import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Users, BookOpen, MessageCircle, Settings, Download, RefreshCw,
  Shield, Link2, Languages, Github, Image, FileText, CheckCircle2,
  AlertCircle, Loader2, FolderSync,
} from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalConversations: number;
  totalChunks: number;
  importLastRun?: string;
}

interface GithubFilesStats {
  total: number;
  markdown: number;
  images: number;
  lastSync: string | null;
}

interface SyncProgress {
  phase: string;
  filesScanned: number;
  markdownFiles: number;
  imageFiles: number;
  markdownSaved: number;
  imagesSaved: number;
  dbUpdated: number;
  dbInserted: number;
  errors: string[];
  done: boolean;
  startedAt: string;
  finishedAt?: string;
}

interface SyncStatus {
  running: boolean;
  progress: SyncProgress | null;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const isAr = lang === "ar";
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [importing, setImporting] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ sections: number; chunks: number; inserted: number; updated: number } | null>(null);
  const [translateResult, setTranslateResult] = useState<{ translated: number; remaining: number } | null>(null);
  const [fullSyncRunning, setFullSyncRunning] = useState(false);
  const [fullSyncProgress, setFullSyncProgress] = useState<SyncProgress | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  interface TranslateResult { translated: number; remaining: number; message: string; }
  interface SyncResult { success: boolean; message: string; sections: number; chunks: number; inserted: number; updated: number; }

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{isAr ? "غير مصرح" : "Access denied"}</p>
      </div>
    );
  }

  const { data: stats, refetch } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: () => api.get("/admin/dashboard"),
  });

  const { data: githubStats, refetch: refetchGithubStats } = useQuery<GithubFilesStats>({
    queryKey: ["github-files-stats"],
    queryFn: () => api.get("/admin/github-files/stats"),
  });

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.get("/admin/sync-github-full/status") as SyncStatus;
        setFullSyncProgress(status.progress);
        if (!status.running && status.progress?.done) {
          setFullSyncRunning(false);
          clearInterval(pollRef.current!);
          pollRef.current = null;
          refetch();
          refetchGithubStats();
          if (status.progress.errors.length === 0) {
            toast({
              title: isAr ? "✅ اكتملت المزامنة" : "✅ Sync Complete",
              description: isAr
                ? `${status.progress.markdownSaved} ملف · ${status.progress.imagesSaved} صورة · ${status.progress.dbInserted} جديد`
                : `${status.progress.markdownSaved} files · ${status.progress.imagesSaved} images · ${status.progress.dbInserted} new`,
            });
          } else {
            toast({
              title: isAr ? "اكتملت المزامنة مع أخطاء" : "Sync completed with errors",
              description: `${status.progress.errors.length} errors`,
              variant: "destructive",
            });
          }
        }
      } catch {}
    }, 2000);
  };

  useEffect(() => {
    api.get("/admin/sync-github-full/status").then((status: any) => {
      if (status.running) {
        setFullSyncRunning(true);
        setFullSyncProgress(status.progress);
        startPolling();
      }
    }).catch(() => {});

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleFullSync = async () => {
    setFullSyncRunning(true);
    setFullSyncProgress(null);
    try {
      await api.post("/admin/sync-github-full");
      toast({ title: isAr ? "بدأت المزامنة الكاملة" : "Full sync started" });
      startPolling();
    } catch (err: any) {
      setFullSyncRunning(false);
      toast({ title: isAr ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSyncGithub = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.post("/admin/sync-github") as SyncResult;
      setSyncResult(result);
      toast({ title: result.message || (isAr ? "تمت المزامنة بنجاح" : "Sync completed successfully") });
      refetch();
    } catch (err: any) {
      toast({ title: isAr ? "خطأ في المزامنة" : "Sync error", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleTranslate = async () => {
    setTranslating(true);
    setTranslateResult(null);
    try {
      const result = await api.post("/admin/translate?limit=50") as TranslateResult;
      setTranslateResult(result);
      toast({ title: result.message || t("success") });
      refetch();
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setTranslating(false);
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

  const phaseLabel = (phase: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      scanning: { ar: "فحص المستودع...", en: "Scanning repository..." },
      downloading_images: { ar: "تحميل الصور...", en: "Downloading images..." },
      processing_markdown: { ar: "معالجة ملفات Markdown...", en: "Processing markdown files..." },
      done: { ar: "اكتملت المزامنة", en: "Sync complete" },
      error: { ar: "حدث خطأ", en: "Error occurred" },
    };
    return labels[phase]?.[isAr ? "ar" : "en"] ?? phase;
  };

  const statCards = [
    { icon: <Users size={20} className="text-primary" />, value: stats?.totalUsers || 0, label: t("totalUsers"), href: "/admin/users" },
    { icon: <MessageCircle size={20} className="text-blue-400" />, value: stats?.totalConversations || 0, label: t("totalConversations"), href: null },
    { icon: <BookOpen size={20} className="text-green-400" />, value: stats?.totalChunks || 0, label: t("totalChunks"), href: null },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{t("adminDashboard")}</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {statCards.map((card, i) => (
          <Card key={i} className={`border-border bg-card ${card.href ? "hover:border-primary/40 cursor-pointer transition-all" : ""}`}
            onClick={() => card.href && setLocation(card.href)}>
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-2">{card.icon}</div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Full GitHub Sync */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FolderSync size={16} className="text-primary" />
            {isAr ? "مزامنة كاملة من GitHub" : "Full GitHub Sync"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* File stats from DB */}
          {githubStats && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-foreground">{githubStats.total}</p>
                <p className="text-xs text-muted-foreground">{isAr ? "إجمالي الملفات" : "Total Files"}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <div className="flex justify-center mb-1"><FileText size={14} className="text-blue-400" /></div>
                <p className="text-lg font-bold text-foreground">{githubStats.markdown}</p>
                <p className="text-xs text-muted-foreground">{isAr ? "ملفات Markdown" : "Markdown"}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <div className="flex justify-center mb-1"><Image size={14} className="text-green-400" /></div>
                <p className="text-lg font-bold text-foreground">{githubStats.images}</p>
                <p className="text-xs text-muted-foreground">{isAr ? "صور" : "Images"}</p>
              </div>
            </div>
          )}

          {githubStats?.lastSync && (
            <p className="text-xs text-muted-foreground">
              {isAr ? "آخر مزامنة:" : "Last sync:"}{" "}
              {new Date(githubStats.lastSync).toLocaleString(isAr ? "ar" : "en")}
            </p>
          )}

          {/* Progress display */}
          {fullSyncProgress && (
            <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                {fullSyncRunning ? (
                  <Loader2 size={14} className="animate-spin text-primary" />
                ) : fullSyncProgress.errors.length > 0 ? (
                  <AlertCircle size={14} className="text-destructive" />
                ) : (
                  <CheckCircle2 size={14} className="text-green-400" />
                )}
                <p className="text-xs font-medium text-foreground">{phaseLabel(fullSyncProgress.phase)}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{isAr ? "ملفات مفحوصة:" : "Scanned:"} <strong className="text-foreground">{fullSyncProgress.filesScanned}</strong></span>
                <span>{isAr ? "ملفات MD:" : "Markdown:"} <strong className="text-foreground">{fullSyncProgress.markdownFiles}</strong></span>
                <span>{isAr ? "صور محفوظة:" : "Images saved:"} <strong className="text-green-400">{fullSyncProgress.imagesSaved}</strong></span>
                <span>{isAr ? "MD محفوظة:" : "MD saved:"} <strong className="text-blue-400">{fullSyncProgress.markdownSaved}</strong></span>
                <span>{isAr ? "قيود جديدة:" : "DB inserted:"} <strong className="text-foreground">{fullSyncProgress.dbInserted}</strong></span>
                <span>{isAr ? "قيود محدَّثة:" : "DB updated:"} <strong className="text-foreground">{fullSyncProgress.dbUpdated}</strong></span>
              </div>
              {fullSyncProgress.errors.length > 0 && (
                <p className="text-xs text-destructive">{fullSyncProgress.errors.length} {isAr ? "أخطاء" : "errors"}</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1 gap-2 bg-primary hover:bg-primary/90"
              onClick={handleFullSync}
              disabled={fullSyncRunning}
            >
              {fullSyncRunning
                ? <Loader2 size={14} className="animate-spin" />
                : <Github size={14} />}
              {fullSyncRunning
                ? (isAr ? "يزامن..." : "Syncing...")
                : (isAr ? "جلب كل المحتوى والصور" : "Fetch All Content & Images")}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {isAr
              ? "يجلب جميع ملفات Markdown والصور من المستودع ويحفظها محلياً ويربطها بقاعدة البيانات"
              : "Fetches all markdown files and images from the repository, saves them locally, and links to the database"}
          </p>
        </CardContent>
      </Card>

      {/* Content Management */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 space-y-3">

          {/* Quick Sync from GitHub (markdown only) */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Github size={14} className="text-muted-foreground" />
                {isAr ? "مزامنة سريعة (Markdown فقط)" : "Quick Sync (Markdown only)"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {syncResult
                  ? isAr
                    ? `✅ ${syncResult.sections} قسم · ${syncResult.chunks} جزء (جديد: ${syncResult.inserted} · محدَّث: ${syncResult.updated})`
                    : `✅ ${syncResult.sections} sections · ${syncResult.chunks} chunks (new: ${syncResult.inserted} · updated: ${syncResult.updated})`
                  : stats?.importLastRun
                    ? `${isAr ? "آخر تحديث:" : "Last updated:"} ${new Date(stats.importLastRun).toLocaleString(isAr ? "ar" : "en")}`
                    : isAr ? "جلب ملفات Markdown الرئيسية فقط من المستودع" : "Fetch main Markdown files from the repo only"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-green-500/30 text-green-400 hover:bg-green-500/10 shrink-0"
              onClick={handleSyncGithub}
              disabled={syncing}
            >
              <Github size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? (isAr ? "يجلب..." : "Fetching...") : (isAr ? "مزامنة" : "Sync")}
            </Button>
          </div>

          {/* Translate content */}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {isAr ? "ترجمة المحتوى إلى العربية" : "Translate content to Arabic"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {translateResult
                  ? isAr
                    ? `مُترجم: ${translateResult.translated} • متبقي: ${translateResult.remaining}`
                    : `Translated: ${translateResult.translated} • Remaining: ${translateResult.remaining}`
                  : isAr ? "ترجمة 50 قطعة لكل دفعة باستخدام Claude AI" : "Translate 50 chunks per batch using Claude AI"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              onClick={handleTranslate}
              disabled={translating}
            >
              <Languages size={14} className={translating ? "animate-pulse" : ""} />
              {translating ? (isAr ? "يترجم..." : "Translating...") : (isAr ? "ترجمة" : "Translate")}
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/admin/settings">
          <Card className="border-border bg-card hover:border-primary/40 cursor-pointer transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <Settings size={18} className="text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("settings")}</p>
                <p className="text-xs text-muted-foreground">{t("appSettings")}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card
          className="border-border bg-card hover:border-primary/40 cursor-pointer transition-all"
          onClick={handleDownloadN8n}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Download size={18} className="text-blue-400" />
            <div>
              <p className="text-sm font-medium text-foreground">n8n</p>
              <p className="text-xs text-muted-foreground">{t("downloadWorkflow")}</p>
            </div>
          </CardContent>
        </Card>

        <Link href="/admin/users">
          <Card className="border-border bg-card hover:border-primary/40 cursor-pointer transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <Users size={18} className="text-green-400" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("manageUsers")}</p>
                <p className="text-xs text-muted-foreground">{isAr ? "عرض وتعديل الأدوار" : "View and edit roles"}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/logs">
          <Card className="border-border bg-card hover:border-primary/40 cursor-pointer transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield size={18} className="text-yellow-400" />
              <div>
                <p className="text-sm font-medium text-foreground">{isAr ? "سجلات النظام" : "System Logs"}</p>
                <p className="text-xs text-muted-foreground">{isAr ? "مراقبة الأنشطة والأحداث" : "Monitor activities and events"}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/resources">
          <Card className="border-border bg-card hover:border-primary/40 cursor-pointer transition-all col-span-2">
            <CardContent className="p-4 flex items-center gap-3">
              <Link2 size={18} className="text-orange-400" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("manageResources")}</p>
                <p className="text-xs text-muted-foreground">{isAr ? "استيراد وتنظيم المصادر التعليمية" : "Import and organize learning resources"}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
