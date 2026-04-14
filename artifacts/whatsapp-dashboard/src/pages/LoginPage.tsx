import { useState } from "react";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      toast({ title: "خطأ في تسجيل الدخول", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
      <div className="w-full max-w-md p-8 rounded-2xl border border-border bg-card shadow-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-4">
            <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.07-1.34C8.42 21.5 10.15 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.27 13.94c-.22.62-1.3 1.18-1.8 1.25-.46.07-1.04.1-1.68-.1a15.3 15.3 0 01-1.52-.56c-2.67-1.16-4.4-3.87-4.53-4.05-.13-.17-1.08-1.43-1.08-2.73 0-1.3.68-1.94 1-2.2.32-.27.62-.3.82-.3h.6c.2 0 .47-.05.7.55.23.6.8 2.07.87 2.22.07.15.1.32 0 .5-.1.2-.15.3-.3.47-.15.17-.3.38-.43.5-.14.14-.3.3-.12.57.17.27.77 1.28 1.66 2.08 1.15 1.02 2.1 1.34 2.4 1.5.3.14.47.12.63-.07l.8-.95c.2-.25.37-.2.6-.12.23.08 1.48.7 1.73.83.24.12.4.18.46.28.07.12.07.67-.15 1.29z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">مدير واتساب</h1>
          <p className="text-muted-foreground text-sm mt-1">قم بتسجيل الدخول للمتابعة</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="admin"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
          >
            {loading ? "جاري التحقق..." : "تسجيل الدخول"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          البيانات الافتراضية: admin / 123456
        </p>
      </div>
    </div>
  );
}
