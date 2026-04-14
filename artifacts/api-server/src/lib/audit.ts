import { db, auditLogsTable } from "@workspace/db";

export async function writeAuditLog(params: {
  userId?: number;
  username?: string;
  action: string;
  sessionId?: string | null;
  details?: object;
  ipAddress?: string;
}): Promise<void> {
  await db.insert(auditLogsTable).values({
    userId: params.userId,
    username: params.username,
    action: params.action,
    sessionId: params.sessionId ?? null,
    details: params.details ? JSON.stringify(params.details) : null,
    ipAddress: params.ipAddress,
    timestamp: new Date(),
  });
}
