import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Send, Image, Video, Music, FileText, MapPin, Sticker } from "lucide-react";

interface Session {
  id: string;
  name: string;
  status: string;
  phoneNumber?: string;
}

type MessageType = "text" | "image" | "video" | "audio" | "file" | "location" | "sticker";

const MESSAGE_TYPES: { id: MessageType; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "text", label: "نص", icon: Send, desc: "إرسال رسالة نصية" },
  { id: "image", label: "صورة", icon: Image, desc: "إرسال صورة" },
  { id: "video", label: "فيديو", icon: Video, desc: "إرسال فيديو" },
  { id: "audio", label: "صوت", icon: Music, desc: "إرسال رسالة صوتية" },
  { id: "file", label: "ملف", icon: FileText, desc: "إرسال ملف" },
  { id: "location", label: "موقع", icon: MapPin, desc: "إرسال موقع جغرافي" },
  { id: "sticker", label: "ملصق", icon: Sticker, desc: "إرسال ملصق" },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SendPage() {
  const { toast } = useToast();
  const [msgType, setMsgType] = useState<MessageType>("text");
  const [sessionId, setSessionId] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locationDesc, setLocationDesc] = useState("");
  const [sending, setSending] = useState(false);

  const { data: sessions } = useQuery<Session[]>({
    queryKey: ["sessions"],
    queryFn: () => api.get("/sessions"),
  });

  const connectedSessions = sessions?.filter(s => s.status === "connected") || [];

  const handleSend = async () => {
    if (!sessionId) { toast({ title: "اختر جلسة", variant: "destructive" }); return; }
    if (!to) { toast({ title: "أدخل رقم الهاتف", variant: "destructive" }); return; }

    setSending(true);
    try {
      let body: Record<string, unknown> = { sessionId, to };

      if (msgType === "text") {
        if (!message) throw new Error("أدخل الرسالة");
        body.message = message;
      } else if (msgType === "location") {
        if (!lat || !lng) throw new Error("أدخل الإحداثيات");
        body.lat = parseFloat(lat);
        body.lng = parseFloat(lng);
        body.description = locationDesc;
      } else {
        if (!mediaFile) throw new Error("اختر ملفًا");
        const base64 = await fileToBase64(mediaFile);
        if (msgType === "image") { body.image = base64; body.caption = caption; }
        else if (msgType === "video") { body.video = base64; body.caption = caption; }
        else if (msgType === "audio") { body.audio = base64; }
        else if (msgType === "file") { body.file = base64; body.filename = mediaFile.name; }
        else if (msgType === "sticker") { body.sticker = base64; }
      }

      await api.post(`/send/${msgType}`, body);
      toast({ title: "تم الإرسال بنجاح" });
      setMessage(""); setCaption(""); setMediaFile(null); setLat(""); setLng(""); setLocationDesc("");
    } catch (err: any) {
      toast({ title: "فشل الإرسال", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">إرسال رسالة</h1>
        <p className="text-muted-foreground text-sm mt-1">أرسل رسائل متعددة الأنواع عبر واتساب</p>
      </div>

      {/* Message Type Selector */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {MESSAGE_TYPES.map(type => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => setMsgType(type.id)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-sm ${
                msgType === type.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">{type.label}</span>
            </button>
          );
        })}
      </div>

      {/* Form */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
        {/* Session */}
        <div>
          <label className="block text-sm font-medium mb-2">الجلسة</label>
          {connectedSessions.length === 0 ? (
            <p className="text-sm text-destructive">لا توجد جلسات متصلة حاليًا</p>
          ) : (
            <select
              value={sessionId}
              onChange={e => setSessionId(e.target.value)}
              className="w-full px-4 py-3 bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            >
              <option value="">اختر جلسة...</option>
              {connectedSessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.phoneNumber ? `(${s.phoneNumber})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* To */}
        <div>
          <label className="block text-sm font-medium mb-2">رقم المستلم</label>
          <input
            type="tel"
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="966501234567"
            className="w-full px-4 py-3 bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground mt-1">الرقم الدولي بدون + أو مسافات</p>
        </div>

        {/* Text */}
        {msgType === "text" && (
          <div>
            <label className="block text-sm font-medium mb-2">الرسالة</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="اكتب رسالتك هنا..."
              rows={4}
              className="w-full px-4 py-3 bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
            />
          </div>
        )}

        {/* Media (image, video, audio, file, sticker) */}
        {["image", "video", "audio", "file", "sticker"].includes(msgType) && (
          <div>
            <label className="block text-sm font-medium mb-2">
              {msgType === "image" ? "الصورة" : msgType === "video" ? "الفيديو" : msgType === "audio" ? "الملف الصوتي" : msgType === "file" ? "الملف" : "الملصق (WebP)"}
            </label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => document.getElementById("media-input")?.click()}
            >
              {mediaFile ? (
                <p className="text-sm font-medium">{mediaFile.name}</p>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">انقر لاختيار ملف</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {msgType === "image" ? "JPG, PNG, GIF, WebP" : msgType === "video" ? "MP4, AVI, MOV" : msgType === "audio" ? "MP3, OGG, WAV" : msgType === "sticker" ? "WebP" : "أي نوع ملف"}
                  </p>
                </>
              )}
            </div>
            <input
              id="media-input"
              type="file"
              className="hidden"
              accept={
                msgType === "image" ? "image/*" :
                msgType === "video" ? "video/*" :
                msgType === "audio" ? "audio/*" :
                msgType === "sticker" ? "image/webp" : "*"
              }
              onChange={e => setMediaFile(e.target.files?.[0] || null)}
            />
          </div>
        )}

        {/* Caption for image/video */}
        {["image", "video"].includes(msgType) && (
          <div>
            <label className="block text-sm font-medium mb-2">تسمية توضيحية (اختياري)</label>
            <input
              type="text"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="أضف وصفًا..."
              className="w-full px-4 py-3 bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
        )}

        {/* Location */}
        {msgType === "location" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">خط العرض (Latitude)</label>
                <input
                  type="number"
                  value={lat}
                  onChange={e => setLat(e.target.value)}
                  placeholder="24.7136"
                  step="0.000001"
                  className="w-full px-4 py-3 bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">خط الطول (Longitude)</label>
                <input
                  type="number"
                  value={lng}
                  onChange={e => setLng(e.target.value)}
                  placeholder="46.6753"
                  step="0.000001"
                  className="w-full px-4 py-3 bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">الوصف (اختياري)</label>
              <input
                type="text"
                value={locationDesc}
                onChange={e => setLocationDesc(e.target.value)}
                placeholder="اسم الموقع أو وصفه"
                className="w-full px-4 py-3 bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={sending || connectedSessions.length === 0}
          className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {sending ? "جاري الإرسال..." : "إرسال"}
        </button>
      </div>
    </div>
  );
}
