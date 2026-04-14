import { pgTable, serial, text, bigint, boolean, integer, timestamp, date } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const telegramUsersTable = pgTable("telegram_users", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "bigint" }).unique().notNull(),
  firstName: text("first_name"),
  username: text("username"),
  linkedUserId: integer("linked_user_id").references(() => usersTable.id),
  language: text("language").default("ar"),
  isBlocked: boolean("is_blocked").default(false),
  dailyCount: integer("daily_count").default(0),
  lastReset: date("last_reset").defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  lastActive: timestamp("last_active", { withTimezone: true }).defaultNow(),
});

export const insertTelegramUserSchema = createInsertSchema(telegramUsersTable).omit({ id: true, createdAt: true });
export type InsertTelegramUser = z.infer<typeof insertTelegramUserSchema>;
export type TelegramUser = typeof telegramUsersTable.$inferSelect;
