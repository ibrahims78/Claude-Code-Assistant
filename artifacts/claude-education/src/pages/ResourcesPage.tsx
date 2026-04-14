import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Globe, Star, ChevronDown, Loader2, Library } from "lucide-react";

interface Resource {
  id: number;
  titleEn: string;
  titleAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  url: string;
  sourceName?: string;
  type: string;
  language: string;
  isFeatured?: boolean;
  viewCount?: number;
}

const typeColors: Record<string, string> = {
  official: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  research: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  article: "bg-green-500/15 text-green-400 border-green-500/30",
  tool: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  video: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function ResourcesPage() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState("all");
  const [langFilter, setLangFilter] = useState("all");
  const [translateModal, setTranslateModal] = useState<{ resource: Resource; translatedText: string } | null>(null);
  const [translating, setTranslating] = useState<number | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestForm, setSuggestForm] = useState({ url: "", title: "", description: "", type: "article" });
  const [suggesting, setSuggesting] = useState(false);

  const params = new URLSearchParams();
  if (typeFilter !== "all") params.set("type", typeFilter);
  if (langFilter !== "all") params.set("lang", langFilter);
  params.set("limit", "50");

  const { data } = useQuery<{ resources: Resource[] }>({
    queryKey: ["resources", typeFilter, langFilter],
    queryFn: () => api.get(`/resources?${params}`),
  });

  const resources = data?.resources || [];
  const featured = resources.filter(r => r.isFeatured);

  const handleTranslate = async (resource: Resource) => {
    setTranslating(resource.id);
    try {
      const field = resource.titleAr ? "description" : "title";
      const sourceLang = "en";
      const targetLang = "ar";
      const res = await api.post<{ translatedText: string }>(`/resources/${resource.id}/translate`, { field, sourceLang, targetLang });
      setTranslateModal({ resource, translatedText: res.translatedText });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setTranslating(null);
    }
  };

  const handleSuggest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuggesting(true);
    try {
      await api.post("/resources/suggest", suggestForm);
      toast({ title: t("success") });
      setSuggestOpen(false);
      setSuggestForm({ url: "", title: "", description: "", type: "article" });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Library size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("resources")}</h1>
          <p className="text-sm text-muted-foreground">{resources.length} {lang === "ar" ? "مصدر" : "resources"}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32 bg-muted border-border h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allTypes")}</SelectItem>
            <SelectItem value="official">{t("official")}</SelectItem>
            <SelectItem value="research">{t("research")}</SelectItem>
            <SelectItem value="article">{t("article")}</SelectItem>
            <SelectItem value="tool">{t("tool")}</SelectItem>
            <SelectItem value="video">{t("video")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={langFilter} onValueChange={setLangFilter}>
          <SelectTrigger className="w-36 bg-muted border-border h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allLanguages")}</SelectItem>
            <SelectItem value="ar">{t("arabicOnly")}</SelectItem>
            <SelectItem value="en">{t("englishOnly")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Featured */}
      {featured.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-1.5 mb-3">
            <Star size={14} className="text-yellow-400" />
            <p className="text-sm font-semibold text-foreground">{t("featured")}</p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {featured.map(r => (
              <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 w-52 p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-all group">
                <Badge className={`${typeColors[r.type] || "bg-muted text-muted-foreground"} text-[10px] border mb-2`}>
                  {t(r.type as any)}
                </Badge>
                <p className="text-xs font-medium text-foreground line-clamp-2 mb-1">
                  {lang === "ar" && r.titleAr ? r.titleAr : r.titleEn}
                </p>
                <p className="text-[10px] text-muted-foreground">{r.sourceName}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Resources List */}
      <div className="space-y-3">
        {resources.map(r => (
          <Card key={r.id} className="border-border bg-card hover:border-border/80 transition-all">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className={`${typeColors[r.type] || "bg-muted text-muted-foreground"} text-[10px] border`}>
                      {t(r.type as any)}
                    </Badge>
                    {r.isFeatured && <Star size={11} className="text-yellow-400" />}
                    {r.language === "ar" && <Globe size={11} className="text-primary" />}
                  </div>
                  <p className="font-medium text-sm text-foreground mb-0.5">
                    {lang === "ar" && r.titleAr ? r.titleAr : r.titleEn}
                  </p>
                  {(r.descriptionAr || r.descriptionEn) && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {lang === "ar" && r.descriptionAr ? r.descriptionAr : r.descriptionEn}
                    </p>
                  )}
                  {r.sourceName && (
                    <p className="text-[10px] text-muted-foreground mt-1">{r.sourceName}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-border">
                      <ExternalLink size={11} />
                      {t("viewResource")}
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground hover:text-primary"
                    onClick={() => handleTranslate(r)}
                    disabled={translating === r.id}
                  >
                    {translating === r.id ? <Loader2 size={11} className="animate-spin" /> : null}
                    {t("translate")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Suggest Resource */}
      <Collapsible open={suggestOpen} onOpenChange={setSuggestOpen} className="mt-6">
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full gap-2 border-border text-muted-foreground justify-between">
            {t("suggestResource")}
            <ChevronDown size={15} className={`transition-transform ${suggestOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-3 border-border bg-card">
            <CardContent className="p-4">
              <form onSubmit={handleSuggest} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">{t("viewResource")} URL</Label>
                  <Input value={suggestForm.url} onChange={e => setSuggestForm(f => ({ ...f, url: e.target.value }))} placeholder={t("urlPlaceholder")} disabled={suggesting} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{t("resources")}</Label>
                  <Input value={suggestForm.title} onChange={e => setSuggestForm(f => ({ ...f, title: e.target.value }))} placeholder={t("titlePlaceholder")} disabled={suggesting} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">{t("descPlaceholder")}</Label>
                  <Input value={suggestForm.description} onChange={e => setSuggestForm(f => ({ ...f, description: e.target.value }))} placeholder={t("descPlaceholder")} disabled={suggesting} />
                </div>
                <Button type="submit" size="sm" className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90" disabled={suggesting || !suggestForm.url}>
                  {suggesting ? t("loading") : t("suggest")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Translate Modal */}
      <Dialog open={!!translateModal} onOpenChange={() => setTranslateModal(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("translate")}</DialogTitle>
            <DialogDescription>{translateModal?.resource.titleEn}</DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-lg p-4 text-sm text-foreground leading-relaxed">
            {translateModal?.translatedText}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
