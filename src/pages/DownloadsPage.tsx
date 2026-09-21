import { useState, useEffect } from "react";
import {
  Download,
  FileText,
  Loader2,
  Search,
  Eye,
  BookOpen,
  CheckCircle2,
  Layers,
  Sparkles,
  ExternalLink,
  FileCode,
  LayoutGrid,
  List,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const DownloadsPage = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [previewItem, setPreviewItem] = useState<any | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cmsRes, catRes] = await Promise.all([
          apiFetch("/api/cms?category=download&active_only=true"),
          apiFetch("/api/download-categories"),
        ]);

        const cmsData = await cmsRes.json();
        const catData = await catRes.json();

        if (Array.isArray(cmsData)) setItems(cmsData);
        if (Array.isArray(catData)) setCategories(catData);
      } catch (err) {
        console.error("Failed to fetch download items", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDownload = async (item: any) => {
    try {
      const fileUrl = item.image_url || item.file_url;
      if (!fileUrl) {
        toast.error(t("Download file link unavailable"));
        return;
      }
      toast.info(t("Initiating download for {{title}}", { title: item.title }));

      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      let filename = item.title;
      const pathParts = fileUrl.split("/");
      const nameFromUrl = pathParts[pathParts.length - 1];
      if (nameFromUrl && nameFromUrl.includes(".")) {
        filename = nameFromUrl;
      } else if (item.file_type) {
        filename = `${item.title}.${item.file_type.toLowerCase()}`;
      }
      a.href = url;
      a.download = filename;
      a.target = "_blank";
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(t("Download completed!"));
    } catch (err) {
      console.error("Direct download failed", err);
      window.open(item.image_url || item.file_url, "_blank");
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title?.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" ||
      (selectedCategory === "uncategorized"
        ? !item.download_category_id
        : item.download_category_id === selectedCategory);

    return matchesSearch && matchesCategory;
  });

  const getCategoryName = (catId?: string) => {
    if (!catId) return t("General Resource");
    const found = categories.find((c) => c._id === catId || c.id === catId);
    return found ? t(found.name) : t("General Resource");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Banner Section */}
        <section className="bg-primary/5 border-b border-border py-16">
          <div className="container mx-auto px-4 text-center">
            <Badge className="mb-4 bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-none">
              Authorized Learning Repository
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground">
              {t("Downloads &")} <span className="text-primary">{t("Resources")}</span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto font-medium text-sm md:text-base">
              {t(
                "Official study materials, syllabus guides, previous question papers, lab manuals, and application handbooks."
              )}
            </p>
          </div>
        </section>

        {/* Catalog Control Section */}
        <section className="py-8 border-b border-border bg-card/50">
          <div className="container mx-auto px-4 space-y-6">
            {/* Search and View Mode controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t("Search by document title, keywords, or subjects...")}
                  className="pl-10 rounded-none border-border bg-background h-11"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  {filteredItems.length} {t("Documents Available")}
                </span>
                <div className="flex border border-border bg-background">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={`rounded-none px-3 h-9 ${
                      viewMode === "grid" ? "bg-primary text-primary-foreground hover:bg-primary" : ""
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className={`rounded-none px-3 h-9 ${
                      viewMode === "table" ? "bg-primary text-primary-foreground hover:bg-primary" : ""
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
                className="rounded-none text-xs font-black uppercase tracking-widest h-9 shrink-0"
              >
                {t("All Downloads")}
                <Badge variant="secondary" className="ml-2 text-[10px] rounded-none">
                  {items.length}
                </Badge>
              </Button>

              {categories.map((cat) => {
                const count = items.filter((i) => i.download_category_id === cat._id).length;
                const isSelected = selectedCategory === cat._id;
                return (
                  <Button
                    key={cat._id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat._id)}
                    className="rounded-none text-xs font-black uppercase tracking-widest h-9 shrink-0 border-border"
                  >
                    {t(cat.name)}
                    {count > 0 && (
                      <Badge
                        variant="secondary"
                        className={`ml-2 text-[10px] rounded-none ${
                          isSelected ? "bg-primary-foreground text-primary" : ""
                        }`}
                      >
                        {count}
                      </Badge>
                    )}
                  </Button>
                );
              })}

              {items.some((i) => !i.download_category_id) && (
                <Button
                  variant={selectedCategory === "uncategorized" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory("uncategorized")}
                  className="rounded-none text-xs font-black uppercase tracking-widest h-9 shrink-0 border-border"
                >
                  {t("Other Resources")}
                  <Badge variant="secondary" className="ml-2 text-[10px] rounded-none">
                    {items.filter((i) => !i.download_category_id).length}
                  </Badge>
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-12">
          <div className="container mx-auto px-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  {t("Loading Resources...")}
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-16 border border-dashed border-border text-center bg-card">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-bold text-foreground mb-1">{t("No Documents Found")}</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {t("There are currently no resources matching your active search or category selection.")}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("all");
                  }}
                  className="mt-6 rounded-none text-xs font-bold uppercase tracking-widest"
                >
                  {t("Reset Filters")}
                </Button>
              </div>
            ) : viewMode === "grid" ? (
              /* Grid View */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredItems.map((item) => {
                  const fileType = item.file_type || (item.image_url?.endsWith(".pdf") ? "PDF" : "DOC");
                  return (
                    <Card
                      key={item._id}
                      className="rounded-none border-border hover:border-primary/50 transition-all flex flex-col group bg-card hover:shadow-lg"
                    >
                      <CardContent className="p-5 flex flex-col h-full space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <Badge
                            variant="outline"
                            className="bg-primary/5 text-primary text-[9px] font-black uppercase tracking-wider rounded-none border-primary/20 truncate max-w-[170px]"
                          >
                            {getCategoryName(item.download_category_id)}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="text-[9px] font-black uppercase tracking-widest rounded-none"
                          >
                            {fileType}
                          </Badge>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-primary/10 text-primary flex items-center justify-center shrink-0 rounded-none group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm uppercase tracking-tight line-clamp-2 text-foreground">
                              {t(item.title)}
                            </h3>
                            {item.file_size && (
                              <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                                {item.file_size}
                              </p>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                          {t(item.description || "Official learning reference document and downloadable syllabus guide.")}
                        </p>

                        <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewItem(item)}
                            className="rounded-none text-[10px] font-black uppercase tracking-widest h-8 px-3 border-border hover:bg-muted"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            {t("Preview")}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleDownload(item)}
                            className="rounded-none text-[10px] font-black uppercase tracking-widest h-8 px-3.5 bg-primary text-primary-foreground"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            {t("Download")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              /* Table View */
              <div className="border border-border bg-card overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {t("Document Title")}
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {t("Category")}
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                        {t("Description")}
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                        {t("Format")}
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">
                        {t("Actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredItems.map((item) => (
                      <tr key={item._id} className="hover:bg-primary/5 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 text-primary rounded-none group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold uppercase tracking-tight block">
                                {t(item.title)}
                              </span>
                              {item.file_size && (
                                <span className="text-[10px] text-muted-foreground font-semibold">
                                  {item.file_size}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider rounded-none">
                            {getCategoryName(item.download_category_id)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <p className="text-xs text-muted-foreground line-clamp-1 max-w-sm">
                            {t(item.description || "Official document.")}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                          {item.file_type || "PDF"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPreviewItem(item)}
                              className="rounded-none text-[10px] font-black uppercase tracking-widest h-8 px-3 border-border"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              {t("Preview")}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDownload(item)}
                              className="rounded-none text-[10px] font-black uppercase tracking-widest h-8 px-3 bg-primary text-primary-foreground"
                            >
                              <Download className="w-3.5 h-3.5 mr-1" />
                              {t("Download")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Document In-Browser Preview Modal */}
        <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
          <DialogContent className="max-w-4xl h-[85vh] p-0 rounded-none flex flex-col bg-card border-border">
            {previewItem && (
              <>
                <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-base font-bold uppercase tracking-tight">
                      {t(previewItem.title)}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      {getCategoryName(previewItem.download_category_id)} • In-Browser Document Preview
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-2 pr-6">
                    <Button
                      size="sm"
                      onClick={() => handleDownload(previewItem)}
                      className="rounded-none text-xs font-black uppercase tracking-widest h-8"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      {t("Download File")}
                    </Button>
                  </div>
                </div>

                <div className="flex-1 bg-muted/20 relative overflow-hidden flex items-center justify-center p-2">
                  {previewItem.image_url || previewItem.file_url ? (
                    <iframe
                      src={`${previewItem.image_url || previewItem.file_url}#toolbar=0`}
                      className="w-full h-full border-none bg-white"
                      title={previewItem.title}
                    />
                  ) : (
                    <div className="text-center p-8">
                      <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-3 opacity-40" />
                      <p className="text-sm font-bold">{t("Preview not available for this file type.")}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("Please click download to view on your device.")}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>

      <Footer />
    </div>
  );
};

export default DownloadsPage;
