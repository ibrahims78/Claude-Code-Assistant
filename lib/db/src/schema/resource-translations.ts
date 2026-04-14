import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { resourcesTable } from "./resources";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const resourceTranslationsTable = pgTable("resource_translations", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").references(() => resourcesTable.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  sourceLang: text("source_lang").notNull(),
  targetLang: text("target_lang").notNull(),
  translated: text("translated").notNull(),
  translatedAt: timestamp("translated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueTranslation: unique().on(table.resourceId, table.field, table.sourceLang, table.targetLang),
}));

export const insertResourceTranslationSchema = createInsertSchema(resourceTranslationsTable).omit({ id: true, translatedAt: true });
export type InsertResourceTranslation = z.infer<typeof insertResourceTranslationSchema>;
export type ResourceTranslation = typeof resourceTranslationsTable.$inferSelect;
