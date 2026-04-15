# مرجع الـ API

**Base URL:** `http://localhost:8080/api`  
**المصادقة:** JWT في httpOnly Cookie (`session_token`)

---

## المصادقة

### تسجيل الدخول
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "123456"
}
```
**الاستجابة:**
```json
{
  "token": "eyJ...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "mustChangePassword": true
  }
}
```

### تسجيل الخروج
```http
POST /api/auth/logout
```

### بيانات المستخدم الحالي
```http
GET /api/auth/me
```

---

## المستخدمون

```http
GET    /api/users/me                    # بيانات المستخدم الحالي
PATCH  /api/users/me/password           # تغيير كلمة المرور
GET    /api/users                       # قائمة المستخدمين (admin)
POST   /api/users                       # إنشاء مستخدم (admin)
PATCH  /api/users/:id                   # تعديل مستخدم (admin)
DELETE /api/users/:id                   # حذف مستخدم (admin)
PATCH  /api/users/:id/toggle-active     # تفعيل/تعطيل (admin)
```

---

## جلسات واتساب

```http
GET    /api/sessions                    # قائمة الجلسات
POST   /api/sessions                    # إنشاء جلسة
GET    /api/sessions/:id                # تفاصيل جلسة
PATCH  /api/sessions/:id                # تعديل جلسة
DELETE /api/sessions/:id                # حذف جلسة

POST   /api/sessions/:id/connect        # بدء الاتصال (QR)
POST   /api/sessions/:id/disconnect     # قطع الاتصال
POST   /api/sessions/:id/restart        # إعادة التشغيل

GET    /api/sessions/:id/messages       # الرسائل
PATCH  /api/sessions/:id/webhook        # إعداد webhook
PATCH  /api/sessions/:id/features       # تفعيل/تعطيل ميزات
```

### إرسال الرسائل (لجلسة محددة)
```http
POST /api/sessions/:id/send/text
POST /api/sessions/:id/send/image
POST /api/sessions/:id/send/video
POST /api/sessions/:id/send/audio
POST /api/sessions/:id/send/file
POST /api/sessions/:id/send/location
POST /api/sessions/:id/send/sticker
```

**مثال إرسال نص:**
```json
{
  "to": "966501234567@c.us",
  "text": "مرحباً!"
}
```

---

## إرسال عام (API Key)

```http
POST /api/send/text
POST /api/send/image
POST /api/send/video
POST /api/send/audio
POST /api/send/file
POST /api/send/location
POST /api/send/sticker
```

**Headers:**
```http
X-API-Key: your-api-key
Content-Type: application/json
```

**مثال:**
```json
{
  "sessionId": "session_001",
  "to": "966501234567@c.us",
  "text": "رسالة آلية"
}
```

---

## الدردشة الذكية (RAG)

```http
GET    /api/chat/conversations               # قائمة المحادثات
POST   /api/chat/conversations               # محادثة جديدة
GET    /api/chat/conversations/:id           # تفاصيل + رسائل
POST   /api/chat/conversations/:id/messages  # إرسال رسالة
DELETE /api/chat/conversations/:id           # حذف محادثة
```

**إرسال رسالة:**
```http
POST /api/chat/conversations/1/messages
Content-Type: application/json

{
  "content": "ما هي أوامر الشريطة المائلة في Claude Code؟"
}
```

**الاستجابة:**
```json
{
  "id": 42,
  "role": "assistant",
  "content": "أوامر الشريطة المائلة تشمل...",
  "sources": [
    { "title": "Slash Commands", "section": "slash-commands", "chunkId": 5 }
  ],
  "tokensUsed": 1240
}
```

---

## محتوى التعلم

```http
GET /api/content/sections              # قائمة الأقسام مع نسبة التقدم
GET /api/content/sections/:sectionId   # قطع قسم محدد
GET /api/content/search?q=             # بحث نصي
POST /api/content/progress/:chunkId    # تسجيل قراءة قطعة
GET /api/content/progress              # تقدم المستخدم الحالي
```

**مثال استجابة sections:**
```json
[
  {
    "section": "slash-commands",
    "totalChunks": 33,
    "readChunks": 5,
    "progressPercent": 15
  }
]
```

---

## الموارد التعليمية

```http
GET  /api/resources                    # قائمة الموارد المنشورة
GET  /api/resources/:id                # تفاصيل مورد
POST /api/resources/:id/translate      # طلب ترجمة
GET  /api/resources/:id/ask-context    # سياق للدردشة
POST /api/resources/suggest            # اقتراح مورد جديد
```

---

## الإدارة (admin فقط)

```http
GET  /api/admin/dashboard              # إحصائيات عامة
GET  /api/admin/settings               # جلب الإعدادات
PUT  /api/admin/settings               # تحديث الإعدادات
POST /api/admin/settings/test-ai       # اختبار مفتاح AI

POST /api/admin/import                 # استيراد المحتوى من GitHub

GET    /api/admin/resources            # جميع الموارد
POST   /api/admin/resources            # إضافة مورد
PUT    /api/admin/resources/:id        # تعديل مورد
DELETE /api/admin/resources/:id        # حذف مورد

GET /api/admin/telegram/users          # مستخدمو تيليغرام
GET /api/admin/telegram/stats          # إحصائيات تيليغرام
GET /api/admin/audit-logs              # سجل التدقيق

GET    /api/admin/content              # جميع قطع المحتوى
PUT    /api/admin/content/:id          # تعديل قطعة
DELETE /api/admin/content/:id          # حذف قطعة
```

---

## WebSocket (Socket.IO)

يستخدم لتوصيل QR Code لجلسات واتساب.

```javascript
import { io } from "socket.io-client";
const socket = io("http://localhost:8080");

// الاشتراك في QR code لجلسة
socket.emit("subscribe:qr", { sessionId: "session_001" });

// استقبال QR
socket.on("qr", ({ sessionId, qr }) => {
  // عرض QR للمستخدم
});

// حالة الاتصال
socket.on("session:status", ({ sessionId, status }) => {
  // connected | disconnected | qr_ready
});
```

---

## أكواد الأخطاء

| الكود | المعنى |
|------|-------|
| 400 | طلب خاطئ (بيانات ناقصة) |
| 401 | غير مصادق (تسجيل الدخول مطلوب) |
| 403 | ممنوع (صلاحيات غير كافية) |
| 404 | غير موجود |
| 429 | تجاوز حد الطلبات |
| 500 | خطأ داخلي |
