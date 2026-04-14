import { Router, Request, Response } from "express";
import { db, contentChunksTable, userProgressTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import type { User } from "@workspace/db";

const router = Router();

// GET /api/content/sections
router.get("/sections", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  
  const chunks = await db.select().from(contentChunksTable).orderBy(contentChunksTable.orderIndex);
  const progress = await db.select().from(userProgressTable)
    .where(eq(userProgressTable.userId, user.id));
  
  const readChunkIds = new Set(progress.map(p => p.chunkId));
  
  // Group by section
  const sectionMap = new Map<string, { totalChunks: number; readChunks: number }>();
  for (const chunk of chunks) {
    const section = chunk.section || "general";
    if (!sectionMap.has(section)) {
      sectionMap.set(section, { totalChunks: 0, readChunks: 0 });
    }
    const entry = sectionMap.get(section)!;
    entry.totalChunks++;
    if (readChunkIds.has(chunk.id)) entry.readChunks++;
  }
  
  const sections = Array.from(sectionMap.entries()).map(([section, data]) => ({
    section,
    totalChunks: data.totalChunks,
    readChunks: data.readChunks,
    progressPercent: data.totalChunks > 0 ? Math.round((data.readChunks / data.totalChunks) * 100) : 0,
  }));
  
  res.json(sections);
});

// GET /api/content/sections/:sectionId
router.get("/sections/:sectionId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const sectionId = req.params.sectionId;
  
  const chunks = await db.select().from(contentChunksTable)
    .where(eq(contentChunksTable.section, sectionId))
    .orderBy(contentChunksTable.orderIndex);
  
  const progress = await db.select().from(userProgressTable)
    .where(eq(userProgressTable.userId, user.id));
  
  const readChunkIds = new Set(progress.map(p => p.chunkId));
  
  res.json(chunks.map(c => ({ ...c, isRead: readChunkIds.has(c.id) })));
});

// GET /api/content/search?q=
router.get("/search", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const q = req.query.q as string;
  if (!q) { res.json([]); return; }
  
  const results = await db.select().from(contentChunksTable)
    .where(or(
      ilike(contentChunksTable.title, `%${q}%`),
      ilike(contentChunksTable.titleAr, `%${q}%`),
      ilike(contentChunksTable.content, `%${q}%`),
      ilike(contentChunksTable.contentAr, `%${q}%`),
    ));
  
  res.json(results);
});

// POST /api/content/progress/:chunkId
router.post("/progress/:chunkId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const chunkId = parseInt(req.params.chunkId);
  
  const [chunk] = await db.select().from(contentChunksTable).where(eq(contentChunksTable.id, chunkId));
  if (!chunk) { res.status(404).json({ error: "Chunk not found" }); return; }
  
  await db.insert(userProgressTable).values({
    userId: user.id,
    chunkId,
    section: chunk.section,
  }).onConflictDoNothing();
  
  res.json({ success: true });
});

// GET /api/content/progress
router.get("/progress", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const progress = await db.select().from(userProgressTable)
    .where(eq(userProgressTable.userId, user.id));
  res.json(progress.map(p => p.chunkId));
});

export default router;
