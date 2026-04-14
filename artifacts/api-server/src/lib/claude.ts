import Anthropic from "@anthropic-ai/sdk";
import { getSettingValue } from "./settings.js";
import type { ContentChunk } from "@workspace/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

export async function generateEmbedding(text: string): Promise<number[]> {
  // Simple deterministic embedding based on text hash for development
  // In production this would use a proper embedding API
  const hash = Array.from(text).reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  
  const embedding = new Array(1536).fill(0).map((_, i) => {
    const seed = hash * (i + 1) * 2654435761;
    return ((seed >>> 16) / 65535) * 2 - 1;
  });
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / (magnitude || 1));
}

export async function chatWithClaude(
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt: string,
  model?: string
): Promise<{ content: string; tokensUsed: number }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      content: "⚠️ ANTHROPIC_API_KEY غير مُكوَّن. يرجى إضافة مفتاح Anthropic API في إعدادات المشروع للحصول على ردود ذكاء اصطناعي.",
      tokensUsed: 0,
    };
  }
  
  const aiModel = model || (await getSettingValue("ai_model")) || "claude-3-5-sonnet-20241022";
  
  const response = await anthropic.messages.create({
    model: aiModel,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });
  
  return {
    content: response.content[0].type === "text" ? response.content[0].text : "",
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}

export function buildSystemPrompt(chunks: ContentChunk[], language: "ar" | "en"): string {
  const context = chunks.map((c, i) =>
    `[${i + 1}] ${language === "ar" ? (c.titleAr || c.title) : c.title}\n${language === "ar" ? (c.contentAr || c.content) : c.content}`
  ).join("\n\n---\n\n");

  if (language === "ar") {
    return `أنت مساعد تعليمي متخصص في Claude Code. أجب بالعربية فقط.
استند فقط للمعلومات التالية وأشر إلى المصدر في إجابتك:

${context || "لا توجد معلومات متاحة حالياً في قاعدة المعرفة."}

إذا لم تجد الإجابة في المعلومات المُقدَّمة، قل ذلك صراحةً.`;
  }
  return `You are an educational assistant specialized in Claude Code. Answer only in English.
Base your answer ONLY on the following context and cite the source:

${context || "No knowledge base information currently available."}

If the answer is not in the provided context, say so explicitly.`;
}
