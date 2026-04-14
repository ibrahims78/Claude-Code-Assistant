import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function RegisterPage() {
  const { login } = useAuth();
  const { t, lang, toggle } = useLang();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast({ title: t("error"), description: "Passwords do not match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await api.post("/users", { username: form.username, email: form.email, password: form.password, role: "employee" });
      await login(form.username, form.password);
      setLocation("/chat");
    } catch (err: any) {
      toast({ title: t("error"), description: err.message || "Registration failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-4">
          <Button variant="ghost" size="sm" onClick={toggle} className="text-muted-foreground">
            {lang === "ar" ? "English" : "عربي"}
          </Button>
        </div>
        <Card className="border-border bg-card">
          <CardHeader className="text-center pb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center mx-auto mb-3">
              <span className="text-white font-bold text-xl">CC</span>
            </div>
            <CardTitle className="text-xl">{t("register")}</CardTitle>
            <CardDescription>{t("appName")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("username")}</Label>
                <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={loading} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("email")}</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={loading} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("password")}</Label>
                <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} disabled={loading} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("confirmPassword")}</Label>
                <Input type="password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} disabled={loading} />
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-primary to-blue-500 hover:opacity-90" disabled={loading}>
                {loading ? t("loading") : t("registerBtn")}
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-4">
              <Link href="/login">
                <a className="text-primary hover:underline">{t("login")}</a>
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
