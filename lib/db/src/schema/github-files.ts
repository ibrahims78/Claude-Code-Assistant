import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const githubFilesTable = pgTable("github_files", {
  id: serial("id").primaryKey(),
  path: text("path").notNull().unique(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  directory: text("directory"),
  localPath: text("local_path"),
  size: integer("size"),
  sha: text("sha"),
  downloadUrl: text("download_url"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type GithubFile = typeof githubFilesTable.$inferSelect;
