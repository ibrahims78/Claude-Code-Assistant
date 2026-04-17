export type Category = "beginner" | "intermediate" | "advanced" | "general";

export interface SectionMeta {
  category: Category;
  titleAr: string;
  titleEn: string;
  iconName: string;
  order: number;
}

export const SECTION_META: Record<string, SectionMeta> = {
  "intro":          { category: "beginner",     titleAr: "مقدمة إلى Claude Code",         titleEn: "Introduction to Claude Code",  iconName: "BookOpen",     order: 1  },
  "index":          { category: "beginner",     titleAr: "الفهرس الشامل",                titleEn: "Full Index",                   iconName: "List",         order: 2  },
  "roadmap":        { category: "beginner",     titleAr: "خارطة التعلم",                  titleEn: "Learning Roadmap",             iconName: "Map",          order: 3  },
  "quick-ref":      { category: "beginner",     titleAr: "المرجع السريع",                 titleEn: "Quick Reference",              iconName: "Zap",          order: 4  },
  "slash-commands": { category: "beginner",     titleAr: "أوامر الشريطة المائلة",         titleEn: "Slash Commands",               iconName: "Terminal",     order: 5  },
  "cli":            { category: "beginner",     titleAr: "واجهة سطر الأوامر",             titleEn: "CLI Reference",                iconName: "Terminal",     order: 6  },
  "settings":       { category: "beginner",     titleAr: "الإعدادات والتكوين",            titleEn: "Settings & Configuration",     iconName: "Settings",     order: 7  },
  "tips":           { category: "beginner",     titleAr: "نصائح وأفضل الممارسات",         titleEn: "Tips & Best Practices",        iconName: "Lightbulb",    order: 8  },
  "catalog":        { category: "intermediate", titleAr: "كتالوج الميزات",               titleEn: "Features Catalog",             iconName: "Layers",       order: 10 },
  "style-guide":    { category: "intermediate", titleAr: "دليل الأسلوب",                 titleEn: "Style Guide",                  iconName: "FileText",     order: 11 },
  "hooks":          { category: "intermediate", titleAr: "نظام Hooks",                   titleEn: "Hooks System",                 iconName: "Wrench",       order: 12 },
  "memory":         { category: "intermediate", titleAr: "إدارة الذاكرة",                titleEn: "Memory Management",            iconName: "Database",     order: 13 },
  "skills":         { category: "intermediate", titleAr: "المهارات",                     titleEn: "Skills",                       iconName: "GraduationCap", order: 14 },
  "checkpoints":    { category: "intermediate", titleAr: "نقاط التفتيش",                 titleEn: "Checkpoints",                  iconName: "CheckCircle2", order: 15 },
  "security":       { category: "intermediate", titleAr: "أفضل ممارسات الأمان",          titleEn: "Security Best Practices",      iconName: "Shield",       order: 16 },
  "mcp":            { category: "advanced",     titleAr: "بروتوكول MCP",                titleEn: "Model Context Protocol (MCP)", iconName: "Cpu",          order: 20 },
  "agents":         { category: "advanced",     titleAr: "سير عمل متعدد الوكلاء",        titleEn: "Multi-Agent Workflows",        iconName: "GitBranch",    order: 21 },
  "plugins":        { category: "advanced",     titleAr: "الإضافات",                     titleEn: "Plugins",                      iconName: "Wrench",       order: 22 },
  "advanced":       { category: "advanced",     titleAr: "الميزات المتقدمة",              titleEn: "Advanced Features",            iconName: "Zap",          order: 23 },
  "claude-md":      { category: "advanced",     titleAr: "ملف CLAUDE.md",                titleEn: "CLAUDE.md File",               iconName: "Code2",        order: 24 },
  "workflows":      { category: "advanced",     titleAr: "سير العمل الآلي",              titleEn: "Automated Workflows",          iconName: "Layers",       order: 25 },
};

export function getSectionTitle(sectionId: string, lang: "ar" | "en"): string {
  const meta = SECTION_META[sectionId];
  if (!meta) return sectionId.replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  return lang === "ar" ? meta.titleAr : meta.titleEn;
}

export function getSectionOrder(sectionId: string): number {
  return SECTION_META[sectionId]?.order ?? 99;
}
