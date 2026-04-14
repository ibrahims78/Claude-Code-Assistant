import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";

export default function ChangePasswordPage() {
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirm) {
      toast({ title: "كلمات المرور غير متطابقة", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await api.patch("/users/me/password", { currentPassword: current, newPassword: newPw });
      toast({ title: "تم تغيير كلمة المرور بنجاح" });
      await refreshUser();
    } catch (err) {
      toast({ title: "خطأ", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
      <div className="w-full max-w-md p-8 rounded-2xl border border-border bg-card shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">تغيير كلمة المرور</h1>
          <p className="text-muted-foreground text-sm mt-1">يجب تغيير كلمة المرور قبل المتابعة</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">كلمة المرور الحالية</label>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">كلمة المرور الجديدة</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="8 أحرف على الأقل" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">تأكيد كلمة المرور</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-60 transition-all">
            {loading ? "جاري الحفظ..." : "تغيير كلمة المرور"}
          </button>
        </form>
      </div>
    </div>
  );
}
