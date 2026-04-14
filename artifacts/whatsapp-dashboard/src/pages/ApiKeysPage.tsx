import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string;
  createdAt: string;
  allowedSessionIds?: string;
}

export default function ApiKeysPage() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => {
    api.get<ApiKey[]>("/api-keys").then(setKeys).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const key = await api.post<ApiKey & { plainKey: string }>("/api-keys", { name });
      setNewKey(key.plainKey);
      setKeys(prev => [...prev, key]);
      setShowCreate(false);
      setName("");
    } catch (err) {
      toast({ title: "خطأ في الإنشاء", description: String(err), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل تريد حذف هذا المفتاح؟")) return;
    try {
      await api.delete(`/api-keys/${id}`);
      setKeys(prev => prev.filter(k => k.id !== id));
      toast({ title: "تم حذف المفتاح" });
    } catch (err) {
      toast({ title: "خطأ", description: String(err), variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">مفاتيح API</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة مفاتيح الوصول للـ API</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all text-sm">
          + إضافة مفتاح
        </button>
      </div>

      {/* New key display */}
      {newKey && (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
          <p className="font-semibold text-green-400 mb-2">✅ تم إنشاء المفتاح! احفظه الآن لأنه لن يظهر مرة أخرى.</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-black/30 px-4 py-2.5 rounded-xl text-sm font-mono text-green-300 overflow-x-auto">
              {newKey}
            </code>
            <button onClick={() => { navigator.clipboard.writeText(newKey); toast({ title: "تم النسخ!" }); }}
              className="px-3 py-2.5 rounded-xl border border-green-500/30 text-green-400 text-xs hover:bg-green-500/10">
              نسخ
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-muted-foreground mt-2">إخفاء</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold mb-4">إنشاء مفتاح جديد</h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="اسم المفتاح"
              className="flex-1 px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <button type="submit" disabled={creating}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-60 text-sm">
              {creating ? "جاري..." : "إنشاء"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-sm">
              إلغاء
            </button>
          </form>
        </div>
      )}

      {/* Keys list */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">الاسم</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">البادئة</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">آخر استخدام</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">تاريخ الإنشاء</th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">جاري التحميل...</td></tr>
            ) : keys.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">لا توجد مفاتيح</td></tr>
            ) : keys.map(key => (
              <tr key={key.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3 font-medium">{key.name}</td>
                <td className="px-5 py-3 font-mono text-muted-foreground">{key.keyPrefix}...</td>
                <td className="px-5 py-3 text-muted-foreground">
                  {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString("ar-SA") : "لم يُستخدم"}
                </td>
                <td className="px-5 py-3 text-muted-foreground">{new Date(key.createdAt).toLocaleDateString("ar-SA")}</td>
                <td className="px-5 py-3">
                  <button onClick={() => handleDelete(key.id)}
                    className="text-xs text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-all">
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
