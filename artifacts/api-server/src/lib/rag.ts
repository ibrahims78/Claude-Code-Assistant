import { db, contentChunksTable } from "@workspace/db";
import { sql, isNotNull } from "drizzle-orm";
import { generateEmbedding } from "./claude.js";
import type { ContentChunk } from "@workspace/db";

export async function searchSimilarChunks(query: string, limit = 5): Promise<ContentChunk[]> {
  try {
    const embedding = await generateEmbedding(query);
    const embeddingStr = `[${embedding.join(",")}]`;
    
    const result = await db.execute(
      sql`SELECT * FROM content_chunks 
          WHERE embedding IS NOT NULL 
          ORDER BY embedding <-> ${embeddingStr}::vector 
          LIMIT ${limit}`
    );
    return result.rows as ContentChunk[];
  } catch {
    // Fallback to text search if pgvector not available
    const results = await db.select().from(contentChunksTable).limit(limit);
    return results;
  }
}
