import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { db, usersTable, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { User } from "@workspace/db";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const SALT_ROUNDS = 10;

export const hashPassword = (password: string): string => bcrypt.hashSync(password, SALT_ROUNDS);
export const verifyPassword = (plain: string, hash: string): boolean => bcrypt.compareSync(plain, hash);

export const generateToken = (userId: number, role: string): string =>
  jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d", algorithm: "HS256" });

export const verifyToken = (token: string): { userId: number; role: string } | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
  } catch {
    return null;
  }
};

export const hasPermission = (user: User, permission: string): boolean => {
  if (user.role === "admin") return true;
  try {
    const perms = JSON.parse(user.permissions || "{}");
    return perms[permission] !== false;
  } catch {
    return true;
  }
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let userId: number | null = null;

  // 1. Check httpOnly cookie
  const cookieToken = req.cookies?.session_token;
  if (cookieToken) {
    const payload = verifyToken(cookieToken);
    if (payload) userId = payload.userId;
  }

  // 2. Check Authorization header
  if (!userId) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = verifyToken(token);
      if (payload) userId = payload.userId;
    }
  }

  // 3. Check X-API-Key header
  if (!userId) {
    const apiKey = req.headers["x-api-key"] as string | undefined;
    if (apiKey) {
      const keyPrefix = apiKey.slice(0, 8);
      const candidates = await db.select().from(apiKeysTable).where(eq(apiKeysTable.keyPrefix, keyPrefix));
      for (const candidate of candidates) {
        if (bcrypt.compareSync(apiKey, candidate.keyHash)) {
          // Update last_used_at
          await db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, candidate.id));
          // Check session restrictions
          const reqPath = req.path;
          const sessionIdFromPath = req.params?.sessionId || req.params?.id;
          if (candidate.allowedSessionIds) {
            const allowed = JSON.parse(candidate.allowedSessionIds) as string[];
            const bodySessionId = (req.body as Record<string, unknown>)?.sessionId as string | undefined;
            const targetSession = sessionIdFromPath || bodySessionId;
            if (targetSession && !allowed.includes(targetSession) && !reqPath.includes("healthz") && !reqPath.includes("dashboard") && !reqPath.includes("auth")) {
              res.status(403).json({ error: "API key not authorized for this session" });
              return;
            }
          }
          userId = candidate.userId;
          break;
        }
      }
    }
  }

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Get user
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  (req as Request & { user: User }).user = user;

  // Check mustChangePassword
  // req.path is the LOCAL path after router prefix stripping:
  //   /api/auth/me       → req.path = "/me"
  //   /api/auth/login    → req.path = "/login"
  //   /api/users/me/password → req.path = "/me/password"
  if (user.mustChangePassword) {
    const allowedPaths = ["/login", "/logout", "/me", "/me/password"];
    const isAllowed = allowedPaths.some(p => req.path === p);
    if (!isAllowed) {
      res.status(403).json({ error: "Password change required", mustChangePassword: true });
      return;
    }
  }

  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as Request & { user: User }).user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden — admin access required" });
    return;
  }
  next();
};
