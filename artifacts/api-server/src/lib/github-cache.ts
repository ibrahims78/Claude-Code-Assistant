import fs from "fs";
import path from "path";
import { db, contentChunksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger.js";

const GITHUB_BASE = "https://api.github.com/repos/ibrahims78/claude-howto";
const CACHE_FILE = path.join(process.cwd(), "data", "github-content.json");

const SECTION_MAP: Record<string, { section: string; category: string; titleAr: string }> = {
  "01-slash-commands":    { section: "slash-commands", category: "beginner",     titleAr: "أوامر الشريطة المائلة" },
  "02-memory":            { section: "memory",          category: "intermediate", titleAr: "إدارة الذاكرة" },
  "03-skills":            { section: "skills",          category: "intermediate", titleAr: "المهارات" },
  "04-subagents":         { section: "agents",          category: "advanced",     titleAr: "الوكلاء الفرعيون" },
  "05-mcp":               { section: "mcp",             category: "advanced",     titleAr: "بروتوكول MCP" },
  "06-hooks":             { section: "hooks",           category: "intermediate", titleAr: "نظام Hooks" },
  "07-plugins":           { section: "plugins",         category: "advanced",     titleAr: "الإضافات" },
  "08-checkpoints":       { section: "checkpoints",     category: "intermediate", titleAr: "نقاط التفتيش" },
  "09-advanced-features": { section: "advanced",        category: "advanced",     titleAr: "الميزات المتقدمة" },
  "10-cli":               { section: "cli",             category: "beginner",     titleAr: "واجهة سطر الأوامر" },
  "README.md":            { section: "intro",           category: "beginner",     titleAr: "نظرة عامة" },
  "CATALOG.md":           { section: "catalog",         category: "intermediate", titleAr: "كتالوج الميزات" },
  "CLAUDE.md":            { section: "claude-md",       category: "advanced",     titleAr: "ملف CLAUDE" },
  "INDEX.md":             { section: "index",           category: "beginner",     titleAr: "الفهرس" },
  "LEARNING-ROADMAP.md":  { section: "roadmap",         category: "beginner",     titleAr: "خارطة التعلم" },
  "QUICK_REFERENCE.md":   { section: "quick-ref",       category: "beginner",     titleAr: "المرجع السريع" },
  "STYLE_GUIDE.md":       { section: "style-guide",     category: "intermediate", titleAr: "دليل الأسلوب" },
};

export interface CachedChunk {
  title: string;
  content: string;
  contentAr?: string;
  sourceFile: string;
  orderIndex: number;
}

export interface CachedSection {
  section: string;
  category: string;
  titleAr: string;
  chunks: CachedChunk[];
}

export interface GithubCache {
  fetchedAt: string;
  sections: Record<string, CachedSection>;
}

async function fetchText(url: string): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "claude-education-app",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchJSON(url: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "claude-education-app",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function splitIntoChunks(text: string, fileName: string): CachedChunk[] {
  const cleaned = text.replace(/^---[\s\S]*?---\n/m, "").trim();
  const parts = cleaned.split(/^## /m).filter(p => p.trim());

  if (parts.length > 1) {
    return parts
      .map((part, i) => {
        const lines = part.split("\n");
        const title = lines[0].trim().replace(/^#+\s*/, "");
        const content = lines.slice(1).join("\n").trim();
        return { title: title || fileName, content: content || part.trim(), sourceFile: fileName, orderIndex: i };
      })
      .filter(c => c.content.length > 50);
  }

  const h1Match = cleaned.match(/^# (.+)/m);
  const title = h1Match ? h1Match[1].trim() : fileName.replace(/\.md$/, "").replace(/[-_]/g, " ");
  return [{ title, content: cleaned, sourceFile: fileName, orderIndex: 0 }];
}

export async function fetchFromGithub(): Promise<GithubCache> {
  logger.info("Fetching content from GitHub...");
  const cache: GithubCache = { fetchedAt: new Date().toISOString(), sections: {} };

  const rootItems = await fetchJSON(`${GITHUB_BASE}/contents/`) as Array<{
    name: string; type: string; download_url: string | null;
  }>;

  // Process top-level .md files
  const topMdFiles = rootItems.filter(f => f.type === "file" && f.name.endsWith(".md"));
  for (const file of topMdFiles) {
    const sectionInfo = SECTION_MAP[file.name];
    if (!sectionInfo || !file.download_url) continue;
    try {
      const text = await fetchText(file.download_url);
      const chunks = splitIntoChunks(text, file.name);
      if (!cache.sections[sectionInfo.section]) {
        cache.sections[sectionInfo.section] = { ...sectionInfo, chunks: [] };
      }
      cache.sections[sectionInfo.section].chunks.push(...chunks);
    } catch (e) {
      logger.warn({ file: file.name, err: e }, "Failed to fetch file");
    }
  }

  // Process numbered directories
  const dirs = rootItems.filter(f => f.type === "dir" && /^\d{2}-/.test(f.name));
  for (const dir of dirs) {
    const sectionInfo = SECTION_MAP[dir.name];
    if (!sectionInfo) continue;
    try {
      const dirItems = await fetchJSON(`${GITHUB_BASE}/contents/${dir.name}`);
      const mdFiles = dirItems.filter((f: any) => f.type === "file" && f.name.endsWith(".md"));
      if (!cache.sections[sectionInfo.section]) {
        cache.sections[sectionInfo.section] = { ...sectionInfo, chunks: [] };
      }
      for (const file of mdFiles) {
        if (!file.download_url) continue;
        try {
          const text = await fetchText(file.download_url);
          const chunks = splitIntoChunks(text, `${dir.name}/${file.name}`);
          cache.sections[sectionInfo.section].chunks.push(...chunks);
        } catch (e) {
          logger.warn({ file: file.name, err: e }, "Failed to fetch file");
        }
      }
    } catch (e) {
      logger.warn({ dir: dir.name, err: e }, "Failed to fetch directory");
    }
  }

  return cache;
}

export function saveCacheFile(cache: GithubCache): void {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  logger.info({ file: CACHE_FILE }, "GitHub content cache saved");
}

export function loadCacheFile(): GithubCache | null {
  if (!fs.existsSync(CACHE_FILE)) return null;
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as GithubCache;
  } catch {
    return null;
  }
}

export async function upsertCacheIntoDB(cache: GithubCache): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const [, sectionData] of Object.entries(cache.sections)) {
    for (const chunk of sectionData.chunks) {
      // Check if exists
      const existing = await db
        .select({ id: contentChunksTable.id, contentAr: contentChunksTable.contentAr })
        .from(contentChunksTable)
        .where(
          and(
            eq(contentChunksTable.sourceFile, chunk.sourceFile),
            eq(contentChunksTable.orderIndex, chunk.orderIndex)
          )
        );

      if (existing.length > 0) {
        // Update content_en but preserve existing contentAr if it was translated
        const existingAr = existing[0].contentAr;
        const hasRealAr = existingAr && existingAr !== chunk.content && existingAr.length > 20;
        await db
          .update(contentChunksTable)
          .set({
            title: chunk.title,
            titleAr: chunk.title,
            content: chunk.content,
            contentAr: hasRealAr ? existingAr : chunk.content,
            section: sectionData.section,
            category: sectionData.category,
            updatedAt: new Date(),
          })
          .where(eq(contentChunksTable.id, existing[0].id));
        updated++;
      } else {
        await db.insert(contentChunksTable).values({
          title: chunk.title,
          titleAr: chunk.title,
          content: chunk.content,
          contentAr: chunk.content,
          category: sectionData.category,
          section: sectionData.section,
          sourceFile: chunk.sourceFile,
          orderIndex: chunk.orderIndex,
        });
        inserted++;
      }
    }
  }

  return { inserted, updated };
}

export async function syncFromGithub(): Promise<{ fetchedAt: string; sections: number; chunks: number; inserted: number; updated: number }> {
  const cache = await fetchFromGithub();
  saveCacheFile(cache);
  const { inserted, updated } = await upsertCacheIntoDB(cache);

  const totalChunks = Object.values(cache.sections).reduce((sum, s) => sum + s.chunks.length, 0);

  return {
    fetchedAt: cache.fetchedAt,
    sections: Object.keys(cache.sections).length,
    chunks: totalChunks,
    inserted,
    updated,
  };
}

export async function loadCacheOnStartup(): Promise<void> {
  const existing = loadCacheFile();
  if (existing) {
    logger.info({ fetchedAt: existing.fetchedAt, sections: Object.keys(existing.sections).length }, "Loading GitHub content cache from file");
    try {
      const result = await upsertCacheIntoDB(existing);
      logger.info(result, "GitHub cache loaded into DB");
    } catch (e) {
      logger.error({ err: e }, "Failed to load cache into DB");
    }
  } else {
    logger.info("No GitHub cache file found, fetching from GitHub...");
    try {
      const result = await syncFromGithub();
      logger.info(result, "Initial GitHub content fetch complete");
    } catch (e) {
      logger.error({ err: e }, "Failed to fetch initial GitHub content — continuing with existing DB data");
    }
  }
}
