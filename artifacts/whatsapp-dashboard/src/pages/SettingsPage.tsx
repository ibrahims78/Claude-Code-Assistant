import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Record<string, string>>("/admin/settings").then(setSettings).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/admin/settings", settings);
      toast({ title: "تم حفظ الإعدادات بنجاح" });
    } catch (err) {
      toast({ title: "خطأ في الحفظ", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSetupTelegram = async () => {
    try {
      const result = await api.post<{ success: boolean; webhookUrl: string }>("/webhook/telegram/setup");
      toast({ title: "تم إعداد Telegram", description: `Webhook: ${result.webhookUrl}` });
    } catch (err) {
      toast({ title: "خطأ في إعداد Telegram", description: String(err), variant: "destructive" });
    }
  };

  const handleImport = async () => {
    try {
      toast({ title: "جاري الاستيراد..." });
      const result = await api.post<{ imported: number; updated: number; total: number }>("/admin/import");
      toast({ title: `تم الاستيراد: ${result.imported} جديد، ${result.updated} محدَّث` });
    } catch (err) {
      toast({ title: "خطأ في الاستيراد", description: String(err), variant: "destructive" });
    }
  };

  const fields = [
    { key: "ai_model", label: "نموذج الذكاء الاصطناعي", placeholder: "claude-3-5-sonnet-20241022" },
    { key: "telegram_token", label: "رمز Telegram Bot", placeholder: "1234567890:ABCDEF..." },
    { key: "telegram_max_daily", label: "حد الرسائل اليومية (Telegram)", placeholder: "20" },
    { key: "telegram_welcome_ar", label: "رسالة ترحيب Telegram (عربي)", placeholder: "مرحباً بك!" },
    { key: "telegram_welcome_en", label: "رسالة ترحيب Telegram (إنجليزي)", placeholder: "Welcome!" },
  ];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground text-sm mt-1">إعدادات النظام العامة</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-semibold text-lg mb-2">إعدادات الذكاء الاصطناعي</h2>
            {fields.map(field => (
              <div key={field.key}>
                <label className="block text-sm font-medium mb-1.5">{field.label}</label>
                <input
                  value={settings[field.key] || ""}
                  onChange={e => setSettings(p => ({ ...p, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-60 text-sm">
              {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
            </button>
          </div>
        </form>
      )}

      {/* Actions */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-lg">إجراءات متقدمة</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleSetupTelegram}
            className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium transition-all">
            🤖 إعداد Telegram Webhook
          </button>
          <button onClick={handleImport}
            className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium transition-all">
            📥 استيراد المحتوى من GitHub
          </button>
          <a href="/api/n8n-workflow/download" download="n8n-workflow.json"
            className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium transition-all">
            🔄 تحميل قالب n8n
          </a>
        </div>
      </div>
    </div>
  );
}
