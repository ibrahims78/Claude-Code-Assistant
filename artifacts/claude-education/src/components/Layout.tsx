import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Home, MessageCircle, BookOpen, Library, User, Settings, LogOut,
  Menu, X, Globe, Moon, Sun
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { lang, toggle, t } = useLang();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const { toast } = useToast();

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

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
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
        <header className="md:hidden flex items-center gap-3 p-4 border-b border-border bg-background/95">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center text-white font-bold text-xs">CC</div>
            <span className="font-bold text-foreground text-sm">{t("appName")}</span>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle}>
              <Globe size={15} />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
