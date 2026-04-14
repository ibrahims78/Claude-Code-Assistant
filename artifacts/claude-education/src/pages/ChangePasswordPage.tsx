import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";

function passwordStrength(p: string) {
  let score = 0;
  if (p.length >= 6) score++;
  if (p.length >= 10) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[a-z]/.test(p)) score++;
  if (/[0-9!@#$%^&*]/.test(p)) score++;
  return score;
}

export default function ChangePasswordPage() {
  const { user, setUser, logout } = useAuth();
  const { t } = useLang();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const strength = passwordStrength(form.newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch("/users/me/password", { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast({ title: t("success"), description: t("passwordChanged") });
      if (user) setUser({ ...user, mustChangePassword: false });
      setLocation("/chat");
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const strengthColor = ["bg-destructive", "bg-destructive", "bg-warning", "bg-warning", "bg-green-500", "bg-green-500"][strength];
  const strengthLabel = ["", "ضعيف", "ضعيف", "متوسط", "قوي", "قوي"][strength];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <Card className="border-border bg-card">
          <CardHeader className="text-center pb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-destructive flex items-center justify-center mx-auto mb-3">
              <Shield size={28} className="text-white" />
            </div>
            <CardTitle className="text-xl">{t("changePassword")}</CardTitle>
            <CardDescription className="text-warning">{t("mustChangePassword")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("currentPassword")}</Label>
                <Input type="password" value={form.currentPassword} onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))} disabled={loading} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("newPassword")}</Label>
                <Input type="password" value={form.newPassword} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))} disabled={loading} />
                {form.newPassword && (
                  <div className="space-y-1">
                    <Progress value={(strength / 5) * 100} className={`h-1.5 ${strengthColor}`} />
                    <p className="text-xs text-muted-foreground">{strengthLabel}</p>
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-primary to-blue-500" disabled={loading || !form.currentPassword || form.newPassword.length < 6}>
                {loading ? t("loading") : t("updatePassword")}
              </Button>
            </form>
            <Button variant="ghost" size="sm" className="w-full mt-3 text-muted-foreground" onClick={() => logout()}>
              {t("logout")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
