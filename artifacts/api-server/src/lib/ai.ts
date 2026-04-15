import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSettingValue } from "./settings.js";

type Message = { role: "user" | "assistant"; content: string };
type AIResult = { content: string; tokensUsed: number };

// ─── Anthropic ────────────────────────────────────────────────────────────────
async function callAnthropic(messages: Message[], systemPrompt: string, model: string): Promise<AIResult> {
  const client = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "",
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || undefined,
  });
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });
  return {
    content: response.content[0].type === "text" ? response.content[0].text : "",
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────
async function callOpenAI(messages: Message[], systemPrompt: string, apiKey: string, model: string): Promise<AIResult> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    max_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
  });
  return {
    content: response.choices[0]?.message?.content || "",
    tokensUsed: (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0),
  };
}

// ─── Gemini ───────────────────────────────────────────────────────────────────
async function callGemini(messages: Message[], systemPrompt: string, apiKey: string, model: string): Promise<AIResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
  });

  const history = messages.slice(0, -1).map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1]?.content || "";
  const chat = geminiModel.startChat({ history });
  const result = await chat.sendMessage(lastMessage);
  const text = result.response.text();
  const usage = result.response.usageMetadata;

  return {
    content: text,
    tokensUsed: (usage?.promptTokenCount || 0) + (usage?.candidatesTokenCount || 0),
  };
}

// ─── Validate / Test Key ──────────────────────────────────────────────────────
export async function testAIKey(provider: string, apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const testMsg: Message[] = [{ role: "user", content: "Say OK" }];
    const sys = "Reply with exactly: OK";
    if (provider === "openai") {
      const model = (await getSettingValue("openai_model")) || "gpt-4o";
      await callOpenAI(testMsg, sys, apiKey, model);
    } else if (provider === "gemini") {
      const model = (await getSettingValue("gemini_model")) || "gemini-1.5-flash";
      await callGemini(testMsg, sys, apiKey, model);
    } else {
      return { ok: false, error: "Unknown provider" };
    }
    return { ok: true };
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes("401") || msg.includes("API key") || msg.includes("invalid") || msg.includes("Incorrect")) {
      return { ok: false, error: "المفتاح غير صحيح أو غير صالح" };
    }
    if (msg.includes("quota") || msg.includes("limit") || msg.includes("rate")) {
      return { ok: false, error: "تجاوز الحصة المسموح بها - المفتاح صحيح لكن الرصيد منته" };
    }
    return { ok: false, error: msg.substring(0, 120) };
  }
}

// ─── Main Unified Chat ────────────────────────────────────────────────────────
export async function chatWithAI(messages: Message[], systemPrompt: string): Promise<AIResult> {
  const provider = (await getSettingValue("ai_provider")) || "anthropic";

  if (provider === "openai") {
    const apiKey = (await getSettingValue("openai_api_key")) || "";
    if (!apiKey) throw new Error("مفتاح OpenAI API غير مُكوَّن في الإعدادات");
    const model = (await getSettingValue("openai_model")) || "gpt-4o";
    return callOpenAI(messages, systemPrompt, apiKey, model);
  }

  if (provider === "gemini") {
    const apiKey = (await getSettingValue("gemini_api_key")) || "";
    if (!apiKey) throw new Error("مفتاح Gemini API غير مُكوَّن في الإعدادات");
    const model = (await getSettingValue("gemini_model")) || "gemini-1.5-flash";
    return callGemini(messages, systemPrompt, apiKey, model);
  }

  // Default: Anthropic (Replit integration)
  const model = (await getSettingValue("ai_model")) || "claude-sonnet-4-6";
  const hasKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!hasKey) throw new Error("مفتاح Anthropic API غير مُكوَّن");
  return callAnthropic(messages, systemPrompt, model);
}
