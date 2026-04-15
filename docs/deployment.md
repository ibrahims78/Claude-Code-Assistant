# دليل النشر

## النشر على Replit (الحالي)

المشروع مُعَدّ للعمل على Replit مع Autoscale deployment.

### متغيرات البيئة المطلوبة

```bash
DATABASE_URL=postgresql://...      # تلقائي من Replit DB
JWT_SECRET=...                     # في .replit [userenv.shared]
ANTHROPIC_API_KEY=sk-ant-...       # في Replit Secrets
GITHUB_TOKEN=ghp_...               # اختياري، في Replit Secrets
```

### خطوات النشر

```bash
# بناء الخادم
pnpm --filter @workspace/api-server run build

# ثم اضغط "Deploy" في Replit
```

### إعداد ما بعد النشر (postMerge)

```bash
# scripts/post-merge.sh
pnpm install --frozen-lockfile
pnpm --filter db push
```

---

## النشر على Docker/VPS

### Dockerfile

```dockerfile
FROM node:24-slim

# تثبيت متطلبات wppconnect و sharp
RUN apt-get update && apt-get install -y \
    chromium \
    libglib2.0-0 \
    libnss3 \
    libgconf-2-4 \
    libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
```

### docker-compose.yml

```yaml
version: "3.8"

services:
  postgres:
    image: ankane/pgvector:latest
    environment:
      POSTGRES_DB: claudeapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secret
    volumes:
      - pg_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build: .
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgresql://postgres:secret@postgres:5432/claudeapp
      JWT_SECRET: change-this-in-production
      ANTHROPIC_API_KEY: sk-ant-...
      NODE_ENV: production
    depends_on:
      - postgres

  education:
    build:
      context: .
      dockerfile: artifacts/claude-education/Dockerfile
    ports:
      - "25013:25013"
    environment:
      PORT: 25013
      BASE_PATH: /education/

  whatsapp:
    build:
      context: .
      dockerfile: artifacts/whatsapp-dashboard/Dockerfile
    ports:
      - "23097:23097"
    environment:
      PORT: 23097
      BASE_PATH: /whatsapp/

volumes:
  pg_data:
```

---

## إعداد الإنتاج

### متطلبات wppconnect

يحتاج wppconnect إلى Chromium:

```bash
# Ubuntu/Debian
apt-get install -y \
  chromium-browser \
  libglib2.0-0 \
  libnss3 \
  libgconf-2-4 \
  libfontconfig1 \
  libxss1
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /education/ {
        proxy_pass http://localhost:25013;
    }

    location /whatsapp/ {
        proxy_pass http://localhost:23097;
    }
}
```

---

## قائمة تدقيق الإنتاج

- [ ] تغيير `JWT_SECRET` إلى قيمة قوية عشوائية
- [ ] تغيير كلمة مرور `admin` الافتراضية
- [ ] ضبط `NODE_ENV=production`
- [ ] تفعيل HTTPS (TLS)
- [ ] إعداد نسخ احتياطية لقاعدة البيانات
- [ ] استيراد المحتوى من GitHub: `pnpm --filter @workspace/scripts run import-content`
- [ ] إعداد مفتاح Anthropic API
- [ ] اختبار Chromium لجلسات واتساب

---

## المراقبة

الخادم يستخدم **Pino** للتسجيل:

```bash
# عرض السجلات بشكل منسق
node ./dist/index.mjs | pnpm exec pino-pretty

# في الإنتاج (JSON مضغوط)
NODE_ENV=production node ./dist/index.mjs
```

نقطة فحص الصحة:
```http
GET /api/health
# → { "status": "ok", "timestamp": "..." }
```
