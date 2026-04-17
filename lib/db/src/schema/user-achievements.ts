import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ACHIEVEMENT_KEYS = [
  "first_read",
  "section_complete",
  "beginner_done",
  "intermediate_done",
  "advanced_done",
  "quiz_perfect",
  "ai_explorer",
  "daily_streak_7",
  "speed_reader",
  "completionist",
] as const;

export type AchievementKey = (typeof ACHIEVEMENT_KEYS)[number];

export const ACHIEVEMENT_META: Record<AchievementKey, { nameAr: string; nameEn: string; descAr: string; icon: string; points: number }> = {
  first_read:        { nameAr: "القارئ الأول",          nameEn: "First Read",          descAr: "قرأت أول قطعة محتوى",                  icon: "📖", points: 10  },
  section_complete:  { nameAr: "أتممت قسماً",           nameEn: "Section Complete",    descAr: "أنهيت قسماً كاملاً",                   icon: "✅", points: 50  },
  beginner_done:     { nameAr: "خريج المبتدئين",        nameEn: "Beginner Graduate",   descAr: "أتممت جميع أقسام المستوى المبتدئ",     icon: "🌱", points: 200 },
  intermediate_done: { nameAr: "خريج المتوسطين",        nameEn: "Intermediate Grad",   descAr: "أتممت جميع أقسام المستوى المتوسط",     icon: "🌿", points: 400 },
  advanced_done:     { nameAr: "خريج المتقدمين",        nameEn: "Advanced Graduate",   descAr: "أتممت جميع أقسام المستوى المتقدم",     icon: "🌳", points: 600 },
  quiz_perfect:      { nameAr: "الطالب المثالي",        nameEn: "Perfect Score",       descAr: "حصلت على 100% في اختبار",              icon: "💯", points: 100 },
  ai_explorer:       { nameAr: "مستكشف الذكاء",         nameEn: "AI Explorer",         descAr: "أجريت 5 محادثات مع المساعد الذكي",    icon: "🤖", points: 30  },
  daily_streak_7:    { nameAr: "أسبوع متواصل",          nameEn: "Weekly Streak",       descAr: "سجّلت دخولك 7 أيام متتالية",           icon: "🔥", points: 70  },
  speed_reader:      { nameAr: "القارئ السريع",          nameEn: "Speed Reader",        descAr: "قرأت 10 قطع في جلسة واحدة",           icon: "⚡", points: 50  },
  completionist:     { nameAr: "المكتمل",               nameEn: "Completionist",       descAr: "أتممت 100% من جميع المحتوى",           icon: "🏆", points: 1000},
};

export const userAchievementsTable = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  achievementKey: text("achievement_key").notNull(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueUserAchievement: unique().on(table.userId, table.achievementKey),
}));

export const insertUserAchievementSchema = createInsertSchema(userAchievementsTable).omit({ id: true, unlockedAt: true });
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type UserAchievement = typeof userAchievementsTable.$inferSelect;
