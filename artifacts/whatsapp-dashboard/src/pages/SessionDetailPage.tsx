import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { api, getSocketBase } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Wifi, WifiOff, QrCode, BarChart2, MessageSquare, Webhook, Zap } from "lucide-react";

interface Session {
  id: string;
  name: string;
  status: string;
  phoneNumber?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEvents?: string[];
  totalMessagesSent: number;
  totalMessagesReceived: number;
  autoReconnect: boolean;
  features?: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: number;
  direction: string;
  fromNumber: string;
  toNumber: string;
  messageType: string;
  content?: string;
  caption?: string;
  createdAt: string;
}

type Tab = "qr" | "stats" | "messages" | "webhook" | "features";

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

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "qr", label: "رمز QR", icon: QrCode },
  { id: "stats", label: "الإحصائيات", icon: BarChart2 },
  { id: "messages", label: "الرسائل", icon: MessageSquare },
  { id: "webhook", label: "Webhook", icon: Webhook },
  { id: "features", label: "المميزات", icon: Zap },
];

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("qr");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [features, setFeatures] = useState<Record<string, boolean>>({});

  const sessionId = params.id;

  const { data: session, isLoading, error } = useQuery<Session>({
    queryKey: ["session", sessionId],
    queryFn: () => api.get(`/sessions/${sessionId}`),
    refetchInterval: 5000,
  });

  const { data: messages } = useQuery<{ messages: Message[]; total: number }>({
    queryKey: ["session-messages", sessionId],
    queryFn: () => api.get(`/sessions/${sessionId}/messages`),
    enabled: activeTab === "messages",
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (session) {
      setWebhookUrl(session.webhookUrl || "");
      setWebhookSecret(session.webhookSecret || "");
      setFeatures(session.features || {});
    }
  }, [session]);

  useEffect(() => {
    const socket = io(getSocketBase(), { path: "/socket.io" });
    socket.on("connect", () => socket.emit("join_session", sessionId));
    socket.on("qr_code", (data: { sessionId: string; qr: string }) => {
      if (data.sessionId === sessionId) setQrCode(data.qr);
    });
    socket.on("session_status", (data: { sessionId: string; status: string }) => {
      if (data.sessionId === sessionId) {
        queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
        if (data.status === "connected") setQrCode(null);
      }
    });
    return () => { socket.disconnect(); };
  }, [sessionId, queryClient]);

  const connectMutation = useMutation({
    mutationFn: () => api.post(`/sessions/${sessionId}/connect`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session", sessionId] }),
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.post(`/sessions/${sessionId}/disconnect`),
    onSuccess: () => {
      setQrCode(null);
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const webhookMutation = useMutation({
    mutationFn: () => api.patch(`/sessions/${sessionId}/webhook`, {
      webhookUrl: webhookUrl || null, webhookSecret, webhookEvents: ["message", "status_change"],
    }),
    onSuccess: () => {
      toast({ title: "تم حفظ إعدادات Webhook" });
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const featuresMutation = useMutation({
    mutationFn: () => api.patch(`/sessions/${sessionId}/features`, { features }),
    onSuccess: () => toast({ title: "تم حفظ المميزات" }),
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <p className="text-destructive">لم يتم العثور على الجلسة</p>
        <button onClick={() => setLocation("/sessions")} className="text-primary hover:underline text-sm">
          العودة للجلسات
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation("/sessions")}
          className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{session.name}</h1>
            <span className={`w-3 h-3 rounded-full ${STATUS_COLORS[session.status] || "bg-gray-500"}`} />
            <span className="text-sm text-muted-foreground">{STATUS_LABELS[session.status] || session.status}</span>
          </div>
          {session.phoneNumber && (
            <p className="text-muted-foreground text-sm mt-0.5">{session.phoneNumber}</p>
          )}
        </div>
        <div className="flex gap-2">
          {session.status === "disconnected" && (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm transition-all disabled:opacity-50"
            >
              <Wifi className="w-4 h-4" />
              <span>اتصال</span>
            </button>
          )}
          {(session.status === "connected" || session.status === "connecting") && (
            <button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm transition-all disabled:opacity-50"
            >
              <WifiOff className="w-4 h-4" />
              <span>قطع الاتصال</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-card border border-b-transparent border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-card rounded-2xl border border-border p-6">

        {/* QR Tab */}
        {activeTab === "qr" && (
          <div className="flex flex-col items-center gap-6">
            {session.status === "connected" ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wifi className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-green-500 mb-2">متصل</h3>
                <p className="text-muted-foreground">{session.phoneNumber || "تم الاتصال بنجاح"}</p>
              </div>
            ) : qrCode ? (
              <div className="text-center">
                <h3 className="text-lg font-bold mb-2">امسح رمز QR</h3>
                <p className="text-muted-foreground text-sm mb-6">افتح واتساب على هاتفك وامسح الرمز</p>
                <div className="p-4 bg-white rounded-2xl inline-block">
                  <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                </div>
                <p className="text-xs text-muted-foreground mt-4">ينتهي الرمز بعد دقيقة</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <QrCode className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold mb-2">في انتظار رمز QR</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {session.status === "connecting"
                    ? "جاري توليد رمز QR..."
                    : "اضغط على زر الاتصال لبدء عملية الاتصال"}
                </p>
                {session.status === "disconnected" && (
                  <button
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                    className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {connectMutation.isPending ? "جاري الاتصال..." : "بدء الاتصال"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <div className="space-y-6">
            <h3 className="font-semibold text-lg">إحصائيات الجلسة</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "الرسائل المرسلة", value: session.totalMessagesSent, color: "text-blue-400" },
                { label: "الرسائل المستلمة", value: session.totalMessagesReceived, color: "text-green-400" },
                { label: "إجمالي الرسائل", value: session.totalMessagesSent + session.totalMessagesReceived, color: "text-purple-400" },
                { label: "الحالة", value: STATUS_LABELS[session.status] || session.status, color: STATUS_COLORS[session.status] ? "text-foreground" : "text-muted-foreground" },
              ].map(stat => (
                <div key={stat.label} className="bg-muted/50 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">رقم الهاتف</span>
                <span>{session.phoneNumber || "غير متصل"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">إعادة الاتصال التلقائي</span>
                <span>{session.autoReconnect ? "مفعّل" : "معطّل"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">تاريخ الإنشاء</span>
                <span>{new Date(session.createdAt).toLocaleDateString("ar")}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">آخر تحديث</span>
                <span>{new Date(session.updatedAt).toLocaleDateString("ar")}</span>
              </div>
            </div>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === "messages" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">سجل الرسائل</h3>
              <span className="text-sm text-muted-foreground">
                {messages?.total ?? 0} رسالة
              </span>
            </div>
            {!messages?.messages?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد رسائل بعد</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {messages.messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 p-3 rounded-xl ${
                      msg.direction === "outbound" ? "bg-primary/10 flex-row-reverse" : "bg-muted/50"
                    }`}
                  >
                    <div className={`flex-1 ${msg.direction === "outbound" ? "text-right" : ""}`}>
                      <div className="flex items-center gap-2 mb-1 justify-between">
                        <span className="text-xs text-muted-foreground">
                          {msg.direction === "outbound" ? msg.toNumber : msg.fromNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.createdAt).toLocaleTimeString("ar")}
                        </span>
                      </div>
                      <p className="text-sm">{msg.content || msg.caption || `[${msg.messageType}]`}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full h-fit ${
                      msg.direction === "outbound" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {msg.messageType}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Webhook Tab */}
        {activeTab === "webhook" && (
          <div className="space-y-5">
            <h3 className="font-semibold text-lg">إعدادات Webhook</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Webhook URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className="w-full px-4 py-3 bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Webhook Secret</label>
                <input
                  type="text"
                  value={webhookSecret}
                  onChange={e => setWebhookSecret(e.target.value)}
                  placeholder="مفتاح سري اختياري للتحقق من الطلبات"
                  className="w-full px-4 py-3 bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                  dir="ltr"
                />
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">الأحداث المرسلة:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li><code>message</code> — عند استقبال رسالة</li>
                  <li><code>status_change</code> — عند تغيير حالة الجلسة</li>
                </ul>
              </div>
              <button
                onClick={() => webhookMutation.mutate()}
                disabled={webhookMutation.isPending}
                className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                {webhookMutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
              </button>
            </div>
          </div>
        )}

        {/* Features Tab */}
        {activeTab === "features" && (
          <div className="space-y-5">
            <h3 className="font-semibold text-lg">مميزات الجلسة</h3>
            <div className="space-y-3">
              {[
                { key: "autoReply", label: "الرد التلقائي", desc: "الرد تلقائيًا على الرسائل الواردة" },
                { key: "recordMessages", label: "تسجيل الرسائل", desc: "حفظ الرسائل في قاعدة البيانات" },
                { key: "broadcastMode", label: "وضع البث", desc: "إرسال رسائل جماعية" },
                { key: "aiIntegration", label: "تكامل الذكاء الاصطناعي", desc: "معالجة الرسائل بالذكاء الاصطناعي" },
                { key: "mediaForwarding", label: "توجيه الوسائط", desc: "إعادة توجيه الصور والفيديوهات" },
              ].map(feat => (
                <div key={feat.key} className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                  <div>
                    <p className="font-medium text-sm">{feat.label}</p>
                    <p className="text-xs text-muted-foreground">{feat.desc}</p>
                  </div>
                  <button
                    onClick={() => setFeatures(prev => ({ ...prev, [feat.key]: !prev[feat.key] }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      features[feat.key] ? "bg-primary" : "bg-muted border border-border"
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      features[feat.key] ? "translate-x-5" : ""
                    }`} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => featuresMutation.mutate()}
              disabled={featuresMutation.isPending}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              {featuresMutation.isPending ? "جاري الحفظ..." : "حفظ المميزات"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
