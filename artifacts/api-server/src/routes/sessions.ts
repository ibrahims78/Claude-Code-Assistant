import { Router, Request, Response } from "express";
import { db, whatsappSessionsTable, messagesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, hasPermission } from "../lib/auth.js";
import { writeAuditLog } from "../lib/audit.js";
import { rmSync, existsSync } from "fs";
import path from "path";
import type { User, WhatsappSession } from "@workspace/db";

const router = Router();

const TOKENS_DIR = path.join(process.cwd(), "tokens");

async function isPrivateUrl(urlStr: string): Promise<boolean> {
  try {
    const url = new URL(urlStr);
    const { promises: dnsPromises } = await import("dns");
    const { address } = await dnsPromises.lookup(url.hostname);
    return /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|localhost)/.test(address);
  } catch {
    return false;
  }
}

// GET /api/sessions
router.get("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  
  let sessions: WhatsappSession[];
  if (user.role === "admin") {
    sessions = await db.select().from(whatsappSessionsTable).orderBy(whatsappSessionsTable.createdAt);
  } else {
    sessions = await db.select().from(whatsappSessionsTable)
      .where(eq(whatsappSessionsTable.userId, user.id))
      .orderBy(whatsappSessionsTable.createdAt);
  }
  
  res.json(sessions);
});

// POST /api/sessions
router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  
  if (!hasPermission(user, "createSession")) {
    res.status(403).json({ error: "Permission denied: createSession" });
    return;
  }
  
  if (user.maxSessions !== null && user.maxSessions !== undefined) {
    const count = await db.select().from(whatsappSessionsTable)
      .where(eq(whatsappSessionsTable.userId, user.id));
    if (count.length >= user.maxSessions) {
      res.status(400).json({ error: "Session limit reached" });
      return;
    }
  }
  
  const { name, webhookUrl } = req.body as { name: string; webhookUrl?: string };
  const sessionId = `session_${Date.now()}`;
  
  const [session] = await db.insert(whatsappSessionsTable).values({
    id: sessionId,
    userId: user.id,
    name,
    webhookUrl,
    status: "disconnected",
  }).returning();
  
  await writeAuditLog({
    userId: user.id,
    username: user.username,
    action: "createSession",
    sessionId,
    details: { name },
    ipAddress: req.ip,
  });
  
  res.status(201).json(session);
});

// GET /api/sessions/:id
router.get("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const sessionId = req.params.id;
  
  const [session] = await db.select().from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.id, sessionId));
  
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  
  if (user.role !== "admin" && session.userId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  
  res.json(session);
});

// DELETE /api/sessions/:id
router.delete("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const sessionId = req.params.id;
  
  const [session] = await db.select().from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.id, sessionId));
  
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  
  if (user.role !== "admin" && session.userId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  
  // Try to disconnect if connected
  const { getWppSession } = await import("../lib/whatsapp-manager.js").catch(() => ({ getWppSession: null }));
  if (getWppSession) {
    try {
      const client = getWppSession(sessionId);
      if (client) await client.close();
    } catch {}
  }
  
  // Delete tokens directory
  const tokenDir = path.join(TOKENS_DIR, sessionId);
  if (existsSync(tokenDir)) {
    rmSync(tokenDir, { recursive: true, force: true });
  }
  
  await db.delete(whatsappSessionsTable).where(eq(whatsappSessionsTable.id, sessionId));
  
  await writeAuditLog({
    userId: user.id,
    username: user.username,
    action: "deleteSession",
    sessionId,
    ipAddress: req.ip,
  });
  
  res.json({ success: true });
});

// POST /api/sessions/:id/connect
router.post("/:id/connect", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const sessionId = req.params.id;
  
  if (!hasPermission(user, "connectSession")) {
    res.status(403).json({ error: "Permission denied: connectSession" });
    return;
  }
  
  const [session] = await db.select().from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.id, sessionId));
  
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  
  if (user.role !== "admin" && session.userId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  
  await db.update(whatsappSessionsTable).set({ status: "connecting", updatedAt: new Date() })
    .where(eq(whatsappSessionsTable.id, sessionId));
  
  const { createWppSession } = await import("../lib/whatsapp-manager.js").catch(() => ({ createWppSession: null }));
  const { getIo } = await import("../lib/socket-io.js").catch(() => ({ getIo: null }));
  
  if (createWppSession && getIo) {
    const io = getIo();
    if (io) {
      createWppSession(sessionId, io).catch(async (err: Error) => {
        req.log?.error({ err }, `Failed to create wpp session ${sessionId}`);
        await db.update(whatsappSessionsTable).set({ status: "disconnected", updatedAt: new Date() })
          .where(eq(whatsappSessionsTable.id, sessionId));
      });
    }
  }
  
  await writeAuditLog({
    userId: user.id,
    username: user.username,
    action: "connectSession",
    sessionId,
    ipAddress: req.ip,
  });
  
  res.json({ success: true, status: "connecting" });
});

// POST /api/sessions/:id/disconnect
router.post("/:id/disconnect", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const sessionId = req.params.id;
  
  if (!hasPermission(user, "disconnectSession")) {
    res.status(403).json({ error: "Permission denied: disconnectSession" });
    return;
  }
  
  const { getWppSession } = await import("../lib/whatsapp-manager.js").catch(() => ({ getWppSession: null }));
  if (getWppSession) {
    try {
      const client = getWppSession(sessionId);
      if (client) await client.close();
    } catch {}
  }
  
  await db.update(whatsappSessionsTable).set({
    status: "disconnected",
    autoReconnect: false,
    updatedAt: new Date(),
  }).where(eq(whatsappSessionsTable.id, sessionId));
  
  await writeAuditLog({
    userId: user.id,
    username: user.username,
    action: "disconnectSession",
    sessionId,
    ipAddress: req.ip,
  });
  
  res.json({ success: true });
});

// GET /api/sessions/:id/stats
router.get("/:id/stats", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const sessionId = req.params.id;
  
  const [session] = await db.select().from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.id, sessionId));
  
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  
  if (user.role !== "admin" && session.userId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  
  res.json({
    totalSent: session.totalMessagesSent,
    totalReceived: session.totalMessagesReceived,
    status: session.status,
    phoneNumber: session.phoneNumber,
    name: session.name,
  });
});

// GET /api/sessions/:id/messages
router.get("/:id/messages", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const sessionId = req.params.id;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  
  if (!hasPermission(user, "viewMessages")) {
    res.status(403).json({ error: "Permission denied: viewMessages" });
    return;
  }
  
  const [session] = await db.select().from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.id, sessionId));
  
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  
  if (user.role !== "admin" && session.userId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  
  const messages = await db.select().from(messagesTable)
    .where(eq(messagesTable.sessionId, sessionId))
    .orderBy(desc(messagesTable.timestamp))
    .limit(limit)
    .offset(offset);
  
  res.json(messages);
});

// PATCH /api/sessions/:id/webhook
router.patch("/:id/webhook", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const sessionId = req.params.id;
  
  if (!hasPermission(user, "manageWebhook")) {
    res.status(403).json({ error: "Permission denied: manageWebhook" });
    return;
  }
  
  const { webhookUrl, webhookSecret, webhookEvents } = req.body as {
    webhookUrl: string;
    webhookSecret?: string;
    webhookEvents?: string[];
  };
  
  if (webhookUrl && await isPrivateUrl(webhookUrl)) {
    res.status(400).json({ error: "Webhook URL cannot point to private/local addresses" });
    return;
  }
  
  await db.update(whatsappSessionsTable).set({
    webhookUrl,
    webhookSecret: webhookSecret ?? null,
    webhookEvents: webhookEvents ? JSON.stringify(webhookEvents) : null,
    updatedAt: new Date(),
  }).where(eq(whatsappSessionsTable.id, sessionId));
  
  res.json({ success: true });
});

// PATCH /api/sessions/:id/features
router.patch("/:id/features", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const sessionId = req.params.id;
  
  if (!hasPermission(user, "manageFeatures")) {
    res.status(403).json({ error: "Permission denied: manageFeatures" });
    return;
  }
  
  const { features } = req.body as { features: object };
  
  await db.update(whatsappSessionsTable).set({
    features: JSON.stringify(features),
    updatedAt: new Date(),
  }).where(eq(whatsappSessionsTable.id, sessionId));
  
  res.json({ success: true });
});

export default router;
