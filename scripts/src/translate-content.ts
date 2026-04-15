import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BATCH_SIZE = 5;
const MAX_CONTENT_LENGTH = 2000;

// أولوية الأقسام
const PRIORITY_SECTIONS = [
  "intro", "slash-commands", "memory", "hooks", "mcp",
  "agents", "workflows", "cli", "settings", "tips",
  "skills", "checkpoints", "plugins", "advanced",
  "CATALOG", "claude_concepts_guide", "clean-code-rules",
  "LEARNING-ROADMAP", "QUICK_REFERENCE",
];

async function translateBatch(chunks: Array<{ id: number; title: string; content: string }>) {
  const items = chunks.map((c, i) =>
    `[${i + 1}] العنوان: ${c.title}\nالمحتوى:\n${c.content.slice(0, MAX_CONTENT_LENGTH)}`
  ).join("\n\n---\n\n");

  const message = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `ترجم النصوص التالية إلى العربية. للكل عنصر قدّم الترجمة بالتنسيق التالي:
[رقم_العنصر]
العنوان_المترجم: <ترجمة العنوان>
المحتوى_المترجم:
<ترجمة المحتوى>
===

احتفظ بتنسيق Markdown (###, **, \`, جداول, إلخ). ترجم فقط النص البشري، لا تترجم أسماء الأوامر البرمجية.

النصوص:
${items}`,
    }],
  });

  const response = (message.content[0] as { type: string; text: string }).text;

  const results: Array<{ titleAr: string; contentAr: string }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const pattern = new RegExp(
      `\\[${i + 1}\\]\\s*\\nالعنوان_المترجم:\\s*(.+?)\\nالمحتوى_المترجم:\\s*\\n([\\s\\S]*?)(?=\\[${i + 2}\\]|$|===)`,
      "i"
    );
    const match = response.match(pattern);

    if (match) {
      results.push({
        titleAr: match[1].trim(),
        contentAr: match[2].replace(/===\s*$/, "").trim(),
      });
    } else {
      results.push({ titleAr: chunks[i].title, contentAr: chunks[i].content });
    }
  }

  return results;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY غير موجود");
    process.exit(1);
  }

  console.log("🌐 بدء ترجمة المحتوى إلى العربية...\n");

  let totalTranslated = 0;
  let totalFailed = 0;

  for (const section of PRIORITY_SECTIONS) {
    const result = await pool.query(
      `SELECT id, title, content FROM content_chunks 
       WHERE section = $1 AND (content_ar = content OR content_ar IS NULL)
       ORDER BY order_index`,
      [section]
    );

    if (result.rows.length === 0) {
      console.log(`✅ ${section}: مترجم بالفعل`);
      continue;
    }

    console.log(`\n📝 ${section}: ${result.rows.length} قطعة تحتاج ترجمة`);

    for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
      const batch = result.rows.slice(i, i + BATCH_SIZE);
      process.stdout.write(`  ترجمة ${i + 1}-${Math.min(i + BATCH_SIZE, result.rows.length)}...`);

      try {
        const translations = await translateBatch(batch);

        for (let j = 0; j < batch.length; j++) {
          await pool.query(
            `UPDATE content_chunks SET title_ar = $1, content_ar = $2, updated_at = NOW() WHERE id = $3`,
            [translations[j].titleAr, translations[j].contentAr, batch[j].id]
          );
        }

        totalTranslated += batch.length;
        console.log(` ✓`);

        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.log(` ❌ فشل: ${err}`);
        totalFailed += batch.length;
      }
    }
  }

  const total = await pool.query(`SELECT COUNT(*) FROM content_chunks WHERE content_ar != content`);
  console.log(`\n✅ اكتمل!`);
  console.log(`   مترجم: ${totalTranslated}`);
  console.log(`   فشل:   ${totalFailed}`);
  console.log(`   إجمالي مترجم في قاعدة البيانات: ${total.rows[0].count}`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
