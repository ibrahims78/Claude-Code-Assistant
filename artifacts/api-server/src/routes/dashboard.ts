import { Router, Request, Response } from "express";
import { db, whatsappSessionsTable, messagesTable, auditLogsTable } from "@workspace/db";
import { eq, gte, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import type { User } from "@workspace/db";

const router = Router();

// GET /api/dashboard/stats
router.get("/stats", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: User }).user;
  
  let sessions;
  if (user.role === "admin") {
    sessions = await db.select().from(whatsappSessionsTable);
  } else {
    sessions = await db.select().from(whatsappSessionsTable)
      .where(eq(whatsappSessionsTable.userId, user.id));
  }
  
  const sessionIds = sessions.map(s => s.id);
  const totalSent = sessions.reduce((sum, s) => sum + (s.totalMessagesSent || 0), 0);
  const totalReceived = sessions.reduce((sum, s) => sum + (s.totalMessagesReceived || 0), 0);
  const connectedSessions = sessions.filter(s => s.status === "connected").length;
  
  // Build 7-day stats
  const today = new Date();
  const dailyStats = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dailyStats.push({ date: date.toISOString().slice(0, 10), sent: 0, received: 0 });
  }
  
  if (sessionIds.length > 0) {
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    
    const msgStats = await db.execute(
      sql`SELECT DATE(timestamp) as day, direction, COUNT(*) as count 
          FROM messages 
          WHERE timestamp >= ${sevenDaysAgo.toISOString()} 
          AND session_id = ANY(${sessionIds})
          GROUP BY day, direction`
    );
    
    for (const row of msgStats.rows as Array<{ day: string; direction: string; count: string }>) {
      const dayStr = row.day.toString().slice(0, 10);
      const entry = dailyStats.find(d => d.date === dayStr);
      if (entry) {
        if (row.direction === "outbound") entry.sent += parseInt(row.count);
        else entry.received += parseInt(row.count);
      }
    }
  }
  
  res.json({
    totalSessions: sessions.length,
    connectedSessions,
    disconnectedSessions: sessions.length - connectedSessions,
    totalSent,
    totalReceived,
    dailyStats,
  });
});

// GET /api/audit-logs — Admin only
router.get("/audit-logs", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;
  
  const total = await db.execute(sql`SELECT COUNT(*) as count FROM audit_logs`);
  const logs = await db.select().from(auditLogsTable)
    .orderBy(sql`timestamp DESC`)
    .limit(limit)
    .offset(offset);
  
  const totalCount = parseInt((total.rows[0] as { count: string }).count);
  
  res.json({
    logs,
    total: totalCount,
    page,
    totalPages: Math.ceil(totalCount / limit),
  });
});

export default router;
