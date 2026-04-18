import fs from "fs";
import path from "path";
import { db, contentChunksTable, githubFilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger.js";

const GITHUB_BASE = "https://api.github.com/repos/ibrahims78/claude-howto";
const DATA_DIR = path.join(process.cwd(), "data");
const CONTENT_DIR = path.join(DATA_DIR, "content");
const IMAGES_DIR = path.join(DATA_DIR, "images");

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico"]);
const SKIP_DIRS = new Set([".github", ".claude", "scripts", "uk", "vi", "zh"]);

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
  "CHANGELOG.md":         { section: "changelog",       category: "intermediate", titleAr: "سجل التغييرات" },
  "CONTRIBUTING.md":      { section: "contributing",    category: "beginner",     titleAr: "المساهمة" },
  "RELEASE_NOTES.md":     { section: "releases",        category: "intermediate", titleAr: "ملاحظات الإصدار" },
  "SECURITY.md":          { section: "security",        category: "advanced",     titleAr: "الأمان" },
  "CODE_OF_CONDUCT.md":   { section: "conduct",         category: "beginner",     titleAr: "قواعد السلوك" },
  "claude_concepts_guide.md": { section: "concepts",   category: "intermediate", titleAr: "دليل المفاهيم" },
  "clean-code-rules.md":  { section: "clean-code",      category: "intermediate", titleAr: "قواعد الكود النظيف" },
  "resources.md":         { section: "resources-doc",   category: "beginner",     titleAr: "الموارد" },
  "docs":                 { section: "docs",            category: "advanced",     titleAr: "التوثيق" },
  "prompts":              { section: "prompts",         category: "intermediate", titleAr: "النماذج" },
  "slides":               { section: "slides",          category: "beginner",     titleAr: "الشرائح" },
  "assets":               { section: "assets",          category: "beginner",     titleAr: "الأصول" },
  "resources":            { section: "resources-dir",   category: "beginner",     titleAr: "مجلد الموارد" },
};

export interface SyncProgress {
  phase: string;
  filesScanned: number;
  markdownFiles: number;
  imageFiles: number;
  markdownSaved: number;
  imagesSaved: number;
  dbUpdated: number;
  dbInserted: number;
  errors: string[];
  done: boolean;
  startedAt: string;
  finishedAt?: string;
}

let currentSync: SyncProgress | null = null;
let syncRunning = false;

export function getSyncProgress(): SyncProgress | null {
  return currentSync;
}

export function isSyncRunning(): boolean {
  return syncRunning;
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "claude-education-app",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchBinary(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isImageFile(name: string): boolean {
  return IMAGE_EXTS.has(path.extname(name).toLowerCase());
}

function isMarkdownFile(name: string): boolean {
  return name.endsWith(".md");
}

function rewriteImageUrls(content: string, filePath: string): string {
  const fileDir = path.dirname(filePath);

  return content.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, src) => {
      if (src.startsWith("http://") || src.startsWith("https://")) {
        const url = new URL(src);
        if (url.hostname === "github.com" || url.hostname === "raw.githubusercontent.com") {
          const parts = url.pathname.split("/");
          const imagePathParts = parts.slice(
            url.hostname === "raw.githubusercontent.com" ? 4 : 5
          );
          if (imagePathParts.length > 0) {
            const imagePath = imagePathParts.join("/");
            return `![${alt}](/api/static/images/${imagePath})`;
          }
        }
        return match;
      }
      const resolved = src.startsWith("/") ? src.slice(1) : path.join(fileDir, src).replace(/\\/g, "/");
      if (isImageFile(resolved)) {
        return `![${alt}](/api/static/images/${resolved})`;
      }
      return match;
    }
  );
}

interface GithubItem {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  sha?: string;
  download_url?: string | null;
}

async function scanDirectory(dirPath: string, progress: SyncProgress): Promise<GithubItem[]> {
  const url = dirPath
    ? `${GITHUB_BASE}/contents/${dirPath}`
    : `${GITHUB_BASE}/contents/`;

  let items: GithubItem[];
  try {
    items = await fetchJSON(url);
  } catch (e) {
    progress.errors.push(`Failed to scan ${dirPath}: ${e}`);
    return [];
  }

  if (!Array.isArray(items)) return [];

  const allFiles: GithubItem[] = [];

  for (const item of items) {
    progress.filesScanned++;
    if (item.type === "file") {
      if (isMarkdownFile(item.name)) {
        progress.markdownFiles++;
        allFiles.push(item);
      } else if (isImageFile(item.name)) {
        progress.imageFiles++;
        allFiles.push(item);
      }
    } else if (item.type === "dir" && !SKIP_DIRS.has(item.name)) {
      const subFiles = await scanDirectory(item.path, progress);
      allFiles.push(...subFiles);
    }
  }

  return allFiles;
}

function getSectionInfo(filePath: string): { section: string; category: string; titleAr: string } {
  const parts = filePath.split("/");
  const topLevel = parts[0];

  if (SECTION_MAP[filePath]) return SECTION_MAP[filePath];
  if (parts.length === 1 && SECTION_MAP[topLevel]) return SECTION_MAP[topLevel];
  if (parts.length > 1 && SECTION_MAP[topLevel]) return SECTION_MAP[topLevel];

  const baseName = path.basename(filePath);
  if (SECTION_MAP[baseName]) return SECTION_MAP[baseName];

  const dirName = parts[0];
  const match = Object.keys(SECTION_MAP).find(k => dirName.startsWith(k) || k.startsWith(dirName));
  if (match) return SECTION_MAP[match];

  const section = dirName.replace(/^\d{2}-/, "").replace(/[_-]/g, "-");
  return { section, category: "intermediate", titleAr: section };
}

function splitIntoChunks(text: string, filePath: string): Array<{ title: string; content: string; orderIndex: number }> {
  const cleaned = text.replace(/^---[\s\S]*?---\n/m, "").trim();
  const parts = cleaned.split(/^## /m).filter(p => p.trim());

  if (parts.length > 1) {
    return parts
      .map((part, i) => {
        const lines = part.split("\n");
        const title = lines[0].trim().replace(/^#+\s*/, "");
        const content = lines.slice(1).join("\n").trim();
        return { title: title || path.basename(filePath), content: content || part.trim(), orderIndex: i };
      })
      .filter(c => c.content.length > 30);
  }

  const h1Match = cleaned.match(/^# (.+)/m);
  const title = h1Match ? h1Match[1].trim() : path.basename(filePath).replace(/\.md$/, "").replace(/[-_]/g, " ");
  return [{ title, content: cleaned, orderIndex: 0 }];
}

async function saveMarkdownFile(item: GithubItem, progress: SyncProgress): Promise<void> {
  if (!item.download_url) return;

  try {
    const text = await fetchText(item.download_url);
    const rewritten = rewriteImageUrls(text, item.path);

    const localPath = path.join(CONTENT_DIR, item.path);
    ensureDir(path.dirname(localPath));
    fs.writeFileSync(localPath, rewritten, "utf-8");
    progress.markdownSaved++;

    await db
      .insert(githubFilesTable)
      .values({
        path: item.path,
        type: "markdown",
        name: item.name,
        directory: path.dirname(item.path) || "/",
        localPath: `data/content/${item.path}`,
        size: item.size,
        sha: item.sha,
        downloadUrl: item.download_url,
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: githubFilesTable.path,
        set: {
          sha: item.sha,
          size: item.size,
          downloadUrl: item.download_url,
          localPath: `data/content/${item.path}`,
          syncedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    const sectionInfo = getSectionInfo(item.path);
    const chunks = splitIntoChunks(rewritten, item.path);

    for (const chunk of chunks) {
      const existing = await db
        .select({ id: contentChunksTable.id, contentAr: contentChunksTable.contentAr })
        .from(contentChunksTable)
        .where(
          and(
            eq(contentChunksTable.sourceFile, item.path),
            eq(contentChunksTable.orderIndex, chunk.orderIndex)
          )
        );

      if (existing.length > 0) {
        const existingAr = existing[0].contentAr;
        const hasRealAr = existingAr && existingAr !== chunk.content && existingAr.length > 20;
        await db
          .update(contentChunksTable)
          .set({
            title: chunk.title,
            titleAr: chunk.title,
            content: chunk.content,
            contentAr: hasRealAr ? existingAr : chunk.content,
            section: sectionInfo.section,
            category: sectionInfo.category,
            updatedAt: new Date(),
          })
          .where(eq(contentChunksTable.id, existing[0].id));
        progress.dbUpdated++;
      } else {
        await db.insert(contentChunksTable).values({
          title: chunk.title,
          titleAr: chunk.title,
          content: chunk.content,
          contentAr: chunk.content,
          category: sectionInfo.category,
          section: sectionInfo.section,
          sourceFile: item.path,
          orderIndex: chunk.orderIndex,
        });
        progress.dbInserted++;
      }
    }
  } catch (e) {
    progress.errors.push(`Markdown ${item.path}: ${e}`);
    logger.warn({ file: item.path, err: e }, "Failed to process markdown file");
  }
}

async function saveImageFile(item: GithubItem, progress: SyncProgress): Promise<void> {
  if (!item.download_url) return;

  try {
    const imageData = await fetchBinary(item.download_url);
    const localPath = path.join(IMAGES_DIR, item.path);
    ensureDir(path.dirname(localPath));
    fs.writeFileSync(localPath, imageData);
    progress.imagesSaved++;

    await db
      .insert(githubFilesTable)
      .values({
        path: item.path,
        type: "image",
        name: item.name,
        directory: path.dirname(item.path) || "/",
        localPath: `data/images/${item.path}`,
        size: item.size,
        sha: item.sha,
        downloadUrl: item.download_url,
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: githubFilesTable.path,
        set: {
          sha: item.sha,
          size: item.size,
          downloadUrl: item.download_url,
          localPath: `data/images/${item.path}`,
          syncedAt: new Date(),
          updatedAt: new Date(),
        },
      });
  } catch (e) {
    progress.errors.push(`Image ${item.path}: ${e}`);
    logger.warn({ file: item.path, err: e }, "Failed to save image file");
  }
}

export async function runFullGithubSync(): Promise<SyncProgress> {
  if (syncRunning) {
    return currentSync!;
  }

  syncRunning = true;
  currentSync = {
    phase: "scanning",
    filesScanned: 0,
    markdownFiles: 0,
    imageFiles: 0,
    markdownSaved: 0,
    imagesSaved: 0,
    dbUpdated: 0,
    dbInserted: 0,
    errors: [],
    done: false,
    startedAt: new Date().toISOString(),
  };

  const progress = currentSync;

  try {
    ensureDir(CONTENT_DIR);
    ensureDir(IMAGES_DIR);

    logger.info("Starting full GitHub sync...");
    progress.phase = "scanning";

    const allFiles = await scanDirectory("", progress);
    const markdownFiles = allFiles.filter(f => isMarkdownFile(f.name));
    const imageFiles = allFiles.filter(f => isImageFile(f.name));

    logger.info(
      { markdown: markdownFiles.length, images: imageFiles.length },
      "GitHub scan complete"
    );

    progress.phase = "downloading_images";
    for (const img of imageFiles) {
      await saveImageFile(img, progress);
    }

    logger.info({ saved: progress.imagesSaved }, "Images saved");

    progress.phase = "processing_markdown";
    const CONCURRENCY = 3;
    for (let i = 0; i < markdownFiles.length; i += CONCURRENCY) {
      const batch = markdownFiles.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(f => saveMarkdownFile(f, progress)));
    }

    logger.info({ saved: progress.markdownSaved }, "Markdown files saved");

    progress.phase = "done";
    progress.done = true;
    progress.finishedAt = new Date().toISOString();

    logger.info(progress, "Full GitHub sync complete");
  } catch (e) {
    progress.errors.push(`Fatal: ${e}`);
    progress.phase = "error";
    progress.done = true;
    progress.finishedAt = new Date().toISOString();
    logger.error({ err: e }, "GitHub sync failed");
  } finally {
    syncRunning = false;
  }

  return progress;
}

export function getLocalContentPath(filePath: string): string | null {
  const localPath = path.join(CONTENT_DIR, filePath);
  if (fs.existsSync(localPath)) return localPath;
  return null;
}

export function getLocalImagePath(imagePath: string): string | null {
  const localPath = path.join(IMAGES_DIR, imagePath);
  if (fs.existsSync(localPath)) return localPath;
  return null;
}

export function getContentDir(): string { return CONTENT_DIR; }
export function getImagesDir(): string { return IMAGES_DIR; }
