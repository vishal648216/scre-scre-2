import { useState, useEffect } from "react";
import { Download, FileText, Loader2, Search } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

const DownloadsPage = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cmsRes, catRes] = await Promise.all([
          apiFetch("/api/cms?category=download&active_only=true"),
          apiFetch("/api/download-categories")
        ]);

        const cmsData = await cmsRes.json();
        const catData = await catRes.json();

        if (Array.isArray(cmsData)) setItems(cmsData);
        if (Array.isArray(catData)) setCategories(catData);
      } catch (err) {
        console.error("Failed to fetch data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  // Get current category info
  const currentCategory = selectedCategory ? categories.find(c => c._id === selectedCategory) : null;

  // Get filtered items for the selected category
  const categoryItems = currentCategory ? filtered.filter(i => i.download_category_id === selectedCategory) : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <section className="bg-primary/5 border-b border-border py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground">
              {t("Downloads &")} <span className="text-primary">{t("Resources")}</span>
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto font-medium">
              {t("Access official brochures, application forms, syllabus, and other important documents.")}
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="container mx-auto px-4">
            {/* Search Input - always visible */}
            <div className="max-w-md mx-auto mb-10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t("Search...")}
                  className="pl-10 rounded-none border-border"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {!selectedCategory ? (
              <>
                {/* Categories Table */}
                <h2 className="text-2xl font-bold text-foreground mb-6">{t("Categories")}</h2>
                <div className="overflow-x-auto border border-border">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Category Name")}</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Description")}</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">{t("Action")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {categories.filter(cat => {
                        const matchesSearch =
                          t(cat.name).toLowerCase().includes(search.toLowerCase()) ||
                          (cat.description && t(cat.description).toLowerCase().includes(search.toLowerCase()));
                        // Also show if any item in the category matches search
                        const hasMatchingItems = items.filter(i => i.download_category_id === cat._id && (
                          i.title.toLowerCase().includes(search.toLowerCase()) ||
                          (i.description && i.description.toLowerCase().includes(search.toLowerCase()))
                        )).length > 0;
                        return matchesSearch || hasMatchingItems;
                      }).map((cat) => {
                        const itemCount = filtered.filter(i => i.download_category_id === cat._id).length;
                        return (
                          <tr key={cat._id} className="hover:bg-primary/5 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 text-primary rounded-none group-hover:bg-primary group-hover:text-white transition-colors">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-tight">{t(cat.name)}</span>
                                {itemCount > 0 && (
                                  <span className="text-[10px] text-muted-foreground ml-2">({itemCount})</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider max-w-xs truncate md:max-w-md">
                                {t(cat.description || `Downloads for ${cat.name}`)}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => setSelectedCategory(cat._id)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-md shadow-primary/10"
                              >
                                {t("View")}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Uncategorized as a category */}
                      {filtered.filter(i => !i.download_category_id).length > 0 && (
                        <tr className="hover:bg-primary/5 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-muted/50 text-muted-foreground rounded-none group-hover:bg-muted group-hover:text-foreground transition-colors">
                                <FileText className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-bold uppercase tracking-tight">{t("Other Resources")}</span>
                              <span className="text-[10px] text-muted-foreground ml-2">({filtered.filter(i => !i.download_category_id).length})</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider max-w-xs truncate md:max-w-md">
                              {t("Uncategorized documents and resources")}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedCategory("uncategorized")}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground border border-border text-[10px] font-black uppercase tracking-widest hover:bg-muted/80 transition-all hover:scale-105 active:scale-95"
                            >
                              {t("View")}
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                {/* Back Button */}
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="mb-6 inline-flex items-center gap-2 px-4 py-2 border border-border hover:bg-muted transition-colors text-[10px] font-black uppercase tracking-widest"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  {t("Back to Categories")}
                </button>

                {/* Downloads List */}
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  {currentCategory ? t(currentCategory.name) : t("Other Resources")}
                </h2>

                {loading ? (
                  <div className="flex justify-center py-20">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-border">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Document Title")}</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Description")}</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:table-cell">{t("Size")}</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:table-cell">{t("Type")}</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">{t("Action")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(selectedCategory === "uncategorized"
                          ? filtered.filter(i => !i.download_category_id)
                          : categoryItems
                        ).map((item) => (
                          <tr key={item._id} className="hover:bg-primary/5 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 text-primary rounded-none group-hover:bg-primary group-hover:text-white transition-colors">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-tight">{t(item.title)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider max-w-xs truncate md:max-w-md">
                                {t(item.description || "Official document for reference.")}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hidden md:table-cell">
                              {item.file_size || t("N/A")}
                            </td>
                            <td className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hidden md:table-cell">
                              {item.file_type || t("FILE")}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={async () => {
                                  try {
                                    const response = await fetch(item.image_url);
                                    const blob = await response.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    // Extract filename from URL or use item title
                                    let filename = item.title;
                                    const pathParts = item.image_url.split('/');
                                    const nameFromUrl = pathParts[pathParts.length - 1];
                                    if (nameFromUrl && nameFromUrl.includes('.')) {
                                      filename = nameFromUrl;
                                    } else if (item.file_type) {
                                      filename = `${item.title}.${item.file_type.toLowerCase()}`;
                                    }
                                    a.href = url;
                                    a.download = filename;
                                    a.target = '_blank';
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                  } catch (err) {
                                    console.error("Failed to download file:", err);
                                    // Fallback: open in new tab
                                    window.open(item.image_url, '_blank');
                                  }
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-md shadow-primary/10"
                              >
                                <Download className="w-3 h-3" />
                                {t("Download")}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default DownloadsPage;
