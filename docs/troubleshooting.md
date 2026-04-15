# استكشاف الأخطاء وإصلاحها

## مشاكل الإعداد

### `Error: Cannot find module './dist/index.mjs'`

**السبب:** لم يتم بناء الخادم بعد.

```bash
pnpm --filter @workspace/api-server run build
```

---

### `type "vector" does not exist`

**السبب:** إضافة pgvector غير مفعّلة في قاعدة البيانات.

```bash
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
pnpm --filter @workspace/db run push
```

---

### `Cannot find package 'pg'` أو `drizzle-orm`

**السبب:** حزمة مفقودة من dependencies.

```bash
pnpm install
```

---

### صفحة التعلم لا تُظهر البيانات

**السبب 1:** الـ API proxy مفقود من إعداد Vite.

تحقق من وجود هذا في `vite.config.ts`:
```typescript
server: {
  proxy: {
    "/api": { target: "http://localhost:8080" }
  }
}
```

**السبب 2:** المحتوى لم يُستورد بعد.

```bash
pnpm --filter @workspace/scripts run import-content
```

**السبب 3:** المستخدم غير مسجّل الدخول (صفحة التعلم تتطلب مصادقة).

---

### خطأ 401 في كل طلب

**السبب:** انتهت صلاحية الجلسة أو لم تسجل الدخول.

- سجّل الخروج وأعد تسجيل الدخول
- تأكد أن `credentials: "include"` موجود في طلبات fetch

---

## مشاكل واتساب

### جلسة واتساب لا تتصل

**السبب 1:** Chromium غير مثبت.

```bash
# التحقق
chromium-browser --version
# أو
google-chrome --version
```

**السبب 2:** في Replit، wppconnect محدود بسبب بيئة الـ sandbox.

> ⚠️ wppconnect يعمل بشكل كامل فقط على VPS أو Docker مع Chromium مثبت.

---

### QR Code لا يظهر

1. تأكد أن الخادم يعمل على المنفذ 8080
2. تأكد من اتصال WebSocket في لوحة التحكم:
   ```javascript
   // في المتصفح
   const socket = io("http://localhost:8080");
   socket.on("connect", () => console.log("متصل!"));
   ```
3. تحقق من سجلات الخادم لأي أخطاء wppconnect

---

## مشاكل الدردشة الذكية

### `ANTHROPIC_API_KEY is not set`

```bash
# إضافة في .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

أو عبر Replit Secrets.

---

### الدردشة لا تُرجع نتائج ذات صلة

**السبب:** embeddings غير مولّدة للمحتوى.

الحل: استيراد المحتوى مجدداً مع مفتاح Anthropic:
```bash
pnpm --filter @workspace/scripts run import-content
```

> ملاحظة: توليد embeddings يستهلك وقتاً وبعض الرصيد من API.

---

## مشاكل قاعدة البيانات

### `relation "table_name" does not exist`

```bash
pnpm --filter @workspace/db run push
```

---

### مشكلة الاتصال بقاعدة البيانات

```bash
# اختبار الاتصال
psql $DATABASE_URL -c "SELECT 1;"

# التحقق من المتغير
echo $DATABASE_URL
```

---

## أدوات التشخيص

```bash
# حالة جميع الجداول
psql $DATABASE_URL -c "\dt"

# عدد السجلات في كل جدول مهم
psql $DATABASE_URL -c "
  SELECT 
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM content_chunks) as content_chunks,
    (SELECT COUNT(*) FROM whatsapp_sessions) as sessions,
    (SELECT COUNT(*) FROM resources) as resources;
"

# سجلات الخادم
# في Replit: لوحة Workflow console
# في VPS: journalctl -u your-service -f

# اختبار الـ API
curl http://localhost:8080/api/health
```

---

## إعادة البناء من الصفر

```bash
# تنظيف
rm -rf artifacts/api-server/dist
rm -rf node_modules
pnpm store prune

# إعادة التثبيت والبناء
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed
pnpm --filter @workspace/api-server run build
```
