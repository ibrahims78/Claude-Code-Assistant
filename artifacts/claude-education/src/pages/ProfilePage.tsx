import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { User, MessageCircle, BookOpen, ShieldCheck } from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalConversations: number;
  totalChunks: number;
}

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { t } = useLang();
  const { toast } = useToast();
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "" });
  const [pwLoading, setPwLoading] = useState(false);

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: () => api.get("/admin/dashboard"),
    retry: false,
  });

  const { data: conversations = [] } = useQuery<any[]>({
    queryKey: ["conversations"],
    queryFn: () => api.get("/chat/conversations"),
  });

  const { data: progress = [] } = useQuery<number[]>({
    queryKey: ["progress"],
    queryFn: () => api.get("/content/progress"),
  });

  const totalChunks = 10;
  const progressPercent = Math.round((progress.length / totalChunks) * 100);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwLoading(true);
    try {
      await api.patch("/users/me/password", { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast({ title: t("success"), description: t("passwordChanged") });
      setPwForm({ currentPassword: "", newPassword: "" });
      if (user) setUser({ ...user, mustChangePassword: false });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setPwLoading(false);
    }
  };

  const initials = user?.username?.slice(0, 2).toUpperCase() || "??";

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      {/* Avatar & Info */}
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-xl">{initials}</span>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{user?.username}</p>
              <p className="text-sm text-muted-foreground">{user?.email || "—"}</p>
              <Badge className={`mt-1 text-xs ${user?.role === "admin" ? "bg-primary/20 text-primary border-primary/30" : "bg-muted text-muted-foreground"} border`}>
                {user?.role === "admin" ? "Admin" : "Employee"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border bg-card text-center">
          <CardContent className="p-4">
            <MessageCircle size={18} className="text-primary mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">{conversations.length}</p>
            <p className="text-[11px] text-muted-foreground">{t("totalConversations")}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card text-center">
          <CardContent className="p-4">
            <BookOpen size={18} className="text-blue-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">{progress.length}</p>
            <p className="text-[11px] text-muted-foreground">{t("markAsRead")}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card text-center">
          <CardContent className="p-4">
            <ShieldCheck size={18} className="text-green-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">{progressPercent}%</p>
            <p className="text-[11px] text-muted-foreground">{t("progressPercent")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Learning Progress */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">{t("learn")}</p>
            <p className="text-sm text-muted-foreground">{progress.length}/{totalChunks}</p>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("changePassword")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{t("currentPassword")}</Label>
              <Input
                type="password"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                disabled={pwLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("newPassword")}</Label>
              <Input
                type="password"
                value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                disabled={pwLoading}
              />
            </div>
            <Button type="submit" size="sm" className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90" disabled={pwLoading || !pwForm.currentPassword || !pwForm.newPassword}>
              {pwLoading ? t("loading") : t("updatePassword")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
