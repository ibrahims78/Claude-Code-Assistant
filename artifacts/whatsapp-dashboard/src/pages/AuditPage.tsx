import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AuditLog {
  id: number;
  username?: string;
  action: string;
  sessionId?: string;
  ipAddress?: string;
  timestamp: string;
  details?: string;
}

const ACTION_COLORS: Record<string, string> = {
  login: "text-green-400",
  logout: "text-gray-400",
  createSession: "text-blue-400",
  deleteSession: "text-red-400",
  connectSession: "text-purple-400",
  disconnectSession: "text-orange-400",
  sendText: "text-teal-400",
  sendImage: "text-teal-300",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async (p: number) => {
    setLoading(true);
    try {
      const data = await api.get<{ logs: AuditLog[]; totalPages: number }>(`/dashboard/audit-logs?page=${p}&limit=50`);
      setLogs(data.logs);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(page); }, [page]);

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">سجل الأحداث</h1>
        <p className="text-muted-foreground text-sm mt-1">تتبع جميع العمليات في النظام</p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">الوقت</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">المستخدم</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">الحدث</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">الجلسة</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">جاري التحميل...</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3 text-muted-foreground text-xs">
                  {new Date(log.timestamp).toLocaleString("ar-SA")}
                </td>
                <td className="px-5 py-3 font-medium">{log.username || "—"}</td>
                <td className="px-5 py-3">
                  <span className={`font-medium ${ACTION_COLORS[log.action] || "text-foreground"}`}>{log.action}</span>
                </td>
                <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{log.sessionId || "—"}</td>
                <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{log.ipAddress || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl border border-border hover:bg-muted disabled:opacity-50 text-sm">
            السابق
          </button>
          <span className="px-4 py-2 text-sm text-muted-foreground">
            صفحة {page} من {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 rounded-xl border border-border hover:bg-muted disabled:opacity-50 text-sm">
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
