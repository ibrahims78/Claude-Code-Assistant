# Claude Code تعلّم

منصة تعليمية لمطوري العرب لتعلم Claude Code، مع محادثة ذكية RAG.

**المسار:** `/education/` | **المنفذ:** 25013

## الصفحات

| الصفحة | الرابط | الوصف |
|-------|--------|-------|
| الرئيسية | `/` | لوحة التحكم الشخصية |
| الدردشة | `/chat` | محادثة RAG مع Claude |
| التعلم | `/learn` | قائمة الأقسام والتقدم |
| قسم محدد | `/learn/:id` | قراءة محتوى القسم |
| الموارد | `/resources` | مراجع ومقالات |
| الملف الشخصي | `/profile` | تعديل البيانات |
| الإدارة | `/admin` | لوحة المدير |

## تشغيل بيئة التطوير

```bash
PORT=25013 BASE_PATH=/education/ pnpm --filter @workspace/claude-education run dev
```

## المتطلبات

- API Server يعمل على المنفذ 8080
- `vite.config.ts` يحتوي على proxy لـ `/api`

## التقنيات

- React 19 + Vite 7
- Tailwind CSS v4 + Shadcn UI
- TanStack React Query
- Wouter (routing)
- دعم كامل للعربية RTL (خط Cairo)
