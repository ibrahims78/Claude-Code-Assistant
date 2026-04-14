import { useState } from "react";
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
import { Users, BookOpen, MessageCircle, Settings, Download, RefreshCw, Shield, Link2 } from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalConversations: number;
  totalChunks: number;
  importLastRun?: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { t } = useLang();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [importing, setImporting] = useState(false);

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    );
  }

  const { data: stats, refetch } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: () => api.get("/admin/dashboard"),
  });

  const handleImport = async () => {
    setImporting(true);
    try {
      await api.post("/admin/import");
      toast({ title: t("success") });
      refetch();
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
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

      {/* Last Import */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("lastImport")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats?.importLastRun ? new Date(stats.importLastRun).toLocaleString("ar") : "—"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-border text-muted-foreground"
              onClick={handleImport}
              disabled={importing}
            >
              <RefreshCw size={14} className={importing ? "animate-spin" : ""} />
              {importing ? t("importing") : t("importContent")}
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
                <p className="text-sm font-medium text-foreground">إدارة المستخدمين</p>
                <p className="text-xs text-muted-foreground">عرض وتعديل الأدوار</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/logs">
          <Card className="border-border bg-card hover:border-primary/40 cursor-pointer transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield size={18} className="text-yellow-400" />
              <div>
                <p className="text-sm font-medium text-foreground">سجلات النظام</p>
                <p className="text-xs text-muted-foreground">مراقبة الأنشطة والأحداث</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/resources">
          <Card className="border-border bg-card hover:border-primary/40 cursor-pointer transition-all col-span-2">
            <CardContent className="p-4 flex items-center gap-3">
              <Link2 size={18} className="text-orange-400" />
              <div>
                <p className="text-sm font-medium text-foreground">إدارة المصادر</p>
                <p className="text-xs text-muted-foreground">استيراد وتنظيم المصادر التعليمية</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
