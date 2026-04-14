import { Router, Request, Response } from "express";
import { db, whatsappSessionsTable, messagesTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, hasPermission } from "../lib/auth.js";
import { validatePhoneNumber, formatNumber } from "../lib/validate.js";
import { writeAuditLog } from "../lib/audit.js";
import { rmSync, existsSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import path from "path";
import type { User, WhatsappSession } from "@workspace/db";

function saveTempFile(dataUrl: string, fallbackExt: string): string | null {
  if (!dataUrl.startsWith("data:")) return null;
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) return null;
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
    "video/mp4": "mp4", "audio/mpeg": "mp3", "audio/ogg": "ogg", "application/pdf": "pdf",
  };
  const ext = extMap[matches[1]] || fallbackExt;
  const filePath = path.join(tmpdir(), `${randomUUID()}.${ext}`);
  writeFileSync(filePath, Buffer.from(matches[2], "base64"));
  return filePath;
}

function cleanupTempFile(filePath: string | null): void {
  try { if (filePath && existsSync(filePath)) unlinkSync(filePath); } catch {}
}

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

// GET /api/sessions/:id/qr — returns QR status (actual QR delivered via Socket.IO)
router.get("/:id/qr", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const sessionId = req.params.id;

  const [session] = await db.select().from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.id, sessionId));

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  if (user.role !== "admin" && session.userId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  res.json({ status: session.status, message: "QR delivered via Socket.IO event: qr_code" });
});

// ── Per-session send routes: POST /api/sessions/:id/send/* ───────────────────

async function getConnectedClient(sessionId: string, user: User, res: Response) {
  const [session] = await db.select().from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.id, sessionId));
  if (!session) { res.status(404).json({ error: "Session not found" }); return null; }
  if (user.role !== "admin" && session.userId !== user.id) { res.status(403).json({ error: "Forbidden" }); return null; }
  const { getWppSession } = await import("../lib/whatsapp-manager.js").catch(() => ({ getWppSession: () => null }));
  const client = getWppSession(sessionId);
  if (!client || session.status !== "connected") { res.status(400).json({ error: "Session not connected" }); return null; }
  return { session, client };
}

router.post("/:id/send/text", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  if (!hasPermission(user, "sendText")) { res.status(403).json({ error: "Permission denied: sendText" }); return; }
  const sessionId = req.params.id;
  const { to, message } = req.body as { to: string; message: string };
  const phoneError = validatePhoneNumber(to);
  if (phoneError) { res.status(400).json({ error: phoneError }); return; }
  const data = await getConnectedClient(sessionId, user, res);
  if (!data) return;
  const { session, client } = data;
  try {
    await client.sendText(formatNumber(to), message);
    await db.insert(messagesTable).values({ sessionId, direction: "outbound", fromNumber: session.phoneNumber || sessionId, toNumber: formatNumber(to), messageType: "text", content: message });
    await db.update(whatsappSessionsTable).set({ totalMessagesSent: sql`${whatsappSessionsTable.totalMessagesSent} + 1`, updatedAt: new Date() }).where(eq(whatsappSessionsTable.id, sessionId));
    await writeAuditLog({ userId: user.id, username: user.username, action: "sendText", sessionId, ipAddress: req.ip });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed to send message" }); }
});

router.post("/:id/send/image", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  if (!hasPermission(user, "sendMedia")) { res.status(403).json({ error: "Permission denied: sendMedia" }); return; }
  const sessionId = req.params.id;
  const { to, image, caption } = req.body as { to: string; image: string; caption?: string };
  const phoneError = validatePhoneNumber(to);
  if (phoneError) { res.status(400).json({ error: phoneError }); return; }
  const data = await getConnectedClient(sessionId, user, res);
  if (!data) return;
  const { session, client } = data;
  let tempPath: string | null = null;
  try {
    if (image.startsWith("data:")) { tempPath = saveTempFile(image, "jpg"); await client.sendImage(formatNumber(to), tempPath!, caption || "", caption || ""); }
    else { await client.sendImage(formatNumber(to), image, caption || "", caption || ""); }
    await db.insert(messagesTable).values({ sessionId, direction: "outbound", fromNumber: session.phoneNumber || sessionId, toNumber: formatNumber(to), messageType: "image", caption });
    await db.update(whatsappSessionsTable).set({ totalMessagesSent: sql`${whatsappSessionsTable.totalMessagesSent} + 1`, updatedAt: new Date() }).where(eq(whatsappSessionsTable.id, sessionId));
    await writeAuditLog({ userId: user.id, username: user.username, action: "sendImage", sessionId, ipAddress: req.ip });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed to send image" }); } finally { cleanupTempFile(tempPath); }
});

router.post("/:id/send/video", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  if (!hasPermission(user, "sendMedia")) { res.status(403).json({ error: "Permission denied: sendMedia" }); return; }
  const sessionId = req.params.id;
  const { to, video, caption } = req.body as { to: string; video: string; caption?: string };
  const phoneError = validatePhoneNumber(to);
  if (phoneError) { res.status(400).json({ error: phoneError }); return; }
  const data = await getConnectedClient(sessionId, user, res);
  if (!data) return;
  const { session, client } = data;
  let tempPath: string | null = null;
  try {
    if (video.startsWith("data:")) { tempPath = saveTempFile(video, "mp4"); await client.sendVideoAsGif(formatNumber(to), tempPath!, caption || "", caption || ""); }
    else { await client.sendVideoAsGif(formatNumber(to), video, caption || "", caption || ""); }
    await db.insert(messagesTable).values({ sessionId, direction: "outbound", fromNumber: session.phoneNumber || sessionId, toNumber: formatNumber(to), messageType: "video", caption });
    await db.update(whatsappSessionsTable).set({ totalMessagesSent: sql`${whatsappSessionsTable.totalMessagesSent} + 1`, updatedAt: new Date() }).where(eq(whatsappSessionsTable.id, sessionId));
    await writeAuditLog({ userId: user.id, username: user.username, action: "sendVideo", sessionId, ipAddress: req.ip });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed to send video" }); } finally { cleanupTempFile(tempPath); }
});

router.post("/:id/send/audio", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  if (!hasPermission(user, "sendMedia")) { res.status(403).json({ error: "Permission denied: sendMedia" }); return; }
  const sessionId = req.params.id;
  const { to, audio } = req.body as { to: string; audio: string };
  const phoneError = validatePhoneNumber(to);
  if (phoneError) { res.status(400).json({ error: phoneError }); return; }
  const data = await getConnectedClient(sessionId, user, res);
  if (!data) return;
  const { session, client } = data;
  let tempPath: string | null = null;
  try {
    if (audio.startsWith("data:")) { tempPath = saveTempFile(audio, "mp3"); await client.sendVoice(formatNumber(to), tempPath!); }
    else { await client.sendVoice(formatNumber(to), audio); }
    await db.insert(messagesTable).values({ sessionId, direction: "outbound", fromNumber: session.phoneNumber || sessionId, toNumber: formatNumber(to), messageType: "audio" });
    await db.update(whatsappSessionsTable).set({ totalMessagesSent: sql`${whatsappSessionsTable.totalMessagesSent} + 1`, updatedAt: new Date() }).where(eq(whatsappSessionsTable.id, sessionId));
    await writeAuditLog({ userId: user.id, username: user.username, action: "sendAudio", sessionId, ipAddress: req.ip });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed to send audio" }); } finally { cleanupTempFile(tempPath); }
});

router.post("/:id/send/file", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  if (!hasPermission(user, "sendMedia")) { res.status(403).json({ error: "Permission denied: sendMedia" }); return; }
  const sessionId = req.params.id;
  const { to, file, filename } = req.body as { to: string; file: string; filename: string };
  const phoneError = validatePhoneNumber(to);
  if (phoneError) { res.status(400).json({ error: phoneError }); return; }
  const data = await getConnectedClient(sessionId, user, res);
  if (!data) return;
  const { session, client } = data;
  let tempPath: string | null = null;
  try {
    if (file.startsWith("data:")) { tempPath = saveTempFile(file, "bin"); await client.sendFile(formatNumber(to), tempPath!, filename || "file", filename || "file"); }
    else { await client.sendFile(formatNumber(to), file, filename || "file", filename || "file"); }
    await db.insert(messagesTable).values({ sessionId, direction: "outbound", fromNumber: session.phoneNumber || sessionId, toNumber: formatNumber(to), messageType: "file", content: filename });
    await db.update(whatsappSessionsTable).set({ totalMessagesSent: sql`${whatsappSessionsTable.totalMessagesSent} + 1`, updatedAt: new Date() }).where(eq(whatsappSessionsTable.id, sessionId));
    await writeAuditLog({ userId: user.id, username: user.username, action: "sendFile", sessionId, ipAddress: req.ip });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed to send file" }); } finally { cleanupTempFile(tempPath); }
});

router.post("/:id/send/location", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  if (!hasPermission(user, "sendLocation")) { res.status(403).json({ error: "Permission denied: sendLocation" }); return; }
  const sessionId = req.params.id;
  const { to, lat, lng, description } = req.body as { to: string; lat: number; lng: number; description?: string };
  const phoneError = validatePhoneNumber(to);
  if (phoneError) { res.status(400).json({ error: phoneError }); return; }
  if (isNaN(lat) || isNaN(lng)) { res.status(400).json({ error: "Invalid coordinates: NaN" }); return; }
  if (!isFinite(lat) || !isFinite(lng)) { res.status(400).json({ error: "Invalid coordinates: Infinity" }); return; }
  if (lat < -90 || lat > 90) { res.status(400).json({ error: "Latitude must be between -90 and 90" }); return; }
  if (lng < -180 || lng > 180) { res.status(400).json({ error: "Longitude must be between -180 and 180" }); return; }
  const data = await getConnectedClient(sessionId, user, res);
  if (!data) return;
  const { session, client } = data;
  try {
    await client.sendLocation(formatNumber(to), lat, lng, description || "");
    await db.insert(messagesTable).values({ sessionId, direction: "outbound", fromNumber: session.phoneNumber || sessionId, toNumber: formatNumber(to), messageType: "location", content: JSON.stringify({ lat, lng, description }) });
    await db.update(whatsappSessionsTable).set({ totalMessagesSent: sql`${whatsappSessionsTable.totalMessagesSent} + 1`, updatedAt: new Date() }).where(eq(whatsappSessionsTable.id, sessionId));
    await writeAuditLog({ userId: user.id, username: user.username, action: "sendLocation", sessionId, ipAddress: req.ip });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed to send location" }); }
});

router.post("/:id/send/sticker", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  if (!hasPermission(user, "sendSticker")) { res.status(403).json({ error: "Permission denied: sendSticker" }); return; }
  const sessionId = req.params.id;
  const { to, sticker } = req.body as { to: string; sticker: string };
  const phoneError = validatePhoneNumber(to);
  if (phoneError) { res.status(400).json({ error: phoneError }); return; }
  const data = await getConnectedClient(sessionId, user, res);
  if (!data) return;
  const { session, client } = data;
  let tempPath: string | null = null;
  try {
    if (sticker.startsWith("data:")) { tempPath = saveTempFile(sticker, "webp"); await client.sendImageAsSticker(formatNumber(to), tempPath!); }
    else { await client.sendImageAsSticker(formatNumber(to), sticker); }
    await db.insert(messagesTable).values({ sessionId, direction: "outbound", fromNumber: session.phoneNumber || sessionId, toNumber: formatNumber(to), messageType: "sticker" });
    await db.update(whatsappSessionsTable).set({ totalMessagesSent: sql`${whatsappSessionsTable.totalMessagesSent} + 1`, updatedAt: new Date() }).where(eq(whatsappSessionsTable.id, sessionId));
    await writeAuditLog({ userId: user.id, username: user.username, action: "sendSticker", sessionId, ipAddress: req.ip });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Failed to send sticker" }); } finally { cleanupTempFile(tempPath); }
});

export default router;
