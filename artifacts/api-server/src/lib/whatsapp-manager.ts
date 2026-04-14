import { existsSync, readdirSync, rmSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { db, whatsappSessionsTable, messagesTable } from "@workspace/db";
import { eq, and, not } from "drizzle-orm";
import { createHmac } from "crypto";
import { logger } from "./logger.js";
import type { Server as SocketServer } from "socket.io";

const TOKENS_DIR = path.join(process.cwd(), "tokens");

if (!existsSync(TOKENS_DIR)) {
  mkdirSync(TOKENS_DIR, { recursive: true });
}

function resolveChromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cacheBase = "/home/runner/.cache/puppeteer/chrome";
  if (existsSync(cacheBase)) {
    try {
      const versions = readdirSync(cacheBase).sort().reverse();
      for (const ver of versions) {
        const candidate = path.join(cacheBase, ver, "chrome-linux64", "chrome");
        if (existsSync(candidate)) return candidate;
      }
    } catch {}
  }
  return "/home/runner/.cache/puppeteer/chrome/linux-146.0.7680.153/chrome-linux64/chrome";
}

function ensureChrome(): void {
  const chromePath = resolveChromePath();
  if (existsSync(chromePath)) return;
  logger.info("Chrome not found, downloading...");
  execSync("npx --yes puppeteer@24.40.0 browsers install chrome", { stdio: "pipe", timeout: 180_000 });
}

function cleanChromeLocks(sessionId: string): void {
  const dir = path.join(TOKENS_DIR, sessionId);
  for (const name of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    const f = path.join(dir, name);
    try { if (existsSync(f)) rmSync(f, { force: true }); } catch {}
  }
}

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

async function triggerWebhook(
  session: { id: string; webhookUrl: string | null; webhookSecret: string | null; webhookEvents: string | null },
  event: string,
  payload: object
): Promise<void> {
  if (!session.webhookUrl) return;
  const events = JSON.parse(session.webhookEvents || "[]") as string[];
  if (events.length > 0 && !events.includes(event)) return;
  try {
    if (await isPrivateUrl(session.webhookUrl)) return;
  } catch { return; }
  
  const body = JSON.stringify({ event, sessionId: session.id, timestamp: new Date().toISOString(), ...payload });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session.webhookSecret) {
    headers["X-Webhook-Signature"] = "sha256=" + createHmac("sha256", session.webhookSecret).update(body).digest("hex");
  }
  
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      await fetch(session.webhookUrl, { method: "POST", headers, body, signal: ctrl.signal });
      clearTimeout(timer);
      break;
    } catch {}
  }
}

// In-memory map of active sessions
const sessions = new Map<string, any>();

export function getWppSession(sessionId: string): any {
  return sessions.get(sessionId);
}

function mapStatus(status: string): string {
  const statusMap: Record<string, string> = {
    isLogged: "connected",
    notLogged: "notLogged",
    browserClose: "disconnected",
    qrReadSuccess: "connected",
    qrReadFail: "disconnected",
    autocloseCalled: "disconnected",
    desconnectedMobile: "disconnected",
    deleteToken: "disconnected",
    deviceNotConnected: "disconnected",
    serverWssNotConnected: "disconnected",
    noOpenBrowser: "disconnected",
    initBrowser: "connecting",
    openBrowser: "connecting",
    qrReadError: "disconnected",
  };
  return statusMap[status] || "disconnected";
}

export async function createWppSession(sessionId: string, io: SocketServer): Promise<void> {
  try {
    ensureChrome();
    cleanChromeLocks(sessionId);
    
    const CHROME_PATH = resolveChromePath();
    const wppMod = await import("@wppconnect-team/wppconnect");
    const create = (wppMod as any).create ?? (wppMod as any).default?.create;
    if (typeof create !== "function") throw new Error("wppconnect create not loaded");
    
    const client = await create({
      session: sessionId,
      headless: true,
      executablePath: CHROME_PATH,
      devtools: false,
      useChrome: true,
      logQR: false,
      browserArgs: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      puppeteerOptions: { args: ["--no-sandbox"] },
      folderNameToken: TOKENS_DIR,
      catchQR: (base64Qr: string) => {
        io.emit("qr:update", { sessionId, qr: base64Qr });
      },
      statusFind: async (statusSession: string) => {
        const status = mapStatus(statusSession);
        await db.update(whatsappSessionsTable)
          .set({ status, updatedAt: new Date() })
          .where(eq(whatsappSessionsTable.id, sessionId));
        io.emit("session:status", { sessionId, status });
        
        if (status === "connected") {
          try {
            const info = await client.getHostDevice();
            if (info?.phone?.wa_id) {
              await db.update(whatsappSessionsTable)
                .set({ phoneNumber: info.phone.wa_id, updatedAt: new Date() })
                .where(eq(whatsappSessionsTable.id, sessionId));
            }
          } catch {}
        }
      },
    } as any);
    
    sessions.set(sessionId, client);
    
    client.onMessage(async (message: any) => {
      const [session] = await db.select().from(whatsappSessionsTable)
        .where(eq(whatsappSessionsTable.id, sessionId));
      
      await db.insert(messagesTable).values({
        sessionId,
        direction: "inbound",
        fromNumber: message.from || "",
        toNumber: message.to || "",
        messageType: message.type || "text",
        content: message.body || null,
        timestamp: new Date(),
      });
      
      await db.update(whatsappSessionsTable).set({
        totalMessagesReceived: (session?.totalMessagesReceived || 0) + 1,
        updatedAt: new Date(),
      }).where(eq(whatsappSessionsTable.id, sessionId));
      
      io.emit("message:new", { sessionId, message });
      
      if (session) {
        triggerWebhook(session, "message", { message }).catch(() => {});
      }
    });
    
  } catch (err) {
    logger.error({ err }, `Error creating wpp session ${sessionId}`);
    await db.update(whatsappSessionsTable).set({ status: "disconnected", updatedAt: new Date() })
      .where(eq(whatsappSessionsTable.id, sessionId));
    throw err;
  }
}

export async function reconnectOnBoot(io: SocketServer): Promise<void> {
  const activeSessions = await db.select().from(whatsappSessionsTable)
    .where(and(
      eq(whatsappSessionsTable.autoReconnect, true),
      not(eq(whatsappSessionsTable.status, "banned"))
    ));
  
  for (const session of activeSessions) {
    createWppSession(session.id, io).catch(err =>
      logger.error(err, `Failed to reconnect ${session.id}`)
    );
  }
}
