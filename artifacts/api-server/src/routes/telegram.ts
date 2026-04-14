import { Router, Request, Response } from "express";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { getSettingValue, setSettingValue } from "../lib/settings.js";
import { logger } from "../lib/logger.js";

const router = Router();

let botInstance: any = null;

async function getOrInitBot() {
  if (botInstance) return botInstance;
  
  const token = await getSettingValue("telegram_token");
  const enabled = await getSettingValue("telegram_enabled");
  
  if (!token || enabled !== "true") return null;
  
  try {
    const { Bot } = await import("grammy");
    const { db, telegramUsersTable, telegramConversationsTable, conversationsTable, chatMessagesTable } = await import("@workspace/db");
    const { eq, desc } = await import("drizzle-orm");
    const { searchSimilarChunks } = await import("../lib/rag.js");
    const { chatWithClaude, buildSystemPrompt } = await import("../lib/claude.js");
    
    const bot = new Bot(token);
    
    // Middleware: register/update telegram_users
    bot.use(async (ctx: any, next: () => Promise<void>) => {
      if (!ctx.from) return next();
      const telegramId = BigInt(ctx.from.id);
      
      const [existing] = await db.select().from(telegramUsersTable)
        .where(eq(telegramUsersTable.telegramId, telegramId));
      
      let telegramUser;
      if (!existing) {
        [telegramUser] = await db.insert(telegramUsersTable).values({
          telegramId,
          firstName: ctx.from.first_name,
          username: ctx.from.username,
          language: "ar",
        }).returning();
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const updates: Record<string, unknown> = { lastActive: new Date() };
        const lastReset = existing.lastReset?.toString().slice(0, 10);
        if (lastReset && lastReset < today) {
          updates.dailyCount = 0;
          updates.lastReset = new Date();
        }
        [telegramUser] = await db.update(telegramUsersTable).set(updates)
          .where(eq(telegramUsersTable.id, existing.id)).returning();
      }
      
      ctx.telegramUser = telegramUser;
      
      if (telegramUser.isBlocked) {
        await ctx.reply(telegramUser.language === "ar" ? "عذراً، تم حظر حسابك." : "Sorry, your account has been blocked.");
        return;
      }
      
      const maxDaily = parseInt(await getSettingValue("telegram_max_daily") || "20");
      if (telegramUser.dailyCount >= maxDaily) {
        await ctx.reply(telegramUser.language === "ar"
          ? `لقد وصلت للحد اليومي (${maxDaily} رسالة). يُجدَّد الحد غداً.`
          : `You have reached the daily limit (${maxDaily} messages). Resets tomorrow.`);
        return;
      }
      
      await next();
    });
    
    bot.command("start", async (ctx: any) => {
      const lang = ctx.telegramUser?.language || "ar";
      const welcome = await getSettingValue(lang === "ar" ? "telegram_welcome_ar" : "telegram_welcome_en");
      await ctx.reply(welcome || (lang === "ar" ? "مرحباً!" : "Hello!"));
    });
    
    bot.command("help", async (ctx: any) => {
      const lang = ctx.telegramUser?.language || "ar";
      if (lang === "ar") {
        await ctx.reply("/start — رسالة الترحيب\n/help — قائمة الأوامر\n/lang — تبديل اللغة\n/clear — محادثة جديدة\n/stats — إحصائياتي");
      } else {
        await ctx.reply("/start — Welcome message\n/help — Command list\n/lang — Switch language\n/clear — New conversation\n/stats — My stats");
      }
    });
    
    bot.command("lang", async (ctx: any) => {
      const current = ctx.telegramUser?.language || "ar";
      const newLang = current === "ar" ? "en" : "ar";
      await db.update(telegramUsersTable).set({ language: newLang })
        .where(eq(telegramUsersTable.id, ctx.telegramUser!.id));
      await ctx.reply(newLang === "ar" ? "✅ تم التبديل للعربية" : "✅ Switched to English");
    });
    
    bot.command("clear", async (ctx: any) => {
      const [conv] = await db.insert(conversationsTable).values({
        userId: null,
        sessionTitle: `Telegram - ${ctx.from?.first_name}`,
      }).returning();
      
      const [existing] = await db.select().from(telegramConversationsTable)
        .where(eq(telegramConversationsTable.telegramUserId, ctx.telegramUser!.id));
      
      if (existing) {
        await db.update(telegramConversationsTable).set({ conversationId: conv.id })
          .where(eq(telegramConversationsTable.id, existing.id));
      } else {
        await db.insert(telegramConversationsTable).values({
          telegramUserId: ctx.telegramUser!.id,
          conversationId: conv.id,
        });
      }
      
      const lang = ctx.telegramUser?.language || "ar";
      await ctx.reply(lang === "ar" ? "✅ تم مسح المحادثة" : "✅ Conversation cleared");
    });
    
    bot.command("stats", async (ctx: any) => {
      const user = ctx.telegramUser!;
      const lang = user.language;
      await ctx.reply(lang === "ar"
        ? `📊 إحصائياتك:\nأسئلة اليوم: ${user.dailyCount}`
        : `📊 Your stats:\nToday's questions: ${user.dailyCount}`);
    });
    
    bot.on("message:text", async (ctx: any) => {
      const query = ctx.message.text;
      if (query.startsWith("/")) return;
      
      const user = ctx.telegramUser!;
      
      let convId: number;
      const [existingTgConv] = await db.select().from(telegramConversationsTable)
        .where(eq(telegramConversationsTable.telegramUserId, user.id));
      
      if (existingTgConv?.conversationId) {
        convId = existingTgConv.conversationId;
      } else {
        const [conv] = await db.insert(conversationsTable).values({
          userId: null,
          sessionTitle: `Telegram - ${ctx.from?.first_name}`,
        }).returning();
        await db.insert(telegramConversationsTable).values({
          telegramUserId: user.id,
          conversationId: conv.id,
        });
        convId = conv.id;
      }
      
      await ctx.replyWithChatAction("typing");
      
      const chunks = await searchSimilarChunks(query, 5);
      const systemPrompt = buildSystemPrompt(chunks, user.language as "ar" | "en");
      
      const history = await db.select().from(chatMessagesTable)
        .where(eq(chatMessagesTable.conversationId, convId))
        .orderBy(desc(chatMessagesTable.createdAt))
        .limit(8);
      
      const { content: reply } = await chatWithClaude(
        [...history.reverse().map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
         { role: "user", content: query }],
        systemPrompt
      );
      
      await db.insert(chatMessagesTable).values([
        { conversationId: convId, role: "user", content: query },
        {
          conversationId: convId,
          role: "assistant",
          content: reply,
          sources: chunks.map(c => ({ title: c.titleAr || c.title, section: c.section })) as any,
        },
      ]);
      
      await db.update(telegramUsersTable).set({ dailyCount: user.dailyCount + 1 })
        .where(eq(telegramUsersTable.id, user.id));
      
      await ctx.reply(reply, { parse_mode: "Markdown" });
    });
    
    botInstance = bot;
    return bot;
  } catch (err) {
    logger.error({ err }, "Failed to init Telegram bot");
    return null;
  }
}

// POST /api/webhook/telegram
router.post("/telegram", async (req: Request, res: Response): Promise<void> => {
  const bot = await getOrInitBot();
  if (!bot) {
    res.sendStatus(200);
    return;
  }
  
  try {
    await bot.handleUpdate(req.body);
  } catch (err) {
    logger.error({ err }, "Telegram webhook error");
  }
  
  res.sendStatus(200);
});

// POST /api/webhook/telegram/setup
router.post("/telegram/setup", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const token = await getSettingValue("telegram_token");
  if (!token) {
    res.status(400).json({ error: "Telegram token not configured" });
    return;
  }
  
  const appUrl = process.env.REPLIT_DEV_DOMAIN || process.env.APP_URL;
  if (!appUrl) {
    res.status(400).json({ error: "App URL not configured" });
    return;
  }
  
  const webhookUrl = `https://${appUrl}/api/webhook/telegram`;
  
  const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });
  
  const tgData = await tgRes.json() as { ok: boolean; description?: string };
  
  if (!tgData.ok) {
    res.status(400).json({ error: "Failed to set webhook", details: tgData.description });
    return;
  }
  
  await setSettingValue("telegram_enabled", "true");
  botInstance = null; // Reset to re-initialize with new settings
  
  res.json({ success: true, webhookUrl });
});

export { getOrInitBot };
export default router;
