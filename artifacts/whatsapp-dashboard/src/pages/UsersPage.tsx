import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number;
  username: string;
  email?: string;
  role: string;
  isActive: boolean;
  maxSessions?: number;
  createdAt: string;
}

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "employee", maxSessions: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get<User[]>("/users").then(setUsers).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const user = await api.post<User>("/users", {
        ...form,
        maxSessions: form.maxSessions ? parseInt(form.maxSessions) : undefined,
      });
      setUsers(prev => [...prev, user]);
      setShowCreate(false);
      setForm({ username: "", email: "", password: "", role: "employee", maxSessions: "" });
      toast({ title: "تم إنشاء المستخدم بنجاح" });
    } catch (err) {
      toast({ title: "خطأ في الإنشاء", description: String(err), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (user: User) => {
    try {
      const updated = await api.patch<User>(`/users/${user.id}`, { isActive: !user.isActive });
      setUsers(prev => prev.map(u => u.id === user.id ? updated : u));
      toast({ title: user.isActive ? "تم تعطيل المستخدم" : "تم تفعيل المستخدم" });
    } catch (err) {
      toast({ title: "خطأ", description: String(err), variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل تريد حذف هذا المستخدم؟")) return;
    try {
      await api.delete(`/users/${id}`);
      setUsers(prev => prev.filter(u => u.id !== id));
      toast({ title: "تم حذف المستخدم" });
    } catch (err) {
      toast({ title: "خطأ", description: String(err), variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المستخدمون</h1>
          <p className="text-muted-foreground text-sm mt-1">{users.length} مستخدم مُسجَّل</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all text-sm">
          + مستخدم جديد
        </button>
      </div>

      {showCreate && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">إنشاء مستخدم جديد</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required
              placeholder="اسم المستخدم"
              className="px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="البريد الإلكتروني" type="email"
              className="px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required
              placeholder="كلمة المرور" type="password"
              className="px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="employee">موظف</option>
              <option value="admin">مدير</option>
            </select>
            <input value={form.maxSessions} onChange={e => setForm(p => ({ ...p, maxSessions: e.target.value }))}
              placeholder="حد الجلسات (اختياري)" type="number" min="1"
              className="px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <div className="flex gap-2">
              <button type="submit" disabled={creating}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-60 text-sm">
                {creating ? "جاري..." : "إنشاء"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-sm">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">المستخدم</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">الدور</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">الحالة</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">حد الجلسات</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">جاري التحميل...</td></tr>
            ) : users.map(user => (
              <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3">
                  <div className="font-medium">{user.username}</div>
                  <div className="text-xs text-muted-foreground">{user.email || "—"}</div>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    user.role === "admin" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {user.role === "admin" ? "مدير" : "موظف"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    user.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {user.isActive ? "نشط" : "معطَّل"}
                  </span>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{user.maxSessions ?? "غير محدود"}</td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => toggleActive(user)}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                        user.isActive ? "text-orange-400 hover:bg-orange-500/10" : "text-green-400 hover:bg-green-500/10"
                      }`}>
                      {user.isActive ? "تعطيل" : "تفعيل"}
                    </button>
                    <button onClick={() => handleDelete(user.id)}
                      className="text-xs text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-all">
                      حذف
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
