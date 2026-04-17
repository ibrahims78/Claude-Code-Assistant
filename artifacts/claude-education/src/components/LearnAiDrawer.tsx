import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MessageCircle, Send, Loader2, Sparkles, BookOpen, X, RotateCcw
} from "lucide-react";
import { Link } from "wouter";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AskResponse {
  answer: string;
  relatedChunks: { id: number; title: string; section: string }[];
  newAchievements: string[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  relatedChunks?: { id: number; title: string; section: string }[];
  isLoading?: boolean;
}

interface LearnAiDrawerProps {
  chunkId: number | null;
  sectionId: string;
  chunkTitle?: string;
}

// ─── Quick suggestion chips ───────────────────────────────────────────────────

const QUICK_SUGGESTIONS_AR = [
  "اشرح لي بمثال عملي",
  "ما التطبيق العملي لهذا؟",
  "لخّص ما قرأته للتو",
  "ما الفرق الأساسي هنا؟",
];

const QUICK_SUGGESTIONS_EN = [
  "Explain with a practical example",
  "What's the practical use?",
  "Summarize what I just read",
  "What's the key difference here?",
];

// ─── Single message bubble ─────────────────────────────────────────────────

function MessageBubble({ message, isAr }: { message: Message; isAr: boolean }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-violet-500/15 text-violet-400"
        )}
      >
        {isUser ? "أ" : <Sparkles size={12} />}
      </div>

      {/* Bubble */}
      <div className={cn("flex-1 max-w-[85%]", isUser ? "items-end" : "items-start", "flex flex-col gap-1.5")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          )}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs">{isAr ? "يفكر..." : "Thinking..."}</span>
            </div>
          ) : (
            <p className={cn("whitespace-pre-wrap", isAr && !isUser ? "text-right" : "")}>
              {message.content}
            </p>
          )}
        </div>

        {/* Related chunks as source links */}
        {!isUser && message.relatedChunks && message.relatedChunks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted-foreground self-center">
              {isAr ? "📚 مصادر:" : "📚 Sources:"}
            </span>
            {message.relatedChunks.map(chunk => (
              <Link key={chunk.id} href={`/learn/${chunk.section}`}>
                <a className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] text-primary hover:bg-primary/20 transition-colors">
                  <BookOpen size={9} />
                  <span className="truncate max-w-[120px]">{chunk.title}</span>
                </a>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function LearnAiDrawer({ chunkId, sectionId, chunkTitle }: LearnAiDrawerProps) {
  const { lang } = useLang();
  const isAr = lang === "ar";

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = isAr ? QUICK_SUGGESTIONS_AR : QUICK_SUGGESTIONS_EN;

  // Scroll to bottom when new message is added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset messages when chunk changes
  useEffect(() => {
    setMessages([]);
  }, [chunkId]);

  // Focus textarea when drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [open]);

  const askMutation = useMutation<AskResponse, Error, string>({
    mutationFn: (question: string) =>
      api.post("/learn/ask-about-chunk", { chunkId, question, lang }),
    onMutate: (question) => {
      // Add user message + loading placeholder
      setMessages(prev => [
        ...prev,
        { role: "user", content: question },
        { role: "assistant", content: "", isLoading: true },
      ]);
    },
    onSuccess: (data) => {
      // Replace loading placeholder with actual answer
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          role: "assistant",
          content: data.answer,
          relatedChunks: data.relatedChunks,
        };
        return updated;
      });
    },
    onError: (error) => {
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          role: "assistant",
          content: isAr
            ? `عذراً، حدث خطأ: ${error.message}`
            : `Sorry, an error occurred: ${error.message}`,
        };
        return updated;
      });
    },
  });

  function sendMessage(text: string) {
    const q = text.trim();
    if (!q || askMutation.isPending) return;
    if (!chunkId) return;
    setInput("");
    askMutation.mutate(q);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const showWelcome = messages.length === 0;

  return (
    <>
      {/* ─── Floating trigger button ─── */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 end-6 z-40",
          "flex items-center gap-2 px-4 py-2.5 rounded-full",
          "bg-violet-600 hover:bg-violet-700 text-white",
          "shadow-lg shadow-violet-500/30 transition-all duration-200",
          "hover:scale-105 active:scale-95",
          "text-sm font-medium"
        )}
        aria-label={isAr ? "اسأل المساعد الذكي" : "Ask AI Assistant"}
      >
        <MessageCircle size={16} />
        <span>{isAr ? "اسأل المساعد" : "Ask AI"}</span>
      </button>

      {/* ─── Sheet Drawer ─── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col gap-0 border-l border-violet-500/20 bg-background"
        >
          {/* Header */}
          <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-violet-500/15 flex items-center justify-center">
                  <Sparkles size={14} className="text-violet-400" />
                </div>
                <div>
                  <SheetTitle className="text-sm font-semibold text-foreground">
                    {isAr ? "المساعد الذكي" : "AI Assistant"}
                  </SheetTitle>
                  {chunkTitle && (
                    <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                      {isAr ? "سياق:" : "Context:"} {chunkTitle}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setMessages([])}
                    title={isAr ? "مسح المحادثة" : "Clear chat"}
                  >
                    <RotateCcw size={13} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  <X size={14} />
                </Button>
              </div>
            </div>

            {/* Context badge */}
            {sectionId && (
              <div className="flex items-center gap-1.5 mt-1">
                <Badge className="text-[10px] bg-violet-500/10 text-violet-400 border-violet-500/20 border">
                  📖 {sectionId}
                </Badge>
                {chunkId && (
                  <Badge className="text-[10px] bg-muted text-muted-foreground border border-border">
                    #{chunkId}
                  </Badge>
                )}
              </div>
            )}
          </SheetHeader>

          {/* ─── Messages area ─── */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* Welcome screen */}
            {showWelcome && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-8">
                <div className="w-14 h-14 rounded-full bg-violet-500/10 flex items-center justify-center">
                  <Sparkles size={24} className="text-violet-400" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    {isAr ? "مرحباً! أنا مساعدك الذكي" : "Hello! I'm your AI assistant"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[220px] leading-relaxed">
                    {isAr
                      ? "أنا هنا لمساعدتك في فهم هذا المحتوى. اسألني أي سؤال!"
                      : "I'm here to help you understand this content. Ask me anything!"}
                  </p>
                </div>

                {/* No chunk selected warning */}
                {!chunkId && (
                  <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-xs text-yellow-400 max-w-[240px]">
                    {isAr
                      ? "⚠️ افتح قطعة محتوى أولاً لتفعيل سياق الأسئلة"
                      : "⚠️ Open a content chunk first to enable contextual questions"}
                  </div>
                )}
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} isAr={isAr} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* ─── Quick suggestion chips ─── */}
          {showWelcome && chunkId && (
            <div className="px-4 pb-3 shrink-0">
              <p className="text-[10px] text-muted-foreground mb-2 text-center">
                {isAr ? "جرّب سؤالاً سريعاً:" : "Try a quick question:"}
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    disabled={askMutation.isPending}
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-full border transition-all",
                      "border-violet-500/30 text-violet-300 bg-violet-500/5",
                      "hover:bg-violet-500/15 hover:border-violet-500/50",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Input area ─── */}
          <div className="px-4 py-3 border-t border-border shrink-0 bg-background">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !chunkId
                    ? (isAr ? "افتح قطعة محتوى أولاً..." : "Open a content chunk first...")
                    : (isAr ? "اكتب سؤالك... (Enter للإرسال)" : "Type your question... (Enter to send)")
                }
                disabled={!chunkId || askMutation.isPending}
                className={cn(
                  "min-h-[44px] max-h-[120px] resize-none text-sm bg-muted border-border",
                  "focus-visible:ring-violet-500/40",
                  isAr && "text-right"
                )}
                rows={1}
              />
              <Button
                size="icon"
                className="h-11 w-11 shrink-0 bg-violet-600 hover:bg-violet-700 text-white"
                onClick={() => sendMessage(input)}
                disabled={!chunkId || !input.trim() || askMutation.isPending}
              >
                {askMutation.isPending
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Send size={16} />
                }
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground text-center mt-1.5">
              {isAr ? "الردود مدعومة بـ Claude AI" : "Powered by Claude AI"}
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
