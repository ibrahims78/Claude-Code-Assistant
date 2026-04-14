import { pgTable, serial, text, integer, timestamp, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config?: { dimensions?: number }) {
    return config?.dimensions ? `vector(${config.dimensions})` : "vector";
  },
  fromDriver(value: string): number[] {
    return value
      .replace("[", "")
      .replace("]", "")
      .split(",")
      .map(Number);
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
});

export const contentChunksTable = pgTable("content_chunks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  content: text("content").notNull(),
  contentAr: text("content_ar"),
  category: text("category"),
  section: text("section"),
  sourceFile: text("source_file"),
  orderIndex: integer("order_index"),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertContentChunkSchema = createInsertSchema(contentChunksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContentChunk = z.infer<typeof insertContentChunkSchema>;
export type ContentChunk = typeof contentChunksTable.$inferSelect;
