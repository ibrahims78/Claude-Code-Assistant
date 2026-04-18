import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import fs from "fs";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { apiRateLimiter } from "./lib/rate-limit.js";

const app: Express = express();

// Trust proxy (Replit / Cloud reverse proxy)
app.set("trust proxy", 1);

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
  frameguard: false,
}));

// CORS — allow all Replit domains + localhost
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const ok =
      /\.replit\.dev$/.test(origin) ||
      /\.repl\.co$/.test(origin) ||
      origin.startsWith("http://localhost");
    callback(null, ok ? origin : false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
}));

// Body parsing (50MB for base64 media)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// HTTP request logging
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Rate limiting for all API routes
app.use("/api/", apiRateLimiter);

// All routes
app.use("/api", router);

// Serve static images downloaded from GitHub
const imagesDir = path.join(process.cwd(), "data", "images");
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
app.use("/api/static/images", express.static(imagesDir, { maxAge: "1h" }));

// Proxy frontend apps (preserve full path since Vite base includes the prefix)
app.use("/education", createProxyMiddleware({
  target: "http://localhost:25013",
  changeOrigin: true,
  ws: true,
  pathRewrite: (path) => `/education${path}`,
}));

app.use("/whatsapp", createProxyMiddleware({
  target: "http://localhost:23097",
  changeOrigin: true,
  ws: true,
  pathRewrite: (path) => `/whatsapp${path}`,
}));

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
