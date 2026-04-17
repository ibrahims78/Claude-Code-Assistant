import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Brain, Loader2, Trophy, Star, CheckCircle2, XCircle,
  RotateCcw, ArrowRight, ArrowLeft, Sparkles, ChevronRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuizQuestion {
  id: number;
  question: string;
  options: Record<string, string>;
}

interface QuizResult {
  questionId: number;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  correct: boolean;
}

interface GenerateResponse {
  quizId: string;
  questions: QuizQuestion[];
}

interface SubmitResponse {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  results: QuizResult[];
  pointsEarned: number;
  totalPoints: number;
  newAchievements: string[];
}

type Stage = "intro" | "loading" | "questions" | "submitting" | "results";

// ─── Achievement Display ──────────────────────────────────────────────────────

const ACHIEVEMENT_META: Record<string, { nameAr: string; nameEn: string; icon: string }> = {
  quiz_perfect:       { nameAr: "الطالب المثالي",          nameEn: "Perfect Score",       icon: "🏆" },
  first_read:         { nameAr: "القارئ الأول",            nameEn: "First Reader",         icon: "📖" },
  section_complete:   { nameAr: "أتممت قسماً",             nameEn: "Section Complete",     icon: "✅" },
  ai_explorer:        { nameAr: "مستكشف الذكاء الاصطناعي", nameEn: "AI Explorer",          icon: "🤖" },
  speed_reader:       { nameAr: "القارئ السريع",           nameEn: "Speed Reader",         icon: "⚡" },
  daily_streak_7:     { nameAr: "أسبوع متواصل",           nameEn: "Weekly Streak",        icon: "🔥" },
  beginner_done:      { nameAr: "خريج المستوى المبتدئ",   nameEn: "Beginner Graduate",    icon: "🎓" },
  intermediate_done:  { nameAr: "خريج المستوى المتوسط",   nameEn: "Intermediate Graduate", icon: "🎓" },
  advanced_done:      { nameAr: "خريج المستوى المتقدم",   nameEn: "Advanced Graduate",    icon: "🎓" },
  completionist:      { nameAr: "المكتمل",                 nameEn: "Completionist",        icon: "💎" },
};

// ─── Option Button ────────────────────────────────────────────────────────────

function OptionButton({
  letter,
  text,
  selected,
  revealed,
  correct,
  isAr,
  onClick,
}: {
  letter: string;
  text: string;
  selected: boolean;
  revealed?: boolean;
  correct?: boolean;
  isAr: boolean;
  onClick: () => void;
}) {
  const base = "w-full text-start p-3 rounded-lg border transition-all duration-200 text-sm flex items-start gap-3";

  let colorClass = "border-border hover:border-violet-400/60 hover:bg-violet-500/5 cursor-pointer";
  if (revealed) {
    if (correct) colorClass = "border-green-500 bg-green-500/10 text-green-400 cursor-default";
    else if (selected && !correct) colorClass = "border-red-500 bg-red-500/10 text-red-400 cursor-default";
    else colorClass = "border-border opacity-50 cursor-default";
  } else if (selected) {
    colorClass = "border-violet-500 bg-violet-500/15 cursor-pointer";
  }

  return (
    <button className={cn(base, colorClass)} onClick={onClick} disabled={revealed}>
      <span className={cn(
        "flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold border transition-colors",
        selected && !revealed ? "bg-violet-600 border-violet-600 text-white" :
        revealed && correct   ? "bg-green-600 border-green-600 text-white" :
        revealed && selected  ? "bg-red-600 border-red-600 text-white" :
        "border-border text-muted-foreground"
      )}>
        {letter}
      </span>
      <span className={cn("flex-1 leading-relaxed", isAr && "text-right")}>{text}</span>
    </button>
  );
}

// ─── QuizModal ────────────────────────────────────────────────────────────────

interface QuizModalProps {
  sectionId: string;
  sectionTitleAr: string;
  sectionTitleEn: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QuizModal({
  sectionId,
  sectionTitleAr,
  sectionTitleEn,
  isOpen,
  onClose,
}: QuizModalProps) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const sectionTitle = isAr ? sectionTitleAr : sectionTitleEn;

  // Stage management
  const [stage, setStage] = useState<Stage>("intro");
  const [quizId, setQuizId] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<SubmitResponse | null>(null);
  const [showReview, setShowReview] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStage("intro");
      setQuizId("");
      setQuestions([]);
      setCurrentIdx(0);
      setAnswers({});
      setSelectedOption(null);
      setSubmitted(false);
      setResults(null);
      setShowReview(false);
    }
  }, [isOpen]);

  // Generate quiz mutation
  const generateMutation = useMutation<GenerateResponse, Error>({
    mutationFn: () =>
      api.get<GenerateResponse>(`/learn/quiz/${encodeURIComponent(sectionId)}/generate`),
    onMutate: () => setStage("loading"),
    onSuccess: (data) => {
      setQuizId(data.quizId);
      setQuestions(data.questions);
      setCurrentIdx(0);
      setAnswers({});
      setSelectedOption(null);
      setStage("questions");
    },
    onError: () => setStage("intro"),
  });

  // Submit quiz mutation
  const submitMutation = useMutation<SubmitResponse, Error>({
    mutationFn: () =>
      api.post<SubmitResponse>(`/learn/quiz/${encodeURIComponent(sectionId)}/submit`, {
        quizId,
        answers,
      }),
    onMutate: () => setStage("submitting"),
    onSuccess: (data) => {
      setResults(data);
      setStage("results");
    },
    onError: () => setStage("questions"),
  });

  const currentQuestion = questions[currentIdx];
  const isLastQuestion = currentIdx === questions.length - 1;

  function handleSelectOption(letter: string) {
    if (submitted) return;
    setSelectedOption(letter);
  }

  function handleNext() {
    if (!selectedOption) return;
    const newAnswers = { ...answers, [String(currentQuestion.id)]: selectedOption };
    setAnswers(newAnswers);
    setSelectedOption(null);
    setSubmitted(false);

    if (isLastQuestion) {
      submitMutation.mutate();
    } else {
      setCurrentIdx(i => i + 1);
    }
  }

  // ── Rank helper ──
  function getRankInfo(pts: number) {
    if (pts >= 5000) return { icon: "💎", name: isAr ? "بلاتيني" : "Platinum", color: "text-cyan-400" };
    if (pts >= 2000) return { icon: "🥇", name: isAr ? "ذهبي" : "Gold",     color: "text-yellow-400" };
    if (pts >= 500)  return { icon: "🥈", name: isAr ? "فضي" : "Silver",   color: "text-slate-300" };
    return             { icon: "🥉", name: isAr ? "برونزي" : "Bronze",  color: "text-amber-600" };
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENDER — INTRO
  // ─────────────────────────────────────────────────────────────────────
  const renderIntro = () => (
    <div className="flex flex-col items-center text-center gap-5 py-4">
      <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
        <Brain size={32} className="text-violet-400" />
      </div>
      <div>
        <h3 className="text-lg font-bold mb-1">
          {isAr ? "اختبر فهمك" : "Test Your Understanding"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isAr
            ? `سيتم توليد ٥ أسئلة تفاعلية من محتوى قسم:`
            : `5 interactive questions from the section:`}
        </p>
        <p className="text-sm font-semibold text-violet-400 mt-1">"{sectionTitle}"</p>
      </div>

      <div className="w-full rounded-xl bg-card/60 border border-border p-4 text-sm space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
          <span>{isAr ? "٥ أسئلة اختيار من متعدد" : "5 multiple-choice questions"}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Star size={14} className="text-yellow-400 flex-shrink-0" />
          <span>{isAr ? "حتى ٢٠٠ نقطة (٢٠ لكل إجابة صحيحة + ١٠٠ bonus للاختبار الكامل)" : "Up to 200 pts (20 per correct + 100 bonus for 100%)"}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Brain size={14} className="text-violet-400 flex-shrink-0" />
          <span>{isAr ? "الأسئلة مولّدة بالذكاء الاصطناعي من المحتوى" : "AI-generated from section content"}</span>
        </div>
      </div>

      {generateMutation.isError && (
        <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 w-full text-center">
          {(generateMutation.error as Error)?.message ?? (isAr ? "حدث خطأ، يرجى المحاولة مجدداً" : "An error occurred, please try again")}
        </p>
      )}

      <Button
        className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"
        onClick={() => generateMutation.mutate()}
      >
        <Sparkles size={16} />
        {isAr ? "ابدأ الاختبار" : "Start Quiz"}
      </Button>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────
  // RENDER — LOADING
  // ─────────────────────────────────────────────────────────────────────
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
          <Brain size={28} className="text-violet-400 animate-pulse" />
        </div>
        <Loader2 size={20} className="text-violet-400 animate-spin absolute -bottom-1 -right-1" />
      </div>
      <div className="text-center">
        <p className="font-medium">{isAr ? "جاري توليد الأسئلة..." : "Generating questions..."}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr ? "الذكاء الاصطناعي يحلّل المحتوى" : "AI is analyzing the content"}
        </p>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────
  // RENDER — QUESTIONS
  // ─────────────────────────────────────────────────────────────────────
  const renderQuestions = () => {
    if (!currentQuestion) return null;
    const progress = ((currentIdx) / questions.length) * 100;

    return (
      <div className="flex flex-col gap-4">
        {/* Progress */}
        <div className="flex items-center gap-3">
          <Progress value={progress} className="flex-1 h-1.5" />
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {isAr
              ? `${currentIdx + 1} / ${questions.length}`
              : `${currentIdx + 1} of ${questions.length}`}
          </span>
        </div>

        {/* Question number badge */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs bg-violet-600/20 text-violet-400 border-violet-500/30">
            {isAr ? `السؤال ${currentIdx + 1}` : `Question ${currentIdx + 1}`}
          </Badge>
        </div>

        {/* Question text */}
        <p className={cn(
          "text-base font-medium leading-relaxed",
          isAr && "text-right"
        )}>
          {currentQuestion.question}
        </p>

        {/* Options */}
        <div className="flex flex-col gap-2 mt-1">
          {Object.entries(currentQuestion.options).map(([letter, text]) => (
            <OptionButton
              key={letter}
              letter={letter}
              text={text}
              selected={selectedOption === letter}
              isAr={isAr}
              onClick={() => handleSelectOption(letter)}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className={cn("flex mt-2", isAr ? "justify-start" : "justify-end")}>
          <Button
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white min-w-[120px]"
            disabled={!selectedOption}
            onClick={handleNext}
          >
            {isLastQuestion
              ? (isAr ? "إرسال الإجابات" : "Submit Answers")
              : (isAr ? "التالي" : "Next")}
            {isAr ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}
          </Button>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────
  // RENDER — SUBMITTING
  // ─────────────────────────────────────────────────────────────────────
  const renderSubmitting = () => (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Loader2 size={32} className="text-violet-400 animate-spin" />
      <p className="text-sm text-muted-foreground">
        {isAr ? "جاري تصحيح الإجابات..." : "Grading your answers..."}
      </p>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────
  // RENDER — RESULTS
  // ─────────────────────────────────────────────────────────────────────
  const renderResults = () => {
    if (!results) return null;
    const { score, total, percentage, passed, pointsEarned, totalPoints, newAchievements } = results;
    const rank = getRankInfo(totalPoints);

    const emoji =
      percentage === 100 ? "🏆" :
      percentage >= 80   ? "🎉" :
      percentage >= 60   ? "👍" : "📚";

    const messageAr =
      percentage === 100 ? "ممتاز! نتيجة مثالية!" :
      percentage >= 80   ? "رائع! أداء ممتاز!" :
      percentage >= 60   ? "جيد، لكن يمكنك التحسين!" : "حاول مجدداً لتحسين نتيجتك";

    const messageEn =
      percentage === 100 ? "Perfect score!" :
      percentage >= 80   ? "Great performance!" :
      percentage >= 60   ? "Good, but room to improve!" : "Try again to improve your score";

    return (
      <div className="flex flex-col gap-5">
        {/* Score circle */}
        <div className="flex flex-col items-center gap-3 py-3">
          <div className={cn(
            "w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center",
            passed ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10"
          )}>
            <span className="text-2xl font-bold">{percentage}%</span>
            <span className="text-xs text-muted-foreground">{score}/{total}</span>
          </div>
          <div className="text-center">
            <p className="text-lg">{emoji} {isAr ? messageAr : messageEn}</p>
          </div>
        </div>

        {/* Points earned */}
        <div className="rounded-xl bg-card/60 border border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star size={18} className="text-yellow-400" />
            <span className="font-semibold">
              {isAr ? `+${pointsEarned} نقطة` : `+${pointsEarned} points`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={rank.color}>{rank.icon}</span>
            <span>{isAr ? `المجموع: ${totalPoints}` : `Total: ${totalPoints}`}</span>
          </div>
        </div>

        {/* New achievements */}
        {newAchievements.length > 0 && (
          <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-3">
            <p className="text-xs font-semibold text-yellow-400 mb-2 flex items-center gap-1">
              <Trophy size={12} /> {isAr ? "إنجازات جديدة مفتوحة!" : "New achievements unlocked!"}
            </p>
            <div className="flex flex-wrap gap-2">
              {newAchievements.map(key => {
                const meta = ACHIEVEMENT_META[key];
                return meta ? (
                  <Badge key={key} variant="secondary" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs gap-1">
                    {meta.icon} {isAr ? meta.nameAr : meta.nameEn}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Review toggle */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={() => setShowReview(v => !v)}
        >
          <ChevronRight size={14} className={cn("transition-transform", showReview && "rotate-90")} />
          {isAr ? "مراجعة الإجابات" : "Review Answers"}
        </Button>

        {/* Review table */}
        {showReview && (
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {results.results.map((r, i) => (
              <div key={r.questionId} className={cn(
                "rounded-lg border p-3 text-xs",
                r.correct ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
              )}>
                <div className={cn("flex items-start gap-2 mb-1", isAr && "flex-row-reverse")}>
                  {r.correct
                    ? <CheckCircle2 size={13} className="text-green-400 flex-shrink-0 mt-0.5" />
                    : <XCircle    size={13} className="text-red-400 flex-shrink-0 mt-0.5" />}
                  <span className="font-medium leading-relaxed">{i + 1}. {r.question}</span>
                </div>
                {!r.correct && (
                  <div className={cn("flex flex-wrap gap-2 mt-1", isAr && "flex-row-reverse")}>
                    <span className="text-red-400">
                      {isAr ? `إجابتك: ${r.userAnswer}` : `Your answer: ${r.userAnswer}`}
                    </span>
                    <span className="text-green-400">
                      {isAr ? `الصحيحة: ${r.correctAnswer}` : `Correct: ${r.correctAnswer}`}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-1">
          <Button
            variant="outline"
            className="flex-1 gap-2 text-sm"
            onClick={() => generateMutation.mutate()}
          >
            <RotateCcw size={14} />
            {isAr ? "اختبار جديد" : "New Quiz"}
          </Button>
          <Button
            className="flex-1 gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm"
            onClick={onClose}
          >
            {isAr ? "العودة للقسم" : "Back to Section"}
          </Button>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────
  // DIALOG SHELL
  // ─────────────────────────────────────────────────────────────────────

  const titleMap: Record<Stage, { ar: string; en: string }> = {
    intro:      { ar: "اختبر نفسك",       en: "Quiz Yourself" },
    loading:    { ar: "جاري التوليد...",  en: "Generating..." },
    questions:  { ar: "الاختبار",         en: "Quiz" },
    submitting: { ar: "جاري التصحيح...", en: "Grading..." },
    results:    { ar: "النتيجة",          en: "Results" },
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-md w-full bg-background border-border"
        dir={isAr ? "rtl" : "ltr"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Brain size={18} className="text-violet-400 flex-shrink-0" />
            <span>{isAr ? titleMap[stage].ar : titleMap[stage].en}</span>
            {stage === "questions" && (
              <Badge variant="secondary" className="ml-auto text-xs bg-violet-600/20 text-violet-400 border-violet-500/30">
                {sectionTitle}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          {stage === "intro"      && renderIntro()}
          {stage === "loading"    && renderLoading()}
          {stage === "questions"  && renderQuestions()}
          {stage === "submitting" && renderSubmitting()}
          {stage === "results"    && renderResults()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
