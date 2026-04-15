# معمارية النظام

## نوع المشروع

**تطبيق ويب متعدد الخدمات (Monorepo)** يتكون من:
- خادم API مشترك (Express.js)
- واجهتان أماميتان مستقلتان (React + Vite)
- قاعدة بيانات PostgreSQL مع pgvector للبحث الدلالي

---

## مخطط المعمارية العامة

```mermaid
graph TB
    subgraph Client["المتصفح"]
        ED[Claude Education<br/>:25013/education]
        WD[WhatsApp Dashboard<br/>:23097/whatsapp]
    end

    subgraph API["API Server :8080"]
        EX[Express.js]
        AUTH[Auth Middleware<br/>JWT + Cookie]
        ROUTES[Routes Layer]
        CLAUDE[Claude AI Client]
        RAG[RAG Pipeline]
        WPP[WPPConnect<br/>WhatsApp]
        GRAM[grammY<br/>Telegram]
    end

    subgraph Data["البيانات"]
        PG[(PostgreSQL 16<br/>+ pgvector)]
        CACHE[Settings Cache]
    end

    subgraph External["خارجي"]
        ANTHR[Anthropic API]
        GH[GitHub<br/>المحتوى]
        TG[Telegram API]
        WA[WhatsApp Web]
    end

    ED -->|HTTP /api| EX
    WD -->|HTTP /api + WS| EX
    EX --> AUTH --> ROUTES
    ROUTES --> PG
    ROUTES --> CLAUDE --> ANTHR
    ROUTES --> RAG --> PG
    ROUTES --> WPP --> WA
    ROUTES --> GRAM --> TG
    GH -->|import-content| PG
```

---

## مخطط تدفق المصادقة

```mermaid
sequenceDiagram
    participant B as المتصفح
    participant A as API Server
    participant DB as PostgreSQL

    B->>A: POST /api/auth/login {username, password}
    A->>DB: SELECT user WHERE username=?
    DB-->>A: user record
    A->>A: bcrypt.compare(password, hash)
    A->>A: jwt.sign({userId, role})
    A-->>B: Set-Cookie: session_token (httpOnly)
    B->>A: GET /api/content/sections (+ cookie)
    A->>A: jwt.verify(token)
    A->>DB: SELECT sections
    DB-->>A: data
    A-->>B: 200 JSON
```

---

## مخطط RAG Pipeline (الدردشة الذكية)

```mermaid
flowchart TD
    A[رسالة المستخدم] --> B[توليد Embedding\nعبر Anthropic API]
    B --> C[البحث بالتشابه\ncosine similarity في pgvector]
    C --> D[أفضل K نتائج\nمن content_chunks]
    D --> E[بناء System Prompt\nمع السياق]
    E --> F[إرسال إلى Claude API]
    F --> G[استجابة مبثوثة\nStreaming Response]
    G --> H[حفظ في chat_messages]
    G --> I[إرسال للمستخدم]
```

---

## هيكل pnpm Monorepo

```mermaid
graph TD
    ROOT[workspace root]
    ROOT --> A[artifacts/api-server]
    ROOT --> B[artifacts/claude-education]
    ROOT --> C[artifacts/whatsapp-dashboard]
    ROOT --> D[lib/db]
    ROOT --> E[lib/api-spec]
    ROOT --> F[lib/api-zod]
    ROOT --> G[lib/api-client-react]
    ROOT --> H[scripts]

    A --> D
    A --> F
    B --> G
    C --> G
    G --> F
    F --> E
```

---

## اتخاذ القرارات التقنية

| القرار | السبب |
|-------|-------|
| pnpm workspaces | مشاركة الكود بين الحزم بدون تكرار |
| Drizzle ORM | Type-safe queries مع TypeScript |
| pgvector | بحث دلالي مدمج في قاعدة البيانات |
| esbuild | بناء سريع للخادم مع دعم ESM |
| JWT في httpOnly cookie | أمان أعلى من localStorage |
| Wouter بدلاً من React Router | حجم أصغر وبساطة أكثر |

---

## المستخدمون المستهدفون

| الشخصية | الوصف | النقاط الرئيسية |
|---------|-------|-----------------|
| **مطور عربي** | يريد تعلم Claude Code باللغة العربية | واجهة RTL، محتوى ثنائي اللغة، دردشة ذكية |
| **مدير العمليات** | يدير جلسات واتساب لفريق | لوحة تحكم، أدوار وصلاحيات، سجل تدقيق |
| **موظف المبيعات** | يرسل رسائل واتساب | واجهة مبسطة حسب الصلاحيات |
| **مستخدم تيليغرام** | يطرح أسئلة عبر بوت تيليغرام | بوت ذكي مع RAG |
