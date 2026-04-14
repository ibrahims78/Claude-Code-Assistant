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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, ArrowLeft, Eye, EyeOff, Download, Send, Loader2 } from "lucide-react";

interface Setting {
  key: string;
  value?: string;
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  if (user?.role !== "admin") {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Access denied</p></div>;
  }

  const { data: telegramStats } = useQuery({
    queryKey: ["telegram-stats"],
    queryFn: () => api.get<any>("/admin/telegram/stats"),
    retry: false,
  });

  useEffect(() => {
    api.get<Setting[]>("/admin/settings").then(data => {
      const map: Record<string, string> = {};
      data.forEach((s: Setting) => { if (s.key) map[s.key] = s.value || ""; });
      setSettings(map);
    }).catch(() => {});
  }, []);

  const saveSetting = async (key: string, value: string) => {
    try {
      await api.patch("/admin/settings", { key, value });
      toast({ title: t("success") });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  const saveAllSettings = async () => {
    setLoading(true);
    try {
      await Promise.all(
        Object.entries(settings).map(([key, value]) => api.patch("/admin/settings", { key, value }))
      );
      toast({ title: t("success") });
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
      setSettings(s => ({ ...s, telegram_enabled: "true" }));
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
      a.href = url;
      a.download = "claude-code-n8n-workflow.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  const Field = ({ label, settingKey, type = "text" }: { label: string; settingKey: string; type?: string }) => (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Input
        type={type}
        value={settings[settingKey] || ""}
        onChange={e => setSettings(s => ({ ...s, [settingKey]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setLocation("/admin")}>
          <BackIcon size={15} />
          {t("back")}
        </Button>
        <h1 className="text-xl font-bold text-foreground">{t("settings")}</h1>
      </div>

      {/* App Settings */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("appSettings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={t("appName")} settingKey="app_name" />
          <Field label={t("dailyLimit")} settingKey="max_messages_per_day" />
          <div className="space-y-1.5">
            <Label className="text-sm">AI Model</Label>
            <Input value={settings.ai_model || ""} onChange={e => setSettings(s => ({ ...s, ai_model: e.target.value }))} />
          </div>
          <Button size="sm" className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90" onClick={saveAllSettings} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin me-1" /> : null}
            {t("save")}
          </Button>
        </CardContent>
      </Card>

      {/* Telegram Bot */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("telegramBot")}</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("botEnabled")}</span>
              <Switch
                checked={settings.telegram_enabled === "true"}
                onCheckedChange={(v) => {
                  setSettings(s => ({ ...s, telegram_enabled: v ? "true" : "false" }));
                  saveSetting("telegram_enabled", v ? "true" : "false");
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {telegramStats && (
            <div className="flex gap-3 p-3 rounded-lg bg-muted">
              <div className="text-center flex-1">
                <p className="text-lg font-bold text-foreground">{telegramStats.messagesToday || 0}</p>
                <p className="text-xs text-muted-foreground">{lang === "ar" ? "رسائل اليوم" : "Messages Today"}</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-lg font-bold text-foreground">{telegramStats.totalUsers || 0}</p>
                <p className="text-xs text-muted-foreground">{lang === "ar" ? "مستخدمون" : "Users"}</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-lg font-bold text-foreground">{telegramStats.activeToday || 0}</p>
                <p className="text-xs text-muted-foreground">{lang === "ar" ? "نشطون اليوم" : "Active Today"}</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm">{t("botToken")}</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={settings.telegram_token || ""}
                onChange={e => setSettings(s => ({ ...s, telegram_token: e.target.value }))}
                placeholder="123456:ABC-DEF..."
                className="pe-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <Field label={t("welcomeAr")} settingKey="telegram_welcome_ar" />
          <Field label={t("welcomeEn")} settingKey="telegram_welcome_en" />
          <Field label={t("dailyLimit")} settingKey="telegram_max_daily" />

          <Button
            size="sm"
            className="gap-2 bg-gradient-to-r from-primary to-blue-500 hover:opacity-90"
            onClick={activateWebhook}
            disabled={webhookLoading}
          >
            {webhookLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {t("saveActivate")}
          </Button>
        </CardContent>
      </Card>

      {/* n8n Integration */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("n8nIntegration")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="gap-2 border-border" onClick={handleDownloadN8n}>
            <Download size={15} />
            {t("downloadWorkflow")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
