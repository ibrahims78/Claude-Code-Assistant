# Claude Code تعلّم + WhatsApp Manager

منصة موحدة ثنائية اللغة (عربي/إنجليزي) تجمع بين:

1. **Claude Code تعلّم** — منصة تعليمية لمطوري العرب مع محادثة RAG
2. **WhatsApp Manager** — إدارة جلسات واتساب متعددة عبر wppconnect
3. **Telegram Bot** — مساعد تيليغرام مبني على grammY

---

## نظرة سريعة

| الخدمة | المسار | المنفذ |
|--------|--------|--------|
| API Server | `/api` | 8080 |
| Claude Education | `/education` | 25013 |
| WhatsApp Dashboard | `/whatsapp` | 23097 |

## بدء الاستخدام السريع

```bash
# 1. تثبيت الحزم
pnpm install

# 2. رفع مخطط قاعدة البيانات
pnpm --filter @workspace/db run push

# 3. زرع البيانات الأولية
pnpm --filter @workspace/scripts run seed

# 4. بناء وتشغيل خادم الـ API
pnpm --filter @workspace/api-server run build
PORT=8080 pnpm --filter @workspace/api-server run start

# 5. تشغيل الواجهات (في نوافذ منفصلة)
PORT=25013 BASE_PATH=/education/ pnpm --filter @workspace/claude-education run dev
PORT=23097 BASE_PATH=/whatsapp/  pnpm --filter @workspace/whatsapp-dashboard run dev
```

**بيانات الدخول الافتراضية:**
- Admin: `admin / 123456` (يجب تغيير كلمة المرور عند أول دخول)
- موظف: `employee1 / Employee@123`

---

## هيكل المشروع

```
/
├── artifacts/
│   ├── api-server/          # Express API (المنفذ 8080)
│   ├── claude-education/    # React + Vite (التعليم)
│   └── whatsapp-dashboard/  # React + Vite (واتساب)
├── lib/
│   ├── db/                  # Drizzle ORM + PostgreSQL schema
│   ├── api-spec/            # OpenAPI specification
│   ├── api-zod/             # Zod validation schemas
│   └── api-client-react/    # React Query hooks
├── scripts/
│   ├── seed.ts              # زرع بيانات أولية
│   └── import-content.ts    # استيراد محتوى من GitHub
└── docs/                    # توثيق تفصيلي
```

---

## التوثيق

| الوثيقة | الوصف |
|--------|-------|
| [المعمارية](docs/architecture.md) | تصميم النظام ومخططات التدفق |
| [مرجع الـ API](docs/api-reference.md) | جميع نقاط النهاية مع أمثلة |
| [قاعدة البيانات](docs/database.md) | مخطط الجداول والعلاقات |
| [دليل التطوير](docs/development.md) | الإعداد، الاختبار، المساهمة |
| [دليل النشر](docs/deployment.md) | النشر في بيئة الإنتاج |
| [استكشاف الأخطاء](docs/troubleshooting.md) | المشاكل الشائعة وحلولها |

---

## المتطلبات

- Node.js 24+
- PostgreSQL 16+ مع إضافة `pgvector`
- pnpm 10+
- مفتاح Anthropic API (للدردشة الذكية)

## الترخيص

MIT
