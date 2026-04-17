import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/lib/i18n";
import { Link } from "wouter";
import { ArrowRight, ArrowLeft, Plus, Eye, EyeOff, Star, Trash2, ExternalLink, Link as LinkIcon } from "lucide-react";

interface Resource {
  id: number;
  title: string;
  url: string;
  description?: string;
  type?: string;
  category?: string;
  isVisible: boolean;
  isFeatured: boolean;
  createdAt: string;
}

export default function AdminResourcesPage() {
  const { toast } = useToast();
  const { lang } = useLang();
  const isAr = lang === "ar";
  const queryClient = useQueryClient();
  const [showImportForm, setShowImportForm] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importTitle, setImportTitle] = useState("");
  const [importDesc, setImportDesc] = useState("");
  const [importType, setImportType] = useState("link");

  const TYPE_LABELS: Record<string, { ar: string; en: string }> = {
    link:    { ar: "رابط",  en: "Link" },
    video:   { ar: "فيديو", en: "Video" },
    book:    { ar: "كتاب",  en: "Book" },
    course:  { ar: "دورة",  en: "Course" },
    tool:    { ar: "أداة",  en: "Tool" },
    article: { ar: "مقال",  en: "Article" },
  };

  const typeLabel = (type: string) =>
    isAr ? (TYPE_LABELS[type]?.ar ?? type) : (TYPE_LABELS[type]?.en ?? type);

  const { data: resources, isLoading } = useQuery<Resource[]>({
    queryKey: ["admin-resources"],
    queryFn: () => api.get("/admin/resources"),
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: (id: number) => api.put(`/admin/resources/${id}/toggle-visibility`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-resources"] }),
    onError: (e: any) => toast({ title: isAr ? "خطأ" : "Error", description: e.message, variant: "destructive" }),
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: (id: number) => api.put(`/admin/resources/${id}/toggle-featured`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-resources"] }),
    onError: (e: any) => toast({ title: isAr ? "خطأ" : "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/resources/${id}`),
    onSuccess: () => {
      toast({ title: isAr ? "تم الحذف" : "Deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
    },
    onError: (e: any) => toast({ title: isAr ? "خطأ" : "Error", description: e.message, variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: () => api.post("/admin/resources/import-url", {
      url: importUrl, title: importTitle, description: importDesc, type: importType,
    }),
    onSuccess: () => {
      toast({ title: isAr ? "تم استيراد المصدر" : "Resource imported successfully" });
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      setShowImportForm(false);
      setImportUrl(""); setImportTitle(""); setImportDesc(""); setImportType("link");
    },
    onError: (e: any) => toast({ title: isAr ? "خطأ" : "Error", description: e.message, variant: "destructive" }),
  });

  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <button className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <BackIcon className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{isAr ? "إدارة المصادر" : "Manage Resources"}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {resources?.length ?? 0} {isAr ? "مصدر" : "resources"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowImportForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-medium transition-all"
        >
          <Plus className="w-4 h-4" />
          {isAr ? "استيراد من رابط" : "Import from URL"}
        </button>
      </div>

      {showImportForm && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h3 className="font-semibold">{isAr ? "استيراد مصدر جديد من رابط" : "Import new resource from URL"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{isAr ? "الرابط *" : "URL *"}</label>
              <input
                type="url"
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{isAr ? "العنوان *" : "Title *"}</label>
              <input
                type="text"
                value={importTitle}
                onChange={e => setImportTitle(e.target.value)}
                placeholder={isAr ? "عنوان المصدر" : "Resource title"}
                className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{isAr ? "الوصف" : "Description"}</label>
              <input
                type="text"
                value={importDesc}
                onChange={e => setImportDesc(e.target.value)}
                placeholder={isAr ? "وصف مختصر" : "Short description"}
                className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{isAr ? "النوع" : "Type"}</label>
              <select
                value={importType}
                onChange={e => setImportType(e.target.value)}
                className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{isAr ? v.ar : v.en}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || !importUrl || !importTitle}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <LinkIcon className="w-4 h-4" />
              {importMutation.isPending ? (isAr ? "جاري الاستيراد..." : "Importing...") : (isAr ? "استيراد" : "Import")}
            </button>
            <button
              onClick={() => setShowImportForm(false)}
              className="px-6 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : !resources?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <LinkIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{isAr ? "لا توجد مصادر بعد" : "No resources yet"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map(resource => (
            <div key={resource.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{resource.title}</h3>
                  {resource.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{resource.description}</p>
                  )}
                </div>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors p-1 shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {resource.type && (
                  <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                    {typeLabel(resource.type)}
                  </span>
                )}
                {resource.isFeatured && (
                  <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">
                    {isAr ? "مميز" : "Featured"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 pt-1 border-t border-border">
                <button
                  onClick={() => toggleVisibilityMutation.mutate(resource.id)}
                  title={resource.isVisible ? (isAr ? "إخفاء" : "Hide") : (isAr ? "إظهار" : "Show")}
                  className={`p-1.5 rounded-lg transition-colors ${resource.isVisible ? "text-green-400 hover:bg-green-500/10" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {resource.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => toggleFeaturedMutation.mutate(resource.id)}
                  title={resource.isFeatured ? (isAr ? "إلغاء التمييز" : "Unfeature") : (isAr ? "تمييز" : "Feature")}
                  className={`p-1.5 rounded-lg transition-colors ${resource.isFeatured ? "text-yellow-400 hover:bg-yellow-500/10" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <Star className="w-4 h-4" />
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    const msg = isAr ? "هل أنت متأكد من حذف هذا المصدر؟" : "Are you sure you want to delete this resource?";
                    if (confirm(msg)) deleteMutation.mutate(resource.id);
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
