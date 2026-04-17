import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Link } from "wouter";
import { ArrowRight, ArrowLeft, Search, RefreshCw, Shield } from "lucide-react";

interface AuditLog {
  id: number;
  userId: number;
  username: string;
  action: string;
  details?: string;
  ipAddress?: string;
  timestamp: string;
}

interface LogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
}

const ACTION_COLORS: Record<string, string> = {
  login: "bg-green-500/20 text-green-400",
  logout: "bg-muted text-muted-foreground",
  import: "bg-blue-500/20 text-blue-400",
  "settings.update": "bg-yellow-500/20 text-yellow-400",
  "user.delete": "bg-red-500/20 text-red-400",
  "user.update": "bg-orange-500/20 text-orange-400",
  sendText: "bg-purple-500/20 text-purple-400",
  sendMedia: "bg-purple-500/20 text-purple-400",
};

export default function AdminLogsPage() {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch, isFetching } = useQuery<LogsResponse>({
    queryKey: ["admin-logs", page, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("username", search);
      return api.get(`/admin/audit-logs?${params}`);
    },
  });

  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <button className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <BackIcon className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{isAr ? "سجلات النظام" : "System Logs"}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {data?.total ?? 0} {isAr ? "سجل إجمالي" : "total records"}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-5 h-5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="relative">
        <Search className={`absolute ${isAr ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder={isAr ? "بحث باسم المستخدم..." : "Search by username..."}
          className={`w-full py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary ${isAr ? "pr-10 pl-4" : "pl-10 pr-4"}`}
        />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !data?.logs?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{isAr ? "لا توجد سجلات" : "No logs found"}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className={`${isAr ? "text-right" : "text-left"} px-4 py-3 text-sm font-medium text-muted-foreground`}>{isAr ? "المستخدم" : "User"}</th>
                    <th className={`${isAr ? "text-right" : "text-left"} px-4 py-3 text-sm font-medium text-muted-foreground`}>{isAr ? "الإجراء" : "Action"}</th>
                    <th className={`${isAr ? "text-right" : "text-left"} px-4 py-3 text-sm font-medium text-muted-foreground`}>{isAr ? "التفاصيل" : "Details"}</th>
                    <th className={`${isAr ? "text-right" : "text-left"} px-4 py-3 text-sm font-medium text-muted-foreground`}>IP</th>
                    <th className={`${isAr ? "text-right" : "text-left"} px-4 py-3 text-sm font-medium text-muted-foreground`}>{isAr ? "التاريخ" : "Date"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map(log => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium">{log.username}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${ACTION_COLORS[log.action] || "bg-muted text-muted-foreground"}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                        {log.details || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono text-xs">
                        {log.ipAddress || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString(isAr ? "ar" : "en")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-border">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg bg-muted text-sm disabled:opacity-50 hover:bg-muted/80 transition-colors"
                >
                  {isAr ? "السابق" : "Previous"}
                </button>
                <span className="text-sm text-muted-foreground">
                  {page} / {data.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  className="px-3 py-1.5 rounded-lg bg-muted text-sm disabled:opacity-50 hover:bg-muted/80 transition-colors"
                >
                  {isAr ? "التالي" : "Next"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
