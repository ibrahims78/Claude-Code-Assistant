import { Router, Request, Response } from "express";
import { db, conversationsTable, chatMessagesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { chatWithClaude, buildSystemPrompt } from "../lib/claude.js";
import { searchSimilarChunks } from "../lib/rag.js";
import { writeAuditLog } from "../lib/audit.js";
import type { User } from "@workspace/db";

const router = Router();

// GET /api/chat/conversations
router.get("/conversations", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const conversations = await db.select().from(conversationsTable)
    .where(eq(conversationsTable.userId, user.id))
    .orderBy(desc(conversationsTable.updatedAt));
  res.json(conversations);
});

// POST /api/chat/conversations
router.post("/conversations", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const { title } = req.body as { title?: string };
  const [conversation] = await db.insert(conversationsTable).values({
    userId: user.id,
    sessionTitle: title || "محادثة جديدة",
  }).returning();
  res.status(201).json(conversation);
});

// GET /api/chat/conversations/:id
router.get("/conversations/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const convId = parseInt(req.params.id);
  
  const [conversation] = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.id, convId), eq(conversationsTable.userId, user.id)));
  
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  
  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.conversationId, convId))
    .orderBy(chatMessagesTable.createdAt);
  
  res.json({ ...conversation, messages });
});

// DELETE /api/chat/conversations/:id
router.delete("/conversations/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const convId = parseInt(req.params.id);
  
  const [conversation] = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.id, convId), eq(conversationsTable.userId, user.id)));
  
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  
  await db.delete(conversationsTable).where(eq(conversationsTable.id, convId));
  res.json({ success: true });
});

// POST /api/chat/conversations/:id/messages
router.post("/conversations/:id/messages", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const convId = parseInt(req.params.id);
  const { content } = req.body as { content: string };
  
  if (!content?.trim()) {
    res.status(400).json({ error: "Content is required" });
    return;
  }
  
  const [conversation] = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.id, convId), eq(conversationsTable.userId, user.id)));
  
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  
  // RAG search
  const chunks = await searchSimilarChunks(content, 5);
  const language = "ar";
  const systemPrompt = buildSystemPrompt(chunks, language);
  
  // Get last 10 messages for history
  const history = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.conversationId, convId))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(10);
  
  const historyMessages = history.reverse().map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  
  const { content: reply, tokensUsed } = await chatWithClaude(
    [...historyMessages, { role: "user", content }],
    systemPrompt
  );
  
  // Save user message
  await db.insert(chatMessagesTable).values({
    conversationId: convId,
    role: "user",
    content,
  });
  
  // Save assistant message
  const sources = chunks.map(c => ({ title: c.titleAr || c.title, section: c.section, chunkId: c.id }));
  const [assistantMsg] = await db.insert(chatMessagesTable).values({
    conversationId: convId,
    role: "assistant",
    content: reply,
    sources: sources as any,
    tokensUsed,
  }).returning();
  
  // Update conversation updatedAt
  await db.update(conversationsTable).set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));
  
  await writeAuditLog({
    userId: user.id,
    username: user.username,
    action: "chat_message",
    ipAddress: req.ip,
  });
  
  res.json({ message: assistantMsg, sources });
});

export default router;
