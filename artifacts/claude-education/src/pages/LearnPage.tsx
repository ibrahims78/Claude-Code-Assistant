import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";

interface Section {
  section: string;
  totalChunks: number;
  readChunks: number;
  progressPercent: number;
}

type Category = "beginner" | "intermediate" | "advanced" | "general";

const sectionMeta: Record<string, { category: Category; titleAr: string; titleEn: string }> = {
  "intro":                { category: "beginner",     titleAr: "مقدمة إلى Claude Code",         titleEn: "Introduction" },
  "README":               { category: "beginner",     titleAr: "نظرة عامة",                     titleEn: "Overview (README)" },
  "INDEX":                { category: "beginner",     titleAr: "الفهرس",                        titleEn: "Index" },
  "LEARNING-ROADMAP":     { category: "beginner",     titleAr: "خارطة التعلم",                  titleEn: "Learning Roadmap" },
  "QUICK_REFERENCE":      { category: "beginner",     titleAr: "المرجع السريع",                 titleEn: "Quick Reference" },
  "slash-commands":       { category: "beginner",     titleAr: "أوامر الشريطة المائلة",         titleEn: "Slash Commands" },
  "settings":             { category: "beginner",     titleAr: "الإعدادات والتكوين",            titleEn: "Settings" },
  "tips":                 { category: "beginner",     titleAr: "نصائح وأفضل الممارسات",         titleEn: "Tips & Best Practices" },
  "resources":            { category: "beginner",     titleAr: "الموارد والمراجع",              titleEn: "Resources" },
  "CATALOG":              { category: "intermediate", titleAr: "كتالوج الميزات",               titleEn: "Features Catalog" },
  "claude_concepts_guide":{ category: "intermediate", titleAr: "دليل مفاهيم Claude",            titleEn: "Claude Concepts Guide" },
  "clean-code-rules":     { category: "intermediate", titleAr: "قواعد الكود النظيف",           titleEn: "Clean Code Rules" },
  "STYLE_GUIDE":          { category: "intermediate", titleAr: "دليل الأسلوب",                 titleEn: "Style Guide" },
  "CONTRIBUTING":         { category: "intermediate", titleAr: "المساهمة في المشروع",           titleEn: "Contributing" },
  "hooks":                { category: "intermediate", titleAr: "نظام Hooks",                   titleEn: "Hooks System" },
  "memory":               { category: "intermediate", titleAr: "إدارة الذاكرة",                titleEn: "Memory Management" },
  "security":             { category: "intermediate", titleAr: "أفضل ممارسات الأمان",          titleEn: "Security Best Practices" },
  "SECURITY":             { category: "intermediate", titleAr: "سياسة الأمان",                 titleEn: "Security Policy" },
  "CODE_OF_CONDUCT":      { category: "intermediate", titleAr: "قواعد السلوك",                 titleEn: "Code of Conduct" },
  "mcp":                  { category: "advanced",     titleAr: "بروتوكول MCP",                titleEn: "Model Context Protocol" },
  "agents":               { category: "advanced",     titleAr: "سير عمل متعدد الوكلاء",        titleEn: "Multi-Agent Workflows" },
  "workflows":            { category: "advanced",     titleAr: "سير العمل الآلي",              titleEn: "Automated Workflows" },
  "CLAUDE":               { category: "advanced",     titleAr: "ملف CLAUDE",                   titleEn: "CLAUDE File" },
  "CHANGELOG":            { category: "general",      titleAr: "سجل التغييرات",                titleEn: "Changelog" },
  "RELEASE_NOTES":        { category: "general",      titleAr: "ملاحظات الإصدار",              titleEn: "Release Notes" },
};

const categoryColors: Record<Category, string> = {
  beginner:     "bg-green-500/15 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  advanced:     "bg-red-500/15 text-red-400 border-red-500/30",
  general:      "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const categoryLabels: Record<Category, { ar: string; en: string }> = {
  beginner:     { ar: "مبتدئ",    en: "Beginner" },
  intermediate: { ar: "متوسط",    en: "Intermediate" },
  advanced:     { ar: "متقدم",    en: "Advanced" },
  general:      { ar: "عام",      en: "General" },
};

function toReadableTitle(section: string): string {
  return section
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function LearnPage() {
  const { lang } = useLang();

  const { data: sections = [], isLoading } = useQuery<Section[]>({
    queryKey: ["sections"],
    queryFn: () => api.get("/content/sections"),
  });

  const totalChunks = sections.reduce((acc, s) => acc + s.totalChunks, 0);
  const totalRead   = sections.reduce((acc, s) => acc + s.readChunks, 0);
  const overallProgress = totalChunks > 0 ? Math.round((totalRead / totalChunks) * 100) : 0;

  const ChevronIcon = lang === "ar" ? ChevronLeft : ChevronRight;

  const categorized: Record<Category, Section[]> = {
    beginner: [], intermediate: [], advanced: [], general: [],
  };

  for (const s of sections) {
    const cat = sectionMeta[s.section]?.category ?? "general";
    categorized[cat].push(s);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <GraduationCap size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {lang === "ar" ? "مسارات التعلم" : "Learning Paths"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {totalRead}/{totalChunks} {lang === "ar" ? "قطعة" : "chunks"}
            </p>
          </div>
          <div className="ms-auto text-right">
            <p className="text-2xl font-bold text-primary">{overallProgress}%</p>
            <p className="text-xs text-muted-foreground">
              {lang === "ar" ? "مكتمل" : "completed"}
            </p>
          </div>
        </div>
        <Progress value={overallProgress} className="h-2" />
      </div>

      <div className="grid gap-6">
        {(["beginner", "intermediate", "advanced", "general"] as Category[]).map(cat => {
          const catSections = categorized[cat];
          if (!catSections.length) return null;
          const label = categoryLabels[cat];
          return (
            <div key={cat}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {lang === "ar" ? label.ar : label.en}
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {catSections.map(section => {
                  const meta = sectionMeta[section.section];
                  const title = meta
                    ? (lang === "ar" ? meta.titleAr : meta.titleEn)
                    : toReadableTitle(section.section);
                  return (
                    <Link key={section.section} href={`/learn/${section.section}`}>
                      <Card className="border-border bg-card hover:border-primary/40 transition-all cursor-pointer group">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <BookOpen size={16} className="text-primary shrink-0" />
                              <span className="font-medium text-sm text-foreground">{title}</span>
                            </div>
                            <ChevronIcon size={15} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                          </div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <Badge className={`${categoryColors[cat]} text-[10px] border`}>
                              {lang === "ar" ? label.ar : label.en}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {section.readChunks}/{section.totalChunks}
                            </span>
                          </div>
                          <Progress value={section.progressPercent} className="h-1.5" />
                        </CardContent>
                      </Card>
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
