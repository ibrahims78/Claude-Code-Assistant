import { Link } from "wouter";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, BookOpen, Library, ArrowLeft, ArrowRight, Sparkles, Code2, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function HomePage() {
  const { t, lang } = useLang();
  const { user } = useAuth();

  const { data: adminData } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<any>("/admin/dashboard"),
    enabled: !!user?.role,
    retry: false,
  });

  const ArrowIcon = lang === "ar" ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative pt-16 pb-20 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.15),transparent_70%)]" />
        <div className="relative max-w-3xl mx-auto">
          <Badge className="mb-4 bg-primary/20 text-primary border-primary/30 hover:bg-primary/20">
            <Sparkles size={12} className="me-1" />
            Claude Code v5.0
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold mb-5 leading-tight">
            <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {t("heroTitle")}
            </span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
            {t("heroSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {user ? (
              <Link href="/chat">
                <Button size="lg" className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90 shadow-lg shadow-primary/30 gap-2">
                  <MessageCircle size={18} />
                  {t("chat")}
                  <ArrowIcon size={16} />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/register">
                  <Button size="lg" className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90 shadow-lg shadow-primary/30 gap-2">
                    {t("startLearning")}
                    <ArrowIcon size={16} />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="border-border gap-2">
                    {t("login")}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      {user && adminData && (
        <section className="py-6 px-6 border-y border-border bg-card/50">
          <div className="max-w-2xl mx-auto grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-foreground">{adminData.totalUsers || 0}</p>
              <p className="text-xs text-muted-foreground">{t("totalUsers")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{adminData.totalConversations || 0}</p>
              <p className="text-xs text-muted-foreground">{t("totalConversations")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{adminData.totalChunks || 0}</p>
              <p className="text-xs text-muted-foreground">{t("totalChunks")}</p>
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto grid md:grid-cols-3 gap-6">
          <FeatureCard icon={<MessageCircle size={24} className="text-primary" />} title={t("aiChat")} desc={t("aiChatDesc")} href="/chat" t={t} />
          <FeatureCard icon={<BookOpen size={24} className="text-blue-400" />} title={t("learningPaths")} desc={t("learningPathsDesc")} href="/learn" t={t} />
          <FeatureCard icon={<Library size={24} className="text-cyan-400" />} title={t("resources")} desc={t("resourcesDesc")} href="/resources" t={t} />
        </div>
      </section>

      {/* Tech Stack */}
      <section className="pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-wrap gap-2 justify-center">
            {["Claude API", "pgvector", "RAG", "Socket.IO", "React 19", "TypeScript", "PostgreSQL"].map(tech => (
              <Badge key={tech} variant="outline" className="border-border text-muted-foreground">
                <Code2 size={11} className="me-1" />
                {tech}
              </Badge>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc, href, t }: any) {
  return (
    <Link href={href}>
      <Card className="border-border bg-card hover:border-primary/40 transition-all cursor-pointer group h-full">
        <CardContent className="p-6 flex flex-col gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            {icon}
          </div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
