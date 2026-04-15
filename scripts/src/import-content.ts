import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const GITHUB_BASE = "https://api.github.com/repos/ibrahims78/claude-howto";
const HEADERS: Record<string, string> = {
  Accept: "application/vnd.github.v3+json",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
};

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
  "CATALOG.md":           { section: "CATALOG",         category: "intermediate", titleAr: "كتالوج الميزات" },
  "CLAUDE.md":            { section: "CLAUDE",          category: "advanced",     titleAr: "ملف CLAUDE" },
  "INDEX.md":             { section: "INDEX",           category: "beginner",     titleAr: "الفهرس" },
  "LEARNING-ROADMAP.md":  { section: "LEARNING-ROADMAP",category: "beginner",    titleAr: "خارطة التعلم" },
  "QUICK_REFERENCE.md":   { section: "QUICK_REFERENCE", category: "beginner",    titleAr: "المرجع السريع" },
  "STYLE_GUIDE.md":       { section: "STYLE_GUIDE",     category: "intermediate", titleAr: "دليل الأسلوب" },
  "CONTRIBUTING.md":      { section: "CONTRIBUTING",    category: "intermediate", titleAr: "المساهمة في المشروع" },
  "CHANGELOG.md":         { section: "CHANGELOG",       category: "general",      titleAr: "سجل التغييرات" },
  "RELEASE_NOTES.md":     { section: "RELEASE_NOTES",   category: "general",      titleAr: "ملاحظات الإصدار" },
  "SECURITY.md":          { section: "SECURITY",         category: "intermediate", titleAr: "سياسة الأمان" },
  "CODE_OF_CONDUCT.md":   { section: "CODE_OF_CONDUCT", category: "intermediate", titleAr: "قواعد السلوك" },
  "claude_concepts_guide.md": { section: "claude_concepts_guide", category: "intermediate", titleAr: "دليل مفاهيم Claude" },
  "clean-code-rules.md":  { section: "clean-code-rules", category: "intermediate", titleAr: "قواعد الكود النظيف" },
};

async function fetchJSON(url: string) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function splitIntoChunks(text: string, fileName: string): Array<{ title: string; content: string; orderIndex: number }> {
  const cleaned = text.replace(/^---[\s\S]*?---\n/m, "").trim();
  const parts = cleaned.split(/^## /m).filter(p => p.trim());

  if (parts.length > 1) {
    return parts.map((part, i) => {
      const lines = part.split("\n");
      const title = lines[0].trim().replace(/^#+\s*/, "");
      const content = lines.slice(1).join("\n").trim();
      return { title: title || fileName, content: content || part.trim(), orderIndex: i };
    }).filter(c => c.content.length > 50);
  }

  const h1Match = cleaned.match(/^# (.+)/m);
  const title = h1Match ? h1Match[1].trim() : fileName.replace(/\.md$/, "").replace(/[-_]/g, " ");
  return [{ title, content: cleaned, orderIndex: 0 }];
}

async function importFile(
  downloadUrl: string,
  fileName: string,
  sectionInfo: { section: string; category: string; titleAr: string },
  stats: { imported: number; updated: number; skipped: number }
) {
  let text: string;
  try {
    text = await fetchText(downloadUrl);
  } catch (e) {
    console.warn(`  ⚠️  Failed to fetch ${fileName}: ${e}`);
    return;
  }

  const chunks = splitIntoChunks(text, fileName);
  if (chunks.length === 0) { stats.skipped++; return; }

  for (const chunk of chunks) {
    if (!chunk.content || chunk.content.length < 30) continue;

    const existing = await pool.query(
      `SELECT id FROM content_chunks WHERE source_file = $1 AND order_index = $2`,
      [fileName, chunk.orderIndex]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE content_chunks SET title=$1, content=$2, section=$3, category=$4, updated_at=NOW() WHERE source_file=$5 AND order_index=$6`,
        [chunk.title, chunk.content, sectionInfo.section, sectionInfo.category, fileName, chunk.orderIndex]
      );
      stats.updated++;
    } else {
      await pool.query(
        `INSERT INTO content_chunks (title, title_ar, content, content_ar, category, section, source_file, order_index)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [chunk.title, sectionInfo.titleAr, chunk.content, chunk.content, sectionInfo.category, sectionInfo.section, fileName, chunk.orderIndex]
      );
      stats.imported++;
    }
  }
}

async function main() {
  console.log("📥 Starting full content import from GitHub...\n");
  const stats = { imported: 0, updated: 0, skipped: 0 };

  const deleted = await pool.query(`DELETE FROM content_chunks WHERE length(content) < 300`);
  console.log(`🗑️  Removed ${deleted.rowCount} placeholder chunks\n`);

  const rootItems = await fetchJSON(`${GITHUB_BASE}/contents/`) as Array<{
    name: string; type: string; download_url: string | null;
  }>;

  const topMdFiles = rootItems.filter((f: any) => f.type === "file" && f.name.endsWith(".md"));
  console.log(`📄 Processing ${topMdFiles.length} top-level markdown files`);
  for (const file of topMdFiles) {
    const sectionInfo = SECTION_MAP[file.name];
    if (!sectionInfo || !file.download_url) { stats.skipped++; continue; }
    console.log(`  → ${file.name} (${sectionInfo.section})`);
    await importFile(file.download_url, file.name, sectionInfo, stats);
  }

  const dirs = rootItems.filter((f: any) => f.type === "dir" && /^\d{2}-/.test(f.name));
  console.log(`\n📁 Processing ${dirs.length} content directories`);

  for (const dir of dirs) {
    const sectionInfo = SECTION_MAP[dir.name];
    if (!sectionInfo) { console.warn(`  ⚠️  No mapping for: ${dir.name}`); continue; }

    console.log(`\n  📁 ${dir.name} → ${sectionInfo.section}`);
    let dirItems: any[];
    try {
      dirItems = await fetchJSON(`${GITHUB_BASE}/contents/${dir.name}`);
    } catch (e) {
      console.warn(`    Failed: ${e}`);
      continue;
    }

    const mdFiles = dirItems.filter((f: any) => f.type === "file" && f.name.endsWith(".md"));
    for (const file of mdFiles) {
      if (!file.download_url) continue;
      console.log(`    → ${file.name}`);
      await importFile(file.download_url, `${dir.name}/${file.name}`, sectionInfo, stats);
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Imported: ${stats.imported}`);
  console.log(`   Updated:  ${stats.updated}`);
  console.log(`   Skipped:  ${stats.skipped}`);

  const total = await pool.query(`SELECT COUNT(*) FROM content_chunks`);
  console.log(`\n📊 Total chunks in DB: ${total.rows[0].count}`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
