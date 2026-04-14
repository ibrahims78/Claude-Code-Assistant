import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const resourceSuggestionsTable = pgTable("resource_suggestions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  type: text("type"),
  status: text("status").default("pending"),
  adminNote: text("admin_note"),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertResourceSuggestionSchema = createInsertSchema(resourceSuggestionsTable).omit({ id: true, createdAt: true });
export type InsertResourceSuggestion = z.infer<typeof insertResourceSuggestionSchema>;
export type ResourceSuggestion = typeof resourceSuggestionsTable.$inferSelect;
