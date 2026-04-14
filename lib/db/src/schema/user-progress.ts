import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { contentChunksTable } from "./content-chunks";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProgressTable = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  section: text("section"),
  chunkId: integer("chunk_id").references(() => contentChunksTable.id),
  readAt: timestamp("read_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueUserChunk: unique().on(table.userId, table.chunkId),
}));

export const insertUserProgressSchema = createInsertSchema(userProgressTable).omit({ id: true, readAt: true });
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type UserProgress = typeof userProgressTable.$inferSelect;
