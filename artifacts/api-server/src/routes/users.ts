import { Router, Request, Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { requireAuth, requireAdmin, hashPassword, verifyPassword } from "../lib/auth.js";
import { validatePasswordComplexity } from "../lib/validate.js";
import type { User } from "@workspace/db";

const router = Router();

const safeUser = (user: User) => {
  const { passwordHash, ...rest } = user;
  return rest;
};

// GET /api/users — Admin only
router.get("/", requireAuth, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const users = await db.select().from(usersTable);
  res.json(users.map(safeUser));
});

// POST /api/users — Admin only
router.post("/", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { username, email, password, role, permissions, maxSessions } = req.body as {
    username: string;
    email?: string;
    password: string;
    role: string;
    permissions?: object;
    maxSessions?: number;
  };
  
  const complexityError = validatePasswordComplexity(password);
  if (complexityError) {
    res.status(400).json({ error: complexityError });
    return;
  }
  
  const passwordHash = hashPassword(password);
  const [newUser] = await db.insert(usersTable).values({
    username,
    email,
    passwordHash,
    role: role || "employee",
    permissions: permissions ? JSON.stringify(permissions) : null,
    maxSessions: maxSessions ?? null,
    isActive: true,
    mustChangePassword: false,
  }).returning();
  
  res.status(201).json(safeUser(newUser));
});

// PATCH /api/users/me/password — MUST come before /:id
router.patch("/me/password", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  
  const complexityError = validatePasswordComplexity(newPassword);
  if (complexityError) {
    res.status(400).json({ error: complexityError });
    return;
  }
  
  await db.update(usersTable).set({
    passwordHash: hashPassword(newPassword),
    mustChangePassword: false,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, user.id));
  
  res.json({ success: true });
});

// PATCH /api/users/me — own data — MUST come before /:id
router.patch("/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  const { email } = req.body as { email?: string };
  
  const [updated] = await db.update(usersTable)
    .set({ email, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id))
    .returning();
  res.json(safeUser(updated));
});

// GET /api/users/:id
router.get("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const currentUser = (req as Request & { user: User }).user;
  const targetId = parseInt(req.params.id);
  
  if (currentUser.role !== "admin" && currentUser.id !== targetId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  
  res.json(safeUser(user));
});

// PATCH /api/users/:id — Admin only
router.patch("/:id", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { username, email, role, permissions, maxSessions, isActive } = req.body as Record<string, unknown>;
  
  const updates: Partial<User> = {};
  if (username) updates.username = username as string;
  if (email !== undefined) updates.email = email as string;
  if (role) updates.role = role as string;
  if (permissions !== undefined) updates.permissions = JSON.stringify(permissions);
  if (maxSessions !== undefined) updates.maxSessions = maxSessions as number;
  if (isActive !== undefined) updates.isActive = isActive as boolean;
  updates.updatedAt = new Date();
  
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(safeUser(updated));
});

// DELETE /api/users/:id — Admin only
router.delete("/:id", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ success: true });
});

export default router;
