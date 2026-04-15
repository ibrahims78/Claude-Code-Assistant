# قاعدة البيانات

**PostgreSQL 16** مع إضافة **pgvector** للبحث الدلالي.

---

## مخطط العلاقات

```mermaid
erDiagram
    users {
        int id PK
        text username
        text email
        text passwordHash
        text role
        text permissions
        int maxSessions
        bool isActive
        bool mustChangePassword
        timestamp createdAt
    }

    whatsapp_sessions {
        text id PK
        int userId FK
        text name
        text status
        text phoneNumber
        text webhookUrl
        jsonb features
        timestamp lastConnectedAt
    }

    messages {
        int id PK
        text sessionId FK
        text from
        text to
        text body
        text type
        text mediaUrl
        bool fromMe
        timestamp timestamp
    }

    api_keys {
        int id PK
        int userId FK
        text name
        text keyHash
        text keyPrefix
        jsonb allowedSessionIds
        bool isActive
        timestamp lastUsedAt
    }

    audit_logs {
        int id PK
        int userId FK
        text username
        text action
        text sessionId
        jsonb details
        text ipAddress
        timestamp createdAt
    }

    conversations {
        int id PK
        int userId FK
        text sessionTitle
        timestamp createdAt
        timestamp updatedAt
    }

    chat_messages {
        int id PK
        int conversationId FK
        text role
        text content
        jsonb sources
        int tokensUsed
        timestamp createdAt
    }

    content_chunks {
        int id PK
        text title
        text titleAr
        text content
        text contentAr
        text category
        text section
        text sourceFile
        int orderIndex
        vector embedding
        timestamp createdAt
    }

    user_progress {
        int id PK
        int userId FK
        int chunkId FK
        text section
        timestamp readAt
    }

    resources {
        int id PK
        text titleEn
        text titleAr
        text url
        text type
        text sourceName
        text language
        bool isVisible
        bool isFeatured
        bool isApproved
        int addedBy FK
        int displayOrder
        vector embedding
    }

    settings {
        int id PK
        text key
        text value
        text description
        timestamp updatedAt
    }

    telegram_users {
        int id PK
        bigint telegramId
        text username
        text firstName
        text language
        bool isBlocked
        int dailyCount
        date lastReset
    }

    users ||--o{ whatsapp_sessions : "يملك"
    users ||--o{ api_keys : "يملك"
    users ||--o{ audit_logs : "يُسجَّل"
    users ||--o{ conversations : "يملك"
    users ||--o{ user_progress : "يتابع"
    whatsapp_sessions ||--o{ messages : "تحتوي"
    conversations ||--o{ chat_messages : "تحتوي"
    content_chunks ||--o{ user_progress : "مُتابَع"
```

---

## وصف الجداول

### `users` — المستخدمون
| العمود | النوع | الوصف |
|-------|-------|-------|
| `role` | text | `admin` أو `employee` |
| `permissions` | jsonb | صلاحيات تفصيلية للموظفين |
| `maxSessions` | int | الحد الأقصى لجلسات واتساب |
| `mustChangePassword` | bool | إجبار تغيير كلمة المرور |

### `content_chunks` — محتوى التعلم
| العمود | النوع | الوصف |
|-------|-------|-------|
| `section` | text | القسم: `slash-commands`, `memory`, `mcp`, إلخ |
| `category` | text | `beginner`, `intermediate`, `advanced`, `general` |
| `embedding` | vector(1536) | تمثيل دلالي للبحث بالتشابه |
| `sourceFile` | text | المصدر من GitHub |

### `whatsapp_sessions` — جلسات واتساب
| العمود | النوع | الوصف |
|-------|-------|-------|
| `status` | text | `connected`, `disconnected`, `qr_ready`, `connecting` |
| `features` | jsonb | ميزات مفعّلة: `autoReply`, `webhookEnabled` |
| `webhookUrl` | text | رابط استقبال الرسائل الواردة |

---

## أوامر إدارة قاعدة البيانات

```bash
# رفع المخطط (تطبيق التغييرات)
pnpm --filter @workspace/db run push

# توليد migrations
pnpm --filter @workspace/db run generate

# زرع البيانات الأولية
pnpm --filter @workspace/scripts run seed

# استيراد المحتوى من GitHub
pnpm --filter @workspace/scripts run import-content

# الاتصال المباشر بقاعدة البيانات
psql $DATABASE_URL

# تفعيل pgvector (مرة واحدة)
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

## إعدادات النظام (جدول settings)

| المفتاح | القيمة الافتراضية | الوصف |
|--------|-----------------|-------|
| `app_name` | `Claude Code Assistant` | اسم التطبيق |
| `ai_model` | `claude-3-5-sonnet-20241022` | نموذج Claude |
| `max_messages_per_day` | `50` | الحد اليومي للرسائل |
| `telegram_enabled` | `false` | تفعيل بوت تيليغرام |
| `telegram_token` | null | رمز بوت تيليغرام |
| `import_last_run` | null | آخر استيراد للمحتوى |
