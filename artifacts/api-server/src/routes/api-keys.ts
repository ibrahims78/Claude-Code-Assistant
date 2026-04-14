import { Router, Request, Response } from "express";
import { db, apiKeysTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { User } from "@workspace/db";

const router = Router();

// GET /api/api-keys
router.get("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  
  let keys;
  if (user.role === "admin") {
    keys = await db.select().from(apiKeysTable);
  } else {
    keys = await db.select().from(apiKeysTable).where(eq(apiKeysTable.userId, user.id));
  }
  
  // Never return keyHash
  res.json(keys.map(k => {
    const { keyHash, ...safe } = k;
    return safe;
  }));
});

// POST /api/api-keys
router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const { name, allowedSessionIds } = req.body as { name: string; allowedSessionIds?: string[] };
  
  const fullKey = randomBytes(32).toString("hex"); // 64 hex chars
  const keyPrefix = fullKey.slice(0, 8);
  const keyHash = bcrypt.hashSync(fullKey, 10);
  
  const [newKey] = await db.insert(apiKeysTable).values({
    userId: user.id,
    name,
    keyHash,
    keyPrefix,
    allowedSessionIds: allowedSessionIds ? JSON.stringify(allowedSessionIds) : null,
  }).returning();
  
  const { keyHash: _, ...safeKey } = newKey;
  
  // plainKey shown ONCE only
  res.status(201).json({ ...safeKey, plainKey: fullKey });
});

// PATCH /api/api-keys/:id
router.patch("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const id = parseInt(req.params.id);
  const { name, allowedSessionIds } = req.body as { name?: string; allowedSessionIds?: string[] | null };
  
  const [key] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, id));
  if (!key) { res.status(404).json({ error: "API key not found" }); return; }
  
  if (user.role !== "admin" && key.userId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  
  const updates: Partial<typeof key> = {};
  if (name !== undefined) updates.name = name;
  if (allowedSessionIds !== undefined) updates.allowedSessionIds = allowedSessionIds ? JSON.stringify(allowedSessionIds) : null;
  
  const [updated] = await db.update(apiKeysTable).set(updates).where(eq(apiKeysTable.id, id)).returning();
  const { keyHash: _, ...safe } = updated;
  res.json(safe);
});

// DELETE /api/api-keys/:id
router.delete("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const id = parseInt(req.params.id);
  
  const [key] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, id));
  if (!key) { res.status(404).json({ error: "API key not found" }); return; }
  
  if (user.role !== "admin" && key.userId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  
  await db.delete(apiKeysTable).where(eq(apiKeysTable.id, id));
  res.json({ success: true });
});

export default router;
