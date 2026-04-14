import { Router, Request, Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { verifyPassword, generateToken } from "../lib/auth.js";
import { loginRateLimiter } from "../lib/rate-limit.js";
import { writeAuditLog } from "../lib/audit.js";
import type { User } from "@workspace/db";

const router = Router();

const safeUser = (user: User) => {
  const { passwordHash, ...rest } = user;
  return rest;
};

router.post("/login", loginRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username: string; password: string };
  
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  
  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.username, username));
  
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  
  const token = generateToken(user.id, user.role);
  
  const isSecure = process.env.NODE_ENV === "production" || !!process.env.REPLIT_DEV_DOMAIN;
  res.cookie("session_token", token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  
  await writeAuditLog({
    userId: user.id,
    username: user.username,
    action: "login",
    ipAddress: req.ip,
  });
  
  res.json({ token, user: { ...safeUser(user), mustChangePassword: user.mustChangePassword } });
});

router.post("/logout", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  res.clearCookie("session_token");
  
  await writeAuditLog({
    userId: user.id,
    username: user.username,
    action: "logout",
    ipAddress: req.ip,
  });
  
  res.json({ success: true });
});

router.get("/me", requireAuth, (req: Request, res: Response): void => {
  const user = (req as Request & { user: User }).user;
  res.json(safeUser(user));
});

export default router;
