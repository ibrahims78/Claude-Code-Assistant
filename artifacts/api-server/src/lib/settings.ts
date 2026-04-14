import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function getSettingValue(key: string): Promise<string | null> {
  const [setting] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return setting?.value ?? null;
}

export async function setSettingValue(key: string, value: string | null): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}
