import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Star, Trophy, Clock, Lock, CheckCircle2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Achievement {
  key: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  icon: string;
  points: number;
  unlocked: boolean;
  unlockedAt?: string | null;
}

interface PointEvent {
  id: number;
  points: number;
  reason: string;
  createdAt: string;
}

interface StatsResponse {
  totalPoints: number;
  rank: string;
  rankAr: string;
  icon: string;
  nextRank: string;
  nextPoints: number;
  chunksRead: number;
  totalChunks: number;
  sectionsCompleted: number;
  totalSections: number;
  quizzesTaken: number;
  aiConversations: number;
  achievements: Achievement[];
  recentActivity: PointEvent[];
}

// ─── Rank helpers ─────────────────────────────────────────────────────────────

const RANK_COLORS: Record<string, string> = {
  bronze:   "text-amber-600  bg-amber-600/10  border-amber-600/30",
  silver:   "text-slate-300  bg-slate-300/10  border-slate-300/30",
  gold:     "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  platinum: "text-cyan-400   bg-cyan-400/10   border-cyan-400/30",
};

const RANK_PROGRESS_COLOR: Record<string, string> = {
  bronze:   "bg-amber-500",
  silver:   "bg-slate-400",
  gold:     "bg-yellow-400",
  platinum: "bg-cyan-400",
};

const RANK_THRESHOLDS: Record<string, number> = {
  bronze: 0, silver: 500, gold: 2000, platinum: 5000,
};

// ─── Reason labels ────────────────────────────────────────────────────────────

function reasonLabel(reason: string, isAr: boolean): string {
  const map: Record<string, { ar: string; en: string }> = {
    chunk_read:       { ar: "قراءة قطعة محتوى",       en: "Read a chunk" },
    section_complete: { ar: "إتمام قسم كامل",          en: "Completed a section" },
    quiz_complete:    { ar: "إكمال اختبار",             en: "Completed a quiz" },
    ai_question:      { ar: "سؤال المساعد الذكي",      en: "Asked AI assistant" },
  };
  if (reason.startsWith("achievement_")) {
    return isAr ? "فتح إنجاز 🏆" : "Achievement unlocked 🏆";
  }
  const entry = map[reason];
  return entry ? (isAr ? entry.ar : entry.en) : reason;
}

// ─── Achievement Card ─────────────────────────────────────────────────────────

function AchievementCard({ a, isAr }: { a: Achievement; isAr: boolean }) {
  const name = isAr ? a.nameAr : a.nameEn;
  const desc = a.descAr;

  return (
    <div className={cn(
      "rounded-xl border p-3 flex flex-col gap-1.5 transition-all duration-200",
      a.unlocked
        ? "border-violet-500/30 bg-violet-500/8 hover:bg-violet-500/12"
        : "border-border bg-muted/20 opacity-55"
    )}>
      <div className="flex items-start justify-between gap-1">
        <span className="text-2xl leading-none">{a.icon}</span>
        {a.unlocked
          ? <CheckCircle2 size={13} className="text-green-400 flex-shrink-0 mt-0.5" />
          : <Lock size={11} className="text-muted-foreground flex-shrink-0 mt-0.5" />}
      </div>
      <p className={cn("text-xs font-semibold leading-snug", !a.unlocked && "text-muted-foreground")}>
        {name}
      </p>
      <p className="text-[10px] text-muted-foreground leading-snug">{desc}</p>
      <div className="flex items-center gap-1 mt-auto">
        <Star size={10} className={a.unlocked ? "text-yellow-400" : "text-muted-foreground"} />
        <span className={cn("text-[10px] font-medium", a.unlocked ? "text-yellow-400" : "text-muted-foreground")}>
          +{a.points}
        </span>
      </div>
    </div>
  );
}

// ─── Activity Row ─────────────────────────────────────────────────────────────

function ActivityRow({ event, isAr }: { event: PointEvent; isAr: boolean }) {
  const date = new Date(event.createdAt);
  const timeStr = date.toLocaleString(isAr ? "ar-SA" : "en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
        <Star size={13} className="text-yellow-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{reasonLabel(event.reason, isAr)}</p>
        <p className="text-[10px] text-muted-foreground">{timeStr}</p>
      </div>
      <span className="text-xs font-bold text-yellow-400 flex-shrink-0">
        +{event.points}
      </span>
    </div>
  );
}

// ─── AchievementsPanel ────────────────────────────────────────────────────────

interface AchievementsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AchievementsPanel({ isOpen, onClose }: AchievementsPanelProps) {
  const { lang } = useLang();
  const isAr = lang === "ar";

  const { data: stats, isLoading } = useQuery<StatsResponse>({
    queryKey: ["learn-stats"],
    queryFn: () => api.get<StatsResponse>("/learn/stats"),
    enabled: isOpen,
    staleTime: 30_000,
  });

  // Rank progress calculation
  const totalPts    = stats?.totalPoints ?? 0;
  const rank        = stats?.rank ?? "bronze";
  const currentFloor = RANK_THRESHOLDS[rank] ?? 0;
  const nextPts     = stats?.nextPoints ?? 500;
  const isPlatinum  = rank === "platinum";
  const progressPct = isPlatinum
    ? 100
    : Math.min(100, Math.round(((totalPts - currentFloor) / (nextPts - currentFloor)) * 100));

  const unlockedCount = stats?.achievements.filter(a => a.unlocked).length ?? 0;
  const totalAch = stats?.achievements.length ?? 0;

  const rankColorClass = RANK_COLORS[rank] ?? RANK_COLORS.bronze;
  const progressColorClass = RANK_PROGRESS_COLOR[rank] ?? RANK_PROGRESS_COLOR.bronze;

  return (
    <Sheet open={isOpen} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side={isAr ? "left" : "right"}
        className="w-full sm:w-[400px] p-0 flex flex-col bg-background border-border"
        dir={isAr ? "rtl" : "ltr"}
      >
        <SheetHeader className="p-4 pb-3 border-b border-border flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Trophy size={18} className="text-yellow-400" />
            {isAr ? "النقاط والإنجازات" : "Points & Achievements"}
          </SheetTitle>
        </SheetHeader>

        {/* ── Rank card ── */}
        <div className={cn(
          "mx-4 mt-4 rounded-xl border p-4 flex-shrink-0",
          rankColorClass
        )}>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          ) : (
            <>
              {/* Rank + points */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-2xl font-black">{stats?.icon} {isAr ? stats?.rankAr : stats?.rank}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {isAr ? `${unlockedCount} من ${totalAch} إنجاز` : `${unlockedCount} of ${totalAch} achievements`}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-2xl font-black">{totalPts.toLocaleString()}</p>
                  <p className="text-xs opacity-70">{isAr ? "نقطة" : "points"}</p>
                </div>
              </div>

              {/* Progress to next rank */}
              {!isPlatinum && (
                <>
                  <div className="relative h-2 w-full bg-black/20 rounded-full overflow-hidden mb-1.5">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", progressColorClass)}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] opacity-70">
                    {isAr
                      ? `${nextPts - totalPts} نقطة للوصول إلى ${stats?.nextRank}`
                      : `${nextPts - totalPts} pts to reach ${stats?.nextRank}`}
                  </p>
                </>
              )}
              {isPlatinum && (
                <p className="text-xs font-semibold opacity-80 text-center">
                  {isAr ? "🎉 أعلى رتبة! أنت بطل!" : "🎉 Maximum rank! You're a champion!"}
                </p>
              )}

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-black/10">
                {[
                  { v: stats?.chunksRead ?? 0,      l: isAr ? "مقروءة" : "Read" },
                  { v: stats?.sectionsCompleted ?? 0, l: isAr ? "أقسام" : "Sections" },
                  { v: stats?.quizzesTaken ?? 0,     l: isAr ? "اختبارات" : "Quizzes" },
                ].map(({ v, l }) => (
                  <div key={l} className="text-center">
                    <p className="text-lg font-bold">{v}</p>
                    <p className="text-[10px] opacity-70">{l}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Tabs: Achievements / Activity ── */}
        <Tabs defaultValue="achievements" className="flex-1 flex flex-col min-h-0 px-4 pb-4 pt-3">
          <TabsList className="w-full grid grid-cols-2 mb-3 flex-shrink-0">
            <TabsTrigger value="achievements" className="text-xs gap-1.5">
              <Trophy size={13} />
              {isAr ? "الإنجازات" : "Achievements"}
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1.5">
              <Clock size={13} />
              {isAr ? "النشاط الأخير" : "Recent Activity"}
            </TabsTrigger>
          </TabsList>

          {/* Achievements grid */}
          <TabsContent value="achievements" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              {isLoading ? (
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 rounded-xl" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {(stats?.achievements ?? []).map(a => (
                      <AchievementCard key={a.key} a={a} isAr={isAr} />
                    ))}
                  </div>
                  {(stats?.achievements ?? []).length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      {isAr ? "لا توجد إنجازات بعد" : "No achievements yet"}
                    </p>
                  )}
                </>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Recent activity */}
          <TabsContent value="activity" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : (stats?.recentActivity ?? []).length > 0 ? (
                <div>
                  {(stats?.recentActivity ?? []).map(event => (
                    <ActivityRow key={event.id} event={event} isAr={isAr} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <Clock size={32} className="text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    {isAr ? "ابدأ بقراءة المحتوى لكسب النقاط!" : "Start reading to earn points!"}
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
