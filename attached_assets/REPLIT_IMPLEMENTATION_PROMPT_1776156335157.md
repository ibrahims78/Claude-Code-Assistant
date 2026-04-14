# أمر التنفيذ الاحترافي الكامل
## Claude Code Assistant + WhatsApp Manager + Telegram Bot — v5.0
### للنسخ والإعطاء مباشرةً لـ Replit Agent

---

> **تعليمات الاستخدام:**  
> انسخ هذا الملف كاملاً وأعطه لـ Replit Agent في replit.com/agent  
> الأمر مكتوب بالإنجليزية عمداً لأن Replit Agent يستجيب بشكل أدق للأوامر التقنية الإنجليزية  

---

```
You are an expert TypeScript full-stack engineer. Build a complete, production-ready
unified platform from scratch according to the exact specifications below.
Do NOT use placeholder data, mock APIs, or incomplete implementations.
Every feature must be fully functional and tested before moving to the next phase.

═══════════════════════════════════════════════════════════════════════════════════
PROJECT: Claude Code Assistant + WhatsApp Manager + Telegram Bot — v5.0
═══════════════════════════════════════════════════════════════════════════════════

OVERVIEW:
A unified bilingual (Arabic/English) platform combining:
1. Educational Platform — teach Claude Code to Arab developers with AI chat (RAG)
2. WhatsApp Multi-Session Manager — manage multiple WhatsApp accounts via wppconnect
3. Telegram Bot — same educational AI chat via Telegram

LANGUAGE: TypeScript everywhere (backend + frontend + shared libs)
PACKAGE MANAGER: pnpm workspaces (monorepo)
DEFAULT: Dark Mode + Arabic RTL

═══════════════════════════════════════════════════════════════════════════════════
PHASE 1 — MONOREPO FOUNDATION + DATABASE
═══════════════════════════════════════════════════════════════════════════════════

Create the full pnpm monorepo structure:

workspace/
├── pnpm-workspace.yaml              → packages: ["artifacts/*", "lib/*", "scripts"]
├── package.json                     → private: true, scripts: { seed, db:push }
├── tsconfig.base.json               → strict: true, moduleResolution: bundler
├── .env.example                     → all env vars with comments
├── lib/
│   ├── db/                          → @workspace/db
│   │   ├── package.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── index.ts             → export { db } + all table exports
│   │       └── schema/              → one file per table
│   ├── api-spec/                    → @workspace/api-spec (OpenAPI YAML)
│   ├── api-zod/                     → @workspace/api-zod (generated Zod validators)
│   └── api-client-react/            → @workspace/api-client-react (React Query hooks)
├── artifacts/
│   ├── api-server/                  → @workspace/api-server
│   └── whatsapp-dashboard/          → @workspace/whatsapp-dashboard
└── scripts/
    └── seed.ts

DATABASE: PostgreSQL + Drizzle ORM (push schema — NO migrations)
REQUIRED EXTENSION: pgvector (run: CREATE EXTENSION IF NOT EXISTS vector)

CREATE ALL 15 TABLES IN THIS EXACT ORDER (respect foreign key dependencies):

TABLE 1 — users:
  id SERIAL PK | username TEXT UNIQUE NOT NULL | email TEXT
  password_hash TEXT NOT NULL | role TEXT DEFAULT 'employee' (admin|employee)
  permissions TEXT (JSON: {"createSession":true,"sendText":false,...})
  max_sessions INTEGER (NULL=unlimited) | is_active BOOLEAN DEFAULT TRUE
  must_change_password BOOLEAN DEFAULT FALSE
  created_at TIMESTAMPTZ DEFAULT NOW() | updated_at TIMESTAMPTZ DEFAULT NOW()

TABLE 2 — whatsapp_sessions:
  id TEXT PK (e.g. "session_001") | user_id INTEGER FK users(id)
  name TEXT NOT NULL | phone_number TEXT
  status TEXT DEFAULT 'disconnected' (disconnected|connecting|connected|banned|notLogged)
  auto_reconnect BOOLEAN DEFAULT TRUE
  webhook_url TEXT | webhook_secret TEXT | webhook_events TEXT (JSON array)
  features TEXT (JSON object — feature flags)
  total_messages_sent INTEGER DEFAULT 0 | total_messages_received INTEGER DEFAULT 0
  created_at TIMESTAMPTZ DEFAULT NOW() | updated_at TIMESTAMPTZ DEFAULT NOW()

TABLE 3 — messages:
  id SERIAL PK | session_id TEXT FK whatsapp_sessions(id)
  direction TEXT NOT NULL (inbound|outbound)
  from_number TEXT NOT NULL | to_number TEXT NOT NULL
  message_type TEXT DEFAULT 'text' (text|image|video|audio|file|sticker|location|contact)
  content TEXT | media_url TEXT | caption TEXT
  status TEXT DEFAULT 'sent' (sent|delivered|read|failed)
  timestamp TIMESTAMPTZ DEFAULT NOW()

TABLE 4 — api_keys:
  id SERIAL PK | user_id INTEGER NOT NULL FK users(id)
  name TEXT NOT NULL | key_hash TEXT UNIQUE NOT NULL (bcrypt of full key)
  key_prefix TEXT NOT NULL (first 8 chars — for O(1) pre-filter)
  allowed_session_ids TEXT (JSON array | NULL = all sessions)
  created_at TIMESTAMPTZ DEFAULT NOW() | last_used_at TIMESTAMPTZ

TABLE 5 — audit_logs:
  id SERIAL PK | user_id INTEGER FK users(id) (nullable — system ops)
  username TEXT | action TEXT NOT NULL
  session_id TEXT | details TEXT (JSON) | ip_address TEXT
  timestamp TIMESTAMPTZ DEFAULT NOW()

TABLE 6 — settings:
  id SERIAL PK | key TEXT UNIQUE NOT NULL | value TEXT
  description TEXT | updated_by INTEGER FK users(id)
  updated_at TIMESTAMPTZ DEFAULT NOW()

TABLE 7 — content_chunks:
  id SERIAL PK | title TEXT NOT NULL | title_ar TEXT
  content TEXT NOT NULL | content_ar TEXT
  category TEXT (beginner|intermediate|advanced)
  section TEXT | source_file TEXT | order_index INTEGER
  embedding VECTOR(1536)
  created_at TIMESTAMPTZ DEFAULT NOW() | updated_at TIMESTAMPTZ DEFAULT NOW()

TABLE 8 — conversations:
  id SERIAL PK | user_id INTEGER FK users(id) ON DELETE CASCADE
  session_title TEXT DEFAULT 'محادثة جديدة'
  created_at TIMESTAMPTZ DEFAULT NOW() | updated_at TIMESTAMPTZ DEFAULT NOW()

TABLE 9 — chat_messages:
  id SERIAL PK | conversation_id INTEGER FK conversations(id) ON DELETE CASCADE
  role TEXT NOT NULL (user|assistant) | content TEXT NOT NULL
  sources JSONB | tokens_used INTEGER
  created_at TIMESTAMPTZ DEFAULT NOW()

TABLE 10 — user_progress:
  id SERIAL PK | user_id INTEGER FK users(id) ON DELETE CASCADE
  section TEXT | chunk_id INTEGER FK content_chunks(id)
  read_at TIMESTAMPTZ DEFAULT NOW()
  UNIQUE(user_id, chunk_id)

TABLE 11 — resources:
  id SERIAL PK | title_en TEXT NOT NULL | title_ar TEXT
  description_en TEXT | description_ar TEXT
  url TEXT NOT NULL | source_name TEXT
  type TEXT NOT NULL (official|research|article|tool|video)
  language TEXT DEFAULT 'en' | is_visible BOOLEAN DEFAULT TRUE
  is_featured BOOLEAN DEFAULT FALSE | embedding VECTOR(1536)
  suggested_by INTEGER FK users(id) | is_approved BOOLEAN DEFAULT FALSE
  added_by INTEGER FK users(id) | display_order INTEGER DEFAULT 0
  view_count INTEGER DEFAULT 0
  created_at TIMESTAMPTZ DEFAULT NOW() | updated_at TIMESTAMPTZ DEFAULT NOW()

TABLE 12 — resource_translations:
  id SERIAL PK | resource_id INTEGER FK resources(id) ON DELETE CASCADE
  field TEXT NOT NULL (title|description)
  source_lang TEXT NOT NULL | target_lang TEXT NOT NULL
  translated TEXT NOT NULL | translated_at TIMESTAMPTZ DEFAULT NOW()
  UNIQUE(resource_id, field, source_lang, target_lang)

TABLE 13 — resource_suggestions:
  id SERIAL PK | user_id INTEGER FK users(id) ON DELETE CASCADE
  url TEXT NOT NULL | title TEXT | description TEXT | type TEXT
  status TEXT DEFAULT 'pending' (pending|approved|rejected)
  admin_note TEXT | reviewed_by INTEGER FK users(id)
  reviewed_at TIMESTAMPTZ | created_at TIMESTAMPTZ DEFAULT NOW()

TABLE 14 — telegram_users:
  id SERIAL PK | telegram_id BIGINT UNIQUE NOT NULL
  first_name TEXT | username TEXT | linked_user_id INTEGER FK users(id)
  language TEXT DEFAULT 'ar' | is_blocked BOOLEAN DEFAULT FALSE
  daily_count INTEGER DEFAULT 0 | last_reset DATE DEFAULT CURRENT_DATE
  created_at TIMESTAMPTZ DEFAULT NOW() | last_active TIMESTAMPTZ DEFAULT NOW()

TABLE 15 — telegram_conversations:
  id SERIAL PK | telegram_user_id INTEGER FK telegram_users(id) ON DELETE CASCADE
  conversation_id INTEGER FK conversations(id)
  created_at TIMESTAMPTZ DEFAULT NOW() | updated_at TIMESTAMPTZ DEFAULT NOW()

SEED DATA (scripts/seed.ts — run after push):
1. admin user: username='admin', password=bcrypt('123456',10), role='admin', must_change_password=TRUE
2. 3 employee users with different permission sets:
   - employee1: all permissions TRUE, maxSessions=5
   - employee2: sendText+sendMedia=TRUE, rest=FALSE, maxSessions=2
   - employee3: viewMessages=TRUE only, maxSessions=1
3. 9 settings rows:
   ('app_name','Claude Code Assistant','اسم التطبيق')
   ('max_messages_per_day','50','الحد اليومي للرسائل')
   ('ai_model','claude-3-5-sonnet-20241022','نموذج Claude')
   ('import_last_run',NULL,'آخر استيراد')
   ('telegram_enabled','false','تفعيل بوت تيليغرام')
   ('telegram_token',NULL,'Bot Token')
   ('telegram_welcome_ar','مرحباً! أنا مساعد Claude Code. كيف يمكنني مساعدتك؟','ترحيب عربي')
   ('telegram_welcome_en','Hello! I am Claude Code Assistant. How can I help you?','ترحيب إنجليزي')
   ('telegram_max_daily','20','الحد اليومي لكل مستخدم تيليغرام')
4. 6 resources (is_visible=TRUE, is_featured alternating):
   {title_en:'Claude Code Official Documentation', url:'https://code.claude.com/docs', type:'official', source_name:'Anthropic'}
   {title_en:'Model Context Protocol Specification', url:'https://modelcontextprotocol.io', type:'official', source_name:'MCP'}
   {title_en:'How Anthropic Built Multi-Agent System', url:'https://anthropic.com/engineering', type:'article', source_name:'Anthropic Engineering'}
   {title_en:'Design Space of AI Coding Tools (VLHCC 2025)', url:'https://lau.ucsd.edu', type:'research', source_name:'VLHCC'}
   {title_en:'Measuring AI Agent Autonomy', url:'https://anthropic.com/research', type:'research', source_name:'Anthropic Research'}
   {title_en:'Awesome Arabic AI Resources', url:'https://blog.brightcoding.dev', type:'article', source_name:'BrightCoding', language:'ar'}
5. 10 content_chunks about Claude Code (Arabic + English, no embeddings yet):
   Sections: intro, slash-commands, hooks, memory, mcp, agents, settings, security, workflows, tips
6. 3 whatsapp_sessions (status='disconnected', userId=admin.id):
   {id:'session_001', name:'الجلسة الأولى'}
   {id:'session_002', name:'الجلسة التجارية'}
   {id:'session_003', name:'الدعم الفني'}
7. 2 api_keys (for admin, bcrypt hashed — print full keys to console once):
   {name:'Production API', allowedSessionIds:null}
   {name:'Session 001 Only', allowedSessionIds:'["session_001"]'}
8. 20 audit_log rows (mix of actions: login, createSession, sendText, connectSession)

PHASE 1 ACCEPTANCE TESTS:
□ pnpm install → 0 errors
□ pnpm --filter @workspace/db push → 0 errors, 15 tables created
□ pnpm run seed → 0 errors, seed data inserted
□ SELECT count(*) FROM users → 4
□ SELECT count(*) FROM settings → 9
□ SELECT * FROM pg_extension WHERE extname='vector' → 1 row
□ \d content_chunks → embedding column type = vector(1536)
□ All foreign key constraints valid

CREATE FILE: PHASE_1_DONE.md documenting all commands and test results.

═══════════════════════════════════════════════════════════════════════════════════
PHASE 2 — API SERVER CORE: AUTH + USERS + API KEYS
═══════════════════════════════════════════════════════════════════════════════════

Build artifacts/api-server/ with full Express.js v5 + TypeScript setup.

DEPENDENCIES:
express@^5 | @types/express | typescript | ts-node | tsx
socket.io@^4 | cors | helmet@^8 | express-rate-limit@^8
cookie-parser | pino | pino-http | bcryptjs | jsonwebtoken
@types/bcryptjs | @types/jsonwebtoken | @types/cors | @types/cookie-parser
@workspace/db (workspace dependency)

MIDDLEWARE STACK (app.ts — exact order matters):

```typescript
app.set("trust proxy", 1);  // REQUIRED for correct req.ip behind Replit mTLS

app.use(helmet({
  contentSecurityPolicy: false,       // JSON API — no HTML
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.includes(".replit.dev") || origin.endsWith(".repl.co") || origin.endsWith(".replit.app"))
      return callback(null, true);
    if (origin.startsWith("http://localhost") || origin.startsWith("https://localhost") ||
        origin.startsWith("http://127.0.0.1") || origin.startsWith("https://127.0.0.1"))
      return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// API Rate Limiter: 300 req/min per IP
app.use("/api", apiRateLimiter);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(pinoHttp({ logger, serializers: { req: r => ({method:r.method,url:r.url?.split("?")[0]}), res: r => ({status:r.statusCode}) } }));

// Health checks (before auth)
app.get("/", (req, res) => res.json({ status: "ok", version: "5.0" }));
app.get("/api/healthz", (req, res) => res.json({ status: "ok" }));

app.use("/api", router);
app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});
```

AUTH LIBRARY (lib/auth.ts):

```typescript
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
const SALT_ROUNDS = 10;

export const hashPassword = (password: string): string => bcrypt.hashSync(password, SALT_ROUNDS);
export const verifyPassword = (plain: string, hash: string): boolean => bcrypt.compareSync(plain, hash);
export const generateToken = (userId: number, role: string): string =>
  jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d", algorithm: "HS256" });
export const verifyToken = (token: string): { userId: number; role: string } | null => {
  try { return jwt.verify(token, JWT_SECRET) as any; } catch { return null; }
};

// requireAuth middleware:
// 1. Check httpOnly cookie "session_token"
// 2. Check Authorization: Bearer header
// 3. Check X-API-Key header:
//    a. Extract keyPrefix = apiKey.slice(0, 8)
//    b. Find api_keys WHERE key_prefix = keyPrefix
//    c. bcrypt.compare(apiKey, keyHash) for each match
//    d. If match: check allowedSessionIds restriction
//    e. Update last_used_at
// 4. Attach (req as any).user = full user object from DB
// 5. Check mustChangePassword:
//    Blocked paths (when mustChangePassword=true):
//    ALLOW: POST /api/auth/login | POST /api/auth/logout | GET /api/auth/me | PATCH /api/users/me/password
//    BLOCK all others: 403 { error: "Password change required", mustChangePassword: true }

export const hasPermission = (user: User, permission: string): boolean => {
  if (user.role === "admin") return true;
  try {
    const perms = JSON.parse(user.permissions || "{}");
    return perms[permission] !== false;  // undefined = allowed, false = blocked
  } catch { return true; }
};
```

RATE LIMITERS (lib/rate-limit.ts):
```typescript
export const loginRateLimiter = rateLimit({ windowMs: 15*60*1000, max: 20, message: { error: "Too many login attempts" } });
export const apiRateLimiter = rateLimit({ windowMs: 60*1000, max: 300, message: { error: "Rate limit exceeded" } });
```

PASSWORD COMPLEXITY VALIDATION (lib/validate.ts):
```typescript
export function validatePasswordComplexity(password: string): string | null {
  if (password.length < 6) return "Password must be at least 6 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    return "Password must contain at least one digit or special character";
  return null;
}
```

AUTH ROUTES (routes/auth.ts):
POST /api/auth/login (loginRateLimiter applied):
  body: { username, password }
  → find user WHERE username=username AND is_active=true
  → verifyPassword → 401 if fail
  → generateToken
  → set cookie: session_token, httpOnly:true, secure:(NODE_ENV=production||REPLIT_DEV_DOMAIN exists), sameSite:'lax', maxAge:7days
  → return { token, user: { ...user without passwordHash, mustChangePassword } }

POST /api/auth/logout (requireAuth):
  → clearCookie('session_token')
  → return { success: true }

GET /api/auth/me (requireAuth):
  → return user without passwordHash

USERS ROUTES (routes/users.ts):
GET    /api/users              → requireAuth + requireAdmin → all users (no passwordHash)
POST   /api/users              → requireAuth + requireAdmin → create user
  body: { username, email?, password, role, permissions?, maxSessions? }
  → validatePasswordComplexity → 400 if fail
  → hashPassword → INSERT → return user without passwordHash

GET    /api/users/:id          → requireAuth → Admin: any | Employee: self only (403 otherwise)
PATCH  /api/users/:id          → requireAuth + requireAdmin
DELETE /api/users/:id          → requireAuth + requireAdmin

PATCH  /api/users/me           → requireAuth → update own name/email
PATCH  /api/users/me/password  → requireAuth
  body: { currentPassword, newPassword }
  → verifyPassword(currentPassword) → 401 if fail
  → validatePasswordComplexity(newPassword)
  → UPDATE passwordHash + mustChangePassword=FALSE

PHASE 2 ACCEPTANCE TESTS:
□ POST /api/auth/login (admin/123456) → 200 + token + mustChangePassword:true
□ POST /api/auth/login (wrong password) → 401
□ POST /api/auth/login x21 in 15min → 429
□ GET /api/auth/me (no token) → 401
□ GET /api/auth/me (valid token) → user object (no passwordHash)
□ POST /api/auth/logout → 200 + cookie cleared
□ GET /api/users (employee token) → 403
□ GET /api/users (admin token) → array of 4 users
□ POST /api/users (admin, password="abc") → 400 complexity error
□ POST /api/users (admin, valid data) → 201 + new user
□ mustChangePassword=true + GET /api/users → 403 + mustChangePassword:true
□ mustChangePassword=true + PATCH /api/users/me/password → 200 ✓
□ X-API-Key auth: valid key → 200
□ X-API-Key auth: invalid key → 401
□ X-API-Key with allowedSessionIds restriction → verified in phase 3

CREATE FILE: PHASE_2_DONE.md

═══════════════════════════════════════════════════════════════════════════════════
PHASE 3 — WHATSAPP MANAGER CORE + WEBSOCKET
═══════════════════════════════════════════════════════════════════════════════════

ADDITIONAL DEPENDENCIES:
@wppconnect-team/wppconnect@^1.41 | socket.io@^4 | dns (built-in)

CHROME PATH RESOLUTION (lib/whatsapp-manager.ts):
```typescript
function resolveChromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cacheBase = "/home/runner/.cache/puppeteer/chrome";
  if (existsSync(cacheBase)) {
    try {
      const versions = readdirSync(cacheBase).sort().reverse();
      for (const ver of versions) {
        const candidate = path.join(cacheBase, ver, "chrome-linux64", "chrome");
        if (existsSync(candidate)) return candidate;
      }
    } catch {}
  }
  return "/home/runner/.cache/puppeteer/chrome/linux-146.0.7680.153/chrome-linux64/chrome";
}

function ensureChrome(): void {
  if (existsSync(CHROME_PATH)) return;
  execSync("npx --yes puppeteer@24.40.0 browsers install chrome", { stdio: "pipe", timeout: 180_000 });
}

function cleanChromeLocks(sessionId: string): void {
  const dir = path.join(TOKENS_DIR, sessionId);
  for (const name of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    const f = path.join(dir, name);
    try { if (existsSync(f)) rmSync(f, { force: true }); } catch {}
  }
}
```

SOCKET.IO SETUP:
```typescript
// index.ts
const httpServer = createServer(app);
const io = new SocketServer(httpServer, { cors: { origin: ..., credentials: true } });

io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];
  const payload = verifyToken(token);
  if (!payload) return next(new Error("Unauthorized"));
  socket.data.user = payload;
  next();
});

// Events emitted by server:
// 'qr:update'      → { sessionId, qr: base64String }
// 'session:status' → { sessionId, status: string }
// 'message:new'    → { sessionId, message: MessageObject }
```

WPPCONNECT SESSION CREATION:
```typescript
export async function createWppSession(sessionId: string, io: SocketServer): Promise<void> {
  ensureChrome();
  cleanChromeLocks(sessionId);

  const client = await create({
    session: sessionId,
    headless: true,
    executablePath: CHROME_PATH,
    devtools: false,
    useChrome: true,
    logQR: false,
    browserArgs: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    puppeteerOptions: { args: ["--no-sandbox"] },
    catchQR: (base64Qr) => {
      io.emit("qr:update", { sessionId, qr: base64Qr });
    },
    statusFind: async (statusSession) => {
      const status = mapStatus(statusSession);
      await db.update(whatsappSessionsTable).set({ status, updatedAt: new Date() }).where(eq(whatsappSessionsTable.id, sessionId));
      io.emit("session:status", { sessionId, status });
    },
  });

  // Store client reference: Map<sessionId, client>
  sessions.set(sessionId, client);

  client.onMessage(async (message) => {
    // Insert into messages table (direction='inbound')
    // UPDATE totalMessagesReceived++
    // io.emit('message:new', { sessionId, message })
    // triggerWebhook(session, 'message', { message })
  });
}

export async function reconnectOnBoot(io: SocketServer): Promise<void> {
  const activeSessions = await db.select().from(whatsappSessionsTable)
    .where(and(eq(whatsappSessionsTable.autoReconnect, true), not(eq(whatsappSessionsTable.status, 'banned'))));
  for (const session of activeSessions) {
    createWppSession(session.id, io).catch(err => logger.error(err, `Failed to reconnect ${session.id}`));
  }
}
```

WEBHOOK DELIVERY:
```typescript
async function isPrivateUrl(urlStr: string): Promise<boolean> {
  const url = new URL(urlStr);
  const { address } = await dnsPromises.lookup(url.hostname);
  return /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|localhost)/.test(address);
}

async function triggerWebhook(session: WhatsappSession, event: string, payload: object): Promise<void> {
  if (!session.webhookUrl) return;
  const events = JSON.parse(session.webhookEvents || '[]');
  if (events.length > 0 && !events.includes(event)) return;
  try {
    if (await isPrivateUrl(session.webhookUrl)) return;  // SSRF guard
  } catch { return; }
  const body = JSON.stringify({ event, sessionId: session.id, timestamp: new Date().toISOString(), ...payload });
  const headers: Record<string,string> = { "Content-Type": "application/json" };
  if (session.webhookSecret) {
    headers["X-Webhook-Signature"] = "sha256=" + createHmac("sha256", session.webhookSecret).update(body).digest("hex");
  }
  // Retry 3 times with 10s AbortController timeout each
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      await fetch(session.webhookUrl, { method: "POST", headers, body, signal: ctrl.signal });
      clearTimeout(timer);
      break;
    } catch {}
  }
}
```

SESSIONS ROUTES (routes/sessions.ts):
GET    /api/sessions
POST   /api/sessions { name, webhookUrl? }
GET    /api/sessions/:id
DELETE /api/sessions/:id → disconnect if connected + delete tokens dir + writeAuditLog
POST   /api/sessions/:id/connect → hasPermission('connectSession') → update status='connecting' → createWppSession
POST   /api/sessions/:id/disconnect → hasPermission('disconnectSession') → client.close() → autoReconnect=false
GET    /api/sessions/:id/qr → return current QR if status='connecting'
GET    /api/sessions/:id/stats → { totalSent, totalReceived, status, phoneNumber, name }
GET    /api/sessions/:id/messages?limit=50&offset=0 → paginated messages
PATCH  /api/sessions/:id/webhook { webhookUrl, webhookSecret?, webhookEvents? }
  → isPrivateUrl(webhookUrl) → 400 if private ("Webhook URL cannot point to private/local addresses")
PATCH  /api/sessions/:id/features { features: object }

AUDIT LOGGING (lib/audit.ts):
```typescript
export async function writeAuditLog(params: {
  userId?: number; username?: string; action: string;
  sessionId?: string; details?: object; ipAddress?: string;
}): Promise<void> {
  await db.insert(auditLogsTable).values({
    ...params,
    details: params.details ? JSON.stringify(params.details) : null,
    timestamp: new Date(),
  });
}
```

PHASE 3 ACCEPTANCE TESTS:
□ POST /api/sessions (admin) → 201 + session created in DB
□ GET /api/sessions (employee1) → sees own sessions only
□ POST /api/sessions (employee with createSession=false) → 403
□ POST /api/sessions (employee3 at maxSessions limit) → 400 "Session limit reached"
□ POST /api/sessions/:id/connect → status='connecting' in DB
□ Socket.IO connect with valid JWT → success
□ Socket.IO connect without token → error "Unauthorized"
□ Socket.IO: qr:update event received within 10s of connect
□ PATCH /api/sessions/:id/webhook (url='http://localhost:3000') → 400 SSRF rejected
□ PATCH /api/sessions/:id/webhook (valid external URL) → 200 saved
□ GET /api/sessions/:id/stats → correct numbers
□ DELETE /api/sessions/:id → 200 + session removed from DB + tokens dir deleted
□ All actions appear in audit_logs table
□ Server restart: sessions with autoReconnect=true attempt reconnect

CREATE FILE: PHASE_3_DONE.md

═══════════════════════════════════════════════════════════════════════════════════
PHASE 4 — FULL SEND ROUTES + VALIDATION
═══════════════════════════════════════════════════════════════════════════════════

SEND ROUTES (routes/send.ts):

PHONE VALIDATION:
```typescript
function validatePhoneNumber(number: string): string | null {
  if (!number?.trim()) return "Phone number is required";
  if (number.endsWith("@c.us") || number.endsWith("@g.us") || number.endsWith("@lid")) return null;
  const digits = number.trim().replace(/\D/g, "");
  if (digits.length < 7) return `Phone number too short: '${number}' (minimum 7 digits)`;
  if (digits.length > 15) return `Phone number too long: '${number}' (maximum 15 digits per E.164)`;
  return null;
}

function formatNumber(number: string): string {
  if (number.endsWith("@c.us") || number.endsWith("@g.us")) return number;
  if (number.includes("@")) return `${number.split("@")[0]}@c.us`;
  return `${number.replace(/\D/g, "")}@c.us`;
}
```

BASE64 → TEMP FILE:
```typescript
function saveTempFile(dataUrl: string, fallbackExt: string): string | null {
  if (!dataUrl.startsWith("data:")) return null;
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) return null;
  const extMap: Record<string,string> = {
    "image/jpeg":"jpg","image/png":"png","image/gif":"gif","image/webp":"webp",
    "video/mp4":"mp4","audio/mpeg":"mp3","audio/ogg":"ogg","application/pdf":"pdf"
  };
  const ext = extMap[matches[1]] || fallbackExt;
  const filePath = path.join(tmpdir(), `${randomUUID()}.${ext}`);
  writeFileSync(filePath, Buffer.from(matches[2], "base64"));
  return filePath;
}
function cleanupTempFile(filePath: string): void {
  try { if (filePath && existsSync(filePath)) unlinkSync(filePath); } catch {}
}
```

IMPLEMENT ALL 7 SEND ENDPOINTS (each in /api/send/ AND /api/sessions/:id/send/):

POST /api/send/text { sessionId, to, message }
  → validatePhone → hasPermission('sendText') → getClient(sessionId) → client.sendText
  → INSERT messages (outbound, text) → UPDATE totalSent++ → writeAuditLog('sendText') → triggerWebhook

POST /api/send/image { sessionId, to, image (URL or base64), caption? }
  → hasPermission('sendMedia')
  → if base64: path=saveTempFile(image,'jpg') → client.sendImage(to,path,caption) → cleanupTempFile(path) in finally
  → else: client.sendImage(to, image, caption)
  → INSERT messages (outbound, image) → UPDATE totalSent++ → writeAuditLog('sendImage')

POST /api/send/video { sessionId, to, video, caption? } → hasPermission('sendMedia') → similar to image

POST /api/send/audio { sessionId, to, audio } → hasPermission('sendMedia') → client.sendPtt or sendAudio

POST /api/send/file { sessionId, to, file, filename } → hasPermission('sendMedia') → client.sendFile

POST /api/send/location { sessionId, to, lat, lng, description? }
  → hasPermission('sendLocation')
  → GPS validation:
    if (isNaN(lat) || isNaN(lng)) → 400 "Invalid coordinates: NaN"
    if (!isFinite(lat) || !isFinite(lng)) → 400 "Invalid coordinates: Infinity"
    if (lat < -90 || lat > 90) → 400 "Latitude must be between -90 and 90"
    if (lng < -180 || lng > 180) → 400 "Longitude must be between -180 and 180"
  → client.sendLocation(to, { lat, lng, description })
  → INSERT messages (outbound, location, content=JSON.stringify({lat,lng,description}))

POST /api/send/sticker { sessionId, to, sticker } → hasPermission('sendSticker') → client.sendSticker

PHASE 4 ACCEPTANCE TESTS:
□ POST /api/send/text (connected session, valid number) → 200 + message in DB
□ POST /api/send/text (number "123") → 400 "Phone number too short"
□ POST /api/send/text (number "1234567890123456") → 400 "Phone number too long"
□ POST /api/send/text (number "@c.us") → passes validation
□ POST /api/send/text (disconnected session) → 400 "Session not connected"
□ POST /api/send/image (URL) → 200
□ POST /api/send/image (base64 data URI) → 200 + temp file cleaned up
□ POST /api/send/location (lat:200, lng:0) → 400 "Latitude must be between -90 and 90"
□ POST /api/send/location (lat:NaN) → 400
□ POST /api/send/location (valid) → 200
□ POST /api/send/text (employee, sendText=false) → 403
□ POST /api/send/image (employee, sendMedia=false) → 403
□ All sends appear in audit_logs
□ totalMessagesSent increments after each send
□ Webhook triggered after each send
□ POST /api/sessions/session_001/send/text → same behavior as /api/send/text

CREATE FILE: PHASE_4_DONE.md

═══════════════════════════════════════════════════════════════════════════════════
PHASE 5 — DASHBOARD API + AUDIT LOGS + API KEYS + n8n
═══════════════════════════════════════════════════════════════════════════════════

GET /api/dashboard/stats (requireAuth):
  Admin: ALL sessions stats
  Employee: own sessions only (precompute visibleSessionIds)
  Build 7-day date skeleton (today-6 → today), then fill from messages table:
    SELECT day, direction, count FROM messages WHERE timestamp >= 7daysAgo [AND sessionId IN ...]
    GROUP BY day, direction
  Return: { totalSessions, connectedSessions, disconnectedSessions, totalSent, totalReceived,
            dailyStats: [{date:"YYYY-MM-DD", sent:N, received:N}] (always 7 elements) }

GET /api/audit-logs (requireAdmin, paginated):
  Query params: page=1, limit=50, action?, sessionId?, from?, to?
  ORDER BY timestamp DESC
  Return: { logs: [...], total: N, page: N, totalPages: N }

API KEYS ROUTES (routes/api-keys.ts):
GET  /api/api-keys → Admin: all | Employee: own (NEVER return keyHash)
POST /api/api-keys { name, allowedSessionIds? }:
  fullKey = randomBytes(32).toString('hex')  // 64 hex chars
  keyPrefix = fullKey.slice(0, 8)
  keyHash = bcrypt(fullKey, 10)
  INSERT → return { ...key, plainKey: fullKey }  // plainKey shown ONCE only
PATCH /api/api-keys/:id { name?, allowedSessionIds? } → Admin or own key
DELETE /api/api-keys/:id → Admin or own key

n8n WORKFLOW ROUTE (routes/n8n.ts):
GET /api/n8n-workflow/download (requireAdmin):
  template = read from scripts/n8n-workflow-template.json
  Replace SERVER_URL placeholder with: process.env.REPLIT_DEV_DOMAIN || process.env.APP_URL || 'localhost:8080'
  Replace API_KEY_PLACEHOLDER with first admin api_key keyPrefix (for display only)
  res.setHeader('Content-Disposition', 'attachment; filename=n8n-workflow.json')
  res.setHeader('Content-Type', 'application/json')
  res.send(template)

CREATE scripts/n8n-workflow-template.json as a minimal n8n workflow with:
  - Webhook trigger node (listens for WhatsApp events)
  - HTTP Request node (calls {{SERVER_URL}}/api/send/text with X-API-Key: {{API_KEY}})
  - Set node for message formatting
  Nodes should be properly connected and exportable to n8n

PHASE 5 ACCEPTANCE TESTS:
□ GET /api/dashboard/stats (admin) → stats for all sessions
□ GET /api/dashboard/stats (employee1) → stats for own sessions only
□ dailyStats always has exactly 7 elements (even if 0 messages)
□ GET /api/audit-logs (admin) → 50 logs + pagination metadata
□ GET /api/audit-logs (employee) → 403
□ GET /api/audit-logs?action=login → filtered results
□ POST /api/api-keys → response contains plainKey (64 hex chars)
□ GET /api/api-keys → no keyHash in response
□ DELETE /api/api-keys/:id → 200
□ GET /api/n8n-workflow/download (admin) → JSON file download
□ GET /api/n8n-workflow/download (employee) → 403
□ Downloaded JSON contains correct SERVER_URL

CREATE FILE: PHASE_5_DONE.md

═══════════════════════════════════════════════════════════════════════════════════
PHASE 6 — EDUCATIONAL PLATFORM: BACKEND COMPLETE
═══════════════════════════════════════════════════════════════════════════════════

ADDITIONAL DEPENDENCIES:
@anthropic-ai/sdk | axios (for GitHub API)

CLAUDE + RAG (lib/claude.ts + lib/rag.ts):

```typescript
// lib/claude.ts
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateEmbedding(text: string): Promise<number[]> {
  // Use claude API or a compatible embedding endpoint
  // Return vector of length 1536
  // If Anthropic doesn't support embeddings directly, use a fallback strategy:
  // - Simple TF-IDF based embedding (for development)
  // - Or use the messages API to generate a summary then hash to 1536 dims
  // IMPORTANT: Must return array of exactly 1536 floats
}

export async function chatWithClaude(
  messages: {role:'user'|'assistant', content:string}[],
  systemPrompt: string,
  model?: string
): Promise<{ content: string; tokensUsed: number }> {
  const aiModel = model || (await getSettingValue('ai_model')) || 'claude-3-5-sonnet-20241022';
  const response = await anthropic.messages.create({
    model: aiModel,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });
  return {
    content: response.content[0].type === 'text' ? response.content[0].text : '',
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}

// lib/rag.ts
export async function searchSimilarChunks(query: string, limit = 5): Promise<ContentChunk[]> {
  const embedding = await generateEmbedding(query);
  // Use Drizzle raw SQL for pgvector:
  const result = await db.execute(
    sql`SELECT * FROM content_chunks WHERE embedding IS NOT NULL
        ORDER BY embedding <-> ${JSON.stringify(embedding)}::vector LIMIT ${limit}`
  );
  return result.rows as ContentChunk[];
}

export function buildSystemPrompt(chunks: ContentChunk[], language: 'ar' | 'en'): string {
  const context = chunks.map((c, i) =>
    `[${i+1}] ${language==='ar' ? c.title_ar||c.title : c.title}\n${language==='ar' ? c.content_ar||c.content : c.content}`
  ).join('\n\n---\n\n');

  if (language === 'ar') {
    return `أنت مساعد تعليمي متخصص في Claude Code. أجب بالعربية فقط.
استند فقط للمعلومات التالية وأشر إلى المصدر في إجابتك:

${context}

إذا لم تجد الإجابة في المعلومات المُقدَّمة، قل ذلك صراحةً.`;
  }
  return `You are an educational assistant specialized in Claude Code. Answer only in English.
Base your answer ONLY on the following context and cite the source:

${context}

If the answer is not in the provided context, say so explicitly.`;
}
```

CHAT ROUTES (routes/chat.ts):
GET    /api/chat/conversations → user's conversations (ordered by updatedAt DESC)
POST   /api/chat/conversations { title? } → create new conversation
GET    /api/chat/conversations/:id → conversation + messages (verify ownership)
DELETE /api/chat/conversations/:id → delete (verify ownership)
POST   /api/chat/conversations/:id/messages { content }:
  1. Verify conversation belongs to user
  2. chunks = await searchSimilarChunks(content, 5)
  3. lang = user.language preference (from profile or 'ar')
  4. systemPrompt = buildSystemPrompt(chunks, lang)
  5. history = last 10 messages from conversation
  6. { content: reply, tokensUsed } = await chatWithClaude([...history, {role:'user',content}], systemPrompt)
  7. INSERT user message (role='user')
  8. INSERT assistant message (role='assistant', sources=chunks mapped to {title,section,chunkId})
  9. UPDATE conversation updatedAt
  10. writeAuditLog('chat_message')
  11. Return { message: assistantMsg, sources: chunks.map(c => ({title: c.title_ar||c.title, section: c.section})) }

CONTENT ROUTES (routes/content.ts):
GET /api/content/sections → distinct sections from content_chunks with:
  { section, totalChunks, readChunks, progressPercent } per section
GET /api/content/sections/:sectionId → all chunks in section (mark which user read)
GET /api/content/search?q= → full text search in (title ILIKE or content_ar ILIKE or title_ar ILIKE)
POST /api/content/progress/:chunkId → INSERT into user_progress (ignore duplicate)
GET /api/content/progress → all read chunk IDs for current user

ADMIN CONTENT IMPORT (part of routes/admin.ts):
POST /api/admin/import (requireAdmin):
  1. GET https://api.github.com/repos/ibrahims78/claude-howto/contents/
     Header: Authorization: token ${GITHUB_TOKEN} (if env var exists)
  2. For each .md file:
     a. GET file content (base64 decode)
     b. Split by "## " into chunks
     c. For each chunk: title = first line, content = rest
     d. Translate to Arabic via Claude API
     e. generateEmbedding(english content)
     f. UPSERT content_chunks WHERE source_file=filename AND order_index=i
  3. UPDATE settings SET value=NOW()::text WHERE key='import_last_run'
  4. Return { imported: N, updated: N, total: N }

RESOURCES ROUTES (routes/resources.ts):
GET /api/resources?type=&lang=&q=&featured=&page=1&limit=20:
  WHERE is_visible=TRUE
  Optional filters: type, language, is_featured
  Optional search: title_en ILIKE OR title_ar ILIKE
  ORDER BY is_featured DESC, display_order ASC, created_at DESC
  Paginated

GET /api/resources/:id → return resource + INCREMENT view_count

POST /api/resources/:id/translate { field:'title'|'description', sourceLang, targetLang }:
  1. Check resource_translations cache first (UNIQUE constraint)
  2. If found: return { translatedText, fromCache: true }
  3. If not: translate via Claude API → INSERT into resource_translations → return { translatedText, fromCache: false }

GET /api/resources/:id/ask-context → { resourceTitle, resourceUrl, systemPrompt for asking about this resource }

POST /api/resources/suggest { url, title, description, type }:
  INSERT into resource_suggestions (status='pending', userId=user.id)

ADMIN RESOURCES ROUTES:
GET  /api/admin/resources → all resources (including hidden)
POST /api/admin/resources { ...fields } → INSERT + auto-translate title to Arabic if missing + generateEmbedding
PUT  /api/admin/resources/:id
PUT  /api/admin/resources/:id/toggle-visibility
PUT  /api/admin/resources/:id/toggle-featured
DELETE /api/admin/resources/:id
GET  /api/admin/resources/suggestions
PUT  /api/admin/resources/suggestions/:id { status:'approved'|'rejected', admin_note? }
  → If approved: INSERT into resources + writeAuditLog

PROFILE ROUTES (routes/profile.ts):
PATCH /api/profile → update name/email
PATCH /api/profile/password → change password (verify old first)
GET   /api/profile/stats → {
  totalConversations: count from conversations,
  totalQuestions: count user messages from chat_messages,
  progressPercent: (read chunks / total chunks) * 100,
  dailyCount: today's chat messages count
}

ADMIN DASHBOARD + SETTINGS:
GET /api/admin/dashboard → {
  totalUsers, activeUsers, totalConversations, totalMessages,
  totalChunks, chunksWithEmbeddings, importLastRun,
  telegramUsers, telegramMessagesToday
}
GET  /api/admin/settings → all settings as key:value object
PUT  /api/admin/settings { key: value, ... } → UPDATE settings

PHASE 6 ACCEPTANCE TESTS:
□ POST /api/chat/conversations/:id/messages { content: "ما هو Claude Code؟" }
  → response contains Arabic text + sources array (not empty if chunks exist)
□ GET /api/content/sections → sections with progressPercent
□ POST /api/content/progress/:chunkId → 200 (idempotent)
□ GET /api/content/search?q=slash → returns matching chunks
□ POST /api/admin/import → imports content from GitHub
□ Content chunks now have embeddings in DB
□ GET /api/resources → 6 resources with pagination
□ POST /api/resources/:id/translate → translated text returned
□ POST /api/resources/:id/translate (second call same params) → fromCache: true
□ POST /api/resources/suggest → saved in resource_suggestions
□ GET /api/admin/resources/suggestions → pending suggestions visible
□ GET /api/profile/stats → all counts correct
□ GET /api/admin/dashboard → all stats

CREATE FILE: PHASE_6_DONE.md

═══════════════════════════════════════════════════════════════════════════════════
PHASE 7 — TELEGRAM BOT
═══════════════════════════════════════════════════════════════════════════════════

ADDITIONAL DEPENDENCIES: grammy

TELEGRAM BOT (lib/telegram-bot.ts):

The bot uses grammY with webhook mode (not polling).
Token is stored in settings table (key='telegram_token'), NOT in .env.

```typescript
import { Bot, Context } from "grammy";
import { db, telegramUsersTable, telegramConversationsTable, conversationsTable } from "@workspace/db";

let botInstance: Bot | null = null;

interface BotContext extends Context {
  telegramUser?: typeof telegramUsersTable.$inferSelect;
  isBlocked?: boolean;
  limitReached?: boolean;
}

export async function getOrInitBot(): Promise<Bot | null> {
  if (botInstance) return botInstance;
  const token = await getSettingValue('telegram_token');
  if (!token || (await getSettingValue('telegram_enabled')) !== 'true') return null;
  botInstance = createBot(token);
  return botInstance;
}

function createBot(token: string): Bot {
  const bot = new Bot<BotContext>(token);

  // Middleware: register/update telegram_users
  bot.use(async (ctx, next) => {
    if (!ctx.from) return next();
    const telegramId = BigInt(ctx.from.id);
    const existing = await db.query.telegramUsers.findFirst({ where: eq(telegramUsersTable.telegramId, telegramId) });
    let telegramUser: typeof telegramUsersTable.$inferSelect;
    if (!existing) {
      [telegramUser] = await db.insert(telegramUsersTable).values({
        telegramId, firstName: ctx.from.first_name, username: ctx.from.username, language: 'ar'
      }).returning();
    } else {
      // Reset daily_count if last_reset < today
      const today = new Date().toISOString().slice(0,10);
      const updates: Partial<typeof telegramUsersTable.$inferInsert> = { lastActive: new Date() };
      if (existing.lastReset?.toISOString().slice(0,10) < today) {
        updates.dailyCount = 0;
        updates.lastReset = new Date();
      }
      [telegramUser] = await db.update(telegramUsersTable).set(updates).where(eq(telegramUsersTable.id, existing.id)).returning();
    }
    ctx.telegramUser = telegramUser;
    if (telegramUser.isBlocked) {
      await ctx.reply(telegramUser.language === 'ar' ? "عذراً، تم حظر حسابك." : "Sorry, your account has been blocked.");
      return;
    }
    const maxDaily = parseInt(await getSettingValue('telegram_max_daily') || '20');
    if (telegramUser.dailyCount >= maxDaily) {
      await ctx.reply(telegramUser.language === 'ar'
        ? `لقد وصلت للحد اليومي (${maxDaily} رسالة). يُجدَّد الحد غداً.`
        : `You have reached the daily limit (${maxDaily} messages). Resets tomorrow.`);
      return;
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    const lang = ctx.telegramUser?.language || 'ar';
    const welcome = await getSettingValue(lang === 'ar' ? 'telegram_welcome_ar' : 'telegram_welcome_en');
    await ctx.reply(welcome || (lang === 'ar' ? 'مرحباً!' : 'Hello!'));
  });

  bot.command("help", async (ctx) => {
    const lang = ctx.telegramUser?.language || 'ar';
    if (lang === 'ar') {
      await ctx.reply("/start — رسالة الترحيب\n/help — قائمة الأوامر\n/lang — تبديل اللغة\n/clear — محادثة جديدة\n/stats — إحصائياتي");
    } else {
      await ctx.reply("/start — Welcome message\n/help — Command list\n/lang — Switch language\n/clear — New conversation\n/stats — My stats");
    }
  });

  bot.command("lang", async (ctx) => {
    const current = ctx.telegramUser?.language || 'ar';
    const newLang = current === 'ar' ? 'en' : 'ar';
    await db.update(telegramUsersTable).set({ language: newLang }).where(eq(telegramUsersTable.id, ctx.telegramUser!.id));
    await ctx.reply(newLang === 'ar' ? "✅ تم التبديل للعربية" : "✅ Switched to English");
  });

  bot.command("clear", async (ctx) => {
    // Create new conversation and update telegram_conversations
    const [conv] = await db.insert(conversationsTable).values({
      userId: null, sessionTitle: `Telegram - ${ctx.from?.first_name}`
    }).returning();
    const existing = await db.query.telegramConversations.findFirst({
      where: eq(telegramConversationsTable.telegramUserId, ctx.telegramUser!.id)
    });
    if (existing) {
      await db.update(telegramConversationsTable).set({ conversationId: conv.id }).where(eq(telegramConversationsTable.id, existing.id));
    } else {
      await db.insert(telegramConversationsTable).values({ telegramUserId: ctx.telegramUser!.id, conversationId: conv.id });
    }
    const lang = ctx.telegramUser?.language || 'ar';
    await ctx.reply(lang === 'ar' ? "✅ تم مسح المحادثة" : "✅ Conversation cleared");
  });

  bot.command("stats", async (ctx) => {
    const user = ctx.telegramUser!;
    const lang = user.language;
    await ctx.reply(lang === 'ar'
      ? `📊 إحصائياتك:\nأسئلة اليوم: ${user.dailyCount}`
      : `📊 Your stats:\nToday's questions: ${user.dailyCount}`);
  });

  // Regular text → RAG + Claude
  bot.on("message:text", async (ctx) => {
    const query = ctx.message.text;
    if (query.startsWith("/")) return;  // ignore unknown commands
    const user = ctx.telegramUser!;

    // Get or create conversation
    let convId: number;
    const existingTgConv = await db.query.telegramConversations.findFirst({
      where: eq(telegramConversationsTable.telegramUserId, user.id)
    });
    if (existingTgConv?.conversationId) {
      convId = existingTgConv.conversationId;
    } else {
      const [conv] = await db.insert(conversationsTable).values({ userId: null, sessionTitle: `Telegram - ${ctx.from?.first_name}` }).returning();
      await db.insert(telegramConversationsTable).values({ telegramUserId: user.id, conversationId: conv.id });
      convId = conv.id;
    }

    // RAG
    await ctx.replyWithChatAction("typing");
    const chunks = await searchSimilarChunks(query, 5);
    const systemPrompt = buildSystemPrompt(chunks, user.language as 'ar'|'en');

    // History (last 8 messages)
    const history = await db.select().from(chatMessagesTable)
      .where(eq(chatMessagesTable.conversationId, convId))
      .orderBy(desc(chatMessagesTable.createdAt)).limit(8);

    const { content: reply } = await chatWithClaude(
      [...history.reverse().map(m => ({ role: m.role as 'user'|'assistant', content: m.content })),
       { role: 'user', content: query }],
      systemPrompt
    );

    // Save messages
    await db.insert(chatMessagesTable).values([
      { conversationId: convId, role: 'user', content: query },
      { conversationId: convId, role: 'assistant', content: reply,
        sources: JSON.stringify(chunks.map(c => ({ title: c.title_ar || c.title, section: c.section }))) }
    ]);

    // Increment daily count
    await db.update(telegramUsersTable).set({ dailyCount: user.dailyCount + 1 }).where(eq(telegramUsersTable.id, user.id));

    await ctx.reply(reply, { parse_mode: 'Markdown' });
  });

  return bot;
}
```

TELEGRAM ROUTES (routes/telegram.ts):
POST /api/webhook/telegram (NO auth required — Telegram calls this):
  → getOrInitBot() → if null: return 200 (bot disabled)
  → await bot.handleUpdate(req.body) → res.sendStatus(200)

POST /api/webhook/telegram/setup (requireAuth + requireAdmin):
  → token = await getSettingValue('telegram_token')
  → if !token: 400 "Telegram token not configured"
  → appUrl = process.env.REPLIT_DEV_DOMAIN
  → fetch(`https://api.telegram.org/bot${token}/setWebhook`, { url: `https://${appUrl}/api/webhook/telegram` })
  → UPDATE settings SET value='true' WHERE key='telegram_enabled'
  → return { success: true, webhookUrl }

ADMIN TELEGRAM ROUTES:
GET /api/admin/telegram/users → all telegram_users ordered by lastActive DESC
PUT /api/admin/telegram/users/:id/block { isBlocked: boolean }:
  → UPDATE telegram_users SET is_blocked=isBlocked
  → writeAuditLog(isBlocked ? 'bot_user_blocked' : 'bot_user_unblocked')
GET /api/admin/telegram/stats → {
  totalUsers, activeToday (lastActive >= today), messagesToday (sum of dailyCount)
}

PHASE 7 ACCEPTANCE TESTS:
□ POST /api/admin/settings { telegram_token: "...", telegram_enabled: "true" }
□ POST /api/webhook/telegram/setup (admin) → 200 + webhookUrl returned
□ Simulated /start update: POST /api/webhook/telegram → welcome message sent
□ Simulated /lang update → language toggled
□ Simulated /clear update → new conversation created in DB
□ Simulated /stats update → daily count returned
□ Simulated text message → Claude response with Arabic reply
□ Simulated text message (user at daily limit) → limit message
□ PUT /api/admin/telegram/users/:id/block → is_blocked=true in DB
□ Blocked user sends message → blocked message (no Claude call)
□ GET /api/admin/telegram/users → list of users
□ GET /api/admin/telegram/stats → stats object

CREATE FILE: PHASE_7_DONE.md

═══════════════════════════════════════════════════════════════════════════════════
PHASE 8 — WHATSAPP DASHBOARD (FRONTEND)
═══════════════════════════════════════════════════════════════════════════════════

Build artifacts/whatsapp-dashboard/ with:
- React 19 + TypeScript
- Vite 7 (port 5000, proxy /api + /socket.io → localhost:8080)
- Shadcn UI (fully initialized with dark theme)
- Tailwind CSS v4
- wouter (routing)
- Zustand (auth store + lang store)
- TanStack Query v5 (data fetching)
- socket.io-client (real-time)
- Recharts (dashboard chart)
- react-qr-code (QR display)

COLOR TOKENS (CSS Variables):
--background: #0A0A0F    (page background)
--card: #12121A          (card background)
--border: #1E1E2E        (borders)
--primary: #7C3AED       (brand purple)
--primary-foreground: #FFFFFF
--success: #10B981
--warning: #F59E0B
--destructive: #EF4444
--muted: #9CA3AF

FONTS: Google Fonts — Cairo (Arabic headlines + body), JetBrains Mono (code)

VITE CONFIG (vite.config.ts):
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    host: "0.0.0.0",
    allowedHosts: "all",
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true },
      "/socket.io": { target: "http://localhost:8080", ws: true, changeOrigin: true },
    },
  },
});
```

ZUSTAND AUTH STORE:
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}
// persist to localStorage
```

API WRAPPER (lib/api.ts):
```typescript
async function request(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",  // sends httpOnly cookie
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) throw await res.json();
  return res.json();
}
```

SOCKET CLIENT (lib/socket.ts):
```typescript
import { io } from "socket.io-client";
let socket: ReturnType<typeof io> | null = null;
export function getSocket(token: string) {
  if (!socket) {
    socket = io("/", { auth: { token }, transports: ["websocket", "polling"] });
  }
  return socket;
}
```

PAGES TO BUILD:

1. LoginPage (/login):
   - Arabic RTL card centered
   - username + password fields
   - POST /api/auth/login
   - On mustChangePassword=true: redirect to /change-password
   - On success: redirect to /

2. ChangePasswordPage (/change-password):
   - Only accessible when mustChangePassword=true
   - PATCH /api/users/me/password { currentPassword: "123456", newPassword: ... }
   - Password strength indicator

3. DashboardPage (/):
   - 4 stat cards: Total Sessions | Connected | Messages Sent | Messages Received
   - Recharts LineChart: X=date (7 days), Y=count, two lines (sent=blue, received=green)
   - Auto-refresh every 30 seconds (TanStack Query refetchInterval)

4. SessionsPage (/sessions):
   - Table: Name | Phone | Status (badge with colors) | Owner | Actions
   - Status colors: connected=green, disconnected=gray, connecting=yellow, banned=red
   - Actions: View | Connect | Disconnect | Delete (confirm dialog)
   - Create session dialog: { name }

5. SessionDetailPage (/sessions/:id):
   Tabs (Shadcn Tabs component):
   Tab 1 "QR Code":
     - Large status badge
     - If status=connected: show phone number + "Connected" message
     - If status=disconnected: "Connect" button → POST connect → status updates via Socket.IO
     - If status=connecting: show QR image from socket event 'qr:update' (react-qr-code from base64)
     - Real-time status via Socket.IO 'session:status' event

   Tab 2 "Statistics":
     - Cards: totalSent | totalReceived | status | phoneNumber
     - Mini chart if available

   Tab 3 "Messages":
     - Table: direction (↑↓) | from | to | type | content preview | timestamp
     - Pagination (50 per page)

   Tab 4 "Webhook":
     - webhookUrl input
     - webhookSecret input (masked)
     - webhookEvents checkboxes: message | message_ack | message_reaction | status_update | call | disconnected | connected
     - Save button → PATCH /api/sessions/:id/webhook

   Tab 5 "Features":
     - Toggle switches for each feature flag (sendMessages, receiveMessages, sendImages, ...)
     - Auto-save on toggle → PATCH /api/sessions/:id/features

6. UsersPage (/users — admin only):
   - User list table
   - Create user dialog: username, email, password, role, maxSessions
   - PermissionsMatrix component:
     Table with employees as columns, permissions as rows
     Each cell is a Checkbox
     onChange → debounced PATCH /api/users/:id { permissions }

7. ApiKeysPage (/api-keys):
   - Table: name | prefix (8 chars) | allowedSessions | created | lastUsed
   - Create dialog → on success: show plainKey in modal with copy button + warning "shown once only"
   - Delete button with confirmation

8. SendPage (/send):
   - Select session (dropdown of connected sessions)
   - Select type (Tabs: Text | Image | Video | Audio | File | Location | Sticker)
   - To: phone number field (with format hint)
   - Type-specific fields:
     Text: message textarea
     Image/Video/Audio/File: file upload (FileReader → base64) OR URL input toggle
     File: extra filename field
     Location: lat + lng + description fields
     Sticker: file upload
   - Send button → POST /api/send/{type}
   - Success/error toast

GLOBAL COMPONENTS:
- Layout: Sidebar (links + user info + logout) + main content
- LanguageToggle: AR/EN toggle in header
- ThemeToggle: Light/Dark in header
- StatusBadge: colored badge by session status
- ConfirmDialog: reusable delete confirmation

PHASE 8 ACCEPTANCE TESTS:
□ http://localhost:5000 → redirects to /login
□ Login with admin/123456 → redirects to /change-password (mustChangePassword=true)
□ Change password → redirects to /
□ Dashboard shows 4 cards + chart with 7 data points
□ Sessions page lists 3 seeded sessions
□ Click Connect on session → status changes to "connecting"
□ QR code appears in 5-10 seconds (Socket.IO)
□ QR updates automatically when wppconnect generates new one
□ After WhatsApp scan → status turns "connected" (Socket.IO event)
□ Send Text → success toast + message appears in Messages tab
□ Send Image via file upload → base64 sent + success
□ Users page (admin only) → shows all 4 users
□ PermissionsMatrix: toggle permission → saved immediately
□ API Keys: create → plainKey shown once in modal
□ Language toggle: all UI text switches AR ↔ EN
□ Dark/Light mode: persists after page refresh (localStorage)
□ Responsive: sidebar collapses on mobile

CREATE FILE: PHASE_8_DONE.md

═══════════════════════════════════════════════════════════════════════════════════
PHASE 9 — EDUCATIONAL PLATFORM (FRONTEND)
═══════════════════════════════════════════════════════════════════════════════════

Build artifacts/claude-education/ with:
- React 19 + TypeScript
- Vite (port 5001, proxy /api → localhost:8080)
- Tailwind CSS v4
- react-i18next (Arabic default, English optional)
- wouter (routing)
- Zustand (auth + theme)
- TanStack Query v5
- Dark Mode default

FONT: Cairo (all text, Arabic + English — Cairo supports Latin too)

i18n SETUP:
ar.json — all UI strings in Arabic
en.json — all UI strings in English
Default: 'ar' | useTranslation hook everywhere

PAGES:

1. HomePage (/): 
   Hero section with gradient title "تعلّم Claude Code بالعربية"
   Feature cards: AI Chat | Learning Paths | Resources
   Stats: total users, total questions, total resources
   CTA buttons: Login + Register

2. LoginPage (/login):
   RTL card, Cairo font, username+password
   POST /api/auth/login

3. RegisterPage (/register):
   username + email + password + confirmPassword
   POST /api/users (open registration — no admin required)
   Then auto-login

4. ChatPage (/chat):
   LEFT panel (250px): Conversation list + "New Conversation" button
   RIGHT panel: Chat area
   Chat bubbles: user=right+purple gradient | assistant=left+dark card
   Under each assistant message: SourceCards (clickable → opens resource URL)
   SourceCard: section title + small excerpt
   Input area: textarea (auto-resize) + send button
   Loading: animated "يكتب..." dots
   TanStack Query: optimistic updates

5. LearnPage (/learn):
   Header: overall progress bar (progressPercent from /api/profile/stats)
   Section cards: section title + progressPercent badge + chunk count
   Color coding: beginner=green | intermediate=yellow | advanced=red

6. SectionPage (/learn/:sectionId):
   Back button
   Chunk cards:
     Title + Arabic content (expandable)
     "Mark as Read" button → POST /api/content/progress/:chunkId
     Read chunks: green border + checkmark
   Search bar (client-side filter)

7. ProfilePage (/profile):
   Avatar placeholder (initials)
   Stats: totalConversations | totalQuestions | progressPercent
   Today's usage progress bar (dailyCount / maxMessagesPerDay)
   Change password form

8. ResourcesPage (/resources):
   Filter bar: All | Official | Research | Article | Tool | Video
   Language filter: All | Arabic | English
   Featured resources row (horizontal scroll)
   Resource cards: title | description | source | type badge | view button | translate button
   Translate button: opens modal with Claude translation (POST /api/resources/:id/translate)
   Suggest resource form (collapsible) → POST /api/resources/suggest

9. AdminPage (/admin):
   Stats overview (totalUsers, totalConversations, totalChunks, importLastRun)
   Import button → POST /api/admin/import + progress indicator
   Quick links to sub-pages

10. AdminUsersPage (/admin/users):
    Users table with edit/delete
    Create user dialog

11. AdminSettingsPage (/admin/settings):
    Section: App Settings (app_name, max_messages_per_day, ai_model)
    Section: Telegram Bot:
      - Toggle (enable/disable)
      - Token input (password field + show/hide)
      - "Save & Activate Webhook" button → PUT settings + POST /api/webhook/telegram/setup
      - Welcome messages (AR + EN)
      - Max daily limit
      - Today's stats badge
      - Link to "View Telegram Users"
    Section: n8n Integration:
      - "Download n8n Workflow" button → GET /api/n8n-workflow/download

12. AdminResourcesPage (/admin/resources):
    Full CRUD table
    Toggle visibility/featured buttons
    Suggestions list with approve/reject

GLOBAL:
- RTL support (dir="rtl" on html, conditional)
- ThemeToggle: Dark/Light (CSS variables)
- LanguageToggle: AR/EN (react-i18next)
- Toast notifications (success/error)
- Mobile responsive

PHASE 9 ACCEPTANCE TESTS:
□ http://localhost:5001 → homepage in Arabic Dark Mode
□ Login → redirects to /chat
□ New conversation → send message → Claude reply in Arabic
□ Sources show under assistant reply (clickable links)
□ /learn → sections with progress bars
□ Mark chunk as read → progressPercent increases
□ /resources → 6 cards
□ Translate button → Arabic translation in modal
□ /profile → stats correct
□ /admin/settings → Telegram section functional
□ Save token + activate → Webhook set + telegram_enabled=true
□ Download n8n Workflow → JSON file downloaded
□ Toggle language → all UI switches AR/EN
□ Toggle dark/light → persists in localStorage
□ Mobile view: navigation collapses, readable on phone

CREATE FILE: PHASE_9_DONE.md

═══════════════════════════════════════════════════════════════════════════════════
PHASE 10 — DOCKER + PRODUCTION DEPLOYMENT
═══════════════════════════════════════════════════════════════════════════════════

CREATE ALL FILES:

Dockerfile.api:
FROM node:20-slim
RUN apt-get update && apt-get install -y chromium fonts-liberation libappindicator3-1 \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libdrm2 \
    libgbm1 libgtk-3-0 libnspr4 libnss3 libxcomposite1 libxdamage1 libxfixes3 \
    libxkbcommon0 libxrandr2 xdg-utils --no-install-recommends && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY lib/db/package.json ./lib/db/
COPY artifacts/api-server/package.json ./artifacts/api-server/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @workspace/api-server build
EXPOSE 8080
CMD ["node", "artifacts/api-server/dist/index.js"]

Dockerfile.dashboard:
FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY lib/*/package.json ./lib/
COPY artifacts/whatsapp-dashboard/package.json ./artifacts/whatsapp-dashboard/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @workspace/whatsapp-dashboard build
FROM nginx:alpine
COPY --from=builder /app/artifacts/whatsapp-dashboard/dist /usr/share/nginx/html
COPY nginx-dashboard.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

Dockerfile.education: (same pattern as dashboard but for claude-education)

docker-compose.yml (production — port 5005):
version: "3.9"
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes: [postgres_data:/var/lib/postgresql/data]
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s; timeout: 5s; retries: 5

  api:
    build: { context: ., dockerfile: Dockerfile.api }
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      JWT_SECRET: ${JWT_SECRET}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      NODE_ENV: production
      APP_PORT: 8080
    depends_on: { db: { condition: service_healthy } }
    restart: unless-stopped
    volumes: [./tokens:/app/tokens]
    command: sh -c "pnpm --filter @workspace/db push && node artifacts/api-server/dist/index.js"

  dashboard:
    build: { context: ., dockerfile: Dockerfile.dashboard }
    restart: unless-stopped

  education:
    build: { context: ., dockerfile: Dockerfile.education }
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports: ["5005:80"]
    volumes: [./nginx.conf:/etc/nginx/conf.d/default.conf:ro]
    depends_on: [api, dashboard, education]
    restart: unless-stopped

volumes:
  postgres_data:

nginx.conf:
server {
  listen 80;
  client_max_body_size 50m;

  # API + WebSocket
  location /api/ {
    proxy_pass http://api:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
  }

  location /socket.io/ {
    proxy_pass http://api:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }

  # WhatsApp Dashboard (default)
  location / {
    proxy_pass http://dashboard:80;
    proxy_set_header Host $host;
  }

  # Educational Platform
  location /education/ {
    proxy_pass http://education:80/;
    proxy_set_header Host $host;
  }
}

.env.example:
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/claude_manager_db
POSTGRES_USER=wauser
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=claude_manager_db

# ── API Security ──────────────────────────────────────────────────────────────
JWT_SECRET=generate_with_openssl_rand_hex_48
APP_PORT=8080

# ── CORS ──────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS=https://your-domain.com

# ── Claude AI ─────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── Email (optional) ──────────────────────────────────────────────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@email.com
EMAIL_PASS=your_app_password

# ── WhatsApp ──────────────────────────────────────────────────────────────────
# CHROME_PATH=  # Optional — auto-detected if not set

# ── GitHub (optional — increases API rate limit) ──────────────────────────────
# GITHUB_TOKEN=

# ── Deployment ────────────────────────────────────────────────────────────────
NODE_ENV=production
APP_URL=your-domain.com

Windows Batch Scripts (scripts/windows/):

start_wa.bat: (First-time setup)
@echo off
chcp 65001
echo ╔══════════════════════════════════════╗
echo ║   WhatsApp Manager — تثبيت أول مرة   ║
echo ╚══════════════════════════════════════╝
if not exist ".env" (
  copy ".env.example" ".env"
  echo ⚠️  تم إنشاء .env — يرجى تعديله بإضافة JWT_SECRET و ANTHROPIC_API_KEY
  notepad .env
  pause
)
docker-compose -f docker-compose.yml build --no-cache
docker-compose -f docker-compose.yml up -d
echo ✅ النظام يعمل على: http://localhost:5005
echo    تسجيل الدخول: admin / 123456
pause

update_wa.bat: (Update)
@echo off
git pull origin main
docker-compose -f docker-compose.yml build --no-cache
docker-compose -f docker-compose.yml up -d
echo ✅ تم التحديث
pause

run_wa.bat: (Daily start)
@echo off
docker-compose -f docker-compose.yml up -d
echo ✅ النظام يعمل على: http://localhost:5005
timeout /t 3

reset_wa.bat: (Reset data)
@echo off
echo ⚠️  سيتم حذف جميع البيانات وإعادة ضبط admin/123456
set /p confirm="اكتب YES للتأكيد: "
if /i "%confirm%"=="YES" (
  docker-compose down -v
  docker-compose up -d
  echo ✅ تمت إعادة الضبط — تسجيل الدخول: admin / 123456
)
pause

cleanup_wa.bat: (Full uninstall)
@echo off
echo ⚠️  سيتم حذف النظام والبيانات بالكامل
set /p confirm="اكتب DELETE للتأكيد: "
if /i "%confirm%"=="DELETE" (
  docker-compose down -v --rmi all
  rmdir /s /q tokens
  echo ✅ تم حذف النظام بالكامل
)
pause

PHASE 10 ACCEPTANCE TESTS:
□ docker-compose up -d → all 5 containers healthy
□ http://localhost:5005 → WhatsApp dashboard
□ http://localhost:5005/education/ → Educational platform
□ http://localhost:5005/api/healthz → { status: "ok" }
□ Socket.IO works through Nginx (WebSocket upgrade headers correct)
□ .env.example has all required variables with clear comments
□ start_wa.bat runs on Windows without errors
□ reset_wa.bat resets data and admin/123456 works
□ update_wa.bat: git pull + rebuild works
□ Production: NODE_ENV=production → secure cookies ON
□ Production: helmet fully active
□ pgvector extension loads correctly in Docker PostgreSQL image
□ Tokens volume persists across container restarts

CREATE FILE: PHASE_10_DONE.md

═══════════════════════════════════════════════════════════════════════════════════
FINAL VALIDATION — COMPLETE SYSTEM TEST
═══════════════════════════════════════════════════════════════════════════════════

After all 10 phases, run this complete end-to-end test:

1. Start system: docker-compose up -d (or pnpm dev in Replit)
2. Open http://localhost:5005
3. Login: admin / 123456
4. Change password to: Admin@2026 (meets complexity requirements)
5. Dashboard shows 7-day chart
6. Create new WhatsApp session "Test Session"
7. Connect session → QR appears in 10s via Socket.IO
8. Go to Send page → send "Hello" text to test number
9. Check Messages tab → message appears
10. Set webhook URL for session
11. Open educational platform at http://localhost:5005/education/
12. Login → go to /chat
13. Ask "ما هو Claude Code؟" → get Arabic response with sources
14. Check /learn → sections with progress
15. Mark a chunk as read → progress updates
16. Go to /resources → 6 resources listed
17. Translate a resource title → Arabic translation appears
18. Open admin settings → enter Telegram token → save + activate
19. Send /start to the bot → receive welcome message
20. Send a question → receive Claude response via Telegram
21. Download n8n workflow → valid JSON file
22. Create employee user with limited permissions
23. Login as employee → verify limited access
24. Check audit_logs → all 24 operations logged

If ALL tests pass: THE SYSTEM IS PRODUCTION READY ✅

═══════════════════════════════════════════════════════════════════════════════════
IMPORTANT TECHNICAL CONSTRAINTS (DO NOT DEVIATE)
═══════════════════════════════════════════════════════════════════════════════════

1. NEVER hardcode Chrome path — always use resolveChromePath()
2. NEVER show passwordHash or keyHash in any API response
3. NEVER skip mustChangePassword middleware
4. NEVER allow private URLs in webhook configuration (SSRF protection)
5. NEVER use polling for Socket.IO in production — always attempt WebSocket first
6. NEVER store Telegram token in .env — always in settings table (admin-configurable)
7. ALWAYS use bcrypt(10) for passwords AND api_keys
8. ALWAYS validate phone numbers with E.164 rules before sending
9. ALWAYS validate GPS coordinates (NaN, Infinity, range) before sending
10. ALWAYS clean up temp files in finally blocks (base64 media)
11. ALWAYS use trust proxy=1 (required for Replit mTLS)
12. ALWAYS use keyPrefix (first 8 chars) for O(1) API key pre-filtering
13. ALWAYS run reconnectOnBoot() on server startup for autoReconnect sessions
14. ALWAYS write audit_log for: login, logout, createSession, deleteSession,
    connectSession, disconnectSession, sendText, sendImage, sendVideo, sendAudio,
    sendFile, sendLocation, sendSticker, bot_enabled, bot_disabled, bot_user_blocked
15. The database MUST use Drizzle ORM with push schema (NO migrations workflow)
16. The monorepo MUST use pnpm workspaces (NO npm, NO yarn)
17. Everything MUST be TypeScript (NO plain JavaScript files except config where required)
18. Default language: Arabic (RTL), Default theme: Dark Mode
19. Cookie: httpOnly=true, secure=true on Replit/production, sameSite='lax'
20. Socket.IO rooms: each user should only receive events for their own sessions

═══════════════════════════════════════════════════════════════════════════════════
START WITH PHASE 1. DO NOT SKIP PHASES. DO NOT PROCEED TO NEXT PHASE UNTIL
ALL ACCEPTANCE TESTS PASS AND PHASE_X_DONE.md IS CREATED.
═══════════════════════════════════════════════════════════════════════════════════
```
