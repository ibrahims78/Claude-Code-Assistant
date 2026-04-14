import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { whatsappSessionsTable } from "./whatsapp-sessions";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => whatsappSessionsTable.id),
  direction: text("direction").notNull(),
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  messageType: text("message_type").default("text").notNull(),
  content: text("content"),
  mediaUrl: text("media_url"),
  caption: text("caption"),
  status: text("status").default("sent").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
