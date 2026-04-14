import { db } from "@workspace/db";
import {
  usersTable,
  whatsappSessionsTable,
  apiKeysTable,
  auditLogsTable,
  settingsTable,
  resourcesTable,
  contentChunksTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

async function seed() {
  console.log("🌱 Starting seed...");

  // 1. Admin user
  const adminHash = bcrypt.hashSync("123456", 10);
  const [admin] = await db.insert(usersTable).values({
    username: "admin",
    email: "admin@example.com",
    passwordHash: adminHash,
    role: "admin",
    isActive: true,
    mustChangePassword: true,
  }).returning();
  console.log("✅ Admin user created, id:", admin.id);

  // 2. 3 employee users
  const emp1Hash = bcrypt.hashSync("Employee@123", 10);
  const [emp1] = await db.insert(usersTable).values({
    username: "employee1",
    email: "emp1@example.com",
    passwordHash: emp1Hash,
    role: "employee",
    permissions: JSON.stringify({
      createSession: true, deleteSession: true, connectSession: true,
      disconnectSession: true, sendText: true, sendMedia: true,
      sendLocation: true, sendSticker: true, viewMessages: true,
      manageWebhook: true, manageFeatures: true,
    }),
    maxSessions: 5,
    isActive: true,
  }).returning();

  const emp2Hash = bcrypt.hashSync("Employee@123", 10);
  const [emp2] = await db.insert(usersTable).values({
    username: "employee2",
    email: "emp2@example.com",
    passwordHash: emp2Hash,
    role: "employee",
    permissions: JSON.stringify({
      createSession: false, deleteSession: false, connectSession: false,
      disconnectSession: false, sendText: true, sendMedia: true,
      sendLocation: false, sendSticker: false, viewMessages: false,
      manageWebhook: false, manageFeatures: false,
    }),
    maxSessions: 2,
    isActive: true,
  }).returning();

  const emp3Hash = bcrypt.hashSync("Employee@123", 10);
  const [emp3] = await db.insert(usersTable).values({
    username: "employee3",
    email: "emp3@example.com",
    passwordHash: emp3Hash,
    role: "employee",
    permissions: JSON.stringify({
      createSession: false, deleteSession: false, connectSession: false,
      disconnectSession: false, sendText: false, sendMedia: false,
      sendLocation: false, sendSticker: false, viewMessages: true,
      manageWebhook: false, manageFeatures: false,
    }),
    maxSessions: 1,
    isActive: true,
  }).returning();

  console.log("✅ 3 employee users created:", emp1.id, emp2.id, emp3.id);

  // 3. Settings
  await db.insert(settingsTable).values([
    { key: "app_name", value: "Claude Code Assistant", description: "اسم التطبيق" },
    { key: "max_messages_per_day", value: "50", description: "الحد اليومي للرسائل" },
    { key: "ai_model", value: "claude-3-5-sonnet-20241022", description: "نموذج Claude" },
    { key: "import_last_run", value: null, description: "آخر استيراد" },
    { key: "telegram_enabled", value: "false", description: "تفعيل بوت تيليغرام" },
    { key: "telegram_token", value: null, description: "Bot Token" },
    { key: "telegram_welcome_ar", value: "مرحباً! أنا مساعد Claude Code. كيف يمكنني مساعدتك؟", description: "ترحيب عربي" },
    { key: "telegram_welcome_en", value: "Hello! I am Claude Code Assistant. How can I help you?", description: "ترحيب إنجليزي" },
    { key: "telegram_max_daily", value: "20", description: "الحد اليومي لكل مستخدم تيليغرام" },
  ]);
  console.log("✅ 9 settings inserted");

  // 4. 6 resources
  await db.insert(resourcesTable).values([
    {
      titleEn: "Claude Code Official Documentation",
      url: "https://code.claude.com/docs",
      type: "official",
      sourceName: "Anthropic",
      isVisible: true,
      isFeatured: true,
      isApproved: true,
      addedBy: admin.id,
      displayOrder: 1,
    },
    {
      titleEn: "Model Context Protocol Specification",
      url: "https://modelcontextprotocol.io",
      type: "official",
      sourceName: "MCP",
      isVisible: true,
      isFeatured: false,
      isApproved: true,
      addedBy: admin.id,
      displayOrder: 2,
    },
    {
      titleEn: "How Anthropic Built Multi-Agent System",
      url: "https://anthropic.com/engineering",
      type: "article",
      sourceName: "Anthropic Engineering",
      isVisible: true,
      isFeatured: true,
      isApproved: true,
      addedBy: admin.id,
      displayOrder: 3,
    },
    {
      titleEn: "Design Space of AI Coding Tools (VLHCC 2025)",
      url: "https://lau.ucsd.edu",
      type: "research",
      sourceName: "VLHCC",
      isVisible: true,
      isFeatured: false,
      isApproved: true,
      addedBy: admin.id,
      displayOrder: 4,
    },
    {
      titleEn: "Measuring AI Agent Autonomy",
      url: "https://anthropic.com/research",
      type: "research",
      sourceName: "Anthropic Research",
      isVisible: true,
      isFeatured: true,
      isApproved: true,
      addedBy: admin.id,
      displayOrder: 5,
    },
    {
      titleEn: "Awesome Arabic AI Resources",
      url: "https://blog.brightcoding.dev",
      type: "article",
      sourceName: "BrightCoding",
      language: "ar",
      isVisible: true,
      isFeatured: false,
      isApproved: true,
      addedBy: admin.id,
      displayOrder: 6,
    },
  ]);
  console.log("✅ 6 resources inserted");

  // 5. 10 content_chunks
  await db.insert(contentChunksTable).values([
    {
      title: "Introduction to Claude Code",
      titleAr: "مقدمة إلى Claude Code",
      content: "Claude Code is an agentic coding tool from Anthropic that allows Claude to directly read, write, and execute code on your machine.",
      contentAr: "Claude Code هو أداة ترميز وكيلة من Anthropic تتيح لـ Claude قراءة وكتابة وتنفيذ الكود مباشرة على جهازك.",
      category: "beginner",
      section: "intro",
      sourceFile: "01-intro.md",
      orderIndex: 1,
    },
    {
      title: "Slash Commands",
      titleAr: "أوامر الشريطة المائلة",
      content: "Claude Code supports slash commands like /help, /clear, /status that control Claude's behavior during a session.",
      contentAr: "يدعم Claude Code أوامر الشريطة المائلة مثل /help و /clear و /status التي تتحكم في سلوك Claude أثناء الجلسة.",
      category: "beginner",
      section: "slash-commands",
      sourceFile: "02-slash-commands.md",
      orderIndex: 1,
    },
    {
      title: "Hooks System",
      titleAr: "نظام Hooks",
      content: "Hooks allow you to intercept Claude's actions and execute custom code before or after specific events.",
      contentAr: "تتيح لك Hooks اعتراض إجراءات Claude وتنفيذ كود مخصص قبل أو بعد أحداث معينة.",
      category: "intermediate",
      section: "hooks",
      sourceFile: "03-hooks.md",
      orderIndex: 1,
    },
    {
      title: "Memory Management",
      titleAr: "إدارة الذاكرة",
      content: "Claude Code has a memory system using CLAUDE.md files that persist information across sessions.",
      contentAr: "يمتلك Claude Code نظام ذاكرة باستخدام ملفات CLAUDE.md تحافظ على المعلومات عبر الجلسات.",
      category: "intermediate",
      section: "memory",
      sourceFile: "04-memory.md",
      orderIndex: 1,
    },
    {
      title: "Model Context Protocol (MCP)",
      titleAr: "بروتوكول سياق النموذج (MCP)",
      content: "MCP enables Claude Code to connect to external tools, databases, and APIs through a standardized protocol.",
      contentAr: "يمكّن MCP Claude Code من الاتصال بالأدوات الخارجية وقواعد البيانات وواجهات API من خلال بروتوكول موحد.",
      category: "advanced",
      section: "mcp",
      sourceFile: "05-mcp.md",
      orderIndex: 1,
    },
    {
      title: "Multi-Agent Workflows",
      titleAr: "سير العمل متعدد الوكلاء",
      content: "Claude Code supports orchestrating multiple AI agents to work together on complex tasks.",
      contentAr: "يدعم Claude Code تنسيق وكلاء ذكاء اصطناعي متعددين للعمل معاً على المهام المعقدة.",
      category: "advanced",
      section: "agents",
      sourceFile: "06-agents.md",
      orderIndex: 1,
    },
    {
      title: "Settings and Configuration",
      titleAr: "الإعدادات والتكوين",
      content: "Configure Claude Code behavior through settings files, environment variables, and CLI flags.",
      contentAr: "قم بتكوين سلوك Claude Code من خلال ملفات الإعدادات ومتغيرات البيئة وعلامات CLI.",
      category: "beginner",
      section: "settings",
      sourceFile: "07-settings.md",
      orderIndex: 1,
    },
    {
      title: "Security Best Practices",
      titleAr: "أفضل ممارسات الأمان",
      content: "Security considerations when using Claude Code including permission management and safe code execution.",
      contentAr: "اعتبارات الأمان عند استخدام Claude Code بما في ذلك إدارة الأذونات وتنفيذ الكود الآمن.",
      category: "intermediate",
      section: "security",
      sourceFile: "08-security.md",
      orderIndex: 1,
    },
    {
      title: "Automated Workflows",
      titleAr: "سير العمل الآلي",
      content: "Use Claude Code in CI/CD pipelines and automation scripts for code review, testing, and deployment.",
      contentAr: "استخدم Claude Code في أنابيب CI/CD ونصوص الأتمتة لمراجعة الكود والاختبار والنشر.",
      category: "advanced",
      section: "workflows",
      sourceFile: "09-workflows.md",
      orderIndex: 1,
    },
    {
      title: "Tips and Best Practices",
      titleAr: "نصائح وأفضل الممارسات",
      content: "Practical tips for getting the most out of Claude Code including prompt engineering and workflow optimization.",
      contentAr: "نصائح عملية للاستفادة القصوى من Claude Code بما في ذلك هندسة التوجيه وتحسين سير العمل.",
      category: "beginner",
      section: "tips",
      sourceFile: "10-tips.md",
      orderIndex: 1,
    },
  ]);
  console.log("✅ 10 content_chunks inserted");

  // 6. 3 WhatsApp sessions
  await db.insert(whatsappSessionsTable).values([
    { id: "session_001", userId: admin.id, name: "الجلسة الأولى", status: "disconnected" },
    { id: "session_002", userId: admin.id, name: "الجلسة التجارية", status: "disconnected" },
    { id: "session_003", userId: admin.id, name: "الدعم الفني", status: "disconnected" },
  ]);
  console.log("✅ 3 WhatsApp sessions inserted");

  // 7. 2 API keys for admin
  const key1 = randomBytes(32).toString("hex");
  const key2 = randomBytes(32).toString("hex");
  const keyHash1 = bcrypt.hashSync(key1, 10);
  const keyHash2 = bcrypt.hashSync(key2, 10);

  await db.insert(apiKeysTable).values([
    {
      userId: admin.id,
      name: "Production API",
      keyHash: keyHash1,
      keyPrefix: key1.slice(0, 8),
      allowedSessionIds: null,
    },
    {
      userId: admin.id,
      name: "Session 001 Only",
      keyHash: keyHash2,
      keyPrefix: key2.slice(0, 8),
      allowedSessionIds: JSON.stringify(["session_001"]),
    },
  ]);
  console.log("🔑 API Key 1 (Production):", key1);
  console.log("🔑 API Key 2 (Session 001 Only):", key2);

  // 8. 20 audit_logs
  const actions = ["login", "createSession", "sendText", "connectSession", "logout", "disconnectSession"];
  const auditRows = Array.from({ length: 20 }, (_, i) => ({
    userId: admin.id,
    username: "admin",
    action: actions[i % actions.length],
    sessionId: i % 3 === 0 ? "session_001" : i % 3 === 1 ? "session_002" : null as string | null,
    details: JSON.stringify({ index: i }),
    ipAddress: "127.0.0.1",
  }));
  await db.insert(auditLogsTable).values(auditRows);
  console.log("✅ 20 audit logs inserted");

  console.log("\n🎉 Seed complete!");
}

seed().catch(console.error).finally(() => process.exit(0));
