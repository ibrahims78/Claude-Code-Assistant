import { db, userPointsTable, userAchievementsTable, userProgressTable, contentChunksTable, conversationsTable } from "@workspace/db";
import { eq, sum, count, and, sql, inArray } from "drizzle-orm";
import { ACHIEVEMENT_KEYS, ACHIEVEMENT_META, type AchievementKey } from "@workspace/db";
import { logger } from "./logger.js";

// ─── Award points ────────────────────────────────────────────────────────────

export async function awardPoints(
  userId: number,
  points: number,
  reason: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.insert(userPointsTable).values({
    userId,
    points,
    reason,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });
}

// ─── Get total points ────────────────────────────────────────────────────────

export async function getTotalPoints(userId: number): Promise<number> {
  const [result] = await db
    .select({ total: sum(userPointsTable.points) })
    .from(userPointsTable)
    .where(eq(userPointsTable.userId, userId));
  return Number(result?.total ?? 0);
}

// ─── Get rank from points ────────────────────────────────────────────────────

export function getRank(points: number): { rank: string; rankAr: string; icon: string; nextRank: string; nextPoints: number } {
  if (points >= 5000) return { rank: "platinum", rankAr: "بلاتيني",  icon: "💎", nextRank: "platinum", nextPoints: 5000 };
  if (points >= 2000) return { rank: "gold",     rankAr: "ذهبي",     icon: "🥇", nextRank: "platinum", nextPoints: 5000 };
  if (points >= 500)  return { rank: "silver",   rankAr: "فضي",      icon: "🥈", nextRank: "gold",     nextPoints: 2000 };
  return                     { rank: "bronze",   rankAr: "برونزي",   icon: "🥉", nextRank: "silver",   nextPoints: 500  };
}

// ─── Get unlocked achievements ───────────────────────────────────────────────

export async function getUnlockedAchievements(userId: number): Promise<string[]> {
  const rows = await db.select({ key: userAchievementsTable.achievementKey })
    .from(userAchievementsTable)
    .where(eq(userAchievementsTable.userId, userId));
  return rows.map(r => r.key);
}

// ─── Unlock achievement (idempotent) ─────────────────────────────────────────

export async function unlockAchievement(
  userId: number,
  key: AchievementKey
): Promise<boolean> {
  try {
    await db.insert(userAchievementsTable)
      .values({ userId, achievementKey: key })
      .onConflictDoNothing();
    const meta = ACHIEVEMENT_META[key];
    // Award bonus points for the achievement
    await awardPoints(userId, meta.points, `achievement_${key}`, { achievementKey: key });
    logger.info({ userId, key }, "Achievement unlocked");
    return true;
  } catch {
    return false;
  }
}

// ─── Check and unlock eligible achievements ──────────────────────────────────

export async function checkAndUnlockAchievements(userId: number): Promise<AchievementKey[]> {
  const unlocked = await getUnlockedAchievements(userId);
  const alreadyUnlocked = new Set(unlocked);
  const newlyUnlocked: AchievementKey[] = [];

  // Progress data
  const progress = await db.select().from(userProgressTable)
    .where(eq(userProgressTable.userId, userId));
  const readChunkIds = new Set(progress.map(p => p.chunkId));
  const totalRead = readChunkIds.size;

  // All chunks
  const allChunks = await db.select({
    id: contentChunksTable.id,
    section: contentChunksTable.section,
    category: contentChunksTable.category,
  }).from(contentChunksTable);

  // Section completion map
  const sectionMap = new Map<string, { total: number; read: number; category: string }>();
  for (const chunk of allChunks) {
    const sec = chunk.section || "general";
    const cat = chunk.category || "general";
    if (!sectionMap.has(sec)) sectionMap.set(sec, { total: 0, read: 0, category: cat });
    const entry = sectionMap.get(sec)!;
    entry.total++;
    if (readChunkIds.has(chunk.id)) entry.read++;
  }

  const completedSections = [...sectionMap.entries()].filter(([, v]) => v.read === v.total && v.total > 0);
  const completedByCategory = (cat: string) => completedSections.filter(([, v]) => v.category === cat).length;
  const totalByCategory = (cat: string) => [...sectionMap.values()].filter(v => v.category === cat).length;

  // AI conversations count
  const [convCount] = await db.select({ count: count() })
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, userId));

  // Define checks
  const checks: Array<{ key: AchievementKey; condition: boolean }> = [
    { key: "first_read",        condition: totalRead >= 1 },
    { key: "section_complete",  condition: completedSections.length >= 1 },
    { key: "beginner_done",     condition: completedByCategory("beginner") >= totalByCategory("beginner") && totalByCategory("beginner") > 0 },
    { key: "intermediate_done", condition: completedByCategory("intermediate") >= totalByCategory("intermediate") && totalByCategory("intermediate") > 0 },
    { key: "advanced_done",     condition: completedByCategory("advanced") >= totalByCategory("advanced") && totalByCategory("advanced") > 0 },
    { key: "ai_explorer",       condition: (convCount?.count ?? 0) >= 5 },
    { key: "completionist",     condition: allChunks.length > 0 && totalRead >= allChunks.length },
  ];

  for (const { key, condition } of checks) {
    if (condition && !alreadyUnlocked.has(key)) {
      const unlockSuccess = await unlockAchievement(userId, key);
      if (unlockSuccess) newlyUnlocked.push(key);
    }
  }

  return newlyUnlocked;
}

// ─── Session read tracker (in-memory, per restart) ───────────────────────────
// Used for "speed_reader" achievement (10 reads in one session)
const sessionReads = new Map<number, { count: number; resetAt: number }>();

export async function trackSessionRead(userId: number): Promise<AchievementKey[]> {
  const now = Date.now();
  const SESSION_WINDOW_MS = 60 * 60 * 1000; // 1 hour window

  const entry = sessionReads.get(userId);
  if (!entry || now - entry.resetAt > SESSION_WINDOW_MS) {
    sessionReads.set(userId, { count: 1, resetAt: now });
  } else {
    entry.count++;
  }

  const current = sessionReads.get(userId)!;
  const newlyUnlocked: AchievementKey[] = [];

  if (current.count >= 10) {
    const unlocked = await getUnlockedAchievements(userId);
    if (!unlocked.includes("speed_reader")) {
      await unlockAchievement(userId, "speed_reader");
      newlyUnlocked.push("speed_reader");
    }
  }

  return newlyUnlocked;
}
