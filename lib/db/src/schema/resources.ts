import { pgTable, serial, text, boolean, integer, timestamp, customType } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config?: { dimensions?: number }) {
    return config?.dimensions ? `vector(${config.dimensions})` : "vector";
  },
  fromDriver(value: string): number[] {
    return value.replace("[", "").replace("]", "").split(",").map(Number);
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
});

export const resourcesTable = pgTable("resources", {
  id: serial("id").primaryKey(),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar"),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  url: text("url").notNull(),
  sourceName: text("source_name"),
  type: text("type").notNull(),
  language: text("language").default("en"),
  isVisible: boolean("is_visible").default(true),
  isFeatured: boolean("is_featured").default(false),
  embedding: vector("embedding", { dimensions: 1536 }),
  suggestedBy: integer("suggested_by").references(() => usersTable.id),
  isApproved: boolean("is_approved").default(false),
  addedBy: integer("added_by").references(() => usersTable.id),
  displayOrder: integer("display_order").default(0),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertResourceSchema = createInsertSchema(resourcesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type Resource = typeof resourcesTable.$inferSelect;
