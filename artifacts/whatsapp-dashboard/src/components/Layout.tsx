import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useAuth } from "@/context/auth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/", icon: "📊", label: "لوحة التحكم" },
  { path: "/sessions", icon: "📱", label: "الجلسات" },
  { path: "/messages", icon: "💬", label: "الرسائل" },
  { path: "/api-keys", icon: "🔑", label: "مفاتيح API" },
  { path: "/users", icon: "👥", label: "المستخدمون", adminOnly: true },
  { path: "/settings", icon: "⚙️", label: "الإعدادات", adminOnly: true },
  { path: "/audit", icon: "📋", label: "سجل الأحداث", adminOnly: true },
];

function NavItem({ path, icon, label }: { path: string; icon: string; label: string }) {
  const [isActive] = useRoute(path === "/" ? "/" : `${path}*`);
  return (
    <Link href={path}>
      <div className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all text-sm font-medium",
        isActive
          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}>
        <span className="text-base">{icon}</span>
        <span>{label}</span>
      </div>
    </Link>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = NAV_ITEMS.filter(item => !item.adminOnly || user?.role === "admin");

  return (
    <div className="flex h-screen bg-background overflow-hidden" dir="rtl">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col bg-sidebar border-l border-sidebar-border transition-all duration-200 shrink-0",
        sidebarOpen ? "w-60" : "w-16"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.07-1.34C8.42 21.5 10.15 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
            </svg>
          </div>
          {sidebarOpen && <span className="font-bold text-foreground text-sm">مدير واتساب</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            sidebarOpen
              ? <NavItem key={item.path} {...item} />
              : (
                <Link key={item.path} href={item.path}>
                  <div className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl hover:bg-sidebar-accent cursor-pointer transition-all" title={item.label}>
                    <span className="text-base">{item.icon}</span>
                  </div>
                </Link>
              )
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-sidebar-border">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                {user?.username?.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user?.username}</p>
                <p className="text-xs text-muted-foreground">{user?.role === "admin" ? "مدير" : "موظف"}</p>
              </div>
              <button onClick={logout} className="text-muted-foreground hover:text-destructive transition-colors" title="تسجيل خروج">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
              </button>
            </div>
          ) : (
            <button onClick={logout} className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl hover:bg-sidebar-accent transition-all" title="تسجيل خروج">
              <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={() => setSidebarOpen(p => !p)}
          className="flex items-center justify-center py-2 text-muted-foreground hover:text-foreground border-t border-sidebar-border transition-colors"
        >
          <svg className={cn("w-4 h-4 transition-transform", !sidebarOpen && "rotate-180")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
