import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ArrowRight, ArrowLeft, CheckCircle2, Circle, Search, ChevronDown, ChevronUp } from "lucide-react";

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
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function SectionPage() {
  const [, params] = useRoute("/learn/:sectionId");
  const sectionId = params?.sectionId || "";
  const [, setLocation] = useLocation();
  const { t, lang } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: chunks = [], isLoading } = useQuery<Chunk[]>({
    queryKey: ["section", sectionId],
    queryFn: () => api.get(`/content/sections/${sectionId}`),
    enabled: !!sectionId,
  });

  const markRead = useMutation({
    mutationFn: (chunkId: number) => api.post(`/content/progress/${chunkId}`),
    onSuccess: (_, chunkId) => {
      qc.setQueryData(["section", sectionId], (old: Chunk[] | undefined) =>
        (old || []).map(c => c.id === chunkId ? { ...c, isRead: true } : c)
      );
      qc.invalidateQueries({ queryKey: ["sections"] });
    },
  });

  const isArabic = lang === "ar";

  const getTitle = (chunk: Chunk) => isArabic ? (chunk.titleAr || chunk.title) : chunk.title;
  const getContent = (chunk: Chunk) => {
    const raw = isArabic ? (chunk.contentAr || chunk.content) : chunk.content;
    return cleanContent(raw);
  };

  const filtered = chunks.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return getTitle(c).toLowerCase().includes(q) || getContent(c).toLowerCase().includes(q);
  });

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  const sectionLabel = sectionId.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  const readCount = chunks.filter(c => c.isRead).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" className="gap-2 mb-6 text-muted-foreground" onClick={() => setLocation("/learn")}>
        <BackIcon size={16} />
        {t("back")}
      </Button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">{sectionLabel}</h1>
        <Badge variant="outline" className="border-border text-muted-foreground">
          {readCount}/{chunks.length}
        </Badge>
      </div>

      <div className="relative mb-6">
        <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t("search")}
          className="ps-9 bg-muted border-border"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8">
          {isArabic ? "لا توجد نتائج" : "No results found"}
        </p>
      )}

      <div className="space-y-3">
        {filtered.map(chunk => {
          const isExpanded = expanded.has(chunk.id);
          const title = getTitle(chunk);
          const content = getContent(chunk);

          return (
            <Card
              key={chunk.id}
              className={cn(
                "border-border bg-card transition-all",
                chunk.isRead ? "border-green-500/30" : ""
              )}
            >
              <CardHeader
                className="p-4 pb-3 cursor-pointer select-none"
                onClick={() => setExpanded(prev => {
                  const next = new Set(prev);
                  next.has(chunk.id) ? next.delete(chunk.id) : next.add(chunk.id);
                  return next;
                })}
              >
                <div className="flex items-start gap-3">
                  {chunk.isRead ? (
                    <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground leading-snug">{title}</p>
                    {chunk.category && (
                      <Badge variant="outline" className="mt-1 text-[10px] border-border/50 text-muted-foreground">
                        {t(chunk.category as any)}
                      </Badge>
                    )}
                  </div>
                  {isExpanded
                    ? <ChevronUp size={15} className="text-muted-foreground shrink-0 mt-0.5" />
                    : <ChevronDown size={15} className="text-muted-foreground shrink-0 mt-0.5" />}
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="border-t border-border pt-3">
                    <MarkdownContent content={content} isArabic={isArabic} />
                    {!chunk.isRead && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 mt-4 border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-500/50"
                        onClick={() => markRead.mutate(chunk.id)}
                        disabled={markRead.isPending}
                      >
                        <CheckCircle2 size={14} />
                        {t("markAsRead")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
