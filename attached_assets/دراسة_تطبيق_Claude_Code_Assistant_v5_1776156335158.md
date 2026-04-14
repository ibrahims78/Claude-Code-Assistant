# دراسة شاملة ومحدّثة: منصة Claude Code Assistant مع إدارة واتساب وتيليغرام
**اسم المشروع:** Claude Code Assistant + WhatsApp Manager + Telegram Bot  
**المصادر:**  
- https://github.com/ibrahims78/claude-howto (المحتوى التعليمي)  
- https://github.com/ibrahims78/WhatsApp-Bot (مدير الواتساب — تم التحقق منه مباشرة)  
**الإصدار:** v5.0 (النسخة الموحّدة — تشمل: المنصة التعليمية + إدارة واتساب متعددة الجلسات + بوت تيليغرام + وحدة الإرسال + الويب هوك + تكامل n8n)  
**التاريخ:** أبريل 2026  
**لغة البرمجة:** TypeScript (كامل المشروع — frontend وbackend)

---

## أولاً: رؤية المشروع الموحّد

### ما هو المشروع؟

منصة متكاملة ثنائية اللغة (عربي/إنجليزي) تجمع بين ثلاثة محاور رئيسية:

1. **المنصة التعليمية** — تعليم Claude Code للمطورين العرب مع ذكاء اصطناعي تفاعلي
2. **مدير واتساب** — إدارة جلسات واتساب متعددة مع إرسال واستقبال الرسائل في الوقت الفعلي
3. **بوت تيليغرام** — ربط تلقائي مع تيليغرام لتقديم نفس تجربة الدردشة التعليمية

### المستخدمون المستهدفون
- المطورون العرب المهتمون بـ Claude Code
- الشركات والأفراد الراغبون في إدارة حسابات واتساب متعددة برمجياً
- متكاملو الأتمتة عبر n8n و Zapier وأي webhook مخصص

### الفرق عن الإصدار السابق
| الميزة | v4.0 | v5.0 |
|--------|------|------|
| لغة البرمجة | JavaScript | TypeScript (كامل) |
| مكتبة الواتساب | مقترحة فقط | @wppconnect-team/wppconnect (مُطبَّقة) |
| الجلسات | جلسة واحدة | متعددة الجلسات (multi-session) |
| قاعدة البيانات ORM | SQL خام | Drizzle ORM |
| الواجهة الأمامية | React + Tailwind | React 19 + Shadcn UI + Tailwind v4 |
| إدارة الحزم | npm | pnpm workspaces (monorepo) |
| WebSocket | مقترح | Socket.IO 4 (مُطبَّق) |
| أمان API | JWT فقط | JWT + API Keys (bcrypt-hashed) |
| صلاحيات الموظفين | دورين بسيطان | 11 صلاحية حبيبية قابلة للضبط |

---

## ثانياً: بنية المشروع الكاملة

### هيكل الـ Monorepo

```
workspace/
├── artifacts/
│   ├── api-server/              # خادم Express.js + Socket.IO (TypeScript)
│   └── whatsapp-dashboard/      # React 19 + Vite 7 + Shadcn UI
├── lib/
│   ├── db/                      # Drizzle ORM — Schema + PostgreSQL Client
│   ├── api-spec/                # OpenAPI Specification (مصدر الحقيقة الوحيد)
│   ├── api-zod/                 # مخططات Zod مُولَّدة من OpenAPI
│   └── api-client-react/        # React Query Hooks مُولَّدة
├── scripts/                     # سكريبتات مساعدة
├── .env.example                 # قالب المتغيرات البيئية
├── docker-compose.yml           # إنتاج (production)
├── docker-compose.dev.yml       # تطوير (development)
├── Dockerfile.api               # حاوية الخادم
├── Dockerfile.dashboard         # حاوية الواجهة
├── nginx.conf                   # Reverse Proxy للإنتاج
└── pnpm-workspace.yaml          # تعريف مساحات العمل
```

### مخطط البنية المعمارية

```
┌──────────────────────────────────────────────────────────────────────┐
│                         المستخدم (Browser)                            │
│   لوحة الواتساب | المنصة التعليمية | صفحات المصادقة                  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTPS + JWT Cookie / API Key
┌──────────────────────────────▼───────────────────────────────────────┐
│                   الخادم (api-server — Port 8080)                     │
│                         Express.js v5 + TypeScript                    │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                      Middleware Layer                          │   │
│  │  Helmet | CORS | Rate Limiter | JWT/APIKey Auth | Pino Logger │   │
│  └───────────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                       API Routes (/api/)                       │   │
│  │  /auth | /sessions | /send | /users | /api-keys               │   │
│  │  /audit-logs | /dashboard | /n8n-workflow | /chat | /content  │   │
│  │  /resources | /admin | /webhook/telegram                      │   │
│  └────────────────────────────┬──────────────────────────────────┘   │
│  ┌─────────────────────────── │ ─────────────────────────────────┐   │
│  │     Socket.IO 4 (WebSocket)│ — Real-Time QR + Messages        │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
       ┌───────────────────────┼──────────────────────────┐
       │                       │                          │
┌──────▼──────┐   ┌────────────▼──────────┐   ┌──────────▼──────────┐
│ PostgreSQL  │   │   @wppconnect/wppconn. │   │    Claude API       │
│ (Drizzle)   │   │   (Puppeteer + Chrome) │   │    (Anthropic)      │
│             │   │                        │   │                     │
│ - users     │   │ - إدارة الجلسات        │   │ - الدردشة التعليمية │
│ - sessions  │   │ - QR Code              │   │ - البحث الدلالي     │
│ - messages  │   │ - إرسال/استقبال        │   │ - الترجمة           │
│ - api_keys  │   │ - Webhooks             │   │ - توليد Embeddings  │
│ - audit_logs│   │ - Auto-Reconnect       │   │                     │
│ - content   │   └────────────────────────┘   └─────────────────────┘
│ - resources │
└─────────────┘
        │
┌───────▼──────────────────────────────────────┐
│               Webhook Targets                 │
│   n8n | Zapier | Custom Backend | Telegram    │
└──────────────────────────────────────────────┘
```

---

## ثالثاً: التقنيات المستخدمة

### الحزم الأساسية

| الطبقة | التقنية | الإصدار | السبب |
|--------|---------|---------|-------|
| **Runtime** | Node.js | ≥ 20 | أداء عالٍ + ES Modules |
| **لغة البرمجة** | TypeScript | 5.9 | أمان الأنواع + IntelliSense |
| **إدارة الحزم** | pnpm workspaces | ≥ 10 | Monorepo + سرعة التثبيت |
| **الخادم** | Express.js | v5 | مرونة + سرعة |
| **WebSocket** | Socket.IO | 4 | QR Code + إشعارات فورية |
| **واتساب** | @wppconnect-team/wppconnect | 1.41.x | الأكثر استقراراً + Puppeteer |
| **قاعدة البيانات** | PostgreSQL | 14+ | موثوقية + pgvector |
| **ORM** | Drizzle ORM | catalog | Type-safe SQL + push schema |
| **واجهة أمامية** | React | 19 | أحدث إصدار مستقر |
| **أداة بناء** | Vite | 7 | سرعة HMR |
| **مكونات UI** | Shadcn UI | latest | مكونات جاهزة + قابلة للتخصيص |
| **CSS** | Tailwind CSS | v4 | تصميم سريع |
| **حالة التطبيق** | Zustand | latest | خفيف + persist |
| **جلب البيانات** | TanStack Query | v5 | كاش + إعادة المحاولة |
| **التوجيه** | wouter | latest | خفيف الوزن |
| **المصادقة** | JWT + bcryptjs | — | أمان + خفة |
| **الترجمة (المنصة)** | react-i18next | — | عربي ↔ إنجليزي + RTL |
| **الترجمة (Dashboard)** | Custom Store | — | مخزن Zustand مخصص |
| **ذكاء اصطناعي** | Claude API (Anthropic) | claude-3-5-sonnet | أفضل نموذج للعربية |
| **Logger** | Pino + pino-http | — | سريع + منخفض التكلفة |
| **حماية** | Helmet.js | 8.x | HTTP Security Headers |
| **CORS** | cors | — | تهيئة دقيقة |
| **Rate Limiting** | express-rate-limit | 8.x | حماية من Brute-Force |
| **بوت تيليغرام** | grammY | latest | الأحدث والأكثر نشاطاً |
| **Containerization** | Docker + docker-compose | — | بيئة إنتاج معزولة |
| **Reverse Proxy** | Nginx | — | للإنتاج على Windows |

---

## رابعاً: نظام الأدوار والصلاحيات

### الأدوار الرئيسية

**Admin (المدير)** — وصول كامل بلا قيود  
**Employee (الموظف)** — وصول محدود بـ 11 صلاحية حبيبية + حد أقصى للجلسات

### الصلاحيات الحبيبية للموظف (11 مفتاح)

```typescript
type PermissionsMap = {
  createSession?:    boolean  // إنشاء جلسة واتساب جديدة
  deleteSession?:    boolean  // حذف جلسة
  connectSession?:   boolean  // ربط جلسة (QR Scan)
  disconnectSession?:boolean  // قطع اتصال جلسة
  sendText?:         boolean  // إرسال رسائل نصية
  sendMedia?:        boolean  // إرسال صور/فيديو/صوت/ملفات
  sendLocation?:     boolean  // إرسال الموقع الجغرافي
  sendSticker?:      boolean  // إرسال ملصقات
  viewMessages?:     boolean  // عرض سجل الرسائل
  manageWebhook?:    boolean  // تعديل إعدادات الويب هوك
  manageFeatures?:   boolean  // تعديل ميزات الجلسة
}
// القاعدة: القيمة false = محجوب | القيمة missing = مسموح
```

### قواعد الوصول

```
المدير:
├── عرض جميع الجلسات + المستخدمين + السجلات
├── إنشاء/تعديل/حذف المستخدمين
├── تعيين صلاحيات الموظفين
├── تعيين الحد الأقصى للجلسات لكل موظف
├── عرض جميع مفاتيح API
├── تحميل ملف n8n Workflow
└── الوصول لكل نقاط API

الموظف:
├── رؤية جلساته الخاصة فقط
├── إجراءات محددة بناءً على permissionsMap
├── لا يرى بيانات الموظفين الآخرين
└── محدود بـ maxSessions عند إنشاء جلسات جديدة

الموظف مع mustChangePassword = true:
└── يُحجب عن جميع النقاط عدا:
    POST /auth/login | POST /auth/logout | GET /auth/me | PATCH /users/me/password
```

---

## خامساً: قاعدة البيانات الكاملة

**أداة ORM:** Drizzle ORM — مخطط Push (لا migrations)  
**الامتداد المطلوب:** `pgvector` للبحث الدلالي

### جدول 1: المستخدمون (users)

```sql
CREATE TABLE users (
  id                  SERIAL PRIMARY KEY,
  username            TEXT UNIQUE NOT NULL,
  email               TEXT,
  password_hash       TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'employee',  -- 'admin' | 'employee'
  permissions         TEXT,         -- JSON: { "createSession": true, "sendText": false, ... }
  max_sessions        INTEGER,      -- NULL = بلا حد | رقم = حد موظف
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,   -- يُجبر على تغيير كلمة المرور
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- الحساب الافتراضي:
-- username='admin' | password='123456' | role='admin' | must_change_password=TRUE
```

### جدول 2: جلسات الواتساب (whatsapp_sessions)

```sql
CREATE TABLE whatsapp_sessions (
  id                      TEXT PRIMARY KEY,   -- e.g. "session_001", "business_ksa"
  user_id                 INTEGER REFERENCES users(id),
  name                    TEXT NOT NULL,       -- اسم وصفي للجلسة
  phone_number            TEXT,               -- يُملأ بعد الربط الناجح
  status                  TEXT NOT NULL DEFAULT 'disconnected',
  -- 'disconnected' | 'connecting' | 'connected' | 'banned' | 'notLogged'
  auto_reconnect          BOOLEAN NOT NULL DEFAULT TRUE,
  -- FALSE = توقف يدوي، لا تُعيد الاتصال عند إعادة التشغيل
  webhook_url             TEXT,               -- URL لإرسال الأحداث
  webhook_secret          TEXT,               -- HMAC secret للتوقيع (write-only)
  webhook_events          TEXT,               -- JSON array: ['message', 'ack', ...]
  features                TEXT,               -- JSON object: feature flags
  total_messages_sent     INTEGER NOT NULL DEFAULT 0,
  total_messages_received INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- أنواع الأحداث المتاحة للويب هوك:
-- 'message' | 'message_ack' | 'message_reaction' | 'status_update'
-- 'call' | 'disconnected' | 'connected'
```

### جدول 3: الرسائل (messages)

```sql
CREATE TABLE messages (
  id           SERIAL PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES whatsapp_sessions(id),
  direction    TEXT NOT NULL,          -- 'inbound' | 'outbound'
  from_number  TEXT NOT NULL,
  to_number    TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  -- 'text' | 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'location' | 'contact'
  content      TEXT,                   -- النص أو بيانات الموقع
  media_url    TEXT,                   -- رابط الميديا المُخزَّنة
  caption      TEXT,                   -- تعليق الصورة/الفيديو
  status       TEXT NOT NULL DEFAULT 'sent',
  -- 'sent' | 'delivered' | 'read' | 'failed'
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### جدول 4: مفاتيح API (api_keys)

```sql
CREATE TABLE api_keys (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  name                TEXT NOT NULL,        -- وصف مفتاح API (e.g. "Production Bot")
  key_hash            TEXT UNIQUE NOT NULL, -- bcrypt hash للمفتاح الكامل
  key_prefix          TEXT NOT NULL,        -- أول 8 أحرف للفلترة السريعة O(1)
  allowed_session_ids TEXT,                 -- JSON array | NULL = كل الجلسات
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at        TIMESTAMPTZ
);

-- آلية الأمان:
-- المفتاح الكامل يُعرض مرة واحدة فقط عند الإنشاء
-- key_prefix يُستخدم لفلترة سريعة قبل bcrypt comparison
-- allowedSessionIds تحد من الجلسات المسموح بالوصول إليها عبر هذا المفتاح
```

### جدول 5: سجل العمليات (audit_logs)

```sql
CREATE TABLE audit_logs (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),  -- NULL = عملية نظام
  username   TEXT,         -- محفوظ حتى بعد حذف المستخدم
  action     TEXT NOT NULL,
  -- 'login' | 'logout' | 'createSession' | 'deleteSession'
  -- 'sendText' | 'sendImage' | 'sendVideo' | 'sendAudio' | 'sendFile'
  -- 'sendLocation' | 'sendSticker' | 'connectSession' | 'disconnectSession'
  -- 'bot_enabled' | 'bot_disabled' | 'bot_user_blocked' | 'bot_settings_updated'
  session_id TEXT,         -- الجلسة المعنية (إن وُجدت)
  details    TEXT,         -- JSON string: تفاصيل إضافية
  ip_address TEXT,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### جدول 6: إعدادات النظام (settings)

```sql
CREATE TABLE settings (
  id          SERIAL PRIMARY KEY,
  key         TEXT UNIQUE NOT NULL,
  value       TEXT,
  description TEXT,
  updated_by  INTEGER REFERENCES users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (key, value, description) VALUES
  ('app_name',            'Claude Code Assistant', 'اسم التطبيق'),
  ('max_messages_per_day','50',                    'الحد اليومي للرسائل — المنصة التعليمية'),
  ('ai_model',            'claude-3-5-sonnet-20241022', 'نموذج Claude المستخدم'),
  ('import_last_run',     NULL,                    'آخر استيراد للمحتوى من GitHub'),
  ('telegram_enabled',    'false',                 'تفعيل بوت تيليغرام'),
  ('telegram_token',      NULL,                    'Bot Token من @BotFather'),
  ('telegram_welcome_ar', 'مرحباً! أنا مساعد Claude Code.', 'رسالة ترحيب تيليغرام — عربي'),
  ('telegram_welcome_en', 'Hello! I am Claude Code Assistant.', 'رسالة ترحيب تيليغرام — إنجليزي'),
  ('telegram_max_daily',  '20',                    'الحد اليومي لكل مستخدم تيليغرام');
```

### جدول 7: المحتوى التعليمي (content_chunks)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE content_chunks (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  title_ar     TEXT,
  content      TEXT NOT NULL,
  content_ar   TEXT,
  category     TEXT,          -- 'beginner' | 'intermediate' | 'advanced'
  section      TEXT,          -- e.g. '01-slash-commands'
  source_file  TEXT,
  order_index  INTEGER,
  embedding    VECTOR(1536),  -- للبحث الدلالي pgvector
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### جدول 8: المحادثات (conversations)

```sql
CREATE TABLE conversations (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_title TEXT DEFAULT 'محادثة جديدة',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### جدول 9: رسائل المحادثات (chat_messages)

```sql
CREATE TABLE chat_messages (
  id              SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,   -- 'user' | 'assistant'
  content         TEXT NOT NULL,
  sources         JSONB,           -- المصادر المستخدمة من content_chunks
  tokens_used     INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### جدول 10: تقدم التعلم (user_progress)

```sql
CREATE TABLE user_progress (
  id       SERIAL PRIMARY KEY,
  user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
  section  TEXT,
  chunk_id INTEGER REFERENCES content_chunks(id),
  read_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, chunk_id)
);
```

### جدول 11: مكتبة المصادر (resources)

```sql
CREATE TABLE resources (
  id              SERIAL PRIMARY KEY,
  title_en        TEXT NOT NULL,
  title_ar        TEXT,
  description_en  TEXT,
  description_ar  TEXT,
  url             TEXT NOT NULL,
  source_name     TEXT,
  type            TEXT NOT NULL,  -- 'official' | 'research' | 'article' | 'tool' | 'video'
  language        TEXT DEFAULT 'en',
  is_visible      BOOLEAN DEFAULT TRUE,
  is_featured     BOOLEAN DEFAULT FALSE,
  embedding       VECTOR(1536),
  suggested_by    INTEGER REFERENCES users(id),
  is_approved     BOOLEAN DEFAULT FALSE,
  added_by        INTEGER REFERENCES users(id),
  display_order   INTEGER DEFAULT 0,
  view_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### جدول 12: ترجمات المصادر (resource_translations)

```sql
CREATE TABLE resource_translations (
  id           SERIAL PRIMARY KEY,
  resource_id  INTEGER REFERENCES resources(id) ON DELETE CASCADE,
  field        TEXT NOT NULL,     -- 'title' | 'description'
  source_lang  TEXT NOT NULL,
  target_lang  TEXT NOT NULL,
  translated   TEXT NOT NULL,
  translated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource_id, field, source_lang, target_lang)
);
```

### جدول 13: اقتراحات المصادر (resource_suggestions)

```sql
CREATE TABLE resource_suggestions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  title       TEXT,
  description TEXT,
  type        TEXT,
  status      TEXT DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  admin_note  TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### جدول 14: مستخدمو بوت تيليغرام (telegram_users)

```sql
CREATE TABLE telegram_users (
  id           SERIAL PRIMARY KEY,
  telegram_id  BIGINT UNIQUE NOT NULL,   -- chat_id من تيليغرام
  first_name   TEXT,
  username     TEXT,                      -- @username (إن وُجد)
  linked_user_id INTEGER REFERENCES users(id), -- ربط بحساب المنصة (اختياري)
  language     TEXT DEFAULT 'ar',        -- لغة الرد
  is_blocked   BOOLEAN DEFAULT FALSE,
  daily_count  INTEGER DEFAULT 0,
  last_reset   DATE DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_active  TIMESTAMPTZ DEFAULT NOW()
);
```

### جدول 15: محادثات تيليغرام (telegram_conversations)

```sql
CREATE TABLE telegram_conversations (
  id              SERIAL PRIMARY KEY,
  telegram_user_id INTEGER REFERENCES telegram_users(id) ON DELETE CASCADE,
  conversation_id  INTEGER REFERENCES conversations(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

---

## سادساً: نقاط API الكاملة

**الأساس:** `/api/`  
**المصادقة:** JWT Cookie (session_token) **أو** API Key (X-API-Key header)

### مجموعة الصحة (Health)
```
GET  /api/healthz              → { status: "ok" } — فحص صحة الخادم
```

### مجموعة المصادقة (/api/auth)
```
POST /api/auth/login
  - body: { username, password }
  - Rate Limited: 20 طلب / 15 دقيقة (حماية brute-force)
  - يحفظ JWT في httpOnly Cookie (session_token)
  - httpOnly + secure (على Replit وproduction)
  - صلاحية 7 أيام
  - يُرجع: { token, user: { id, username, role, permissions, mustChangePassword } }

POST /api/auth/logout
  - يمسح الـ Cookie
  - يُرجع: { success: true }

GET  /api/auth/me
  - يُرجع: بيانات المستخدم الحالي بدون passwordHash
```

### مجموعة الجلسات (/api/sessions) — يتطلب JWT أو API Key
```
GET  /api/sessions
  - Admin: جميع الجلسات
  - Employee: جلساته فقط
  - API Key مع allowedSessionIds: الجلسات المسموحة فقط

POST /api/sessions
  - body: { name, webhookUrl? }
  - Employee: يتحقق من createSession permission + maxSessions limit
  - يُنشئ سجل في audit_logs: action='createSession'

GET  /api/sessions/:id
  - Employee: يتحقق من ملكية الجلسة (403 إن لم تكن ملكه)

DELETE /api/sessions/:id
  - يحذف الجلسة + ملفات الـ tokens (wppconnect session files)
  - يُسجل في audit_logs: action='deleteSession'

POST /api/sessions/:id/connect
  - يبدأ Puppeteer + يولّد QR Code
  - يُبث QR عبر Socket.IO إلى الـ Client

POST /api/sessions/:id/disconnect
  - يقطع الاتصال + يضبط autoReconnect=false
  - الجلسة لا تُعيد الاتصال عند إعادة تشغيل الخادم

GET  /api/sessions/:id/qr
  - يُرجع QR Code الحالي (إن كان في حالة connecting)

GET  /api/sessions/:id/stats
  - يُرجع: { totalSent, totalReceived, status, phoneNumber }

GET  /api/sessions/:id/messages?limit=&offset=
  - سجل الرسائل مع pagination

PATCH /api/sessions/:id/webhook
  - body: { webhookUrl, webhookSecret?, webhookEvents? }
  - التحقق من SSRF: يرفض localhost وPrivate IPs

PATCH /api/sessions/:id/features
  - body: { features: { sendMessages?, receiveMessages?, ... } }
```

### مجموعة الإرسال (/api/send) — يتطلب JWT أو API Key

#### إرسال عام (أي جلسة):
```
POST /api/send/text
  - body: { sessionId, to, message }
  - التحقق من رقم الهاتف E.164 (7-15 رقم)

POST /api/send/image
  - body: { sessionId, to, image (URL أو base64), caption? }
  - base64: يُحفظ ملف مؤقت → wppconnect → يُحذف

POST /api/send/video
  - body: { sessionId, to, video (URL أو base64), caption? }

POST /api/send/audio
  - body: { sessionId, to, audio (URL أو base64) }

POST /api/send/file
  - body: { sessionId, to, file (URL أو base64), filename }

POST /api/send/location
  - body: { sessionId, to, lat, lng, description? }
  - التحقق: lat (-90..90) + lng (-180..180) + ليس NaN/Infinity

POST /api/send/sticker
  - body: { sessionId, to, sticker (URL أو base64) }
```

#### إرسال خاص بجلسة محددة:
```
POST /api/sessions/:id/send/text
POST /api/sessions/:id/send/image
POST /api/sessions/:id/send/video
POST /api/sessions/:id/send/audio
POST /api/sessions/:id/send/file
POST /api/sessions/:id/send/location
POST /api/sessions/:id/send/sticker
  (نفس الـ body بدون sessionId)
```

### مجموعة المستخدمين (/api/users) — يتطلب JWT
```
GET    /api/users               → Admin فقط: جميع المستخدمين
POST   /api/users               → Admin فقط: إنشاء مستخدم
  - body: { username, email?, password, role, permissions?, maxSessions? }
  - التحقق من تعقيد كلمة المرور:
    ✓ 6+ أحرف
    ✓ حرف كبير
    ✓ حرف صغير
    ✓ رقم أو رمز خاص

GET    /api/users/:id           → Admin: أي مستخدم | Employee: نفسه فقط
PATCH  /api/users/:id           → Admin فقط: تعديل أي بيانات
DELETE /api/users/:id           → Admin فقط

PATCH  /api/users/me            → أي مستخدم: تعديل بياناته الخاصة
PATCH  /api/users/me/password   → تغيير كلمة المرور (يُلغي mustChangePassword)
```

### مجموعة مفاتيح API (/api/api-keys) — يتطلب JWT
```
GET    /api/api-keys            → Admin: جميع المفاتيح | Employee: مفاتيحه فقط
POST   /api/api-keys
  - body: { name, allowedSessionIds? }
  - يُولّد مفتاح عشوائي آمن
  - يُعرض المفتاح الكامل مرة واحدة فقط
  - يُحفظ bcrypt(key) في قاعدة البيانات

PATCH  /api/api-keys/:id        → تعديل name أو allowedSessionIds
DELETE /api/api-keys/:id
```

### مجموعة لوحة التحكم (/api/dashboard) — يتطلب JWT
```
GET /api/dashboard/stats
  - Admin: إحصائيات جميع الجلسات
  - Employee: إحصائيات جلساته فقط
  - يُرجع:
    {
      totalSessions: int,
      connectedSessions: int,
      totalMessagesSent: int,
      totalMessagesReceived: int,
      dailyStats: [{ date, sent, received }]  // آخر 7 أيام
    }
```

### مجموعة سجل العمليات (/api/audit-logs) — Admin فقط
```
GET /api/audit-logs?page=&limit=&action=&sessionId=&from=&to=
  - Pagination: 50 سجل في الصفحة
  - يُرجع: { logs[], total, page }
```

### مجموعة n8n (/api/n8n-workflow) — Admin فقط
```
GET /api/n8n-workflow/download
  - يُرجع ملف JSON جاهز للاستيراد في n8n
  - يُضمّن ANTHROPIC_API_KEY و SERVER_URL تلقائياً في الملف
```

### مجموعة المنصة التعليمية (/api/chat) — يتطلب JWT
```
GET  /api/chat/conversations           → محادثات المستخدم الحالي
POST /api/chat/conversations           → محادثة جديدة
GET  /api/chat/conversations/:id       → رسائل محادثة محددة
POST /api/chat/conversations/:id/messages
  - body: { content }
  - توليد embedding للسؤال عبر Claude API
  - بحث دلالي في content_chunks (pgvector — أقرب 5 مقاطع)
  - بناء Prompt بالعربية مع المقاطع المسترجعة
  - إرسال لـ Claude API + حفظ في chat_messages
  - تسجيل في audit_logs
  - يُرجع: { response, sources }

DELETE /api/chat/conversations/:id    → حذف (مع التحقق من الملكية)
```

### مجموعة المحتوى التعليمي (/api/content) — يتطلب JWT
```
GET  /api/content/sections            → الأقسام مع نسبة تقدم المستخدم
GET  /api/content/sections/:sectionId → مقاطع قسم محدد
GET  /api/content/search?q=           → بحث نصي في content_ar
POST /api/content/progress/:chunkId   → تسجيل قراءة مقطع
GET  /api/content/progress            → تقدم المستخدم الكامل
```

### مجموعة الملف الشخصي (/api/profile) — يتطلب JWT
```
PUT  /api/profile/name        → تحديث الاسم + audit_log
PUT  /api/profile/password    → تغيير كلمة المرور + التحقق من القديمة
GET  /api/profile/stats       → { totalQuestions, totalConversations, progressPercent }
```

### مجموعة المصادر (/api/resources) — يتطلب JWT
```
GET  /api/resources?type=&lang=&q=&featured=&page=
  - المصادر المرئية فقط (is_visible=true)
  - ترتيب: is_featured DESC → display_order ASC → created_at DESC

GET  /api/resources/:id
  - تحديث view_count تلقائياً

POST /api/resources/:id/translate
  - body: { field: 'title'|'description', sourceLang, targetLang }
  - يتحقق أولاً من resource_translations (cache)
  - إن لم يجد: يترجم عبر Claude API → يحفظ → يُرجع
  - يُرجع: { translatedText, fromCache: bool }

GET  /api/resources/:id/ask-context
  - يُرجع: { resourceTitle, resourceUrl, systemPrompt }

POST /api/resources/suggest
  - body: { url, title, description, type }
  - يحفظ في resource_suggestions (status='pending')
```

### مجموعة الإدارة الكاملة (/api/admin) — Admin فقط
```
GET    /api/admin/dashboard           → إحصائيات الإدارة الشاملة
GET    /api/admin/users               → جميع المستخدمين مع بحث وفلترة
PUT    /api/admin/users/:id/role      → تغيير الدور
PUT    /api/admin/users/:id/status    → تفعيل/تعطيل
DELETE /api/admin/users/:id

GET    /api/admin/content             → جميع مقاطع المحتوى
PUT    /api/admin/content/:id         → تعديل title_ar أو content_ar
DELETE /api/admin/content/:id

POST   /api/admin/import
  - يجلب .md من GitHub (ibrahims78/claude-howto)
  - يُقسّم النصوص → يترجم → يولّد embeddings → يحفظ

GET    /api/admin/settings
PUT    /api/admin/settings

GET    /api/admin/resources
POST   /api/admin/resources           → إضافة مصدر (مع ترجمة تلقائية للعربية)
POST   /api/admin/resources/import-url → استيراد من رابط تلقائياً
PUT    /api/admin/resources/:id
PUT    /api/admin/resources/:id/toggle-visibility
PUT    /api/admin/resources/:id/toggle-featured
DELETE /api/admin/resources/:id

GET    /api/admin/resources/suggestions
PUT    /api/admin/resources/suggestions/:id
  - body: { status: 'approved'|'rejected', admin_note? }
```

### مجموعة بوت تيليغرام (/api/webhook/telegram)
```
POST /api/webhook/telegram
  - يستقبل Updates من تيليغرام
  - يعالج الأوامر: /start | /help | /lang | /clear | /stats
  - يُطبّق نفس منطق الدردشة التعليمية (Claude API + pgvector)
  - يُسجل في audit_logs + telegram_conversations

POST /api/webhook/telegram/setup
  - يُسجّل webhook URL مع تيليغرام تلقائياً عند تفعيل البوت

GET  /api/admin/telegram/users         → Admin: مستخدمو التيليغرام
PUT  /api/admin/telegram/users/:id/block → حظر/رفع حظر مستخدم
GET  /api/admin/telegram/stats         → إحصائيات بوت التيليغرام
```

---

## سابعاً: Middleware Layer التفصيلي

### طبقة الأمان (app.ts)

```typescript
// 1. Trust Proxy — لعناوين IP الصحيحة خلف Replit mTLS
app.set("trust proxy", 1);

// 2. Helmet — HTTP Security Headers
app.use(helmet({
  contentSecurityPolicy: false,     // JSON API لا HTML
  crossOriginEmbedderPolicy: false,
}));

// 3. CORS — دقيق ومُهيّأ
// مسموح: Replit domains (.replit.dev, .repl.co, .replit.app)
//        + localhost للتطوير المحلي
//        + ALLOWED_ORIGINS env var للإنتاج

// 4. Rate Limiting
// Login: 20 طلب / 15 دقيقة → حماية Brute-Force
// API كامل: 300 طلب / دقيقة

// 5. Body Parser
// الحد الأقصى: 50MB (للميديا base64)

// 6. Cookie Parser + Pino HTTP Logger

// 7. JWT / API Key Authentication Middleware
// يتحقق من: httpOnly Cookie "session_token" أو X-API-Key header
// على API Key: يُطابق keyPrefix أولاً (O(1)) ثم bcrypt.compare

// 8. mustChangePassword Middleware
// يُحجب كل شيء ما عدا: /auth/login | /auth/logout | /auth/me | /users/me/password
```

### حماية Webhook من SSRF

```typescript
async function isPrivateUrl(urlStr: string): Promise<boolean> {
  const url = new URL(urlStr);
  const ip = await dnsPromises.lookup(url.hostname);
  // يحجب: localhost, 127.x, 10.x, 172.16-31.x, 192.168.x, ::1
  return isPrivateIP(ip.address);
}

// الإرسال:
// - timeout: 10 ثوانٍ عبر AbortController
// - إعادة محاولة: 3 مرات
// - التوقيع: X-Webhook-Signature: sha256=HMAC(secret, body)
// - بدون secret: لا يُرسل التوقيع
```

---

## ثامناً: مدير الواتساب (WhatsApp Manager)

### آلية العمل الداخلية

```typescript
// whatsapp-manager.ts

// 1. تحديد مسار Chrome ديناميكياً (لا مسارات ثابتة):
//    CHROME_PATH env var → Puppeteer cache scan → fallback
//    يُنزّل Chrome تلقائياً إن لم يجد: npx puppeteer@24.x browsers install chrome

// 2. دليل Tokens:
//    ./tokens/<session_id>/  ← بيانات جلسة wppconnect لكل حساب

// 3. عند بدء جلسة جديدة:
//    a. cleanChromeLocks(sessionId)     ← إزالة قفل Chrome القديم
//    b. create({ sessionName, ... })    ← تشغيل wppconnect
//    c. يُبث QR عبر Socket.IO → الـ Client يعرضه للمسح
//    d. عند النجاح: status = 'connected', phone_number = xxx
//    e. عند استقبال رسالة: تُحفظ في messages + يُرسل للـ webhook

// 4. عند إعادة تشغيل الخادم:
//    يُعيد الاتصال بجميع الجلسات التي autoReconnect=true

// 5. Socket.IO events:
//    'qr:update'      → { sessionId, qr: base64 }
//    'session:status' → { sessionId, status }
//    'message:new'    → { sessionId, message }
```

### أنواع الرسائل المدعومة

```
text      → رسالة نصية عادية
image     → صورة (URL أو base64 data URI)
video     → فيديو
audio     → ملف صوتي
file      → ملف عام (PDF, ZIP, ...)
location  → إحداثيات GPS
sticker   → ملصق واتساب
```

### الميزات (Feature Flags) لكل جلسة

```typescript
interface SessionFeatures {
  sendMessages?:    boolean  // السماح بالإرسال عبر هذه الجلسة
  receiveMessages?: boolean  // السماح بالاستقبال
  sendImages?:      boolean  // تحديداً للصور
  sendVideos?:      boolean
  sendAudio?:       boolean
  sendFiles?:       boolean
  sendLocation?:    boolean
  sendSticker?:     boolean
}
```

---

## تاسعاً: تكامل بوت تيليغرام

### البنية الكاملة

```
المستخدم يرسل رسالة على تيليغرام
              ↓
Telegram → POST /api/webhook/telegram
              ↓
grammY يُعالج الرسالة
              ↓
┌─── هل is_enabled (bot_token في settings)؟ ───┐
│ لا → تجاهل                                    │
│ نعم ↓                                         │
├─── هل المستخدم محظور (is_blocked)؟ ─────────┤
│ نعم → رسالة خطأ مهذّبة                        │
│ لا ↓                                          │
├─── هل تجاوز الحد اليومي؟ ────────────────────┤
│ نعم → رسالة حد اليوم                          │
│ لا ↓                                          │
├─── هل محادثة جديدة؟ ─────────────────────────┤
│ نعم → إنشاء conversation + telegram_conv      │
│ لا → استخدام المحادثة الحالية                 │
│              ↓                                 │
├─── توليد embedding → pgvector → Claude API ──┤
│              ↓                                 │
└─── حفظ في chat_messages → إرسال الرد ────────┘
```

### أوامر تيليغرام

```
/start  → رسالة ترحيب (telegram_welcome_ar أو telegram_welcome_en)
/help   → قائمة الأوامر المتاحة
/lang   → تبديل لغة الرد (ar ↔ en)
/clear  → بدء محادثة جديدة
/stats  → عدد أسئلة المستخدم اليوم
```

### إعداد Webhook تيليغرام

```
1. المدير يُدخل Bot Token في صفحة الإعدادات
2. النظام يستدعي: POST /api/webhook/telegram/setup
3. يتصل بـ: https://api.telegram.org/bot{TOKEN}/setWebhook
   { url: "https://your-app.replit.app/api/webhook/telegram" }
4. Replit يوفر HTTPS تلقائياً → لا إعداد إضافي
```

---

## عاشراً: تكامل n8n

### ما هو n8n؟
أداة أتمتة مفتوحة المصدر تُشبه Zapier لكن self-hosted.

### طريقة العمل مع هذا المشروع

```
المستخدم في التطبيق:
   Admin → /api/n8n-workflow/download
          ↓
   يُنزّل ملف JSON جاهز للاستيراد
   (يتضمن SERVER_URL + API Key تلقائياً)
          ↓
   يستورده في n8n
          ↓
n8n يُحرَّك بحدث واتساب (message received)
          ↓
يُرسل استجابة مُشغَّلة بـ Claude عبر API Key
```

### أنواع الـ Webhook Events المدعومة

```json
["message", "message_ack", "message_reaction", "status_update", "call"]
```

---

## حادي عشر: الصفحات الكاملة

### واجهة مدير الواتساب (whatsapp-dashboard)

| # | الصفحة | المسار | الدور |
|---|--------|--------|-------|
| 1 | لوحة التحكم | `/` | الجميع |
| 2 | الجلسات | `/sessions` | الجميع |
| 3 | تفاصيل جلسة | `/sessions/:id` | مالك الجلسة |
| 4 | إدارة المستخدمين | `/users` | Admin فقط |
| 5 | مفاتيح API | `/api-keys` | الجميع |
| 6 | إرسال رسالة | `/send` | الجميع |

#### تبويبات صفحة تفاصيل الجلسة `/sessions/:id`
```
[QR Code] [الإحصائيات] [الرسائل] [الويب هوك] [الميزات]
```

### المنصة التعليمية (claude-education)

| # | الصفحة | المسار | الوصول |
|---|--------|--------|--------|
| 1 | الرئيسية | `/` | الجميع |
| 2 | تسجيل الدخول | `/login` | غير مسجّل |
| 3 | إنشاء حساب | `/register` | غير مسجّل |
| 4 | تأكيد البريد | `/verify-email?token=` | الجميع |
| 5 | نسيان كلمة المرور | `/forgot-password` | غير مسجّل |
| 6 | إعادة التعيين | `/reset-password?token=` | الجميع |
| 7 | الدردشة | `/chat` | مسجّل |
| 8 | التعلم | `/learn` | مسجّل |
| 9 | قسم محدد | `/learn/:sectionId` | مسجّل |
| 10 | الملف الشخصي | `/profile` | مسجّل |
| 11 | لوحة المدير | `/admin` | Admin |
| 12 | إدارة المستخدمين | `/admin/users` | Admin |
| 13 | سجل العمليات | `/admin/logs` | Admin |
| 14 | إعدادات النظام | `/admin/settings` | Admin |
| 15 | مكتبة المصادر | `/resources` | مسجّل |
| 16 | إدارة المصادر | `/admin/resources` | Admin |

### صفحة إعدادات المدير `/admin/settings` — مُحدَّثة

```
═══════════════════════════════════════════════════════
قسم: إعدادات التطبيق الأساسية
═══════════════════════════════════════════════════════
- اسم التطبيق
- Claude API Key
- نموذج الذكاء الاصطناعي
- الحد اليومي للرسائل
- [تشغيل استيراد المحتوى من GitHub]

═══════════════════════════════════════════════════════
قسم: إدارة واتساب (من مدير الواتساب)
═══════════════════════════════════════════════════════
- قائمة الجلسات المتاحة
- [إنشاء جلسة جديدة]
- إدارة المستخدمين والصلاحيات

═══════════════════════════════════════════════════════
قسم: بوت تيليغرام
═══════════════════════════════════════════════════════

الحالة: ● نشط / ○ غير نشط
[تفعيل ●] / [إيقاف ○]

─────────────────────────────────────
توكن البوت (من @BotFather):
[________________________________] 👁
[حفظ وتفعيل Webhook تلقائياً]
─────────────────────────────────────
رسالة الترحيب (عربي):
[مرحباً! أنا مساعد Claude Code.___]

رسالة الترحيب (إنجليزي):
[Hello! I am Claude Code Assistant.]

الحد اليومي للرسائل: [20]
─────────────────────────────────────
إحصائيات اليوم:
تيليغرام: 89 رسالة | 21 مستخدم
[عرض تفصيلي] → /admin/telegram/users

═══════════════════════════════════════════════════════
قسم: n8n Workflow Integration
═══════════════════════════════════════════════════════
[⬇ تحميل ملف n8n Workflow]
(يتضمن مفاتيح API والـ Server URL تلقائياً)
```

---

## ثاني عشر: الأمان — تفصيل شامل

### طبقات الأمان

```
1. Transport Security
   - HTTPS إجباري (Replit + Nginx في الإنتاج)
   - HSTS Header عبر Helmet
   - Cookie secure: true (على Replit وproduction)

2. Authentication
   - JWT (HS256) — صلاحية 7 أيام
   - httpOnly Cookie → لا يمكن لـ JavaScript الوصول إليه
   - API Keys: يُعرض مرة واحدة فقط عند الإنشاء
   - bcrypt (10 rounds) لكلمات المرور
   - bcrypt لـ API Keys مع keyPrefix لفلترة O(1)

3. Authorization
   - Admin: وصول كامل
   - Employee: فحص الملكية على كل طلب + 11 صلاحية
   - API Key: session restrictions
   - mustChangePassword: يُحجب كل شيء حتى التغيير

4. Rate Limiting
   - Login: 20 req / 15 min → حماية Brute-Force
   - API: 300 req / min

5. Input Validation
   - رقم الهاتف: E.164 (7-15 رقم)
   - إحداثيات GPS: lat(-90..90) + lng(-180..180)
   - تعقيد كلمة المرور: uppercase + lowercase + digit/symbol
   - حجم الـ body: 50MB max

6. Webhook Security (SSRF Protection)
   - isPrivateUrl(): يرفض localhost + Private IPs
   - Timeout: 10 ثوانٍ
   - إعادة محاولة: 3 مرات
   - HMAC Signature: X-Webhook-Signature: sha256=...

7. Socket.IO
   - JWT Auth Middleware على الاتصال
   - Unauthenticated sockets: لا تتلقى events

8. Health Check
   - GET / → { status: "ok" }
   - يمنع 404 logs من فحوصات Replit كل 30 ثانية

9. Chrome / Puppeteer
   - مسار ديناميكي (لا مسار ثابت)
   - تنزيل تلقائي عند الحاجة
   - إزالة قفل Chrome عند إعادة التشغيل

10. CORS
    - Replit domains فقط + ALLOWED_ORIGINS
    - يُسجّل المحجوب في Pino logs
```

---

## ثالث عشر: بيانات التهيئة الأولية

### مستخدم افتراضي
```
username: admin
password: 123456
role: admin
mustChangePassword: TRUE (يُجبر على تغيير كلمة المرور عند أول دخول)
```

### إعدادات افتراضية (settings table)
```
app_name:              Claude Code Assistant
max_messages_per_day:  50
ai_model:              claude-3-5-sonnet-20241022
import_last_run:       NULL
telegram_enabled:      false
telegram_max_daily:    20
```

### 6 مصادر أولية معتمدة (resources table)
```
1. Claude Code Official Documentation — code.claude.com/docs
2. Model Context Protocol (MCP) Specification — modelcontextprotocol.io
3. How Anthropic Built Multi-Agent System — anthropic.com/engineering
4. Design Space of AI Coding Tools (VLHCC 2025) — lau.ucsd.edu
5. Measuring AI Agent Autonomy — anthropic.com/research
6. Awesome Arabic AI Resources — blog.brightcoding.dev
```

### بيانات تجريبية
```
- 3 جلسات واتساب تجريبية (session_001, session_002, session_003)
- 10 مقاطع محتوى تعليمية بالعربية
- 5 محادثات تجريبية (Claude chat)
- 20 سجل في audit_logs
```

---

## رابع عشر: المتغيرات البيئية الكاملة

```bash
# ─── قاعدة البيانات ────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host/db      # Replit يوفره تلقائياً
POSTGRES_USER=wauser
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=claude_manager_db

# ─── أمان الـ API ──────────────────────────────────────────────────────────
JWT_SECRET=       # openssl rand -hex 48
APP_PORT=8080     # منفذ خادم API

# ─── CORS ──────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS=https://your-domain.com  # أكثر من مجال: مفصولة بفاصلة

# ─── Claude API ─────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ─── البريد الإلكتروني ───────────────────────────────────────────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@email.com
EMAIL_PASS=app_password

# ─── واتساب ─────────────────────────────────────────────────────────────────
CHROME_PATH=      # اختياري — يُكتشف تلقائياً إن لم يُحدَّد

# ─── تيليغرام ────────────────────────────────────────────────────────────────
# يُخزَّن في جدول settings بدلاً من .env للمرونة
# TELEGRAM_BOT_TOKEN يُدخل من واجهة المدير

# ─── GitHub ──────────────────────────────────────────────────────────────────
GITHUB_TOKEN=     # اختياري — لزيادة حد طلبات GitHub API

# ─── التطوير ──────────────────────────────────────────────────────────────────
NODE_ENV=development
```

---

## خامس عشر: تعليمات التشغيل والنشر

### التشغيل في بيئة Replit

```bash
# تثبيت الحزم
pnpm install

# رفع مخطط قاعدة البيانات (Drizzle push — لا migrations)
pnpm --filter @workspace/db push

# تشغيل الخادم (API + WhatsApp Manager)
PORT=8080 pnpm --filter @workspace/api-server run dev

# تشغيل الواجهة الأمامية
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/whatsapp-dashboard run dev
```

### النشر على Windows (من الـ Batch Scripts)

| الملف | الغرض |
|-------|-------|
| `start_wa.bat` | تثبيت أول مرة: يستنسخ المستودع، ينشئ .env، يبني Docker، يُشغّل إنتاج |
| `start_dev.bat` | تثبيت أول مرة للتطوير: مع Vite HMR |
| `update_wa.bat` | تحديث: git pull + إعادة بناء بدون cache |
| `run_wa.bat` | تشغيل يومي للإنتاج (Desktop Shortcut) |
| `run_dev.bat` | تشغيل يومي للتطوير |
| `cleanup_wa.bat` | إلغاء تثبيت كامل + حذف Docker volumes |
| `reset_wa.bat` | إعادة ضبط البيانات (يحذف الجلسات والمستخدمين ويُعيد admin/123456) |

### Docker Containers

```yaml
# docker-compose.yml (إنتاج — Port 5005)
services:
  db:       PostgreSQL 16
  api:      api-server (Port 8080) + Chrome + Puppeteer
  dashboard: whatsapp-dashboard (Nginx serving static files)
  nginx:    Reverse Proxy → يوحّد الـ frontend + API على Port 5005
```

---

## سادس عشر: الهوية البصرية

### نظام الألوان

| الدور | الاسم | الكود | الاستخدام |
|-------|-------|-------|-----------|
| الخلفية الرئيسية | أسود دافئ | `#0A0A0F` | خلفية الصفحات |
| خلفية البطاقات | رمادي داكن عميق | `#12121A` | البطاقات |
| الحدود | رمادي خافت | `#1E1E2E` | الخطوط الفاصلة |
| اللون الأساسي | بنفسجي نابض | `#7C3AED` | الأزرار والتمييز |
| التدرج الرئيسي | بنفسجي → أزرق | `#7C3AED → #3B82F6` | الأزرار الرئيسية |
| نصوص ثانوية | رمادي فاتح | `#9CA3AF` | التعليقات |
| نجاح | أخضر هادئ | `#10B981` | إشعارات إيجابية |
| تحذير | برتقالي دافئ | `#F59E0B` | تنبيهات |
| خطأ | أحمر ناعم | `#EF4444` | رسائل الخطأ |

### نظام الخطوط

```
العناوين الرئيسية:  Cairo Bold 700 — 36-48px — تدرج بنفسجي → أزرق
العناوين الثانوية:  Cairo SemiBold 600 — 24-30px — أبيض
نصوص الجسم:        Cairo Regular 400 — 16px — line-height: 1.8
الأكواد:           JetBrains Mono — 14px — خلفية #1E1E2E
نصوص الدردشة:      Cairo Regular 400 — 15px — line-height: 1.9
```

### إعدادات التصميم الافتراضية

```
الوضع الافتراضي:  Dark Mode
اللغة الافتراضية: العربية (RTL)
تحول الوضع:      CSS Variables + 300ms transition
حفظ التفضيلات:   localStorage
```

### CSS الرئيسية

```css
/* الزر الأساسي */
background: linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%);
box-shadow: 0 0 20px rgba(124, 58, 237, 0.4);

/* Glassmorphism للبطاقات */
background: rgba(124, 58, 237, 0.05);
backdrop-filter: blur(10px);
border: 1px solid rgba(124, 58, 237, 0.15);
```

---

## سابع عشر: تعليمات شاملة لبناء المشروع (Prompt للـ AI)

```
══════════════════════════════════════════════════════════════
اسم المشروع: Claude Code Assistant + WhatsApp Manager v5.0
══════════════════════════════════════════════════════════════
التقنيات:
- TypeScript (كل شيء)
- pnpm workspaces (monorepo)
- Backend: Node.js 20 + Express.js v5 + Socket.IO 4
- Frontend (Dashboard): React 19 + Vite 7 + Shadcn UI + Tailwind v4
- Frontend (Education): React 19 + Vite + Tailwind v4 + react-i18next
- Database: PostgreSQL + Drizzle ORM + pgvector
- WhatsApp: @wppconnect-team/wppconnect (Puppeteer)
- Telegram: grammY
- Auth: JWT (7d) + bcryptjs + httpOnly cookies + API Keys
- Logger: Pino + pino-http
- Security: Helmet + cors + express-rate-limit
- Fonts: Google Fonts (Cairo للعربية, Inter للإنجليزية)
- الوضع الافتراضي: Dark Mode + Arabic (RTL)

══════════════════════════════════════════════════════════════
الهوية البصرية:
══════════════════════════════════════════════════════════════
ألوان داكنة:  #0A0A0F, #12121A, #1E1E2E, #7C3AED, #FFFFFF
ألوان فاتحة:  #F4F4F8, #FFFFFF, #E5E7EB, #7C3AED, #111827

══════════════════════════════════════════════════════════════
هيكل Monorepo:
══════════════════════════════════════════════════════════════
workspace/
├── artifacts/api-server/         ← Express + Socket.IO + wppconnect + Claude
├── artifacts/whatsapp-dashboard/ ← React 19 + Shadcn
├── lib/db/                       ← Drizzle schema (15 جدولاً)
├── lib/api-spec/                 ← OpenAPI YAML
├── lib/api-zod/                  ← Generated validators
└── lib/api-client-react/         ← Generated React Query hooks

══════════════════════════════════════════════════════════════
الجداول (15 جدولاً — ابنِها بهذا الترتيب):
══════════════════════════════════════════════════════════════
1. users (id, username, email, passwordHash, role, permissions, maxSessions, isActive, mustChangePassword, ...)
2. whatsapp_sessions (id:TEXT, userId, name, phoneNumber, status, autoReconnect, webhookUrl, webhookSecret, webhookEvents, features, totalSent, totalReceived, ...)
3. messages (id, sessionId, direction, fromNumber, toNumber, messageType, content, mediaUrl, caption, status, timestamp)
4. api_keys (id, userId, name, keyHash, keyPrefix, allowedSessionIds, createdAt, lastUsedAt)
5. audit_logs (id, userId, username, action, sessionId, details, ipAddress, timestamp)
6. settings (id, key UNIQUE, value, description, updatedBy, updatedAt)
7. content_chunks (id, title, title_ar, content, content_ar, category, section, source_file, order_index, embedding VECTOR(1536), ...)
8. conversations (id, userId, session_title, ...)
9. chat_messages (id, conversation_id, role, content, sources JSONB, tokens_used, ...)
10. user_progress (id, userId, section, chunk_id, read_at, UNIQUE(userId, chunk_id))
11. resources (id, title_en, title_ar, description_en, description_ar, url, source_name, type, language, is_visible, is_featured, embedding VECTOR(1536), ...)
12. resource_translations (id, resource_id, field, source_lang, target_lang, translated, UNIQUE(...))
13. resource_suggestions (id, userId, url, title, description, type, status, admin_note, ...)
14. telegram_users (id, telegram_id BIGINT UNIQUE, first_name, username, linked_user_id, language, is_blocked, daily_count, last_reset, ...)
15. telegram_conversations (id, telegram_user_id, conversation_id, ...)

══════════════════════════════════════════════════════════════
نقاط API الرئيسية (الخادم — Port 8080):
══════════════════════════════════════════════════════════════
/api/auth: login (rate-limited 20/15min), logout, me
/api/sessions: CRUD + connect/disconnect/qr/stats/messages/webhook/features
/api/send: text/image/video/audio/file/location/sticker (عام + per-session)
/api/users: CRUD (admin فقط للإنشاء/الحذف)
/api/api-keys: CRUD
/api/dashboard/stats: 7-day chart (by role)
/api/audit-logs: admin فقط + pagination
/api/n8n-workflow/download: admin فقط
/api/chat: conversations + messages (Claude AI + pgvector)
/api/content: sections + search + progress
/api/resources: list + translate + ask + suggest
/api/admin: dashboard + users + content + settings + resources + import
/api/webhook/telegram: grammY webhook + /api/webhook/telegram/setup
/api/admin/telegram: users + stats

══════════════════════════════════════════════════════════════
Middleware (بالترتيب):
══════════════════════════════════════════════════════════════
1. trust proxy = 1
2. helmet (CSP disabled)
3. cors (Replit domains + ALLOWED_ORIGINS)
4. rate limiter (login: 20/15min | api: 300/min)
5. body parser (50MB)
6. cookie-parser
7. pino-http logger
8. JWT/APIKey auth (keyPrefix O(1) فلترة → bcrypt compare)
9. mustChangePassword guard

══════════════════════════════════════════════════════════════
صفحات الواجهة (whatsapp-dashboard — Port 5000):
══════════════════════════════════════════════════════════════
/ → Dashboard (live stats + 7-day Recharts chart)
/sessions → قائمة الجلسات + حالة الاتصال + حذف
/sessions/:id → تبويبات: QR | إحصائيات | رسائل | ويب هوك | ميزات
/users → إدارة المستخدمين (admin فقط) + permissions matrix
/api-keys → إنشاء/تعديل/حذف مفاتيح
/send → إرسال رسائل (كل الأنواع + file upload)

══════════════════════════════════════════════════════════════
صفحات المنصة التعليمية (claude-education — Port 5001):
══════════════════════════════════════════════════════════════
/ → الرئيسية
/login → تسجيل دخول
/register → إنشاء حساب + تأكيد بريد
/chat → دردشة Claude (مع سجل المحادثات + pgvector)
/learn → المحتوى التعليمي + التقدم
/learn/:sectionId → قسم محدد
/profile → الملف الشخصي
/admin → لوحة المدير (إحصائيات + استيراد محتوى + بوت تيليغرام)
/resources → مكتبة المصادر

══════════════════════════════════════════════════════════════
الأمان الكامل:
══════════════════════════════════════════════════════════════
- bcrypt (10 rounds) للكلمات مرور والـ API Keys
- JWT HS256 — 7 أيام — httpOnly cookie
- secure cookie: true على Replit/production
- API Key: bcrypt(fullKey) + keyPrefix للفلترة السريعة
- mustChangePassword: يُحجب كل شيء ما عدا 4 نقاط
- Phone validation: E.164 (7-15 digit)
- GPS validation: lat(-90..90), lng(-180..180), !NaN, !Infinity
- Password complexity: uppercase + lowercase + digit/symbol + 6+ chars
- Webhook SSRF: isPrivateUrl() + 10s timeout + 3 retries + HMAC
- Socket.IO: JWT auth on connect
- Chrome: dynamic path resolution + auto-download + lock cleanup

══════════════════════════════════════════════════════════════
بيانات الاختبار الأولية:
══════════════════════════════════════════════════════════════
- مدير: username=admin / password=123456 / mustChangePassword=TRUE
- 3 جلسات واتساب: session_001, session_002, session_003
- 3 موظفين تجريبيين بصلاحيات مختلفة
- 2 مفتاح API تجريبي
- 10 مقاطع محتوى عربية عن Claude Code (موزعة على 10 أقسام)
- 5 محادثات Claude تجريبية
- 20 سجل عملية في audit_logs
- 6 مصادر في resources (Claude Docs, MCP, Multi-Agent, VLHCC, Agent Autonomy, Arabic AI)

══════════════════════════════════════════════════════════════
المتغيرات البيئية المطلوبة:
══════════════════════════════════════════════════════════════
DATABASE_URL    → يوفره Replit تلقائياً
JWT_SECRET      → openssl rand -hex 48
ANTHROPIC_API_KEY → من Anthropic Console
APP_PORT        → 8080
ALLOWED_ORIGINS → نطاقاتك الخارجية
EMAIL_HOST/PORT/USER/PASS → SMTP للتأكيد
CHROME_PATH     → اختياري (يُكتشف تلقائياً)
GITHUB_TOKEN    → اختياري
```

---

## تاسع عشر: خطة البناء التدريجي الاحترافية

> **المبدأ:** كل مرحلة تنتهي بنظام يعمل بشكل مستقل وقابل للاختبار قبل الانتقال للتالية.  
> **التبعية:** كل مرحلة تبني فوق السابقة — لا تبدأ مرحلة قبل اجتياز اختبارات المرحلة التي قبلها.  
> **التوثيق:** كل مرحلة تُنتج ملف `PHASE_X_DONE.md` يوثّق ما بُني وما اختُبر.

---

### نظرة عامة على المراحل العشر

| # | المرحلة | المدة المقدّرة | المخرج الرئيسي |
|---|---------|---------------|----------------|
| 1 | الأساس: Monorepo + قاعدة البيانات | يوم 1 | 15 جدولاً + seed data جاهز |
| 2 | الخادم الأساسي: Auth + Users + API Keys | يوم 2 | نظام مصادقة كامل يعمل |
| 3 | مدير الواتساب: Core + WebSocket | يوم 3-4 | جلسات حقيقية + QR Code |
| 4 | نقاط الإرسال الكاملة + التحقق | يوم 4 | إرسال 7 أنواع رسائل |
| 5 | Dashboard API + Audit + n8n | يوم 5 | إحصائيات + سجلات + تصدير |
| 6 | المنصة التعليمية: Backend كامل | يوم 6-7 | Claude RAG + محتوى + مصادر |
| 7 | بوت تيليغرام | يوم 7 | بوت يرد على الأوامر |
| 8 | واجهة مدير الواتساب (Frontend) | يوم 8-9 | لوحة تحكم React كاملة |
| 9 | المنصة التعليمية (Frontend) | يوم 9-10 | موقع تعليمي كامل |
| 10 | Docker + نشر الإنتاج | يوم 10 | بيئة إنتاج جاهزة |

---

### المرحلة 1: الأساس — Monorepo + قاعدة البيانات

**الهدف:** بناء هيكل المشروع الكامل وإنشاء كل الجداول مع البيانات الأولية.

#### ما يُبنى

```
workspace/
├── pnpm-workspace.yaml
├── package.json (root — private: true)
├── tsconfig.base.json
├── .env.example
├── lib/
│   └── db/
│       ├── package.json (@workspace/db)
│       ├── src/
│       │   ├── index.ts        ← يُصدّر db client + جميع الجداول
│       │   └── schema/
│       │       ├── users.ts
│       │       ├── whatsapp-sessions.ts
│       │       ├── messages.ts
│       │       ├── api-keys.ts
│       │       ├── audit-logs.ts
│       │       ├── settings.ts
│       │       ├── content-chunks.ts
│       │       ├── conversations.ts
│       │       ├── chat-messages.ts
│       │       ├── user-progress.ts
│       │       ├── resources.ts
│       │       ├── resource-translations.ts
│       │       ├── resource-suggestions.ts
│       │       ├── telegram-users.ts
│       │       └── telegram-conversations.ts
│       └── drizzle.config.ts
└── scripts/
    └── seed.ts    ← يُدرج البيانات الأولية
```

#### مواصفات التنفيذ

```typescript
// drizzle.config.ts
export default {
  schema: "./src/schema/*",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! }
};

// lib/db/src/index.ts — يُصدّر كل شيء
export { db } from "./client";
export * from "./schema/users";
export * from "./schema/whatsapp-sessions";
// ... بقية الجداول
```

#### البيانات الأولية (seed.ts)

```typescript
// يُدرج البيانات التالية بالترتيب:
// 1. مستخدم admin (password='123456', bcrypt hashed, mustChangePassword=true)
// 2. 3 موظفين تجريبيين بصلاحيات مختلفة
// 3. 9 إعدادات في settings
// 4. 6 مصادر في resources
// 5. 10 مقاطع محتوى تعليمي في content_chunks (بدون embedding — يُحدَّث لاحقاً)
// 6. 3 جلسات واتساب تجريبية (status='disconnected')
// 7. 2 API Keys تجريبية (bcrypt hashed)
// 8. 20 سجل في audit_logs
```

#### اختبارات المرحلة 1

```
✅ تشغيل: pnpm --filter @workspace/db push → بدون أخطاء
✅ تشغيل: pnpm run seed → بدون أخطاء
✅ قاعدة البيانات تحتوي على 15 جدولاً بالضبط
✅ جدول users يحتوي على 4 صفوف (admin + 3 موظفين)
✅ جدول settings يحتوي على 9 صفوف
✅ جدول resources يحتوي على 6 صفوف
✅ امتداد pgvector مُفعَّل (SELECT * FROM pg_extension WHERE extname='vector')
✅ عمود embedding من نوع VECTOR(1536) موجود في content_chunks و resources
✅ المفاتيح الأجنبية (Foreign Keys) كلها صحيحة
```

#### توثيق المرحلة 1

```markdown
# PHASE_1_DONE.md
## ما بُني
- pnpm workspace بـ 6 حزم (lib/db, lib/api-spec, lib/api-zod, lib/api-client-react, artifacts/api-server, artifacts/whatsapp-dashboard)
- 15 جدولاً بـ Drizzle ORM
- seed.ts يُدرج بيانات الاختبار

## الأوامر
pnpm install                        # تثبيت جميع الحزم
pnpm --filter @workspace/db push    # رفع المخطط لـ PostgreSQL
pnpm run seed                       # إدراج البيانات الأولية

## نتائج الاختبار
[✅] جميع الجداول موجودة
[✅] pgvector مُفعَّل
[✅] seed data صحيح
```

---

### المرحلة 2: الخادم الأساسي — Auth + Users + API Keys

**الهدف:** خادم Express كامل مع نظام مصادقة احترافي وإدارة المستخدمين.

#### ما يُبنى

```
artifacts/api-server/
├── package.json (@workspace/api-server)
├── tsconfig.json
├── src/
│   ├── app.ts               ← Middleware stack كامل
│   ├── index.ts             ← نقطة الدخول + HTTP server
│   ├── lib/
│   │   ├── auth.ts          ← JWT + bcrypt + requireAuth + requireAdmin
│   │   ├── rate-limit.ts    ← loginRateLimiter + apiRateLimiter
│   │   └── logger.ts        ← Pino instance
│   └── routes/
│       ├── index.ts         ← يجمع كل الـ routers
│       ├── auth.ts          ← login + logout + me
│       └── users.ts         ← CRUD + me + password
```

#### مواصفات Middleware (بالترتيب الصارم)

```typescript
// app.ts — الترتيب مهم جداً
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: allowedOriginsFunction, credentials: true }));
app.use(apiRateLimiter);                  // 300 req/min
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// Health check — قبل Auth
app.get("/", (req, res) => res.json({ status: "ok" }));
app.get("/api/healthz", (req, res) => res.json({ status: "ok" }));

// Routes
app.use("/api", router);

// 404 handler
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// Global error handler
app.use((err, req, res, next) => { ... });
```

#### مواصفات Auth

```typescript
// lib/auth.ts
hashPassword(password: string): string          // bcrypt 10 rounds
verifyPassword(plain, hash): boolean            // bcrypt.compare
generateToken(userId, role): string             // JWT HS256 — 7d
verifyToken(token): { userId, role } | null

requireAuth middleware:
  1. ابحث عن JWT في: req.cookies.session_token أولاً
  2. ثم في Authorization: Bearer header
  3. ثم في X-API-Key header:
     a. استخرج أول 8 أحرف (keyPrefix)
     b. ابحث في api_keys حيث key_prefix = keyPrefix
     c. bcrypt.compare(fullKey, keyHash)
     d. إن طابق: تحقق من allowedSessionIds إن وُجدت
     e. حدّث lastUsedAt
  4. أرفق (req as any).user = user
  5. تحقق من mustChangePassword — حجب ما عدا 4 نقاط

requireAdmin middleware:
  if (user.role !== 'admin') return 403

hasPermission(user, permissionKey):
  if (user.role === 'admin') return true
  const perms = JSON.parse(user.permissions || '{}')
  return perms[permissionKey] !== false
```

#### اختبارات المرحلة 2

```
✅ POST /api/auth/login (admin/123456) → يُرجع token + mustChangePassword=true
✅ POST /api/auth/login (خطأ) → 401
✅ POST /api/auth/login > 20 مرة في 15 دقيقة → 429 (Rate Limited)
✅ GET /api/auth/me (بدون token) → 401
✅ GET /api/auth/me (مع token صحيح) → بيانات المستخدم
✅ POST /api/auth/logout → يمسح الـ Cookie
✅ GET /api/users (employee token) → 403
✅ GET /api/users (admin token) → قائمة المستخدمين
✅ POST /api/users (admin) → ينشئ مستخدم جديد
✅ PATCH /api/users/me/password → يُلغي mustChangePassword
✅ mustChangePassword=true: GET /api/users → 403
✅ mustChangePassword=true: PATCH /api/users/me/password → 200 ✓
✅ API Key authentication: X-API-Key header يعمل
✅ تعقيد كلمة المرور: "abc" → 400 + رسالة خطأ واضحة
```

#### توثيق المرحلة 2

```markdown
# PHASE_2_DONE.md
## نقاط API المكتملة
POST /api/auth/login    ✅
POST /api/auth/logout   ✅
GET  /api/auth/me       ✅
GET  /api/users         ✅ (admin)
POST /api/users         ✅ (admin)
GET  /api/users/:id     ✅
PATCH /api/users/:id    ✅ (admin)
DELETE /api/users/:id   ✅ (admin)
PATCH /api/users/me     ✅
PATCH /api/users/me/password ✅

## الأمان المُطبَّق
- JWT HS256 / bcrypt(10) / httpOnly Cookie / API Key Auth ✅
- Rate Limiting: login 20/15min + API 300/min ✅
- mustChangePassword Guard ✅
- Password Complexity Validation ✅
- Role-based Access Control ✅
```

---

### المرحلة 3: مدير الواتساب Core + WebSocket

**الهدف:** إدارة جلسات واتساب حقيقية مع QR Code في الوقت الفعلي.

#### ما يُبنى

```
artifacts/api-server/src/
├── lib/
│   ├── whatsapp-manager.ts  ← Core: wppconnect + Chrome + Socket.IO
│   └── audit.ts             ← writeAuditLog()
└── routes/
    └── sessions.ts          ← CRUD + connect/disconnect/qr/stats/messages/webhook/features
```

#### مواصفات whatsapp-manager.ts

```typescript
// Chrome Resolution (بالترتيب):
function resolveChromePath(): string {
  // 1. CHROME_PATH env var
  // 2. scan /home/runner/.cache/puppeteer/chrome/ — أحدث إصدار
  // 3. fallback: npx puppeteer@24.x browsers install chrome
}

// Tokens Directory: process.cwd() + "/tokens/<sessionId>/"

// createSession(sessionId, socketServer):
//   a. cleanChromeLocks(sessionId)        ← SingletonLock/Socket/Cookie
//   b. create({ sessionName: sessionId, headless: true, executablePath: CHROME_PATH, ... })
//   c. onQR → emit 'qr:update' { sessionId, qr }
//   d. onConnected → update DB status='connected', emit 'session:status'
//   e. onMessage → insert into messages, emit 'message:new', triggerWebhook()
//   f. onDisconnected → update DB status='disconnected', emit 'session:status'

// reconnectOnBoot():
//   SELECT * FROM whatsapp_sessions WHERE auto_reconnect=true AND status!='banned'
//   → createSession() لكل منها

// Socket.IO Auth:
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const user = verifyToken(token);
  if (!user) return next(new Error("Unauthorized"));
  socket.data.user = user;
  next();
});
```

#### مواصفات sessions routes

```typescript
// GET /api/sessions
//   Admin: جميع الجلسات
//   Employee: فقط حيث userId=user.id
//   API Key مع allowedSessionIds: الجلسات المحددة فقط

// POST /api/sessions { name, webhookUrl? }
//   - hasPermission(user, 'createSession') أو 403
//   - تحقق من maxSessions: count existing sessions
//   - INSERT → writeAuditLog('createSession')

// POST /api/sessions/:id/connect
//   - hasPermission(user, 'connectSession') أو 403
//   - apiKeyAllowsSession(req, sessionId) أو 403
//   - update status='connecting'
//   - createSession(sessionId, io) → QR يُبث عبر Socket.IO

// POST /api/sessions/:id/disconnect
//   - hasPermission(user, 'disconnectSession') أو 403
//   - client.close() → update status='disconnected', autoReconnect=false

// PATCH /api/sessions/:id/webhook { webhookUrl, webhookSecret?, webhookEvents? }
//   - hasPermission(user, 'manageWebhook') أو 403
//   - SSRF: await isPrivateUrl(webhookUrl) → 400 إن كان private
//   - UPDATE webhook_url, webhook_secret, webhook_events

// Webhook Delivery:
async function triggerWebhook(session, event, payload) {
  if (!session.webhookUrl) return;
  if (!session.webhookEvents?.includes(event)) return;
  if (await isPrivateUrl(session.webhookUrl)) return;  // SSRF guard
  const body = JSON.stringify({ event, sessionId: session.id, ...payload });
  const sig = session.webhookSecret
    ? 'sha256=' + createHmac('sha256', session.webhookSecret).update(body).digest('hex')
    : undefined;
  // fetch with AbortController 10s timeout + retry 3x
}
```

#### اختبارات المرحلة 3

```
✅ POST /api/sessions (admin) → ينشئ جلسة
✅ GET /api/sessions (employee) → يرى جلساته فقط
✅ POST /api/sessions (employee, createSession=false) → 403
✅ POST /api/sessions (employee, تجاوز maxSessions) → 400
✅ POST /api/sessions/:id/connect → status='connecting' في DB
✅ Socket.IO: client يتصل بـ token صحيح → نجاح
✅ Socket.IO: client بدون token → خطأ 'Unauthorized'
✅ Socket.IO: يستقبل qr:update event
✅ PATCH /api/sessions/:id/webhook (localhost URL) → 400 SSRF rejected
✅ PATCH /api/sessions/:id/webhook (URL صحيح) → يحفظ
✅ GET /api/sessions/:id/stats → { totalSent, totalReceived, status }
✅ DELETE /api/sessions/:id → يحذف + يحذف ملفات tokens
✅ Audit Log: كل إجراء يُسجَّل في audit_logs
✅ عند إعادة تشغيل الخادم: الجلسات ذات autoReconnect=true تُعيد الاتصال
```

#### توثيق المرحلة 3

```markdown
# PHASE_3_DONE.md
## نقاط API المكتملة
GET    /api/sessions                ✅
POST   /api/sessions                ✅
GET    /api/sessions/:id            ✅
DELETE /api/sessions/:id            ✅
POST   /api/sessions/:id/connect    ✅
POST   /api/sessions/:id/disconnect ✅
GET    /api/sessions/:id/qr         ✅
GET    /api/sessions/:id/stats      ✅
GET    /api/sessions/:id/messages   ✅
PATCH  /api/sessions/:id/webhook    ✅
PATCH  /api/sessions/:id/features   ✅

## Socket.IO Events
qr:update       → { sessionId, qr: base64 }  ✅
session:status  → { sessionId, status }       ✅
message:new     → { sessionId, message }      ✅

## أمان الـ Webhook
SSRF Protection (isPrivateUrl) ✅
HMAC Signature (sha256=...)    ✅
Timeout 10s + Retry 3x        ✅
```

---

### المرحلة 4: نقاط الإرسال الكاملة

**الهدف:** إرسال 7 أنواع من الرسائل مع تحقق كامل من المدخلات.

#### ما يُبنى

```
artifacts/api-server/src/routes/
└── send.ts   ← جميع نقاط الإرسال
```

#### مواصفات التنفيذ

```typescript
// دوال مساعدة (مشتركة بين جميع النقاط):

validatePhoneNumber(number: string): string | null
  // E.164: 7-15 رقم بعد إزالة غير الأرقام
  // يقبل: @c.us / @g.us / @lid مباشرة
  // يرفض: @newsletter

formatNumber(number: string): string
  // يحوّل الأرقام إلى format: "966XXXXXXXX@c.us"

saveTempFile(dataUrl: string, fallbackExt: string): string | null
  // base64 data URI → ملف مؤقت في tmpdir()
  // يُرجع المسار | null إن لم يكن data URI
  // المستدعي مسؤول عن cleanupTempFile(path)

// POST /api/send/text { sessionId, to, message }
//   1. تحقق من الجلسة + الملكية + hasPermission('sendText')
//   2. validatePhoneNumber + formatNumber
//   3. client.sendText(formattedNumber, message)
//   4. INSERT into messages (direction='outbound', type='text')
//   5. UPDATE totalMessagesSent++
//   6. writeAuditLog('sendText', { sessionId, to })
//   7. triggerWebhook(session, 'message', { ... })

// POST /api/send/location { sessionId, to, lat, lng, description? }
//   تحقق إضافي: isNaN(lat) || isNaN(lng) → 400
//               lat < -90 || lat > 90 → 400
//               lng < -180 || lng > 180 → 400
//               !isFinite(lat) || !isFinite(lng) → 400

// POST /api/send/image { sessionId, to, image, caption? }
//   إن كان image يبدأ بـ "data:":
//     path = saveTempFile(image, 'jpg')
//     client.sendImage(to, path, caption)
//     cleanupTempFile(path)  ← في finally block دائماً
//   إن كان URL:
//     client.sendImage(to, image, caption)

// نفس المنطق لـ: video, audio, file, sticker
// file: يستقبل filename إضافي
```

#### اختبارات المرحلة 4

```
✅ POST /api/send/text (جلسة متصلة) → نجاح + message في DB
✅ POST /api/send/text (رقم قصير < 7 أرقام) → 400 + رسالة وصفية
✅ POST /api/send/text (رقم طويل > 15 رقم) → 400 + رسالة وصفية
✅ POST /api/send/text (جلسة غير متصلة) → 400 session not connected
✅ POST /api/send/image (URL) → نجاح
✅ POST /api/send/image (base64 data URI) → نجاح + ملف مؤقت يُحذف
✅ POST /api/send/location (lat=200) → 400 GPS invalid
✅ POST /api/send/location (lat=NaN) → 400
✅ POST /api/send/location (صحيح) → نجاح
✅ hasPermission check: sendText=false → 403
✅ hasPermission check: sendMedia=false + إرسال صورة → 403
✅ audit_logs: كل إرسال يُسجَّل
✅ totalMessagesSent يزيد بعد كل إرسال
✅ triggerWebhook يُطلَق عند الإرسال
✅ POST /api/sessions/:id/send/text (per-session route) → يعمل
```

---

### المرحلة 5: Dashboard API + Audit + n8n

**الهدف:** إحصائيات حقيقية مع pagination للسجلات وتصدير n8n.

#### ما يُبنى

```
artifacts/api-server/src/routes/
├── dashboard.ts    ← stats + 7-day chart
├── audit-logs.ts   ← paginated logs (admin)
├── api-keys.ts     ← CRUD
└── n8n.ts          ← download workflow JSON
```

#### مواصفات التنفيذ

```typescript
// GET /api/dashboard/stats
//   Admin: جميع الجلسات
//   Employee: جلساته فقط (يُحسب visibleSessionIds أولاً)
//   يبني 7-day skeleton: { "2026-04-08": {sent:0,received:0}, ... }
//   يملأه من messages table حيث timestamp >= 7 أيام
//   يُرجع:
//   {
//     totalSessions, connectedSessions, disconnectedSessions,
//     totalSent, totalReceived,
//     dailyStats: [{ date, sent, received }]  // 7 أيام
//   }

// GET /api/audit-logs?page=1&limit=50&action=&sessionId=&from=&to=
//   Admin فقط
//   ORDER BY timestamp DESC
//   يُرجع: { logs[], total, page, totalPages }

// GET /api/api-keys
//   Admin: جميع المفاتيح | Employee: مفاتيحه فقط
//   لا يُرجع keyHash أبداً — فقط keyPrefix + name + dates

// POST /api/api-keys { name, allowedSessionIds? }
//   fullKey = randomBytes(32).toString('hex')   ← 64 حرف hex
//   keyPrefix = fullKey.slice(0, 8)
//   keyHash = bcrypt(fullKey, 10)
//   INSERT → يُرجع fullKey مرة واحدة فقط في الاستجابة

// GET /api/n8n-workflow/download
//   Admin فقط
//   يقرأ ملف template من /scripts/n8n-workflow-template.json
//   يُبدّل: SERVER_URL → process.env.REPLIT_DEV_DOMAIN أو APP_URL
//           API_KEY_PLACEHOLDER → مفتاح Admin الأول في قاعدة البيانات
//   يُرجع الملف بـ Content-Disposition: attachment; filename=n8n-workflow.json
```

#### اختبارات المرحلة 5

```
✅ GET /api/dashboard/stats (admin) → يُرجع stats لجميع الجلسات
✅ GET /api/dashboard/stats (employee) → يُرجع stats جلساته فقط
✅ dailyStats: 7 عناصر دائماً (حتى لو لا رسائل في يوم)
✅ GET /api/audit-logs?page=1 → 50 سجل + { total, totalPages }
✅ GET /api/audit-logs (employee) → 403
✅ POST /api/api-keys → يُرجع fullKey في الاستجابة فقط
✅ GET /api/api-keys → keyHash غائب من الاستجابة
✅ DELETE /api/api-keys/:id → يحذف
✅ GET /api/n8n-workflow/download (admin) → ملف JSON بـ SERVER_URL مُضمَّن
✅ GET /api/n8n-workflow/download (employee) → 403
```

---

### المرحلة 6: المنصة التعليمية — Backend كامل

**الهدف:** نظام RAG كامل مع Claude API + pgvector + استيراد المحتوى + مكتبة المصادر.

#### ما يُبنى

```
artifacts/api-server/src/
├── lib/
│   ├── claude.ts        ← Anthropic client + embedding + chat
│   ├── rag.ts           ← البحث الدلالي + بناء Prompt
│   └── github.ts        ← جلب ملفات .md من ibrahims78/claude-howto
└── routes/
    ├── chat.ts          ← conversations + messages (RAG)
    ├── content.ts       ← sections + search + progress
    ├── profile.ts       ← profile stats + update
    ├── resources.ts     ← list + translate + ask + suggest
    └── admin.ts         ← dashboard + import + settings + resources management
```

#### مواصفات claude.ts + rag.ts

```typescript
// lib/claude.ts
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateEmbedding(text: string): Promise<number[]>
  // استخدم claude-3-5-sonnet أو text-embedding-ada-002
  // يُرجع vector[1536]

async function chat(messages, systemPrompt, model): Promise<{content, tokensUsed}>
  // model: من settings.ai_model

// lib/rag.ts
async function searchSimilarChunks(query: string, limit = 5): Promise<ContentChunk[]>
  // 1. generateEmbedding(query)
  // 2. SELECT ... FROM content_chunks
  //    ORDER BY embedding <-> $1::vector LIMIT $2
  //    (cosine distance — pgvector operator)

function buildSystemPrompt(chunks: ContentChunk[], language: 'ar' | 'en'): string
  // يبني prompt يُضمّن المقاطع كـ context
  // يوجّه Claude للإجابة بالعربية إن language='ar'
  // يُلزمه بالاستناد فقط للمقاطع المُقدَّمة

// POST /api/chat/conversations/:id/messages { content }
//   1. chunks = await searchSimilarChunks(content, 5)
//   2. systemPrompt = buildSystemPrompt(chunks, userLang)
//   3. history = SELECT last 10 messages من conversation
//   4. response = await chat([...history, {role:'user', content}], systemPrompt)
//   5. INSERT user message + assistant response
//   6. يُرجع: { response, sources: chunks.map(c => ({title:c.title_ar, section:c.section})) }
```

#### مواصفات admin import

```typescript
// POST /api/admin/import
//   Admin فقط
//   1. جلب قائمة الملفات من GitHub API:
//      GET https://api.github.com/repos/ibrahims78/claude-howto/contents/
//      (مع GITHUB_TOKEN إن وُجد)
//   2. لكل ملف .md:
//      a. جلب المحتوى (base64 decode)
//      b. تقسيم بـ "##" إلى مقاطع chunks
//      c. ترجمة title و content إلى العربية عبر Claude API
//      d. generateEmbedding للمحتوى الإنجليزي
//      e. UPSERT في content_chunks (بناءً على source_file + order_index)
//   3. UPDATE settings SET value=NOW() WHERE key='import_last_run'
//   4. يُرجع: { imported, updated, total }
```

#### اختبارات المرحلة 6

```
✅ POST /api/chat/conversations → ينشئ محادثة
✅ POST /api/chat/conversations/:id/messages { content: "ما هو Claude Code؟" }
   → يُرجع إجابة + sources (مقاطع من content_chunks)
✅ GET /api/content/sections → الأقسام مع نسبة التقدم
✅ GET /api/content/search?q=slash → نتائج بحث
✅ POST /api/content/progress/:chunkId → يسجّل القراءة
✅ POST /api/admin/import → يستورد المحتوى من GitHub
✅ GET /api/resources → قائمة المصادر (is_visible=true فقط)
✅ POST /api/resources/:id/translate → يترجم + يُخزّن في cache
✅ POST /api/resources/:id/translate (نفس الطلب مرة ثانية) → fromCache: true
✅ POST /api/resources/suggest → يحفظ في resource_suggestions
✅ GET /api/admin/resources/suggestions → Admin يرى الاقتراحات
✅ PUT /api/admin/resources/suggestions/:id { status: 'approved' } → يُحدّث
✅ GET /api/profile/stats → { totalQuestions, totalConversations, progressPercent }
```

---

### المرحلة 7: بوت تيليغرام

**الهدف:** بوت تيليغرام متكامل يستخدم نفس منطق المنصة التعليمية.

#### ما يُبنى

```
artifacts/api-server/src/
├── lib/
│   └── telegram-bot.ts   ← grammY bot instance + handlers
└── routes/
    └── telegram.ts       ← webhook endpoint + setup + admin routes
```

#### مواصفات telegram-bot.ts

```typescript
import { Bot, Context } from "grammy";

let botInstance: Bot | null = null;

export function initBot(token: string): Bot {
  const bot = new Bot(token);

  // Middleware: تسجيل/تحديث telegram_users
  bot.use(async (ctx, next) => {
    const tgId = ctx.from?.id;
    if (!tgId) return next();
    // UPSERT في telegram_users
    // تحقق من is_blocked → رسالة مهذّبة وتوقف
    // تحقق من daily_count >= telegram_max_daily → رسالة الحد
    await next();
  });

  // /start
  bot.command("start", async (ctx) => {
    const user = ctx.telegramUser;  // من middleware
    const lang = user.language;
    const welcome = await getSetting(lang === 'ar' ? 'telegram_welcome_ar' : 'telegram_welcome_en');
    await ctx.reply(welcome);
  });

  // /help
  bot.command("help", async (ctx) => { ... });

  // /lang
  bot.command("lang", async (ctx) => {
    const current = ctx.telegramUser.language;
    const newLang = current === 'ar' ? 'en' : 'ar';
    await db.update(telegramUsersTable).set({ language: newLang });
    await ctx.reply(newLang === 'ar' ? "تم التبديل للعربية ✓" : "Switched to English ✓");
  });

  // /clear
  bot.command("clear", async (ctx) => {
    // إنشاء محادثة جديدة + تحديث telegram_conversations
    await ctx.reply(lang === 'ar' ? "تم مسح المحادثة ✓" : "Conversation cleared ✓");
  });

  // /stats
  bot.command("stats", async (ctx) => {
    const user = ctx.telegramUser;
    await ctx.reply(`أسئلتك اليوم: ${user.dailyCount}`);
  });

  // كل رسالة عادية → RAG + Claude
  bot.on("message:text", async (ctx) => {
    const query = ctx.message.text;
    const telegramUser = ctx.telegramUser;

    // إيجاد/إنشاء conversation
    let convId = await getOrCreateTelegramConversation(telegramUser.id);

    // RAG
    const chunks = await searchSimilarChunks(query, 5);
    const systemPrompt = buildSystemPrompt(chunks, telegramUser.language);

    // Claude
    const history = await getLast10Messages(convId);
    const { content } = await chat([...history, { role: 'user', content: query }], systemPrompt);

    // حفظ
    await insertChatMessage(convId, 'user', query);
    await insertChatMessage(convId, 'assistant', content);

    // تحديث daily_count
    await incrementDailyCount(telegramUser.id);

    await ctx.reply(content, { parse_mode: 'Markdown' });
  });

  return bot;
}

// POST /api/webhook/telegram
export async function handleTelegramWebhook(req, res) {
  if (!botInstance) {
    const token = await getSetting('telegram_token');
    if (!token) return res.sendStatus(200);
    botInstance = initBot(token);
  }
  await botInstance.handleUpdate(req.body);
  res.sendStatus(200);
}

// POST /api/webhook/telegram/setup
export async function setupTelegramWebhook(req, res) {
  const token = await getSetting('telegram_token');
  const appUrl = process.env.REPLIT_DEV_DOMAIN || process.env.APP_URL;
  const webhookUrl = `https://${appUrl}/api/webhook/telegram`;
  await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    body: JSON.stringify({ url: webhookUrl }),
    headers: { 'Content-Type': 'application/json' }
  });
  res.json({ success: true, webhookUrl });
}
```

#### اختبارات المرحلة 7

```
✅ GET /api/admin/settings → telegram_enabled=false
✅ PUT /api/admin/settings { telegram_token: "..." } → يحفظ
✅ POST /api/webhook/telegram/setup → يُسجّل webhook في تيليغرام
✅ POST /api/webhook/telegram (محاكاة /start) → رسالة ترحيب
✅ POST /api/webhook/telegram (محاكاة /lang) → يبدّل اللغة
✅ POST /api/webhook/telegram (محاكاة /clear) → محادثة جديدة
✅ POST /api/webhook/telegram (محاكاة /stats) → يُرجع العدد
✅ POST /api/webhook/telegram (رسالة عادية) → رد Claude مع sources
✅ تجاوز الحد اليومي → رسالة توقف مهذّبة
✅ مستخدم محظور → رسالة خطأ مهذّبة
✅ GET /api/admin/telegram/users → قائمة مستخدمي التيليغرام
✅ PUT /api/admin/telegram/users/:id/block → يحجب
✅ GET /api/admin/telegram/stats → إحصائيات
```

---

### المرحلة 8: واجهة مدير الواتساب (Frontend)

**الهدف:** لوحة تحكم React 19 + Shadcn UI كاملة مع Socket.IO للتحديثات الفورية.

#### ما يُبنى

```
artifacts/whatsapp-dashboard/
├── package.json (@workspace/whatsapp-dashboard)
├── vite.config.ts   (port 5000, proxy /api → :8080)
├── index.html       (Cairo font, RTL default)
└── src/
    ├── main.tsx
    ├── App.tsx          ← wouter Router + Auth guard
    ├── stores/
    │   ├── auth.ts      ← Zustand: user + token + logout
    │   └── lang.ts      ← Zustand: language + direction
    ├── lib/
    │   ├── api.ts       ← fetch wrapper مع credentials:include
    │   └── socket.ts    ← Socket.IO client (singleton)
    ├── components/
    │   ├── ui/          ← Shadcn components (Button, Card, Table, Dialog, ...)
    │   ├── Layout.tsx   ← Sidebar + Header + main
    │   ├── QRDisplay.tsx ← يستقبل qr:update عبر Socket.IO + يعرض QR
    │   └── PermissionsMatrix.tsx ← جدول 11 صلاحية لكل موظف
    └── pages/
        ├── LoginPage.tsx
        ├── DashboardPage.tsx    ← Recharts LineChart 7 أيام
        ├── SessionsPage.tsx     ← قائمة + حالة + أزرار connect/disconnect/delete
        ├── SessionDetailPage.tsx ← 5 تبويبات
        ├── UsersPage.tsx        ← Admin: CRUD + PermissionsMatrix
        ├── ApiKeysPage.tsx      ← عرض + إنشاء + حذف
        └── SendPage.tsx         ← tabs: نص | صورة | فيديو | صوت | ملف | موقع | ملصق
```

#### مواصفات تفصيلية للصفحات الحرجة

```typescript
// DashboardPage.tsx
// - TanStack Query: useQuery(['dashboard-stats'], fetchStats, { refetchInterval: 30000 })
// - Recharts LineChart: محور X = التاريخ (7 أيام) + محور Y = عدد الرسائل
// - بطاقات: totalSessions | connectedSessions | totalSent | totalReceived
// - ألوان: sent=blue, received=green

// SessionDetailPage.tsx — 5 تبويبات
// Tab 1: QR Code
//   - زر "اتصال" → POST /api/sessions/:id/connect
//   - Socket.IO listener: 'qr:update' → تحديث QR image
//   - QR library: react-qr-code أو qrcode.react
//   - حالة: connecting | connected | disconnected (مع لون)
// Tab 2: الإحصائيات → GET /api/sessions/:id/stats
// Tab 3: الرسائل → GET /api/sessions/:id/messages (pagination)
// Tab 4: الويب هوك
//   - حقول: webhookUrl + webhookSecret + webhookEvents (checkboxes)
//   - PATCH /api/sessions/:id/webhook
// Tab 5: الميزات
//   - toggles لكل feature flag
//   - PATCH /api/sessions/:id/features

// SendPage.tsx
//   - state: type = 'text'|'image'|'video'|'audio'|'file'|'location'|'sticker'
//   - select session من القائمة المتاحة
//   - لكل نوع: حقول مناسبة + file upload → FileReader → base64 data URI
//   - POST /api/send/{type}

// PermissionsMatrix.tsx
//   جدول: الصفوف = الصلاحيات 11 | الأعمدة = المستخدمون
//   Checkbox لكل خلية → PATCH /api/users/:id { permissions }
```

#### اختبارات المرحلة 8

```
✅ http://localhost:5000 → توجيه لـ /login
✅ تسجيل دخول (admin/123456) → توجيه لـ /change-password (mustChangePassword)
✅ تغيير كلمة المرور → توجيه للـ Dashboard
✅ Dashboard: يعرض البطاقات والرسم البياني
✅ Sessions: قائمة الجلسات مع حالتها
✅ Sessions > connect → QR Code يظهر خلال 5 ثوانٍ
✅ Sessions > QR تغيّر → QR على الشاشة يتحدث تلقائياً (Socket.IO)
✅ Sessions > اتصال ناجح → حالة تتحول لـ 'connected' مع لون أخضر
✅ Send > نصي → رسالة تُرسل + تظهر في Messages tab
✅ Send > صورة (file upload) → ترسل base64
✅ Users (admin) → يعرض PermissionsMatrix
✅ Users: تعديل صلاحية → تحفظ فوراً
✅ API Keys: إنشاء → يعرض المفتاح الكامل مرة واحدة مع زر نسخ
✅ تبديل اللغة AR ↔ EN → الواجهة تتحوّل بالكامل
✅ تبديل وضع Light/Dark → يحفظ في localStorage
```

---

### المرحلة 9: المنصة التعليمية (Frontend)

**الهدف:** موقع تعليمي عربي/إنجليزي كامل مع دردشة ذكاء اصطناعي ومكتبة محتوى.

#### ما يُبنى

```
artifacts/claude-education/
├── package.json (@workspace/claude-education)
├── vite.config.ts   (port 5001, proxy /api → :8080)
├── index.html       (Cairo + Inter fonts)
└── src/
    ├── i18n/
    │   ├── ar.json
    │   └── en.json
    ├── stores/
    │   ├── auth.ts
    │   └── theme.ts     ← dark/light + direction
    ├── pages/
    │   ├── HomePage.tsx
    │   ├── LoginPage.tsx
    │   ├── RegisterPage.tsx
    │   ├── ChatPage.tsx       ← المحادثات + الرسائل + المصادر
    │   ├── LearnPage.tsx      ← الأقسام + شريط التقدم
    │   ├── SectionPage.tsx    ← المقاطع + وضع علامة "قرأت"
    │   ├── ProfilePage.tsx    ← الإحصائيات + تغيير كلمة المرور
    │   ├── ResourcesPage.tsx  ← مكتبة المصادر + فلترة + ترجمة
    │   └── admin/
    │       ├── AdminPage.tsx         ← Dashboard المدير
    │       ├── AdminUsersPage.tsx
    │       ├── AdminContentPage.tsx
    │       ├── AdminSettingsPage.tsx ← + قسم تيليغرام + n8n
    │       └── AdminResourcesPage.tsx
    └── components/
        ├── ChatBubble.tsx    ← رسائل المستخدم والمساعد
        ├── SourceCard.tsx    ← بطاقة المصدر المُستشهَد به
        ├── ProgressBar.tsx   ← شريط التقدم
        ├── ResourceCard.tsx  ← بطاقة المصدر + ترجمة + رابط
        └── ThemeToggle.tsx   ← Light/Dark toggle
```

#### مواصفات الصفحات الحرجة

```typescript
// ChatPage.tsx
// - القائمة الجانبية: محادثات المستخدم + زر "محادثة جديدة"
// - منطقة الدردشة:
//   الرسائل: ChatBubble (user=أزرق, assistant=بنفسجي)
//   أسفل كل رد: SourceCard[] للمصادر المُستشهَد بها
//   حقل الإدخال + زر إرسال
//   Loading state: نبضات تحريكية "يكتب..."
// - TanStack Query + Optimistic Update

// LearnPage.tsx
// - شريط تقدم عام (progressPercent من /api/profile/stats)
// - بطاقات الأقسام مع نسبة التقدم لكل قسم
// - للجوال: layout عمودي تلقائي

// AdminSettingsPage.tsx — قسم بوت التيليغرام
// - toggle لتفعيل/إيقاف البوت
// - حقل Bot Token (مخفي + زر إظهار)
// - زر "حفظ وتفعيل Webhook" → POST /api/webhook/telegram/setup
// - رسالة ترحيب AR/EN
// - الحد اليومي
// - إحصائيات اليوم (badge)
// - زر "عرض مستخدمي التيليغرام" → /admin/telegram/users

// AdminSettingsPage.tsx — قسم n8n
// - زر "تحميل n8n Workflow" → GET /api/n8n-workflow/download
```

#### اختبارات المرحلة 9

```
✅ الصفحة الرئيسية تظهر بالعربية مع Dark Mode افتراضي
✅ تسجيل الدخول + التوجيه للدردشة
✅ إنشاء محادثة جديدة
✅ إرسال سؤال → رد Claude مع مصادر
✅ المصادر تظهر تحت كل رد
✅ صفحة التعلم: الأقسام مع شريط التقدم
✅ قراءة مقطع → التقدم يزيد
✅ البحث في المحتوى يعمل
✅ صفحة المصادر: قائمة + فلترة بالنوع
✅ زر ترجمة على كل مصدر يعمل (مع cache)
✅ اقتراح مصدر جديد → يُحفظ في suggestions
✅ لوحة المدير: استيراد المحتوى من GitHub
✅ إعدادات تيليغرام: حفظ Token + تفعيل Webhook
✅ تحميل n8n Workflow → ملف JSON
✅ تبديل اللغة: الموقع يتحول RTL → LTR
✅ تبديل وضع الظلام/الفاتح
✅ الاستجابة على الجوال (responsive)
```

---

### المرحلة 10: Docker + نشر الإنتاج

**الهدف:** بيئة إنتاج مكتملة قابلة للنشر على Windows وReplit والسحابة.

#### ما يُبنى

```
workspace/
├── Dockerfile.api
├── Dockerfile.dashboard
├── Dockerfile.education
├── docker-compose.yml         ← إنتاج (port 5005)
├── docker-compose.dev.yml     ← تطوير
├── nginx.conf
├── .env.example
└── scripts/windows/
    ├── start_wa.bat    ← تثبيت أول مرة
    ├── start_dev.bat   ← تثبيت للتطوير
    ├── update_wa.bat   ← git pull + rebuild
    ├── run_wa.bat      ← تشغيل يومي (إنتاج)
    ├── run_dev.bat     ← تشغيل يومي (تطوير)
    ├── cleanup_wa.bat  ← إزالة كاملة
    └── reset_wa.bat    ← إعادة ضبط البيانات
```

#### مواصفات تفصيلية

```dockerfile
# Dockerfile.api
FROM node:20-slim
RUN apt-get install -y chromium  # أو يُنزَّل تلقائياً عبر Puppeteer
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @workspace/api-server build
EXPOSE 8080
CMD ["node", "artifacts/api-server/dist/index.js"]

# nginx.conf
server {
  listen 5005;
  location /api { proxy_pass http://api:8080; }
  location /socket.io { proxy_pass http://api:8080; }  # WebSocket
  location / { root /usr/share/nginx/html; try_files $uri /index.html; }
}
```

```batch
:: run_wa.bat — تشغيل يومي
@echo off
cd /d "%~dp0"
docker-compose -f docker-compose.yml up -d
echo.
echo ✅ النظام يعمل على: http://localhost:5005
echo    Dashboard: http://localhost:5005
echo    API:       http://localhost:5005/api/healthz
```

```batch
:: reset_wa.bat — إعادة ضبط
@echo off
docker-compose down
docker volume rm workspace_postgres_data
docker-compose up -d
echo ✅ تمت إعادة الضبط — تسجيل الدخول: admin / 123456
```

#### اختبارات المرحلة 10

```
✅ docker-compose up -d → جميع الحاويات تعمل
✅ http://localhost:5005 → لوحة الواتساب
✅ http://localhost:5005/api/healthz → { status: "ok" }
✅ http://localhost:5005/education → المنصة التعليمية
✅ WebSocket يعمل خلف Nginx (X-Forwarded-For)
✅ .env.example يحتوي كل المتغيرات مع شرح
✅ start_wa.bat يعمل على Windows من الصفر
✅ reset_wa.bat يُعيد admin/123456
✅ update_wa.bat: git pull + rebuild بدون downtime طويل
✅ Replit: pnpm install + db push + seed + تشغيل workflow
✅ متغيرات البيئة: DATABASE_URL + JWT_SECRET + ANTHROPIC_API_KEY مطلوبة ✅
✅ الإنتاج: secure cookie = true ✅
✅ الإنتاج: NODE_ENV=production + helmet كامل ✅
```

---

### ملخص معايير الإنجاز الكامل

```
المرحلة 1:  15 جدولاً + seed data                    ✅ اجتياز جميع الاختبارات
المرحلة 2:  Auth + Users + API Keys                  ✅ اجتياز جميع الاختبارات
المرحلة 3:  WhatsApp Sessions + WebSocket + Webhook   ✅ اجتياز جميع الاختبارات
المرحلة 4:  7 أنواع إرسال + Phone/GPS validation     ✅ اجتياز جميع الاختبارات
المرحلة 5:  Dashboard + Audit + n8n                  ✅ اجتياز جميع الاختبارات
المرحلة 6:  RAG + Claude + Import + Resources         ✅ اجتياز جميع الاختبارات
المرحلة 7:  Telegram Bot + Admin Controls             ✅ اجتياز جميع الاختبارات
المرحلة 8:  WhatsApp Dashboard (React 19 + Shadcn)    ✅ اجتياز جميع الاختبارات
المرحلة 9:  Educational Platform (React + i18n)       ✅ اجتياز جميع الاختبارات
المرحلة 10: Docker + Windows + Replit Production      ✅ اجتياز جميع الاختبارات
══════════════════════════════════════════════════════
النظام جاهز للإنتاج الكامل ✅
```

---

## ثامن عشر: خلاصة الإضافات عن الإصدار السابق (v4.0 → v5.0)

| المحور | الإضافة |
|--------|---------|
| **اللغة** | TypeScript بالكامل بدلاً من JavaScript |
| **الواتساب** | Multi-Session Management حقيقي + wppconnect (من الكود الفعلي) |
| **الأدوار** | Employee بدلاً من User + 11 صلاحية حبيبية + maxSessions |
| **قاعدة البيانات** | Drizzle ORM + 5 جداول جديدة (sessions, messages, api_keys, telegram_users, telegram_conversations) |
| **WebSocket** | Socket.IO 4 للـ QR Code والإشعارات الفورية |
| **مفاتيح API** | جدول api_keys + bcrypt + keyPrefix + session restrictions |
| **أمان** | SSRF protection + mustChangePassword + Phone/GPS validation |
| **تيليغرام** | grammY webhook + نفس منطق الدردشة + admin controls |
| **n8n** | تكامل كامل + download endpoint يُضمّن credentials تلقائياً |
| **Docker** | docker-compose للإنتاج + Nginx reverse proxy |
| **Windows** | 7 Batch scripts للنشر على Windows |
| **الإرسال** | text + image + video + audio + file + location + sticker |
| **الصفحات الجديدة** | /sessions/:id (5 تبويبات) + /api-keys + /send + /admin/telegram |
```
