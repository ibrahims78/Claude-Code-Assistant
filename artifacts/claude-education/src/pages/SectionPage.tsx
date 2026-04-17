import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowRight, ArrowLeft, CheckCircle2, Circle, ChevronLeft, ChevronRight,
  Star, Brain, PanelLeftClose, PanelLeftOpen, Loader2
} from "lucide-react";
import { LearnAiDrawer } from "@/components/LearnAiDrawer";
import { QuizModal } from "@/components/QuizModal";
import { SECTION_META, getSectionTitle } from "@/lib/sections";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Chunk {
  id: number;
  title: string;
  titleAr?: string;
  content: string;
  contentAr?: string;
  category?: string;
  section?: string;
  isRead?: boolean;
}

interface MarkReadResponse {
  success: boolean;
  alreadyRead: boolean;
  pointsEarned: number;
  totalPoints: number;
  newAchievements: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanContent(text: string): string {
  return text
    .replace(/<picture[\s\S]*?<\/picture>/gi, "")
    .replace(/<source[^>]*>/gi, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/!\[.*?\]\(resources\/.*?\)/g, "")
    .replace(/^\s*\n+/, "")
    .trim();
}

function MarkdownContent({ content, isArabic }: { content: string; isArabic: boolean }) {
  return (
    <div
      className={cn(
        "prose prose-sm prose-invert max-w-none",
        "prose-headings:text-foreground prose-headings:font-semibold",
        "prose-p:text-muted-foreground prose-p:leading-relaxed",
        "prose-strong:text-foreground",
        "prose-code:text-purple-300 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs",
        "prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:text-xs",
        "prose-table:text-xs prose-th:text-foreground prose-th:bg-muted/50 prose-td:text-muted-foreground",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-li:text-muted-foreground prose-li:leading-relaxed",
        "prose-blockquote:border-primary/40 prose-blockquote:text-muted-foreground",
        isArabic ? "text-right" : "text-left"
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SectionPage() {
  const [, params] = useRoute("/learn/:sectionId");
  const sectionId = params?.sectionId || "";
  const [, setLocation] = useLocation();
  const { lang } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAr = lang === "ar";

  const [activeChunkIndex, setActiveChunkIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const readingAreaRef = useRef<HTMLDivElement>(null);

  const { data: chunks = [], isLoading } = useQuery<Chunk[]>({
    queryKey: ["section", sectionId],
    queryFn: () => api.get(`/content/sections/${sectionId}`),
    enabled: !!sectionId,
  });

  const markReadMutation = useMutation<MarkReadResponse, Error, number>({
    mutationFn: (chunkId: number) => api.post(`/learn/mark-read/${chunkId}`),
    onSuccess: (data, chunkId) => {
      qc.setQueryData(["section", sectionId], (old: Chunk[] | undefined) =>
        (old || []).map(c => c.id === chunkId ? { ...c, isRead: true } : c)
      );
      qc.invalidateQueries({ queryKey: ["sections"] });
      qc.invalidateQueries({ queryKey: ["learn-stats"] });

      if (!data.alreadyRead && data.pointsEarned > 0) {
        toast({
          title: isAr ? `+${data.pointsEarned} نقطة! ⭐` : `+${data.pointsEarned} points! ⭐`,
          description: data.newAchievements.length > 0
            ? (isAr ? `إنجاز جديد: ${data.newAchievements[0]}` : `New achievement: ${data.newAchievements[0]}`)
            : undefined,
        });
      }
    },
  });

  const getTitle = (chunk: Chunk) => isAr ? (chunk.titleAr || chunk.title) : chunk.title;
  const getContent = (chunk: Chunk) => {
    const raw = isAr ? (chunk.contentAr || chunk.content) : chunk.content;
    return cleanContent(raw);
  };

  const activeChunk = chunks[activeChunkIndex] ?? null;
  const readCount = chunks.filter(c => c.isRead).length;
  const progressPct = chunks.length > 0 ? Math.round((readCount / chunks.length) * 100) : 0;
  const allComplete = chunks.length > 0 && readCount === chunks.length;

  const sectionTitle = getSectionTitle(sectionId, lang);

  // Scroll reading area to top on chunk change
  useEffect(() => {
    readingAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeChunkIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" && !isAr) goNext();
      if (e.key === "ArrowLeft"  && !isAr) goPrev();
      if (e.key === "ArrowRight" && isAr)  goPrev();
      if (e.key === "ArrowLeft"  && isAr)  goNext();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeChunkIndex, chunks.length, isAr]);

  function goNext() {
    if (activeChunk && !activeChunk.isRead) {
      markReadMutation.mutate(activeChunk.id);
    }
    if (activeChunkIndex < chunks.length - 1) {
      setActiveChunkIndex(i => i + 1);
    }
  }

  function goPrev() {
    if (activeChunkIndex > 0) {
      setActiveChunkIndex(i => i - 1);
    }
  }

  function selectChunk(index: number) {
    setActiveChunkIndex(index);
  }

  function markCurrentRead() {
    if (activeChunk) markReadMutation.mutate(activeChunk.id);
  }

  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  const PrevIcon = isAr ? ChevronRight : ChevronLeft;
  const NextIcon = isAr ? ChevronLeft : ChevronRight;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!chunks.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Brain size={28} className="text-muted-foreground/40" />
        </div>
        <div>
          <p className="text-base font-medium text-muted-foreground">
            {isAr ? "لا يوجد محتوى لهذا القسم بعد" : "No content available for this section yet"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setLocation("/learn")}>
          <BackIcon size={14} className="me-2" />
          {isAr ? "العودة لمسارات التعلم" : "Back to Learning Paths"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ─── Top Header Bar ─── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-background shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={() => setLocation("/learn")}
        >
          <BackIcon size={16} />
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">{sectionTitle}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Progress value={progressPct} className="h-1 w-24 md:w-40" />
            <span className="text-[11px] text-muted-foreground shrink-0">
              {readCount}/{chunks.length}
            </span>
          </div>
        </div>

        {allComplete && (
          <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[11px] border shrink-0">
            ✅ {isAr ? "مكتمل" : "Complete"}
          </Badge>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hidden md:flex"
          onClick={() => setSidebarOpen(v => !v)}
          title={sidebarOpen ? (isAr ? "إخفاء القائمة" : "Hide sidebar") : (isAr ? "إظهار القائمة" : "Show sidebar")}
        >
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </Button>
      </div>

      {/* ─── Body: Sidebar + Reading Area ─── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside
          className={cn(
            "border-e border-border bg-sidebar flex-col overflow-hidden transition-all duration-300",
            "hidden md:flex",
            sidebarOpen ? "w-64" : "w-0 border-0"
          )}
        >
          <div className={cn("flex flex-col h-full overflow-y-auto", !sidebarOpen && "invisible")}>
            <div className="p-3 space-y-0.5">
              {chunks.map((chunk, index) => {
                const isActive = index === activeChunkIndex;
                const title = getTitle(chunk);
                return (
                  <button
                    key={chunk.id}
                    onClick={() => selectChunk(index)}
                    className={cn(
                      "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-start transition-all text-sm",
                      isActive
                        ? "bg-primary/10 text-foreground border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <span className="shrink-0 mt-0.5">
                      {chunk.isRead
                        ? <CheckCircle2 size={14} className="text-green-500" />
                        : <Circle size={14} className={isActive ? "text-primary" : "text-muted-foreground/50"} />
                      }
                    </span>
                    <span className="leading-snug line-clamp-2 text-xs">{title}</span>
                  </button>
                );
              })}
            </div>

            {/* Quiz button at bottom of sidebar — now correctly opens QuizModal */}
            {allComplete && (
              <div className="p-3 mt-auto border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/50 text-xs"
                  onClick={() => setShowQuiz(true)}
                >
                  <Brain size={14} />
                  {isAr ? "🧠 اختبر نفسك" : "🧠 Quiz Yourself"}
                </Button>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile chunk navigation strip */}
        <div className="md:hidden absolute bottom-0 inset-x-0 z-10 bg-background/95 backdrop-blur border-t border-border px-3 py-2 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] text-muted-foreground shrink-0 me-1">
            {readCount}/{chunks.length}
          </span>
          <Progress value={progressPct} className="w-20 h-1.5 shrink-0" />
          <div className="flex items-center gap-1.5 ms-2">
            {chunks.map((chunk, index) => (
              <button
                key={chunk.id}
                onClick={() => selectChunk(index)}
                className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0 transition-all",
                  index === activeChunkIndex ? "bg-primary scale-125" : chunk.isRead ? "bg-green-500" : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        </div>

        {/* Reading Area */}
        <main ref={readingAreaRef} className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="p-5 md:p-8 max-w-2xl mx-auto">

            {/* Chunk header */}
            <div className="mb-6">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2 className="text-lg font-bold text-foreground leading-snug">
                  {getTitle(activeChunk)}
                </h2>
                {activeChunk.isRead && (
                  <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{activeChunkIndex + 1} / {chunks.length}</span>
                {activeChunk.category && (
                  <>
                    <span>·</span>
                    <span>{activeChunk.category}</span>
                  </>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="mb-8">
              <MarkdownContent content={getContent(activeChunk)} isArabic={isAr} />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-4 border-t border-border">
              {!activeChunk.isRead ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-500/50"
                  onClick={markCurrentRead}
                  disabled={markReadMutation.isPending}
                >
                  {markReadMutation.isPending
                    ? <Loader2 size={14} className="animate-spin" />
                    : <CheckCircle2 size={14} />
                  }
                  {isAr ? "✓ تم القراءة (+5 نقاط)" : "✓ Mark as Read (+5 pts)"}
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 text-green-500 text-sm">
                  <CheckCircle2 size={15} />
                  <span>{isAr ? "تمت القراءة" : "Read"}</span>
                </div>
              )}

              <div className="flex items-center gap-2 sm:ms-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={goPrev}
                  disabled={activeChunkIndex === 0}
                >
                  <PrevIcon size={13} />
                  {isAr ? "السابق" : "Prev"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={goNext}
                  disabled={activeChunkIndex === chunks.length - 1}
                >
                  {isAr ? "التالي" : "Next"}
                  <NextIcon size={13} />
                </Button>
              </div>
            </div>

            {/* Quiz CTA when all chunks read */}
            {allComplete && (
              <div className="mt-6 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 text-center">
                <p className="text-sm text-foreground font-medium mb-1">
                  🎉 {isAr ? "أنجزت هذا القسم بالكامل!" : "You completed this section!"}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {isAr ? "اختبر فهمك بخمسة أسئلة سريعة" : "Test your understanding with 5 quick questions"}
                </p>
                <Button
                  size="sm"
                  className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={() => setShowQuiz(true)}
                >
                  <Brain size={14} />
                  {isAr ? "🧠 اختبر نفسك" : "🧠 Quiz Yourself"}
                </Button>
                <div className="flex items-center justify-center gap-1 mt-2 text-xs text-yellow-400">
                  <Star size={12} />
                  <span>{isAr ? "حتى 200 نقطة إضافية!" : "Up to 200 bonus points!"}</span>
                </div>
              </div>
            )}

          </div>
        </main>

      </div>

      {/* ─── Quiz Modal ─── */}
      <QuizModal
        sectionId={sectionId}
        sectionTitleAr={SECTION_META[sectionId]?.titleAr ?? sectionId}
        sectionTitleEn={SECTION_META[sectionId]?.titleEn ?? sectionId}
        isOpen={showQuiz}
        onClose={() => setShowQuiz(false)}
      />

      {/* ─── AI Assistant Drawer (floating) ─── */}
      <LearnAiDrawer
        chunkId={activeChunk?.id ?? null}
        sectionId={sectionId}
        chunkTitle={activeChunk ? getTitle(activeChunk) : undefined}
      />
    </div>
  );
}
