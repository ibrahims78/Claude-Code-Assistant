export type Category = "beginner" | "intermediate" | "advanced" | "general";

export interface SectionMeta {
  category: Category;
  titleAr: string;
  titleEn: string;
  iconName: string;
}

export const SECTION_META: Record<string, SectionMeta> = {
  "intro":                { category: "beginner",     titleAr: "مقدمة إلى Claude Code",         titleEn: "Introduction",            iconName: "BookOpen" },
  "INDEX":                { category: "beginner",     titleAr: "الفهرس",                        titleEn: "Index",                   iconName: "List" },
  "LEARNING-ROADMAP":     { category: "beginner",     titleAr: "خارطة التعلم",                  titleEn: "Learning Roadmap",        iconName: "Map" },
  "QUICK_REFERENCE":      { category: "beginner",     titleAr: "المرجع السريع",                 titleEn: "Quick Reference",         iconName: "Zap" },
  "slash-commands":       { category: "beginner",     titleAr: "أوامر الشريطة المائلة",         titleEn: "Slash Commands",          iconName: "Terminal" },
  "cli":                  { category: "beginner",     titleAr: "واجهة سطر الأوامر",             titleEn: "CLI Reference",           iconName: "Terminal" },
  "settings":             { category: "beginner",     titleAr: "الإعدادات والتكوين",            titleEn: "Settings",                iconName: "Settings" },
  "tips":                 { category: "beginner",     titleAr: "نصائح وأفضل الممارسات",         titleEn: "Tips & Best Practices",   iconName: "Lightbulb" },
  "resources":            { category: "beginner",     titleAr: "الموارد والمراجع",              titleEn: "Resources",               iconName: "Database" },
  "CATALOG":              { category: "intermediate", titleAr: "كتالوج الميزات",               titleEn: "Features Catalog",        iconName: "Layers" },
  "claude_concepts_guide":{ category: "intermediate", titleAr: "دليل مفاهيم Claude",            titleEn: "Claude Concepts Guide",   iconName: "BookMarked" },
  "clean-code-rules":     { category: "intermediate", titleAr: "قواعد الكود النظيف",           titleEn: "Clean Code Rules",        iconName: "Code2" },
  "STYLE_GUIDE":          { category: "intermediate", titleAr: "دليل الأسلوب",                 titleEn: "Style Guide",             iconName: "FileText" },
  "CONTRIBUTING":         { category: "intermediate", titleAr: "المساهمة في المشروع",           titleEn: "Contributing",            iconName: "GitBranch" },
  "hooks":                { category: "intermediate", titleAr: "نظام Hooks",                   titleEn: "Hooks System",            iconName: "Wrench" },
  "memory":               { category: "intermediate", titleAr: "إدارة الذاكرة",                titleEn: "Memory Management",       iconName: "Database" },
  "skills":               { category: "intermediate", titleAr: "المهارات",                     titleEn: "Skills",                  iconName: "GraduationCap" },
  "checkpoints":          { category: "intermediate", titleAr: "نقاط التفتيش",                 titleEn: "Checkpoints",             iconName: "CheckCircle2" },
  "security":             { category: "intermediate", titleAr: "أفضل ممارسات الأمان",          titleEn: "Security Best Practices", iconName: "Shield" },
  "SECURITY":             { category: "intermediate", titleAr: "سياسة الأمان",                 titleEn: "Security Policy",         iconName: "Shield" },
  "CODE_OF_CONDUCT":      { category: "intermediate", titleAr: "قواعد السلوك",                 titleEn: "Code of Conduct",         iconName: "FileText" },
  "mcp":                  { category: "advanced",     titleAr: "بروتوكول MCP",                titleEn: "Model Context Protocol",  iconName: "Cpu" },
  "agents":               { category: "advanced",     titleAr: "سير عمل متعدد الوكلاء",        titleEn: "Multi-Agent Workflows",   iconName: "GitBranch" },
  "workflows":            { category: "advanced",     titleAr: "سير العمل الآلي",              titleEn: "Automated Workflows",     iconName: "Layers" },
  "plugins":              { category: "advanced",     titleAr: "الإضافات",                     titleEn: "Plugins",                 iconName: "Wrench" },
  "advanced":             { category: "advanced",     titleAr: "الميزات المتقدمة",              titleEn: "Advanced Features",       iconName: "Zap" },
  "CLAUDE":               { category: "advanced",     titleAr: "ملف CLAUDE",                   titleEn: "CLAUDE File",             iconName: "Code2" },
  "CHANGELOG":            { category: "general",      titleAr: "سجل التغييرات",                titleEn: "Changelog",               iconName: "FileText" },
  "RELEASE_NOTES":        { category: "general",      titleAr: "ملاحظات الإصدار",              titleEn: "Release Notes",           iconName: "FileText" },
};

export function getSectionTitle(sectionId: string, lang: "ar" | "en"): string {
  const meta = SECTION_META[sectionId];
  if (!meta) return sectionId.replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  return lang === "ar" ? meta.titleAr : meta.titleEn;
}
