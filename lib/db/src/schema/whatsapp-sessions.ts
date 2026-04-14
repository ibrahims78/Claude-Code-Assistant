import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const whatsappSessionsTable = pgTable("whatsapp_sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  name: text("name").notNull(),
  phoneNumber: text("phone_number"),
  status: text("status").default("disconnected").notNull(),
  autoReconnect: boolean("auto_reconnect").default(true).notNull(),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  webhookEvents: text("webhook_events"),
  features: text("features"),
  totalMessagesSent: integer("total_messages_sent").default(0).notNull(),
  totalMessagesReceived: integer("total_messages_received").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertWhatsappSessionSchema = createInsertSchema(whatsappSessionsTable).omit({ createdAt: true, updatedAt: true });
export type InsertWhatsappSession = z.infer<typeof insertWhatsappSessionSchema>;
export type WhatsappSession = typeof whatsappSessionsTable.$inferSelect;
