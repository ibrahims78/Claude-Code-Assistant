import { Router, Request, Response } from "express";
import { db, whatsappSessionsTable, messagesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, hasPermission } from "../lib/auth.js";
import { validatePhoneNumber, formatNumber } from "../lib/validate.js";
import { writeAuditLog } from "../lib/audit.js";
import { getWppSession } from "../lib/whatsapp-manager.js";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import path from "path";
import type { User } from "@workspace/db";

const router = Router();

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
  try {
    if (filePath && existsSync(filePath)) unlinkSync(filePath);
  } catch {}
}

async function getSessionAndClient(sessionId: string, user: User, res: Response) {
  const [session] = await db.select().from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.id, sessionId));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return null;
  }

  if (user.role !== "admin" && session.userId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  const client = getWppSession(sessionId);
  if (!client || session.status !== "connected") {
    res.status(400).json({ error: "Session not connected" });
    return null;
  }

  return { session, client };
}

// POST /api/send/text
router.post("/text", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  if (!hasPermission(user, "sendText")) {
    res.status(403).json({ error: "Permission denied: sendText" });
    return;
  }

  const { sessionId, to, message } = req.body as { sessionId: string; to: string; message: string };
  const phoneError = validatePhoneNumber(to);
  if (phoneError) { res.status(400).json({ error: phoneError }); return; }

  const data = await getSessionAndClient(sessionId, user, res);
  if (!data) return;
  const { session, client } = data;

  try {
    await client.sendText(formatNumber(to), message);
    await db.insert(messagesTable).values({
      sessionId, direction: "outbound", fromNumber: session.phoneNumber || sessionId,
      toNumber: formatNumber(to), messageType: "text", content: message,
    });
    await db.update(whatsappSessionsTable).set({
      totalMessagesSent: sql`${whatsappSessionsTable.totalMessagesSent} + 1`,
      updatedAt: new Date(),
    }).where(eq(whatsappSessionsTable.id, sessionId));
    await writeAuditLog({ userId: user.id, username: user.username, action: "sendText", sessionId, ipAddress: req.ip });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to send message" });
  }
});

// POST /api/send/image
router.post("/image", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  if (!hasPermission(user, "sendMedia")) { res.status(403).json({ error: "Permission denied: sendMedia" }); return; }

  const { sessionId, to, image, caption } = req.body as { sessionId: string; to: string; image: string; caption?: string };
  const phoneError = validatePhoneNumber(to);
  if (phoneError) { res.status(400).json({ error: phoneError }); return; }

  const data = await getSessionAndClient(sessionId, user, res);
  if (!data) return;
  const { session, client } = data;

  let tempPath: string | null = null;
  try {
    if (image.startsWith("data:")) {
      tempPath = saveTempFile(image, "jpg");
      await client.sendImage(formatNumber(to), tempPath!, caption || "", caption || "");
    } else {
      await client.sendImage(formatNumber(to), image, caption || "", caption || "");
    }
    await db.insert(messagesTable).values({
      sessionId, direction: "outbound", fromNumber: session.phoneNumber || sessionId,
      toNumber: formatNumber(to), messageType: "image", caption,
    });
    await db.update(whatsappSessionsTable).set({
      totalMessagesSent: sql`${whatsappSessionsTable.totalMessagesSent} + 1`, updatedAt: new Date(),
    }).where(eq(whatsappSessionsTable.id, sessionId));
    await writeAuditLog({ userId: user.id, username: user.username, action: "sendImage", sessionId, ipAddress: req.ip });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to send image" });
  } finally {
    cleanupTempFile(tempPath);
  }
});

// POST /api/send/video
router.post("/video", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  if (!hasPermission(user, "sendMedia")) { res.status(403).json({ error: "Permission denied: sendMedia" }); return; }

  const { sessionId, to, video, caption } = req.body as { sessionId: string; to: string; video: string; caption?: string };
  const phoneError = validatePhoneNumber(to);
  if (phoneError) { res.status(400).json({ error: phoneError }); return; }

  const data = await getSessionAndClient(sessionId, user, res);
  if (!data) return;
  const { session, client } = data;

  let tempPath: string | null = null;
  try {
    if (video.startsWith("data:")) {
      tempPath = saveTempFile(video, "mp4");
      await client.sendVideoAsGif(formatNumber(to), tempPath!, caption || "", caption || "");
    } else {
      await client.sendVideoAsGif(formatNumber(to), video, caption || "", caption || "");
    }
    await db.insert(messagesTable).values({
      sessionId, direction: "outbound", fromNumber: session.phoneNumber || sessionId,
      toNumber: formatNumber(to), messageType: "video", caption,
    });
    await db.update(whatsappSessionsTable).set({
      totalMessagesSent: sql`${whatsappSessionsTable.totalMessagesSent} + 1`, updatedAt: new Date(),
    }).where(eq(whatsappSessionsTable.id, sessionId));
    await writeAuditLog({ userId: user.id, username: user.username, action: "sendVideo", sessionId, ipAddress: req.ip });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to send video" });
  } finally {
    cleanupTempFile(tempPath);
  }
});

// POST /api/send/audio
router.post("/audio", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  if (!hasPermission(user, "sendMedia")) { res.status(403).json({ error: "Permission denied: sendMedia" }); return; }

  const { sessionId, to, audio } = req.body as { sessionId: string; to: string; audio: string };
  const phoneError = validatePhoneNumber(to);
  if (phoneError) { res.status(400).json({ error: phoneError }); return; }

  const data = await getSessionAndClient(sessionId, user, res);
  if (!data) return;
  const { session, client } = data;

  let tempPath: string | null = null;
  try {
    if (audio.startsWith("data:")) {
      tempPath = saveTempFile(audio, "mp3");
      await client.sendVoice(formatNumber(to), tempPath!);
    } else {
      await client.sendVoice(formatNumber(to), audio);
    }
    await db.insert(messagesTable).values({
      sessionId, direction: "outbound", fromNumber: session.phoneNumber || sessionId,
      toNumber: formatNumber(to), messageType: "audio",
    });
    await db.update(whatsappSessionsTable).set({
      totalMessagesSent: sql`${whatsappSessionsTable.totalMessagesSent} + 1`, updatedAt: new Date(),
    }).where(eq(whatsappSessionsTable.id, sessionId));
    await writeAuditLog({ userId: user.id, username: user.username, action: "sendAudio", sessionId, ipAddress: req.ip });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to send audio" });
  } finally {
    cleanupTempFile(tempPath);
  }
});

// POST /api/send/file
router.post("/file", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  if (!hasPermission(user, "sendMedia")) { res.status(403).json({ error: "Permission denied: sendMedia" }); return; }

  const { sessionId, to, file, filename } = req.body as { sessionId: string; to: string; file: string; filename: string };
  const phoneError = validatePhoneNumber(to);
  if (phoneError) { res.status(400).json({ error: phoneError }); return; }

  const data = await getSessionAndClient(sessionId, user, res);
  if (!data) return;
  const { session, client } = data;

  let tempPath: string | null = null;
  try {
    if (file.startsWith("data:")) {
      tempPath = saveTempFile(file, "bin");
      await client.sendFile(formatNumber(to), tempPath!, filename || "file", filename || "file");
    } else {
      await client.sendFile(formatNumber(to), file, filename || "file", filename || "file");
    }
    await db.insert(messagesTable).values({
      sessionId, direction: "outbound", fromNumber: session.phoneNumber || sessionId,
      toNumber: formatNumber(to), messageType: "file", content: filename,
    });
    await db.update(whatsappSessionsTable).set({
      totalMessagesSent: sql`${whatsappSessionsTable.totalMessagesSent} + 1`, updatedAt: new Date(),
    }).where(eq(whatsappSessionsTable.id, sessionId));
    await writeAuditLog({ userId: user.id, username: user.username, action: "sendFile", sessionId, ipAddress: req.ip });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to send file" });
  } finally {
    cleanupTempFile(tempPath);
  }
});

// POST /api/send/location
router.post("/location", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  if (!hasPermission(user, "sendLocation")) { res.status(403).json({ error: "Permission denied: sendLocation" }); return; }

  const { sessionId, to, lat, lng, description } = req.body as { sessionId: string; to: string; lat: number; lng: number; description?: string };
  const phoneError = validatePhoneNumber(to);
  if (phoneError) { res.status(400).json({ error: phoneError }); return; }

  if (isNaN(lat) || isNaN(lng)) { res.status(400).json({ error: "Invalid coordinates: NaN" }); return; }
  if (!isFinite(lat) || !isFinite(lng)) { res.status(400).json({ error: "Invalid coordinates: Infinity" }); return; }
  if (lat < -90 || lat > 90) { res.status(400).json({ error: "Latitude must be between -90 and 90" }); return; }
  if (lng < -180 || lng > 180) { res.status(400).json({ error: "Longitude must be between -180 and 180" }); return; }

  const data = await getSessionAndClient(sessionId, user, res);
  if (!data) return;
  const { session, client } = data;

  try {
    await client.sendLocation(formatNumber(to), lat, lng, description || "");
    await db.insert(messagesTable).values({
      sessionId, direction: "outbound", fromNumber: session.phoneNumber || sessionId,
      toNumber: formatNumber(to), messageType: "location", content: JSON.stringify({ lat, lng, description }),
    });
    await db.update(whatsappSessionsTable).set({
      totalMessagesSent: sql`${whatsappSessionsTable.totalMessagesSent} + 1`, updatedAt: new Date(),
    }).where(eq(whatsappSessionsTable.id, sessionId));
    await writeAuditLog({ userId: user.id, username: user.username, action: "sendLocation", sessionId, ipAddress: req.ip });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to send location" });
  }
});

// POST /api/send/sticker
router.post("/sticker", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  if (!hasPermission(user, "sendSticker")) { res.status(403).json({ error: "Permission denied: sendSticker" }); return; }

  const { sessionId, to, sticker } = req.body as { sessionId: string; to: string; sticker: string };
  const phoneError = validatePhoneNumber(to);
  if (phoneError) { res.status(400).json({ error: phoneError }); return; }

  const data = await getSessionAndClient(sessionId, user, res);
  if (!data) return;
  const { session, client } = data;

  let tempPath: string | null = null;
  try {
    if (sticker.startsWith("data:")) {
      tempPath = saveTempFile(sticker, "webp");
      await client.sendImageAsSticker(formatNumber(to), tempPath!);
    } else {
      await client.sendImageAsSticker(formatNumber(to), sticker);
    }
    await db.insert(messagesTable).values({
      sessionId, direction: "outbound", fromNumber: session.phoneNumber || sessionId,
      toNumber: formatNumber(to), messageType: "sticker",
    });
    await db.update(whatsappSessionsTable).set({
      totalMessagesSent: sql`${whatsappSessionsTable.totalMessagesSent} + 1`, updatedAt: new Date(),
    }).where(eq(whatsappSessionsTable.id, sessionId));
    await writeAuditLog({ userId: user.id, username: user.username, action: "sendSticker", sessionId, ipAddress: req.ip });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to send sticker" });
  } finally {
    cleanupTempFile(tempPath);
  }
});

export { saveTempFile, cleanupTempFile };
export default router;
