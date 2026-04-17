import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BookOpen, GraduationCap, Star, Trophy, ArrowRight, ArrowLeft,
  CheckCircle2, Loader2, Sparkles,
  List, Map, Zap, Terminal, Settings, Lightbulb, Database,
  Layers, BookMarked, Code2, FileText, GitBranch, Wrench, Shield, Cpu,
} from "lucide-react";
import { SECTION_META, getSectionOrder, type Category } from "@/lib/sections";

const ICON_MAP: Record<string, React.ReactNode> = {
  BookOpen: <BookOpen size={16} />, List: <List size={16} />, Map: <Map size={16} />,
  Zap: <Zap size={16} />, Terminal: <Terminal size={16} />, Settings: <Settings size={16} />,
  Lightbulb: <Lightbulb size={16} />, Database: <Database size={16} />, Layers: <Layers size={16} />,
  BookMarked: <BookMarked size={16} />, Code2: <Code2 size={16} />, FileText: <FileText size={16} />,
  GitBranch: <GitBranch size={16} />, Wrench: <Wrench size={16} />, GraduationCap: <GraduationCap size={16} />,
  CheckCircle2: <CheckCircle2 size={16} />, Shield: <Shield size={16} />, Cpu: <Cpu size={16} />,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  section: string;
  totalChunks: number;
  readChunks: number;
  progressPercent: number;
}

interface LearnStats {
  totalPoints: number;
  rank: string;
  icon: string;
  chunksRead: number;
  totalChunks: number;
  achievements: { unlocked: boolean }[];
}

interface SuggestNextResponse {
  message: string;
  suggestedSection: string | null;
  progressSummary: { beginner: number; intermediate: number; advanced: number };
  totalPoints: number;
}

type Filter = "all" | Category;

// ─── Rank icon helper (matches API lowercase values) ─────────────────────────

function getRankIcon(rank: string) {
  if (rank === "platinum") return "💎";
  if (rank === "gold")     return "🥇";
  if (rank === "silver")   return "🥈";
  return "🥉";
}

function toReadableTitle(section: string): string {
  return section.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Category config ──────────────────────────────────────────────────────────

const categoryConfig: Record<Category, {
  labelAr: string; labelEn: string;
  borderColor: string; bgColor: string; textColor: string;
  badgeClass: string;
}> = {
  beginner:     {
    labelAr: "مبتدئ", labelEn: "Beginner",
    borderColor: "border-green-500/40", bgColor: "bg-green-500/5", textColor: "text-green-400",
    badgeClass: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  intermediate: {
    labelAr: "متوسط", labelEn: "Intermediate",
    borderColor: "border-yellow-500/40", bgColor: "bg-yellow-500/5", textColor: "text-yellow-400",
    badgeClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  advanced:     {
    labelAr: "متقدم", labelEn: "Advanced",
    borderColor: "border-red-500/40", bgColor: "bg-red-500/5", textColor: "text-red-400",
    badgeClass: "bg-red-500/15 text-red-400 border-red-500/30",
  },
  general:      {
    labelAr: "عام", labelEn: "General",
    borderColor: "border-blue-500/40", bgColor: "bg-blue-500/5", textColor: "text-blue-400",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LearnPage() {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [activeFilter, setActiveFilter] = useState<Filter>("all");

  const { data: sections = [], isLoading } = useQuery<Section[]>({
    queryKey: ["sections"],
    queryFn: () => api.get("/content/sections"),
  });

  const { data: stats } = useQuery<LearnStats>({
    queryKey: ["learn-stats"],
    queryFn: () => api.get("/learn/stats"),
  });

  const { data: suggestion, isLoading: suggestLoading } = useQuery<SuggestNextResponse>({
    queryKey: ["suggest-next", lang],
    queryFn: () => api.post("/learn/suggest-next", { lang }),
    enabled: sections.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const totalChunks = sections.reduce((a, s) => a + s.totalChunks, 0);
  const totalRead   = sections.reduce((a, s) => a + s.readChunks, 0);
  const overallPct  = totalChunks > 0 ? Math.round((totalRead / totalChunks) * 100) : 0;

  const ChevronIcon = isAr ? ArrowLeft : ArrowRight;

  const categorized: Record<Category, Section[]> = {
    beginner: [], intermediate: [], advanced: [], general: [],
  };
  for (const s of sections) {
    const cat = SECTION_META[s.section]?.category ?? "general";
    categorized[cat].push(s);
  }
  for (const cat of Object.keys(categorized) as Category[]) {
    categorized[cat].sort((a, b) => getSectionOrder(a.section) - getSectionOrder(b.section));
  }

  const filterButtons: { key: Filter; arLabel: string; enLabel: string }[] = [
    { key: "all",          arLabel: "الكل",    enLabel: "All" },
    { key: "beginner",     arLabel: "مبتدئ",   enLabel: "Beginner" },
    { key: "intermediate", arLabel: "متوسط",   enLabel: "Intermediate" },
    { key: "advanced",     arLabel: "متقدم",   enLabel: "Advanced" },
  ];

  const categoriesToShow = (activeFilter === "all"
    ? (["beginner", "intermediate", "advanced", "general"] as Category[])
    : [activeFilter as Category]
  ).filter(cat => categorized[cat].length > 0);

  const unlockedCount = stats?.achievements?.filter(a => a.unlocked).length ?? 0;

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        {/* Skeleton for stats */}
        <div className="rounded-xl border border-border bg-card/60 p-4 animate-pulse h-16" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card p-3 h-16 animate-pulse" />
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">

      {/* ─── AI Welcome Banner ─── */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            {suggestLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                <span>{isAr ? "جاري تحليل تقدمك..." : "Analyzing your progress..."}</span>
              </div>
            ) : suggestion ? (
              <>
                <p className="text-sm text-foreground leading-relaxed">{suggestion.message}</p>
                {suggestion.suggestedSection && (
                  <Link href={`/learn/${suggestion.suggestedSection}`}>
                    <a className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline font-medium">
                      {isAr ? "ابدأ الآن ←" : "Start now →"}
                    </a>
                  </Link>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isAr ? "مرحباً! اختر قسماً للبدء في رحلة تعلمك." : "Welcome! Choose a section to start your learning journey."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Stats Bar ─── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Star size={14} className="text-yellow-400" />
            <span className="text-lg font-bold text-foreground">{stats?.totalPoints ?? 0}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{isAr ? "نقطة" : "Points"}</p>
          {stats && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {getRankIcon(stats.rank)} {isAr ? stats.rank : stats.rank.charAt(0).toUpperCase() + stats.rank.slice(1)}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Trophy size={14} className="text-orange-400" />
            <span className="text-lg font-bold text-foreground">{unlockedCount}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{isAr ? "إنجاز" : "Achievements"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <BookOpen size={14} className="text-blue-400" />
            <span className="text-lg font-bold text-foreground">{totalRead}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isAr ? `من ${totalChunks} قطعة` : `of ${totalChunks} chunks`}
          </p>
        </div>
      </div>

      {/* ─── Overall Progress ─── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-base font-bold text-foreground flex items-center gap-2">
            <GraduationCap size={18} className="text-primary" />
            {isAr ? "مسارات التعلم" : "Learning Paths"}
          </h1>
          <span className="text-sm font-bold text-primary">{overallPct}%</span>
        </div>
        <Progress value={overallPct} className="h-2" />
      </div>

      {/* ─── Filter Buttons ─── */}
      <div className="flex flex-wrap gap-2">
        {filterButtons.map(btn => (
          <Button
            key={btn.key}
            variant="outline"
            size="sm"
            onClick={() => setActiveFilter(btn.key)}
            className={cn(
              "text-xs h-7 px-3 rounded-full border transition-all",
              activeFilter === btn.key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {isAr ? btn.arLabel : btn.enLabel}
          </Button>
        ))}
      </div>

      {/* ─── Section Cards ─── */}
      <div className="space-y-6">
        {categoriesToShow.map(cat => {
          const cfg = categoryConfig[cat];
          const catSections = categorized[cat];
          if (!catSections.length) return null;

          return (
            <div key={cat}>
              <h2 className={cn("text-xs font-semibold uppercase tracking-wider mb-3", cfg.textColor)}>
                {isAr ? cfg.labelAr : cfg.labelEn}
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {catSections.map(section => {
                  const meta = SECTION_META[section.section];
                  const title = meta
                    ? (isAr ? meta.titleAr : meta.titleEn)
                    : toReadableTitle(section.section);
                  const isComplete = section.progressPercent === 100;
                  const icon = (meta?.iconName && ICON_MAP[meta.iconName]) ?? <BookOpen size={16} />;

                  return (
                    <Link key={section.section} href={`/learn/${section.section}`}>
                      <a className="block group">
                        <Card
                          className={cn(
                            "border bg-card transition-all duration-200 cursor-pointer",
                            "hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] hover:border-violet-500/40",
                            isComplete
                              ? "border-green-500/40 bg-green-500/5"
                              : "border-border hover:border-primary/30"
                          )}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                  isComplete ? "bg-green-500/15 text-green-400" : `${cfg.bgColor} ${cfg.textColor}`
                                )}>
                                  {isComplete ? <CheckCircle2 size={16} /> : icon}
                                </div>
                                <span className="font-medium text-sm text-foreground leading-snug line-clamp-2">{title}</span>
                              </div>
                              <ChevronIcon size={15} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                            </div>

                            <div className="flex items-center justify-between gap-2 mb-2">
                              {isComplete ? (
                                <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px] border">
                                  ✅ {isAr ? "مكتمل" : "Complete"}
                                </Badge>
                              ) : (
                                <Badge className={cn(cfg.badgeClass, "text-[10px] border")}>
                                  {isAr ? cfg.labelAr : cfg.labelEn}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {section.readChunks}/{section.totalChunks}
                              </span>
                            </div>

                            <Progress
                              value={section.progressPercent}
                              className={cn("h-1.5", isComplete && "[&>div]:bg-green-500")}
                            />
                          </CardContent>
                        </Card>
                      </a>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
