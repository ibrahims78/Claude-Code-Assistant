import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight, ArrowLeft, Eye, EyeOff, Download, Send,
  Loader2, CheckCircle2, XCircle, Sparkles,
} from "lucide-react";

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic (Replit AI)", models: ["claude-sonnet-4-6", "claude-haiku-4-5", "claude-opus-4-6"], keyLabel: null },
  { id: "openai",    label: "OpenAI",                models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"], keyLabel: "OpenAI API Key" },
  { id: "gemini",    label: "Google Gemini",         models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"], keyLabel: "Gemini API Key" },
];

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // ── ALL hooks must run unconditionally before any early return ──
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"idle" | "ok" | "error">("idle");
  const [keyError, setKeyError] = useState("");

  const { data: telegramStats } = useQuery({
    queryKey: ["telegram-stats"],
    queryFn: () => api.get<any>("/admin/telegram/stats"),
    retry: false,
    enabled: user?.role === "admin",
  });

  useEffect(() => {
    if (user?.role !== "admin") return;
    api.get<Record<string, string>>("/admin/settings")
      .then(data => setSettings(data || {}))
      .catch(() => {});
  }, [user?.role]);

  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  // Guard after all hooks
  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    );
  }

  const set = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }));

  const saveSetting = async (key: string, value: string) => {
    try {
      await api.patch("/admin/settings", { key, value });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  const saveSettings = async (keys: string[]) => {
    setLoading(true);
    try {
      await Promise.all(keys.map(k => api.patch("/admin/settings", { key: k, value: settings[k] ?? "" })));
      toast({ title: lang === "ar" ? "تم الحفظ ✅" : "Saved ✅" });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const activateWebhook = async () => {
    if (!settings.telegram_token) {
      toast({ title: t("error"), description: "Telegram token is required", variant: "destructive" });
      return;
    }
    setWebhookLoading(true);
    try {
      await api.patch("/admin/settings", { key: "telegram_token", value: settings.telegram_token });
      await api.patch("/admin/settings", { key: "telegram_enabled", value: "true" });
      const res = await api.post<any>("/webhook/telegram/setup");
      set("telegram_enabled", "true");
      toast({ title: t("success"), description: res.webhookUrl });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleDownloadN8n = async () => {
    try {
      const res = await fetch("/api/n8n-workflow/download", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "claude-code-n8n-workflow.json"; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  const testKey = async () => {
    const provider = settings.ai_provider;
    const apiKey = provider === "openai" ? settings.openai_api_key : settings.gemini_api_key;
    if (!apiKey?.trim()) {
      toast({ title: t("error"), description: lang === "ar" ? "أدخل المفتاح أولاً" : "Enter API key first", variant: "destructive" });
      return;
    }
    setTestingKey(true); setKeyStatus("idle");
    try {
      const res = await api.post<{ ok: boolean; error?: string }>("/admin/settings/test-ai", { provider, apiKey });
      if (res.ok) { setKeyStatus("ok"); toast({ title: lang === "ar" ? "المفتاح صحيح ✅" : "Key is valid ✅" }); }
      else { setKeyStatus("error"); setKeyError(res.error || "فشل التحقق"); }
    } catch (err: any) { setKeyStatus("error"); setKeyError(err.message || "خطأ"); }
    finally { setTestingKey(false); }
  };

  const provider = settings.ai_provider || "anthropic";
  const selectedProvider = PROVIDERS.find(p => p.id === provider) ?? PROVIDERS[0];
  const modelKey = provider === "openai" ? "openai_model" : provider === "gemini" ? "gemini_model" : "ai_model";

  const Field = ({ label, sk, type = "text" }: { label: string; sk: string; type?: string }) => (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Input type={type} value={settings[sk] || ""} onChange={e => set(sk, e.target.value)} />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setLocation("/admin")}>
          <BackIcon size={15} /> {t("back")}
        </Button>
        <h1 className="text-xl font-bold text-foreground">{t("settings")}</h1>
      </div>

      {/* App Settings */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("appSettings")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label={t("appName")} sk="app_name" />
          <Field label={t("dailyLimit")} sk="max_messages_per_day" />
          <Button size="sm" className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
            onClick={() => saveSettings(["app_name", "max_messages_per_day"])} disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin me-1" />} {t("save")}
          </Button>
        </CardContent>
      </Card>

      {/* AI Provider */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <CardTitle className="text-base">{lang === "ar" ? "إعدادات مزود الذكاء الاصطناعي" : "AI Provider Settings"}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Provider picker */}
          <div className="space-y-2">
            <Label className="text-sm">{lang === "ar" ? "المزود" : "Provider"}</Label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map(p => (
                <button key={p.id}
                  onClick={() => { set("ai_provider", p.id); setKeyStatus("idle"); }}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all text-start ${
                    provider === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Anthropic: no key */}
          {provider === "anthropic" && (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2">
              <CheckCircle2 size={15} className="text-green-400 shrink-0" />
              <p className="text-xs text-green-400">
                {lang === "ar" ? "يعمل تلقائياً عبر Replit AI — لا يحتاج مفتاحاً" : "Powered by Replit AI — no key required"}
              </p>
            </div>
          )}

          {/* OpenAI / Gemini key */}
          {provider !== "anthropic" && (
            <div className="space-y-2">
              <Label className="text-sm">{selectedProvider.keyLabel}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={provider === "openai" ? (settings.openai_api_key || "") : (settings.gemini_api_key || "")}
                    onChange={e => set(provider === "openai" ? "openai_api_key" : "gemini_api_key", e.target.value)}
                    placeholder={provider === "openai" ? "sk-..." : "AIza..."}
                    className={`pe-9 ${keyStatus === "ok" ? "border-green-500" : keyStatus === "error" ? "border-red-500" : ""}`}
                  />
                  <button type="button" className="absolute inset-y-0 end-0 flex items-center px-2.5 text-muted-foreground"
                    onClick={() => setShowApiKey(v => !v)}>
                    {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 border-border gap-1.5" onClick={testKey} disabled={testingKey}>
                  {testingKey ? <Loader2 size={13} className="animate-spin" />
                    : keyStatus === "ok" ? <CheckCircle2 size={13} className="text-green-400" />
                    : keyStatus === "error" ? <XCircle size={13} className="text-red-400" /> : null}
                  {lang === "ar" ? "تحقق" : "Test"}
                </Button>
              </div>
              {keyStatus === "ok" && <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={11} />{lang === "ar" ? "المفتاح صحيح وفعّال" : "Key is valid"}</p>}
              {keyStatus === "error" && <p className="text-xs text-red-400 flex items-center gap-1"><XCircle size={11} />{keyError}</p>}
            </div>
          )}

          {/* Model picker */}
          <div className="space-y-2">
            <Label className="text-sm">{lang === "ar" ? "النموذج" : "Model"}</Label>
            <div className="flex gap-2 flex-wrap">
              {selectedProvider.models.map(m => (
                <button key={m} onClick={() => set(modelKey, m)}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-all ${
                    (settings[modelKey] || selectedProvider.models[0]) === m
                      ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                  }`}>{m}</button>
              ))}
            </div>
          </div>

          <Button size="sm" className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
            onClick={() => saveSettings(["ai_provider", "ai_model", "openai_api_key", "openai_model", "gemini_api_key", "gemini_model"])}
            disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin me-1" />}
            {lang === "ar" ? "حفظ إعدادات AI" : "Save AI Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Telegram */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("telegramBot")}</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("botEnabled")}</span>
              <Switch checked={settings.telegram_enabled === "true"}
                onCheckedChange={v => { set("telegram_enabled", v ? "true" : "false"); saveSetting("telegram_enabled", v ? "true" : "false"); }} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {telegramStats && (
            <div className="flex gap-3 p-3 rounded-lg bg-muted">
              {[["messagesToday", lang === "ar" ? "رسائل اليوم" : "Today"], ["totalUsers", lang === "ar" ? "مستخدمون" : "Users"], ["activeToday", lang === "ar" ? "نشطون" : "Active"]].map(([k, lbl]) => (
                <div key={k} className="text-center flex-1">
                  <p className="text-lg font-bold text-foreground">{(telegramStats as any)[k] || 0}</p>
                  <p className="text-xs text-muted-foreground">{lbl}</p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-sm">{t("botToken")}</Label>
            <div className="relative">
              <Input type={showToken ? "text" : "password"} value={settings.telegram_token || ""}
                onChange={e => set("telegram_token", e.target.value)} placeholder="123456:ABC-DEF..." className="pe-10" />
              <button type="button" className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground"
                onClick={() => setShowToken(!showToken)}>
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <Field label={t("welcomeAr")} sk="telegram_welcome_ar" />
          <Field label={t("welcomeEn")} sk="telegram_welcome_en" />
          <Field label={t("dailyLimit")} sk="telegram_max_daily" />
          <Button size="sm" className="gap-2 bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
            onClick={activateWebhook} disabled={webhookLoading}>
            {webhookLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {t("saveActivate")}
          </Button>
        </CardContent>
      </Card>

      {/* n8n */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("n8nIntegration")}</CardTitle></CardHeader>
        <CardContent>
          <Button variant="outline" className="gap-2 border-border" onClick={handleDownloadN8n}>
            <Download size={15} /> {t("downloadWorkflow")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
