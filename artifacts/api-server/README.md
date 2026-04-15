# API Server

خادم Express.js المشترك لجميع الواجهات، يعمل على المنفذ **8080**.

## التقنيات

- **Express.js 5** — إطار العمل
- **Socket.IO** — اتصالات فورية (QR Code)
- **Drizzle ORM** — قاعدة البيانات
- **Pino** — التسجيل
- **JWT + bcrypt** — المصادقة

## تشغيل بيئة التطوير

```bash
pnpm --filter @workspace/api-server run dev
```

## البناء للإنتاج

```bash
pnpm --filter @workspace/api-server run build
PORT=8080 pnpm --filter @workspace/api-server run start
```

## هيكل الكود

```
src/
├── index.ts          # نقطة الدخول
├── app.ts            # Express setup
├── routes/           # 13 ملف route
└── lib/              # Auth, AI, RAG, Audit...
```

## Routes

| المسار | الملف |
|-------|------|
| `/api/auth` | `auth.ts` |
| `/api/users` | `users.ts` |
| `/api/sessions` | `sessions.ts` |
| `/api/send` | `send.ts` |
| `/api/chat` | `chat.ts` |
| `/api/content` | `content.ts` |
| `/api/resources` | `resources.ts` |
| `/api/admin` | `admin.ts` |
| `/api/webhook` | `telegram.ts` |

→ [مرجع API الكامل](../../docs/api-reference.md)
