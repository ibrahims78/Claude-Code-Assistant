import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { io } from "socket.io-client";

interface Session {
  id: string;
  name: string;
  status: string;
  phoneNumber?: string;
  webhookUrl?: string;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  autoReconnect: boolean;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500 animate-pulse",
  disconnected: "bg-red-500",
  banned: "bg-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  connected: "متصل",
  connecting: "يتصل...",
  disconnected: "منقطع",
  banned: "محظور",
};

interface QrModalProps {
  qr: string;
  sessionId: string;
  onClose: () => void;
}

function QrModal({ qr, sessionId, onClose }: QrModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-2xl p-8 max-w-sm w-full mx-4 qr-container" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-center mb-2">امسح رمز QR</h3>
        <p className="text-muted-foreground text-sm text-center mb-6">افتح واتساب على هاتفك وامسح الرمز</p>
        <div className="flex justify-center">
          <img src={qr} alt="QR Code" className="w-64 h-64 rounded-xl" />
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">الجلسة: {sessionId}</p>
        <button onClick={onClose} className="w-full mt-4 py-2 rounded-xl border border-border text-muted-foreground hover:bg-muted transition-all text-sm">
          إغلاق
        </button>
      </div>
    </div>
  );
}

export default function SessionsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState<{ sessionId: string; qr: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWebhook, setNewWebhook] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await api.get<Session[]>("/sessions");
      setSessions(data);
    } catch (err) {
      toast({ title: "خطأ في جلب الجلسات", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();

    // Socket.IO for real-time updates
    const apiUrl = import.meta.env.PROD ? "" : (import.meta.env.VITE_API_URL || "");
    const socket = io(apiUrl, { path: "/socket.io", withCredentials: true });

    socket.on("qr:update", ({ sessionId, qr }: { sessionId: string; qr: string }) => {
      setQrData({ sessionId, qr });
    });

    socket.on("session:status", ({ sessionId, status }: { sessionId: string; status: string }) => {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status } : s));
      if (status === "connected") setQrData(null);
    });

    socket.on("message:new", () => fetchSessions());

    return () => { socket.disconnect(); };
  }, []);

  const handleConnect = async (id: string) => {
    try {
      await api.post(`/sessions/${id}/connect`);
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: "connecting" } : s));
      toast({ title: "جاري الاتصال..." });
    } catch (err) {
      toast({ title: "خطأ في الاتصال", description: String(err), variant: "destructive" });
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await api.post(`/sessions/${id}/disconnect`);
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: "disconnected" } : s));
      toast({ title: "تم قطع الاتصال" });
    } catch (err) {
      toast({ title: "خطأ", description: String(err), variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل تريد حذف هذه الجلسة؟")) return;
    try {
      await api.delete(`/sessions/${id}`);
      setSessions(prev => prev.filter(s => s.id !== id));
      toast({ title: "تم حذف الجلسة" });
    } catch (err) {
      toast({ title: "خطأ في الحذف", description: String(err), variant: "destructive" });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const session = await api.post<Session>("/sessions", { name: newName, webhookUrl: newWebhook || undefined });
      setSessions(prev => [...prev, session]);
      setShowCreate(false);
      setNewName("");
      setNewWebhook("");
      toast({ title: "تم إنشاء الجلسة بنجاح" });
    } catch (err) {
      toast({ title: "خطأ في الإنشاء", description: String(err), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {qrData && <QrModal qr={qrData.qr} sessionId={qrData.sessionId} onClose={() => setQrData(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الجلسات</h1>
          <p className="text-muted-foreground text-sm mt-1">{sessions.length} جلسة مُسجَّلة</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all text-sm">
          <span>+</span> إضافة جلسة
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">إضافة جلسة جديدة</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input value={newName} onChange={e => setNewName(e.target.value)} required placeholder="اسم الجلسة"
              className="px-4 py-2.5 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
            <input value={newWebhook} onChange={e => setNewWebhook(e.target.value)} placeholder="رابط Webhook (اختياري)"
              className="px-4 py-2.5 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
            <div className="flex gap-2">
              <button type="submit" disabled={creating}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-60 text-sm">
                {creating ? "جاري..." : "إنشاء"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-sm">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sessions grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">📱</p>
          <p className="text-muted-foreground">لا توجد جلسات. أضف جلستك الأولى!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sessions.map(session => (
            <div key={session.id} className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[session.status] || "bg-gray-500"}`} />
                    <h3 className="font-semibold text-foreground">{session.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {STATUS_LABELS[session.status] || session.status}
                    {session.phoneNumber && ` • ${session.phoneNumber}`}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 opacity-60">{session.id}</p>
                </div>
              </div>

              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>📤 {session.totalMessagesSent}</span>
                <span>📥 {session.totalMessagesReceived}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setLocation(`/sessions/${session.id}`)}
                  className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-medium transition-all"
                >
                  تفاصيل
                </button>
                {session.status === "connected" ? (
                  <button onClick={() => handleDisconnect(session.id)}
                    className="flex-1 py-2 rounded-lg border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 text-xs font-medium transition-all">
                    قطع الاتصال
                  </button>
                ) : session.status === "connecting" ? (
                  <button disabled className="flex-1 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium">
                    جاري الاتصال...
                  </button>
                ) : (
                  <button onClick={() => handleConnect(session.id)}
                    className="flex-1 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 text-xs font-medium transition-all">
                    اتصال
                  </button>
                )}
                <button onClick={() => handleDelete(session.id)}
                  className="px-3 py-2 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs transition-all">
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
