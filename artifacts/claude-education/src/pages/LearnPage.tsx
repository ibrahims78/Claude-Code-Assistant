import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";

interface Section {
  section: string;
  totalChunks: number;
  readChunks: number;
  progressPercent: number;
}

const sectionMeta: Record<string, { category: "beginner" | "intermediate" | "advanced"; titleAr: string; titleEn: string }> = {
  "intro": { category: "beginner", titleAr: "مقدمة إلى Claude Code", titleEn: "Introduction" },
  "slash-commands": { category: "beginner", titleAr: "أوامر الشريطة المائلة", titleEn: "Slash Commands" },
  "hooks": { category: "intermediate", titleAr: "نظام Hooks", titleEn: "Hooks System" },
  "memory": { category: "intermediate", titleAr: "إدارة الذاكرة", titleEn: "Memory Management" },
  "mcp": { category: "advanced", titleAr: "بروتوكول MCP", titleEn: "Model Context Protocol" },
  "agents": { category: "advanced", titleAr: "سير عمل متعدد الوكلاء", titleEn: "Multi-Agent Workflows" },
  "settings": { category: "beginner", titleAr: "الإعدادات والتكوين", titleEn: "Settings" },
  "security": { category: "intermediate", titleAr: "أفضل ممارسات الأمان", titleEn: "Security" },
  "workflows": { category: "advanced", titleAr: "سير العمل الآلي", titleEn: "Automated Workflows" },
  "tips": { category: "beginner", titleAr: "نصائح وأفضل الممارسات", titleEn: "Tips & Best Practices" },
};

const categoryColors = {
  beginner: "bg-green-500/15 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function LearnPage() {
  const { t, lang } = useLang();

  const { data: sections = [], isLoading } = useQuery<Section[]>({
    queryKey: ["sections"],
    queryFn: () => api.get("/content/sections"),
  });

  const totalChunks = sections.reduce((acc, s) => acc + s.totalChunks, 0);
  const totalRead = sections.reduce((acc, s) => acc + s.readChunks, 0);
  const overallProgress = totalChunks > 0 ? Math.round((totalRead / totalChunks) * 100) : 0;

  const ChevronIcon = lang === "ar" ? ChevronLeft : ChevronRight;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <GraduationCap size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("learn")}</h1>
            <p className="text-sm text-muted-foreground">{totalRead}/{totalChunks} {lang === "ar" ? "قطعة" : "chunks"}</p>
          </div>
          <div className="ms-auto text-right">
            <p className="text-2xl font-bold text-primary">{overallProgress}%</p>
            <p className="text-xs text-muted-foreground">{t("progressPercent")}</p>
          </div>
        </div>
        <Progress value={overallProgress} className="h-2" />
      </div>

      {/* Sections Grid */}
      <div className="grid gap-4">
        {["beginner", "intermediate", "advanced"].map(cat => {
          const catSections = sections.filter(s => sectionMeta[s.section]?.category === cat);
          if (!catSections.length) return null;
          return (
            <div key={cat}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {t(cat as any)}
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {catSections.map(section => {
                  const meta = sectionMeta[section.section];
                  return (
                    <Link key={section.section} href={`/learn/${section.section}`}>
                      <Card className="border-border bg-card hover:border-primary/40 transition-all cursor-pointer group">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <BookOpen size={16} className="text-primary shrink-0" />
                              <span className="font-medium text-sm text-foreground">
                                {lang === "ar" ? meta?.titleAr : meta?.titleEn}
                              </span>
                            </div>
                            <ChevronIcon size={15} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                          </div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <Badge className={`${categoryColors[cat as keyof typeof categoryColors]} text-[10px] border`}>
                              {t(cat as any)}
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
