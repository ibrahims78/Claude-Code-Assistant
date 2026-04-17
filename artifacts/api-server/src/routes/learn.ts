import { Router, Request, Response } from "express";
import { db, contentChunksTable, userProgressTable, userPointsTable, userAchievementsTable, quizAttemptsTable, conversationsTable } from "@workspace/db";
import { eq, and, count, desc, sum, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { chatWithClaude, buildSystemPrompt } from "../lib/claude.js";
import { searchSimilarChunks } from "../lib/rag.js";
import { awardPoints, getTotalPoints, getRank, getUnlockedAchievements, checkAndUnlockAchievements, trackSessionRead } from "../lib/points.js";
import { ACHIEVEMENT_META, ACHIEVEMENT_KEYS } from "@workspace/db";
import type { User } from "@workspace/db";

const router = Router();
router.use(requireAuth);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/learn/stats — User learning statistics
// ─────────────────────────────────────────────────────────────────────────────
router.get("/stats", async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;

  // Points
  const totalPoints = await getTotalPoints(user.id);
  const rankInfo = getRank(totalPoints);

  // Recent point history (last 10)
  const recentPoints = await db.select()
    .from(userPointsTable)
    .where(eq(userPointsTable.userId, user.id))
    .orderBy(desc(userPointsTable.createdAt))
    .limit(10);

  // Progress
  const progress = await db.select().from(userProgressTable)
    .where(eq(userProgressTable.userId, user.id));
  const readChunkIds = new Set(progress.map(p => p.chunkId));

  // All chunks summary
  const allChunks = await db.select({
    id: contentChunksTable.id,
    section: contentChunksTable.section,
    category: contentChunksTable.category,
  }).from(contentChunksTable);

  const sectionMap = new Map<string, { total: number; read: number; category: string }>();
  for (const chunk of allChunks) {
    const sec = chunk.section || "general";
    const cat = chunk.category || "general";
    if (!sectionMap.has(sec)) sectionMap.set(sec, { total: 0, read: 0, category: cat });
    const entry = sectionMap.get(sec)!;
    entry.total++;
    if (readChunkIds.has(chunk.id)) entry.read++;
  }

  const sectionsCompleted = [...sectionMap.values()].filter(v => v.read === v.total && v.total > 0).length;

  // Category progress
  const categoryProgress: Record<string, { total: number; read: number; pct: number }> = {};
  for (const [, v] of sectionMap) {
    const cat = v.category;
    if (!categoryProgress[cat]) categoryProgress[cat] = { total: 0, read: 0, pct: 0 };
    categoryProgress[cat].total += v.total;
    categoryProgress[cat].read += v.read;
  }
  for (const cat of Object.keys(categoryProgress)) {
    const c = categoryProgress[cat];
    c.pct = c.total > 0 ? Math.round((c.read / c.total) * 100) : 0;
  }

  // Quizzes
  const [quizStats] = await db.select({ count: count() })
    .from(quizAttemptsTable)
    .where(and(eq(quizAttemptsTable.userId, user.id)));

  const passedQuizzes = await db.select({ count: count() })
    .from(quizAttemptsTable)
    .where(and(eq(quizAttemptsTable.userId, user.id)));

  // Achievements
  const unlockedKeys = await getUnlockedAchievements(user.id);
  const achievements = ACHIEVEMENT_KEYS.map(key => ({
    key,
    ...ACHIEVEMENT_META[key],
    unlocked: unlockedKeys.includes(key),
  }));

  // Conversations count
  const [convCount] = await db.select({ count: count() })
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, user.id));

  res.json({
    totalPoints,
    ...rankInfo,
    chunksRead: readChunkIds.size,
    totalChunks: allChunks.length,
    sectionsCompleted,
    totalSections: sectionMap.size,
    categoryProgress,
    quizzesTaken: quizStats?.count ?? 0,
    aiConversations: convCount?.count ?? 0,
    achievements,
    recentActivity: recentPoints,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/learn/ask-about-chunk — AI answers in context of a specific chunk
// ─────────────────────────────────────────────────────────────────────────────
router.post("/ask-about-chunk", async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const { chunkId, question, lang = "ar" } = req.body as {
    chunkId: number;
    question: string;
    lang?: "ar" | "en";
  };

  if (!chunkId || !question?.trim()) {
    res.status(400).json({ error: "chunkId and question are required" });
    return;
  }

  // Fetch the chunk being read
  const [chunk] = await db.select().from(contentChunksTable)
    .where(eq(contentChunksTable.id, chunkId));

  if (!chunk) {
    res.status(404).json({ error: "Chunk not found" });
    return;
  }

  // Search for related chunks using RAG
  const relatedChunks = await searchSimilarChunks(question, 3);

  // Build context from the current chunk + related
  const chunkTitle = lang === "ar" ? (chunk.titleAr || chunk.title) : chunk.title;
  const chunkContent = lang === "ar" ? (chunk.contentAr || chunk.content) : chunk.content;

  const systemPrompt = lang === "ar"
    ? `أنت مساعد تعليمي متخصص في Claude Code. أجب بالعربية فقط بوضوح وإيجاز.
المستخدم يقرأ الآن القسم: "${chunk.section}" / القطعة: "${chunkTitle}"

محتوى القطعة الحالية:
${chunkContent.slice(0, 2000)}

${relatedChunks.length > 0 ? `معلومات ذات صلة من قسم المعرفة:\n${relatedChunks.map(c => `- ${c.titleAr || c.title}: ${(c.contentAr || c.content).slice(0, 300)}`).join("\n")}` : ""}

أجب على سؤال المستخدم استناداً إلى هذا السياق. أضف مثالاً عملياً إن أمكن.`
    : `You are an educational assistant specialized in Claude Code. Answer in English clearly and concisely.
The user is reading: Section "${chunk.section}" / Chunk "${chunkTitle}"

Current chunk content:
${chunkContent.slice(0, 2000)}

${relatedChunks.length > 0 ? `Related knowledge:\n${relatedChunks.map(c => `- ${c.title}: ${c.content.slice(0, 300)}`).join("\n")}` : ""}

Answer the user's question based on this context. Include a practical example if possible.`;

  const { content: answer, tokensUsed } = await chatWithClaude(
    [{ role: "user", content: question }],
    systemPrompt
  );

  // Award points for AI usage (first 5 conversations unlock ai_explorer)
  await awardPoints(user.id, 5, "ai_question", { chunkId, section: chunk.section });
  const newAchievements = await checkAndUnlockAchievements(user.id);

  res.json({
    answer,
    tokensUsed,
    relatedChunks: relatedChunks.map(c => ({
      id: c.id,
      title: lang === "ar" ? (c.titleAr || c.title) : c.title,
      section: c.section,
    })),
    newAchievements,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/learn/suggest-next — AI suggests the next learning step
// ─────────────────────────────────────────────────────────────────────────────
router.post("/suggest-next", async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;

  // Calculate progress per category
  const progress = await db.select().from(userProgressTable)
    .where(eq(userProgressTable.userId, user.id));
  const readChunkIds = new Set(progress.map(p => p.chunkId));

  const allChunks = await db.select({
    section: contentChunksTable.section,
    category: contentChunksTable.category,
    id: contentChunksTable.id,
  }).from(contentChunksTable);

  const catTotals: Record<string, number> = {};
  const catRead: Record<string, number> = {};
  const sectionTotals: Record<string, { total: number; read: number; category: string }> = {};

  for (const chunk of allChunks) {
    const cat = chunk.category || "general";
    const sec = chunk.section || "general";
    catTotals[cat] = (catTotals[cat] || 0) + 1;
    catRead[cat] = (catRead[cat] || 0) + (readChunkIds.has(chunk.id) ? 1 : 0);
    if (!sectionTotals[sec]) sectionTotals[sec] = { total: 0, read: 0, category: cat };
    sectionTotals[sec].total++;
    if (readChunkIds.has(chunk.id)) sectionTotals[sec].read++;
  }

  const pct = (cat: string) => catTotals[cat] ? Math.round((catRead[cat] || 0) / catTotals[cat] * 100) : 0;

  // Find best next section (started but not completed, or not started)
  const incompleteSections = Object.entries(sectionTotals)
    .filter(([, v]) => v.read < v.total)
    .sort(([, a], [, b]) => (b.read / b.total) - (a.read / a.total)); // prioritize most-started

  const suggestedSection = incompleteSections[0]?.[0] ?? null;
  const totalPoints = await getTotalPoints(user.id);

  const prompt = `أنت مستشار تعليمي لمنصة تعلّم Claude Code.
تقدم المستخدم:
- المستوى المبتدئ: ${pct("beginner")}% مكتمل
- المستوى المتوسط: ${pct("intermediate")}% مكتمل
- المستوى المتقدم: ${pct("advanced")}% مكتمل
- القسم المقترح: ${suggestedSection ?? "لا يوجد"}
- النقاط الكلية: ${totalPoints}

اكتب رسالة تشجيعية قصيرة جداً (جملة واحدة) باللغة العربية. لا تذكر أرقاماً بالضرورة.
ثم في السطر الثاني اكتب فقط: SECTION:اسم_القسم
مثال: رائع! استمر في تقدمك الممتاز.
SECTION:slash-commands`;

  const { content: raw } = await chatWithClaude(
    [{ role: "user", content: prompt }],
    "أنت مستشار تعليمي. أجب فقط كما في التعليمات."
  );

  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const message = lines[0] ?? "استمر في التعلم!";
  const sectionLine = lines.find(l => l.startsWith("SECTION:"));
  const aiSuggestedSection = sectionLine ? sectionLine.replace("SECTION:", "").trim() : suggestedSection;

  res.json({
    message,
    suggestedSection: aiSuggestedSection,
    progressSummary: {
      beginner: pct("beginner"),
      intermediate: pct("intermediate"),
      advanced: pct("advanced"),
      general: pct("general"),
    },
    totalPoints,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/learn/mark-read/:chunkId — Mark a chunk as read + award points
// ─────────────────────────────────────────────────────────────────────────────
router.post("/mark-read/:chunkId", async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const chunkId = parseInt(req.params.chunkId);

  const [chunk] = await db.select().from(contentChunksTable)
    .where(eq(contentChunksTable.id, chunkId));

  if (!chunk) {
    res.status(404).json({ error: "Chunk not found" });
    return;
  }

  // Insert progress (idempotent)
  const existing = await db.select().from(userProgressTable)
    .where(and(
      eq(userProgressTable.userId, user.id),
      eq(userProgressTable.chunkId, chunkId)
    ));

  let pointsEarned = 0;
  let newAchievements: string[] = [];

  if (existing.length === 0) {
    await db.insert(userProgressTable).values({
      userId: user.id,
      chunkId,
      section: chunk.section,
    });

    // Award points for reading
    await awardPoints(user.id, 5, "chunk_read", { chunkId, section: chunk.section });
    pointsEarned = 5;

    // Track session reads for speed_reader
    const sessionAchievements = await trackSessionRead(user.id);

    // Check all achievements
    newAchievements = [
      ...sessionAchievements,
      ...(await checkAndUnlockAchievements(user.id)),
    ];

    // Check if the whole section is now complete
    const sectionChunks = await db.select({ id: contentChunksTable.id })
      .from(contentChunksTable)
      .where(eq(contentChunksTable.section, chunk.section || ""));

    const sectionProgress = await db.select({ chunkId: userProgressTable.chunkId })
      .from(userProgressTable)
      .where(and(
        eq(userProgressTable.userId, user.id),
        eq(userProgressTable.section, chunk.section || "")
      ));

    if (sectionChunks.length > 0 && sectionProgress.length >= sectionChunks.length) {
      // Section completed! Award bonus
      await awardPoints(user.id, 50, "section_complete", { section: chunk.section });
      pointsEarned += 50;
    }
  }

  const totalPoints = await getTotalPoints(user.id);

  res.json({
    success: true,
    alreadyRead: existing.length > 0,
    pointsEarned,
    totalPoints,
    newAchievements,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/learn/achievements — Full achievements list with status
// ─────────────────────────────────────────────────────────────────────────────
router.get("/achievements", async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const unlockedKeys = await getUnlockedAchievements(user.id);
  const unlockedSet = new Set(unlockedKeys);

  const unlockedRows = await db.select()
    .from(userAchievementsTable)
    .where(eq(userAchievementsTable.userId, user.id));

  const unlockedAtMap = new Map(unlockedRows.map(r => [r.achievementKey, r.unlockedAt]));

  const achievements = ACHIEVEMENT_KEYS.map(key => ({
    key,
    ...ACHIEVEMENT_META[key],
    unlocked: unlockedSet.has(key),
    unlockedAt: unlockedAtMap.get(key) ?? null,
  }));

  res.json(achievements);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/learn/quiz/:sectionId/generate — Generate quiz for a section
// ─────────────────────────────────────────────────────────────────────────────

// In-memory quiz store (production: use Redis or DB with TTL)
const quizStore = new Map<string, { questions: QuizQuestion[]; section: string; userId: number; createdAt: number }>();

interface QuizQuestion {
  id: number;
  question: string;
  options: Record<string, string>;
  correct: string;
}

router.get("/quiz/:sectionId/generate", async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const { sectionId } = req.params;

  // Fetch up to 8 chunks from the section as context
  const chunks = await db.select()
    .from(contentChunksTable)
    .where(eq(contentChunksTable.section, sectionId))
    .limit(8);

  if (chunks.length === 0) {
    res.status(404).json({ error: "Section not found or has no content" });
    return;
  }

  const context = chunks.map(c =>
    `عنوان: ${c.titleAr || c.title}\nمحتوى: ${(c.contentAr || c.content).slice(0, 400)}`
  ).join("\n\n---\n\n");

  const prompt = `بناءً على المحتوى التالي من قسم "${sectionId}":

${context}

اصنع بالضبط 5 أسئلة اختيار من متعدد باللغة العربية.
كل سؤال: نص السؤال + 4 خيارات (A,B,C,D) + الإجابة الصحيحة.
أعد النتيجة كـ JSON array فقط بهذا الشكل، بدون أي نص إضافي:
[{"id":1,"question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correct":"A"},...]`;

  // Check API key before calling AI
  const hasKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!hasKey) {
    res.status(503).json({ error: "⚠️ لم يتم إعداد مفتاح Anthropic API. ميزة الاختبار تتطلب الاتصال بالذكاء الاصطناعي." });
    return;
  }

  const { content: raw } = await chatWithClaude(
    [{ role: "user", content: prompt }],
    "أنت مصمم اختبارات تعليمية. أعد JSON فقط بدون أي نص إضافي."
  );

  let questions: QuizQuestion[];
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found");
    questions = JSON.parse(jsonMatch[0]) as QuizQuestion[];
    if (!Array.isArray(questions) || questions.length === 0) throw new Error("Invalid format");
  } catch {
    res.status(500).json({ error: "Failed to generate quiz, please try again" });
    return;
  }

  // Store quiz with answers server-side
  const quizId = `${user.id}_${sectionId}_${Date.now()}`;
  quizStore.set(quizId, { questions, section: sectionId, userId: user.id, createdAt: Date.now() });

  // Return questions without correct answers
  const publicQuestions = questions.map(({ correct: _correct, ...q }) => q);

  res.json({ quizId, questions: publicQuestions });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/learn/quiz/:sectionId/submit — Submit quiz answers
// ─────────────────────────────────────────────────────────────────────────────
router.post("/quiz/:sectionId/submit", async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const { quizId, answers } = req.body as { quizId: string; answers: Record<string, string> };

  const stored = quizStore.get(quizId);
  if (!stored || stored.userId !== user.id) {
    res.status(404).json({ error: "Quiz not found or expired. Please generate a new quiz." });
    return;
  }

  // Grade answers
  let score = 0;
  const results = stored.questions.map(q => {
    const userAnswer = answers[String(q.id)] ?? "";
    const correct = userAnswer.toUpperCase() === q.correct.toUpperCase();
    if (correct) score++;
    return {
      questionId: q.id,
      question: q.question,
      userAnswer,
      correctAnswer: q.correct,
      correct,
    };
  });

  const total = stored.questions.length;
  const percentage = Math.round((score / total) * 100);
  const passed = percentage >= 60;

  // Award points: 20 per correct answer + 100 bonus for 100%
  let pointsEarned = score * 20;
  if (percentage === 100) pointsEarned += 100;

  await awardPoints(user.id, pointsEarned, "quiz_complete", {
    section: stored.section,
    score,
    total,
    percentage,
  });

  // Save attempt to DB
  await db.insert(quizAttemptsTable).values({
    userId: user.id,
    section: stored.section,
    questions: stored.questions as any,
    answers: answers as any,
    score,
    totalQuestions: total,
    passed,
    completedAt: new Date(),
  });

  // Check achievements (quiz_perfect)
  let newAchievements: string[] = [];
  if (percentage === 100) {
    const unlockedKeys = await getUnlockedAchievements(user.id);
    if (!unlockedKeys.includes("quiz_perfect")) {
      await import("../lib/points.js").then(m => m.unlockAchievement(user.id, "quiz_perfect"));
      newAchievements.push("quiz_perfect");
    }
  }
  newAchievements = [...newAchievements, ...(await checkAndUnlockAchievements(user.id))];

  const totalPoints = await getTotalPoints(user.id);

  // Cleanup quiz from store
  quizStore.delete(quizId);

  res.json({
    score,
    total,
    percentage,
    passed,
    results,
    pointsEarned,
    totalPoints,
    newAchievements,
  });
});

export default router;
