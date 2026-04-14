import { Router, Request, Response } from "express";
import { db, resourcesTable, resourceTranslationsTable, resourceSuggestionsTable } from "@workspace/db";
import { eq, and, ilike, or, sql, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { chatWithClaude } from "../lib/claude.js";
import type { User } from "@workspace/db";

const router = Router();

// GET /api/resources
router.get("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { type, lang, q, featured, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;
  
  let query = db.select().from(resourcesTable).where(eq(resourcesTable.isVisible, true));
  
  const conditions = [eq(resourcesTable.isVisible, true)];
  if (type) conditions.push(eq(resourcesTable.type, type));
  if (lang) conditions.push(eq(resourcesTable.language, lang));
  if (featured === "true") conditions.push(eq(resourcesTable.isFeatured, true));
  if (q) conditions.push(or(
    ilike(resourcesTable.titleEn, `%${q}%`),
    ilike(resourcesTable.titleAr, `%${q}%`),
  )!);
  
  const resources = await db.select().from(resourcesTable)
    .where(and(...conditions))
    .orderBy(desc(resourcesTable.isFeatured), resourcesTable.displayOrder, desc(resourcesTable.createdAt))
    .limit(limitNum)
    .offset(offset);
  
  res.json({ resources, page: pageNum, limit: limitNum });
});

// GET /api/resources/:id
router.get("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, id));
  if (!resource) { res.status(404).json({ error: "Resource not found" }); return; }
  
  await db.update(resourcesTable).set({ viewCount: (resource.viewCount || 0) + 1 })
    .where(eq(resourcesTable.id, id));
  
  res.json(resource);
});

// POST /api/resources/:id/translate
router.post("/:id/translate", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { field, sourceLang, targetLang } = req.body as { field: string; sourceLang: string; targetLang: string };
  
  const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, id));
  if (!resource) { res.status(404).json({ error: "Resource not found" }); return; }
  
  // Check cache
  const [cached] = await db.select().from(resourceTranslationsTable)
    .where(and(
      eq(resourceTranslationsTable.resourceId, id),
      eq(resourceTranslationsTable.field, field),
      eq(resourceTranslationsTable.sourceLang, sourceLang),
      eq(resourceTranslationsTable.targetLang, targetLang),
    ));
  
  if (cached) {
    res.json({ translatedText: cached.translated, fromCache: true });
    return;
  }
  
  // Translate via Claude
  const textToTranslate = field === "title" 
    ? (sourceLang === "en" ? resource.titleEn : resource.titleAr)
    : (sourceLang === "en" ? resource.descriptionEn : resource.descriptionAr);
  
  if (!textToTranslate) {
    res.status(400).json({ error: "No text available for translation" });
    return;
  }
  
  const { content } = await chatWithClaude(
    [{ role: "user", content: `Translate this to ${targetLang === "ar" ? "Arabic" : "English"}: "${textToTranslate}"` }],
    "You are a translator. Provide only the translation without explanation."
  );
  
  await db.insert(resourceTranslationsTable).values({
    resourceId: id,
    field,
    sourceLang,
    targetLang,
    translated: content,
  });
  
  res.json({ translatedText: content, fromCache: false });
});

// POST /api/resources/suggest
router.post("/suggest", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const { url, title, description, type } = req.body as { url: string; title?: string; description?: string; type?: string };
  
  await db.insert(resourceSuggestionsTable).values({
    userId: user.id,
    url,
    title,
    description,
    type,
    status: "pending",
  });
  
  res.status(201).json({ success: true });
});

export default router;
