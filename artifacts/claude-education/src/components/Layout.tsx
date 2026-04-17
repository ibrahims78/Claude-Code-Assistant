import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Home, MessageCircle, BookOpen, Library, User, Settings, LogOut,
  Menu, Globe, Moon, Sun, Star, Trophy
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AchievementsPanel } from "@/components/AchievementsPanel";

interface StatsLite {
  totalPoints: number;
  icon: string;
  rank: string;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { lang, toggle, t } = useLang();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const { toast } = useToast();
  const isAr = lang === "ar";

  // ── Fetch points (lightweight, reuse learn-stats cache) ──
  const { data: statsLite } = useQuery<StatsLite>({
    queryKey: ["learn-stats"],
    queryFn: () => api.get<StatsLite>("/learn/stats"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const totalPoints = statsLite?.totalPoints ?? 0;
  const rankIcon    = statsLite?.icon ?? "🥉";

  const toggleTheme = () => {
    setDark(!dark);
    document.documentElement.classList.toggle("dark", !dark);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      toast({ title: t("error"), variant: "destructive" });
    }
  };

  const navLinks = [
    { href: "/", icon: <Home size={18} />, label: t("home") },
    { href: "/chat", icon: <MessageCircle size={18} />, label: t("chat") },
    { href: "/learn", icon: <BookOpen size={18} />, label: t("learn") },
    { href: "/resources", icon: <Library size={18} />, label: t("resources") },
    { href: "/profile", icon: <User size={18} />, label: t("profile") },
    ...(user?.role === "admin" ? [{ href: "/admin", icon: <Settings size={18} />, label: t("admin") }] : []),
  ];

  // ── Points badge button ──
  const PointsBadge = ({ className }: { className?: string }) => (
    <button
      onClick={() => setPanelOpen(true)}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-200",
        "border-yellow-500/30 bg-yellow-500/8 hover:bg-yellow-500/15 hover:border-yellow-500/50",
        "text-yellow-400 text-xs font-semibold cursor-pointer",
        className
      )}
      title={isAr ? "النقاط والإنجازات" : "Points & Achievements"}
    >
      <span className="text-sm leading-none">{rankIcon}</span>
      <span>{totalPoints.toLocaleString()}</span>
      <Star size={10} className="text-yellow-400" />
    </button>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center text-white font-bold text-sm">
            CC
          </div>
          <div>
            <p className="font-bold text-foreground text-sm">{t("appName")}</p>
            <p className="text-xs text-muted-foreground">{user?.username}</p>
          </div>
        </div>
      </div>

      {/* Points indicator */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => { setPanelOpen(true); setMobileOpen(false); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/12 hover:border-yellow-500/40 transition-all duration-200 group"
        >
          <span className="text-lg leading-none">{rankIcon}</span>
          <div className="flex-1 text-start">
            <p className="text-xs font-bold text-yellow-400">
              {totalPoints.toLocaleString()} {isAr ? "نقطة" : "pts"}
            </p>
            <p className="text-[10px] text-muted-foreground group-hover:text-muted-foreground/80">
              {isAr ? "اضغط لعرض الإنجازات" : "View achievements"}
            </p>
          </div>
          <Trophy size={14} className="text-yellow-400/60 group-hover:text-yellow-400 transition-colors" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navLinks.map(link => (
          <Link key={link.href} href={link.href}>
            <a
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                location === link.href
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {link.icon}
              <span>{link.label}</span>
            </a>
          </Link>
        ))}
      </nav>

      {/* Footer controls */}
      <div className="p-3 border-t border-border space-y-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2 text-muted-foreground"
            onClick={toggle}
          >
            <Globe size={16} />
            <span>{lang === "ar" ? "English" : "عربي"}</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut size={16} />
          <span>{t("logout")}</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 border-e border-border bg-sidebar flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 w-56 h-full bg-sidebar border-e border-border">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center gap-2 px-3 py-2.5 border-b border-border bg-background/95">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center text-white font-bold text-[10px]">CC</div>
            <span className="font-bold text-foreground text-sm">{t("appName")}</span>
          </div>
          <div className="ms-auto flex items-center gap-1.5">
            {/* Points badge in mobile header */}
            <PointsBadge />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle}>
              <Globe size={15} />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Achievements Panel */}
      <AchievementsPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}
