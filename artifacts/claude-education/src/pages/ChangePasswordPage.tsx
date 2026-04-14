import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Check, X } from "lucide-react";

interface Requirement {
  label: string;
  test: (p: string) => boolean;
}

const requirements: Requirement[] = [
  { label: "6 أحرف على الأقل", test: (p) => p.length >= 6 },
  { label: "حرف كبير (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "حرف صغير (a-z)", test: (p) => /[a-z]/.test(p) },
  { label: "رقم أو رمز (!@#...)", test: (p) => /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export default function ChangePasswordPage() {
  const { user, setUser, logout } = useAuth();
  const { t } = useLang();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const passed = requirements.map((r) => r.test(form.newPassword));
  const allPassed = passed.every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allPassed) return;
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
                <Input
                  type="password"
                  value={form.currentPassword}
                  onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                  disabled={loading}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("newPassword")}</Label>
                <Input
                  type="password"
                  value={form.newPassword}
                  onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                  disabled={loading}
                  placeholder="••••••••"
                />
                {form.newPassword.length > 0 && (
                  <div className="mt-2 space-y-1 rounded-md border border-border bg-muted/30 p-3">
                    {requirements.map((req, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {passed[i] ? (
                          <Check size={13} className="text-green-500 shrink-0" />
                        ) : (
                          <X size={13} className="text-destructive shrink-0" />
                        )}
                        <span className={passed[i] ? "text-green-500" : "text-muted-foreground"}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-blue-500"
                disabled={loading || !form.currentPassword || !allPassed}
              >
                {loading ? t("loading") : t("updatePassword")}
              </Button>
            </form>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-muted-foreground"
              onClick={() => logout()}
            >
              {t("logout")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
