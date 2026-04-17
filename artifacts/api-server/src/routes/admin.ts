import { Router, Request, Response } from "express";
import {
  db, usersTable, conversationsTable, chatMessagesTable,
  contentChunksTable, resourcesTable, resourceSuggestionsTable,
  settingsTable, telegramUsersTable, auditLogsTable,
} from "@workspace/db";
import { eq, sql, count, and, ne, isNull, or } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { getSettingValue, setSettingValue } from "../lib/settings.js";
import { generateEmbedding, chatWithClaude } from "../lib/claude.js";
import { testAIKey } from "../lib/ai.js";
import type { User } from "@workspace/db";

const router = Router();
router.use(requireAuth, requireAdmin);

// GET /api/admin/dashboard
router.get("/dashboard", async (req: Request, res: Response): Promise<void> => {
  const [totalUsers] = await db.select({ count: count() }).from(usersTable);
  const [activeUsers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.isActive, true));
  const [totalConversations] = await db.select({ count: count() }).from(conversationsTable);
  const [totalMessages] = await db.select({ count: count() }).from(chatMessagesTable);
  const [totalChunks] = await db.select({ count: count() }).from(contentChunksTable);
  const chunksWithEmbeddings = await db.execute(
    sql`SELECT COUNT(*) as count FROM content_chunks WHERE embedding IS NOT NULL`
  );
  const importLastRun = await getSettingValue("import_last_run");
  const [telegramUsers] = await db.select({ count: count() }).from(telegramUsersTable);
  const telegramToday = await db.execute(
    sql`SELECT COALESCE(SUM(daily_count), 0) as total FROM telegram_users WHERE last_reset = CURRENT_DATE`
  );
  
  res.json({
    totalUsers: totalUsers.count,
    activeUsers: activeUsers.count,
    totalConversations: totalConversations.count,
    totalMessages: totalMessages.count,
    totalChunks: totalChunks.count,
    chunksWithEmbeddings: parseInt((chunksWithEmbeddings.rows[0] as { count: string }).count),
    importLastRun,
    telegramUsers: telegramUsers.count,
    telegramMessagesToday: parseInt((telegramToday.rows[0] as { total: string }).total),
  });
});

// GET /api/admin/settings
router.get("/settings", async (_req: Request, res: Response): Promise<void> => {
  const settings = await db.select().from(settingsTable);
  const result: Record<string, string | null> = {};
  for (const s of settings) result[s.key] = s.value;
  res.json(result);
});

// PUT /api/admin/settings — bulk update { key: value, ... }
router.put("/settings", async (req: Request, res: Response): Promise<void> => {
  const updates = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(updates)) {
    await setSettingValue(key, value);
  }
  res.json({ success: true });
});

// PATCH /api/admin/settings — single update { key, value }
router.patch("/settings", async (req: Request, res: Response): Promise<void> => {
  const { key, value } = req.body as { key: string; value: string };
  if (!key) { res.status(400).json({ error: "key is required" }); return; }
  await setSettingValue(key, value ?? "");
  res.json({ success: true });
});

// POST /api/admin/settings/test-ai — validate API key for a provider
router.post("/settings/test-ai", async (req: Request, res: Response): Promise<void> => {
  const { provider, apiKey } = req.body as { provider: string; apiKey: string };
  if (!provider || !apiKey) {
    res.status(400).json({ ok: false, error: "provider and apiKey are required" });
    return;
  }
  const result = await testAIKey(provider, apiKey);
  res.json(result);
});

// Import job state
let importJobRunning = false;
let importJobProgress = { imported: 0, updated: 0, total: 0, done: false, error: "" };

async function runImportJob(): Promise<void> {
  importJobRunning = true;
  importJobProgress = { imported: 0, updated: 0, total: 0, done: false, error: "" };

  try {
    const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;

    const listRes = await fetch("https://api.github.com/repos/ibrahims78/claude-howto/contents/", { headers });
    if (!listRes.ok) throw new Error("Failed to fetch GitHub content");

    const files = await listRes.json() as Array<{ name: string; download_url: string }>;
    const mdFiles = files.filter(f => f.name.endsWith(".md"));

    type ChunkItem = { file: string; section: string; index: number; title: string; content: string };
    const allChunks: ChunkItem[] = [];

    for (const file of mdFiles) {
      const contentRes = await fetch(file.download_url, { headers });
      const text = await contentRes.text();
      const chunks = text.split(/^## /m).filter(c => c.trim());
      for (let i = 0; i < chunks.length; i++) {
        const lines = chunks[i].split("\n");
        const title = lines[0].trim();
        const content = lines.slice(1).join("\n").trim();
        if (!title || !content) continue;
        allChunks.push({ file: file.name, section: file.name.replace(".md", ""), index: i, title, content });
      }
    }

    importJobProgress.total = allChunks.length;

    // Process in parallel batches of 5
    const BATCH_SIZE = 5;
    for (let b = 0; b < allChunks.length; b += BATCH_SIZE) {
      const batch = allChunks.slice(b, b + BATCH_SIZE);
      await Promise.all(batch.map(async ({ file, section, index, title, content }) => {
        let titleAr = title, contentAr = content;
        try {
          const [arTitleRes, arContentRes] = await Promise.all([
            chatWithClaude(
              [{ role: "user", content: `Translate to Arabic: "${title}"` }],
              "You are a translator. Provide only the Arabic translation."
            ),
            chatWithClaude(
              [{ role: "user", content: `Translate to Arabic:\n${content.slice(0, 1000)}` }],
              "You are a translator. Provide only the Arabic translation."
            ),
          ]);
          titleAr = arTitleRes.content.replace(/^["'"']+|["'"']+$/g, "").trim();
          contentAr = arContentRes.content.replace(/^["'"']+|["'"']+$/g, "").trim();
        } catch {}

        const embedding = await generateEmbedding(content);

        const existing = await db.execute(
          sql`SELECT id FROM content_chunks WHERE source_file = ${file} AND order_index = ${index}`
        );

        if (existing.rows.length > 0) {
          await db.execute(
            sql`UPDATE content_chunks SET title=${title}, title_ar=${titleAr}, content=${content}, content_ar=${contentAr}, embedding=${JSON.stringify(embedding)}::vector, updated_at=NOW() WHERE source_file=${file} AND order_index=${index}`
          );
          importJobProgress.updated++;
        } else {
          await db.insert(contentChunksTable).values({
            title, titleAr, content, contentAr,
            category: "intermediate",
            section,
            sourceFile: file,
            orderIndex: index,
            embedding,
          });
          importJobProgress.imported++;
        }
      }));
    }

    await setSettingValue("import_last_run", new Date().toISOString());
    importJobProgress.done = true;
  } catch (err) {
    importJobProgress.error = String(err);
    importJobProgress.done = true;
  } finally {
    importJobRunning = false;
  }
}

// POST /api/admin/import — start background import from GitHub
router.post("/import", async (req: Request, res: Response): Promise<void> => {
  if (importJobRunning) {
    res.json({ status: "running", progress: importJobProgress });
    return;
  }
  // Fire and forget
  runImportJob().catch(() => {});
  res.json({ status: "started", message: "Import started in background" });
});

// GET /api/admin/import/status — check import progress
router.get("/import/status", async (_req: Request, res: Response): Promise<void> => {
  res.json({
    running: importJobRunning,
    ...importJobProgress,
  });
});

// POST /api/admin/translate — translate untranslated content chunks to Arabic
router.post("/translate", async (req: Request, res: Response): Promise<void> => {
  try {
    const batchSize = 5;
    const limit = parseInt((req.query.limit as string) || "50");

    const untranslated = await db.execute(
      sql`SELECT id, title, content FROM content_chunks 
          WHERE content_ar = content OR content_ar IS NULL 
          ORDER BY order_index 
          LIMIT ${limit}`
    ) as { rows: Array<{ id: number; title: string; content: string }> };

    if (untranslated.rows.length === 0) {
      res.json({ translated: 0, message: "جميع المحتوى مترجم بالفعل" });
      return;
    }

    let translated = 0;
    let failed = 0;

    for (let i = 0; i < untranslated.rows.length; i += batchSize) {
      const batch = untranslated.rows.slice(i, i + batchSize);
      const items = batch.map((c, idx) =>
        `[${idx + 1}] العنوان: ${c.title}\nالمحتوى:\n${c.content.slice(0, 1500)}`
      ).join("\n\n---\n\n");

      try {
        const { content: response } = await chatWithClaude(
          [{
            role: "user",
            content: `ترجم النصوص التالية إلى العربية بشكل احترافي. لكل عنصر استخدم التنسيق:
[رقم]
العنوان: <ترجمة>
المحتوى:
<ترجمة المحتوى مع الحفاظ على Markdown>
===

النصوص:
${items}`,
          }],
          "أنت مترجم محترف للمحتوى التقني إلى العربية. احتفظ بصياغة Markdown والأوامر البرمجية."
        );

        for (let j = 0; j < batch.length; j++) {
          const pattern = new RegExp(
            `\\[${j + 1}\\][\\s\\S]*?العنوان:\\s*(.+?)\\nالمحتوى:\\s*\\n([\\s\\S]*?)(?=\\[${j + 2}\\]|===|$)`,
            "i"
          );
          const match = response.match(pattern);
          if (match) {
            await db.execute(
              sql`UPDATE content_chunks SET title_ar=${match[1].trim()}, content_ar=${match[2].replace(/===\s*$/, "").trim()}, updated_at=NOW() WHERE id=${batch[j].id}`
            );
            translated++;
          } else {
            failed++;
          }
        }
      } catch {
        failed += batch.length;
      }
    }

    const remaining = await db.execute(
      sql`SELECT COUNT(*) as count FROM content_chunks WHERE content_ar = content OR content_ar IS NULL`
    ) as { rows: Array<{ count: string }> };

    res.json({
      translated,
      failed,
      remaining: parseInt(remaining.rows[0].count),
      message: `تمت ترجمة ${translated} قطعة`,
    });
  } catch (err) {
    res.status(500).json({ error: "Translation failed", details: String(err) });
  }
});

// GET /api/admin/resources
router.get("/resources", async (_req: Request, res: Response): Promise<void> => {
  const resources = await db.select().from(resourcesTable).orderBy(resourcesTable.displayOrder);
  res.json(resources);
});

// POST /api/admin/resources
router.post("/resources", async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const data = req.body as Record<string, unknown>;
  const embedding = await generateEmbedding((data.titleEn as string) || "");
  const [resource] = await db.insert(resourcesTable).values({
    ...data,
    embedding,
    addedBy: user.id,
    isApproved: true,
  } as any).returning();
  res.status(201).json(resource);
});

// PUT /api/admin/resources/:id
router.put("/resources/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(resourcesTable).set({ ...req.body, updatedAt: new Date() })
    .where(eq(resourcesTable.id, id)).returning();
  res.json(updated);
});

// PUT /api/admin/resources/:id/toggle-visibility
router.put("/resources/:id/toggle-visibility", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, id));
  const [updated] = await db.update(resourcesTable).set({ isVisible: !resource.isVisible, updatedAt: new Date() })
    .where(eq(resourcesTable.id, id)).returning();
  res.json(updated);
});

// PUT /api/admin/resources/:id/toggle-featured
router.put("/resources/:id/toggle-featured", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, id));
  const [updated] = await db.update(resourcesTable).set({ isFeatured: !resource.isFeatured, updatedAt: new Date() })
    .where(eq(resourcesTable.id, id)).returning();
  res.json(updated);
});

// DELETE /api/admin/resources/:id
router.delete("/resources/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(resourcesTable).where(eq(resourcesTable.id, id));
  res.json({ success: true });
});

// GET /api/admin/resources/suggestions
router.get("/resources/suggestions", async (_req: Request, res: Response): Promise<void> => {
  const suggestions = await db.select().from(resourceSuggestionsTable).orderBy(resourceSuggestionsTable.createdAt);
  res.json(suggestions);
});

// PUT /api/admin/resources/suggestions/:id
router.put("/resources/suggestions/:id", async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const id = parseInt(req.params.id);
  const { status, adminNote } = req.body as { status: string; adminNote?: string };
  
  const [updated] = await db.update(resourceSuggestionsTable).set({
    status,
    adminNote,
    reviewedBy: user.id,
    reviewedAt: new Date(),
  }).where(eq(resourceSuggestionsTable.id, id)).returning();
  
  if (status === "approved") {
    const [suggestion] = await db.select().from(resourceSuggestionsTable).where(eq(resourceSuggestionsTable.id, id));
    if (suggestion) {
      await db.insert(resourcesTable).values({
        titleEn: suggestion.title || suggestion.url,
        url: suggestion.url,
        type: suggestion.type || "article",
        addedBy: user.id,
        isApproved: true,
      } as any);
    }
  }
  
  res.json(updated);
});

// Telegram admin routes
router.get("/telegram/users", async (_req: Request, res: Response): Promise<void> => {
  const users = await db.select().from(telegramUsersTable).orderBy(sql`last_active DESC`);
  res.json(users);
});

router.put("/telegram/users/:id/block", async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const id = parseInt(req.params.id);
  const { isBlocked } = req.body as { isBlocked: boolean };
  const [updated] = await db.update(telegramUsersTable).set({ isBlocked })
    .where(eq(telegramUsersTable.id, id)).returning();
  res.json(updated);
});

router.get("/telegram/stats", async (_req: Request, res: Response): Promise<void> => {
  const [total] = await db.select({ count: count() }).from(telegramUsersTable);
  const activeToday = await db.execute(
    sql`SELECT COUNT(*) as count FROM telegram_users WHERE last_active >= CURRENT_DATE`
  );
  const messagesToday = await db.execute(
    sql`SELECT COALESCE(SUM(daily_count), 0) as total FROM telegram_users WHERE last_reset = CURRENT_DATE`
  );
  res.json({
    totalUsers: total.count,
    activeToday: parseInt((activeToday.rows[0] as { count: string }).count),
    messagesToday: parseInt((messagesToday.rows[0] as { total: string }).total),
  });
});

// GET /api/admin/audit-logs
router.get("/audit-logs", async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;
  
  const total = await db.execute(sql`SELECT COUNT(*) as count FROM audit_logs`);
  const logs = await db.select().from(auditLogsTable)
    .orderBy(sql`timestamp DESC`)
    .limit(limit)
    .offset(offset);
  
  const totalCount = parseInt((total.rows[0] as { count: string }).count);
  res.json({ logs, total: totalCount, page, totalPages: Math.ceil(totalCount / limit) });
});

// GET /api/admin/content
router.get("/content", async (_req: Request, res: Response): Promise<void> => {
  const chunks = await db.select().from(contentChunksTable).orderBy(contentChunksTable.orderIndex);
  res.json(chunks);
});

// PUT /api/admin/content/:id
router.put("/content/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { titleAr, contentAr } = req.body as { titleAr?: string; contentAr?: string };
  const [updated] = await db.update(contentChunksTable)
    .set({ titleAr, contentAr, updatedAt: new Date() })
    .where(eq(contentChunksTable.id, id)).returning();
  res.json(updated);
});

// DELETE /api/admin/content/:id
router.delete("/content/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(contentChunksTable).where(eq(contentChunksTable.id, id));
  res.json({ success: true });
});

// POST /api/admin/resources/import-url
router.post("/resources/import-url", async (req: Request, res: Response): Promise<void> => {
  const { url, title, description, type, category } = req.body as {
    url: string; title: string; description?: string; type?: string; category?: string;
  };
  if (!url || !title) { res.status(400).json({ error: "url and title are required" }); return; }
  try {
    const [resource] = await db.insert(resourcesTable).values({
      url, title, description, type: type || "link", category: category || "general",
      isVisible: true, isFeatured: false,
    }).returning();
    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ error: "Failed to import resource" });
  }
});

export default router;
