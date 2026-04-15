# دليل التطوير

## المتطلبات الأساسية

- **Node.js** 24+
- **pnpm** 10+
- **PostgreSQL** 16+ مع إضافة `pgvector`
- **مفتاح Anthropic API** (للدردشة وتوليد embeddings)

---

## الإعداد الأولي

### 1. تثبيت الحزم

```bash
pnpm install
```

### 2. متغيرات البيئة

```bash
# .env.local (في الجذر)
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
JWT_SECRET=your-secret-key-here
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...   # اختياري، لرفع حد GitHub API
```

### 3. تهيئة قاعدة البيانات

```bash
# تفعيل pgvector
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# رفع المخطط
pnpm --filter @workspace/db run push

# زرع البيانات
pnpm --filter @workspace/scripts run seed

# استيراد المحتوى الحقيقي من GitHub
pnpm --filter @workspace/scripts run import-content
```

### 4. تشغيل بيئة التطوير

افتح 3 نوافذ طرفية:

```bash
# النافذة 1: API Server
pnpm --filter @workspace/api-server run dev

# النافذة 2: Claude Education
PORT=25013 BASE_PATH=/education/ pnpm --filter @workspace/claude-education run dev

# النافذة 3: WhatsApp Dashboard
PORT=23097 BASE_PATH=/whatsapp/ pnpm --filter @workspace/whatsapp-dashboard run dev
```

---

## هيكل الكود

### API Server (`artifacts/api-server/src/`)

```
src/
├── index.ts          # نقطة الدخول، Express + Socket.IO
├── app.ts            # إعداد Express (middleware، routes)
├── routes/
│   ├── index.ts      # تجميع كل الروابط
│   ├── auth.ts       # تسجيل الدخول والخروج
│   ├── users.ts      # إدارة المستخدمين
│   ├── sessions.ts   # جلسات واتساب
│   ├── send.ts       # إرسال الرسائل
│   ├── chat.ts       # الدردشة الذكية RAG
│   ├── content.ts    # محتوى التعلم
│   ├── resources.ts  # الموارد التعليمية
│   ├── admin.ts      # لوحة الإدارة
│   ├── telegram.ts   # بوت تيليغرام
│   └── n8n.ts        # تكامل n8n
└── lib/
    ├── auth.ts        # JWT، bcrypt، middleware
    ├── claude.ts      # Anthropic SDK، embeddings
    ├── ai.ts          # متعدد النماذج (Claude/OpenAI/Gemini)
    ├── rag.ts         # بحث pgvector
    ├── audit.ts       # سجل التدقيق
    ├── settings.ts    # إعدادات النظام
    └── rate-limit.ts  # حماية من الإفراط في الطلبات
```

### Shared Library (`lib/db/src/`)

```
src/
├── index.ts          # تصدير db + schema
└── schema/
    ├── index.ts      # تجميع كل الجداول
    ├── users.ts
    ├── sessions.ts
    ├── content.ts
    ├── chat.ts
    └── ...
```

---

## إضافة ميزة جديدة

### مثال: إضافة endpoint جديد

```typescript
// artifacts/api-server/src/routes/example.ts
import { Router } from "express";
import { requireAuth } from "../lib/auth.js";

const router = Router();

router.get("/example", requireAuth, async (req, res) => {
  res.json({ message: "مرحباً!" });
});

export default router;
```

```typescript
// artifacts/api-server/src/routes/index.ts
import exampleRoutes from "./example.js";
router.use("/example", exampleRoutes);
```

بعد التعديل:
```bash
pnpm --filter @workspace/api-server run build
```

---

## إضافة جدول جديد لقاعدة البيانات

```typescript
// lib/db/src/schema/example.ts
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const exampleTable = pgTable("examples", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

```typescript
// lib/db/src/schema/index.ts
export * from "./example";
```

```bash
pnpm --filter @workspace/db run push
```

---

## أوامر مفيدة

```bash
# بناء الـ API
pnpm --filter @workspace/api-server run build

# فحص TypeScript لجميع الحزم
pnpm run typecheck

# تنسيق الكود
pnpm exec prettier --write .

# فحص قاعدة البيانات مباشرة
psql $DATABASE_URL

# مسح ذاكرة pnpm
pnpm store prune
```

---

## أدوار المستخدمين والصلاحيات

```mermaid
graph TD
    A[admin] -->|كامل| B[جميع العمليات]
    C[employee] -->|محدود| D[الصلاحيات التالية]
    D --> E[createSession]
    D --> F[deleteSession]
    D --> G[connectSession]
    D --> H[sendText / sendMedia]
    D --> I[viewMessages]
    D --> J[manageWebhook]
```

صلاحيات الموظف تُحدَّد كـ JSON في حقل `permissions`:
```json
{
  "createSession": true,
  "deleteSession": false,
  "sendText": true,
  "sendMedia": true,
  "viewMessages": true,
  "manageWebhook": false
}
```

---

## تسجيل الدخول للتطوير

| المستخدم | كلمة المرور | الدور |
|---------|-----------|------|
| `admin` | `123456` | مدير |
| `employee1` | `Employee@123` | موظف (صلاحيات كاملة) |
| `employee2` | `Employee@123` | موظف (إرسال فقط) |
| `employee3` | `Employee@123` | موظف (قراءة فقط) |
