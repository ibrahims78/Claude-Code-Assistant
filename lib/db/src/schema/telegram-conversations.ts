import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { telegramUsersTable } from "./telegram-users";
import { conversationsTable } from "./conversations";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const telegramConversationsTable = pgTable("telegram_conversations", {
  id: serial("id").primaryKey(),
  telegramUserId: integer("telegram_user_id").references(() => telegramUsersTable.id, { onDelete: "cascade" }),
  conversationId: integer("conversation_id").references(() => conversationsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertTelegramConversationSchema = createInsertSchema(telegramConversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTelegramConversation = z.infer<typeof insertTelegramConversationSchema>;
export type TelegramConversation = typeof telegramConversationsTable.$inferSelect;
