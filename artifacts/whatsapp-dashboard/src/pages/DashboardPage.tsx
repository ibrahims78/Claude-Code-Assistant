import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

interface Stats {
  totalSessions: number;
  connectedSessions: number;
  disconnectedSessions: number;
  totalSent: number;
  totalReceived: number;
  dailyStats: { date: string; sent: number; received: number }[];
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: string; color: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Stats>("/dashboard/stats")
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const chartData = stats?.dailyStats.map(d => ({
    date: d.date.slice(5),
    "مُرسَل": d.sent,
    "مُستقبَل": d.received,
  })) || [];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground text-sm mt-1">
          مرحباً {user?.username}، إليك ملخص اليوم
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إجمالي الجلسات" value={stats?.totalSessions ?? 0} icon="📱" color="bg-primary/15 text-primary" />
        <StatCard label="متصلة" value={stats?.connectedSessions ?? 0} icon="🟢" color="bg-green-500/15 text-green-400" />
        <StatCard label="رسائل مُرسَلة" value={stats?.totalSent ?? 0} icon="📤" color="bg-blue-500/15 text-blue-400" />
        <StatCard label="رسائل مُستقبَلة" value={stats?.totalReceived ?? 0} icon="📥" color="bg-orange-500/15 text-orange-400" />
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground mb-4">نشاط الرسائل (آخر 7 أيام)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="sent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="received" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Legend />
            <Area type="monotone" dataKey="مُرسَل" stroke="#7C3AED" fill="url(#sent)" strokeWidth={2} />
            <Area type="monotone" dataKey="مُستقبَل" stroke="#3B82F6" fill="url(#received)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 col-span-1 md:col-span-2">
          <h2 className="text-lg font-semibold mb-4">حالة الجلسات</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">متصلة</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${stats?.totalSessions ? (stats.connectedSessions / stats.totalSessions * 100) : 0}%` }} />
                </div>
                <span className="text-sm font-medium">{stats?.connectedSessions}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">منقطعة</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${stats?.totalSessions ? (stats.disconnectedSessions / stats.totalSessions * 100) : 0}%` }} />
                </div>
                <span className="text-sm font-medium">{stats?.disconnectedSessions}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold mb-4">ملخص سريع</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">نسبة الاتصال</span>
              <span className="font-semibold text-green-400">
                {stats?.totalSessions ? Math.round(stats.connectedSessions / stats.totalSessions * 100) : 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">إجمالي الرسائل</span>
              <span className="font-semibold">{(stats?.totalSent || 0) + (stats?.totalReceived || 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
