import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Session { id: string; name: string; status: string; }
interface Message {
  id: number;
  sessionId: string;
  direction: string;
  fromNumber: string;
  toNumber: string;
  messageType: string;
  content?: string;
  timestamp: string;
}

export default function MessagesPage() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendMsg, setSendMsg] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get<Session[]>("/sessions").then(setSessions);
  }, []);

  const loadMessages = async (sessionId: string) => {
    setSelectedSession(sessionId);
    setLoading(true);
    try {
      const data = await api.get<Message[]>(`/sessions/${sessionId}/messages?limit=100`);
      setMessages(data);
    } catch {
      toast({ title: "خطأ في جلب الرسائل", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !sendTo || !sendMsg) return;
    setSending(true);
    try {
      await api.post("/send/text", { sessionId: selectedSession, to: sendTo, message: sendMsg });
      toast({ title: "تم إرسال الرسالة" });
      setSendMsg("");
      await loadMessages(selectedSession);
    } catch (err) {
      toast({ title: "خطأ في الإرسال", description: String(err), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const connectedSessions = sessions.filter(s => s.status === "connected");

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">الرسائل</h1>
        <p className="text-muted-foreground text-sm mt-1">عرض وإرسال الرسائل</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Sessions list */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-semibold mb-3 text-sm text-muted-foreground">اختر جلسة</h2>
          <div className="space-y-2">
            {sessions.map(s => (
              <button key={s.id} onClick={() => loadMessages(s.id)}
                className={`w-full text-right px-4 py-3 rounded-xl text-sm transition-all ${
                  selectedSession === s.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs opacity-70">{s.status === "connected" ? "متصل" : "منقطع"}</div>
              </button>
            ))}
            {sessions.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">لا توجد جلسات</p>}
          </div>
        </div>

        {/* Right: Messages & Send */}
        <div className="lg:col-span-2 space-y-4">
          {/* Send form */}
          {connectedSessions.length > 0 && selectedSession && connectedSessions.some(s => s.id === selectedSession) && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold mb-4 text-sm">إرسال رسالة</h2>
              <form onSubmit={handleSend} className="flex flex-col gap-3">
                <input value={sendTo} onChange={e => setSendTo(e.target.value)} required
                  placeholder="رقم الهاتف (مثال: 966501234567)"
                  className="px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                <div className="flex gap-2">
                  <textarea value={sendMsg} onChange={e => setSendMsg(e.target.value)} required rows={2}
                    placeholder="نص الرسالة..."
                    className="flex-1 px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                  <button type="submit" disabled={sending}
                    className="px-4 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-60 text-sm">
                    {sending ? "..." : "إرسال"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Messages list */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold mb-4 text-sm">سجل الرسائل ({messages.length})</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                {selectedSession ? "لا توجد رسائل" : "اختر جلسة لعرض الرسائل"}
              </p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${
                      m.direction === "outbound"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm"
                    }`}>
                      <p>{m.content || `[${m.messageType}]`}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {new Date(m.timestamp).toLocaleTimeString("ar-SA")}
                        {" • "}{m.direction === "outbound" ? m.toNumber : m.fromNumber}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
