import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag, Loader2, Tag, Search, Filter } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { normalizeAssetUrl } from "@/lib/utils";

interface Product {
  _id?: string;
  title: string;
  description: string;
  price?: number;
  image_url: string;
  link?: string;
}

const ShopPage = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await apiFetch("/api/cms?category=shop&active_only=true");
        if (res.ok) {
          const data = await res.json();
          setProducts(data);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="font-heading font-extrabold text-4xl text-primary uppercase tracking-tight flex items-center gap-3">
              <ShoppingBag className="w-10 h-10" />
              {t("Student Shop")}
            </h1>
            <p className="text-muted-foreground mt-2 font-medium uppercase tracking-widest text-sm">
              {t("Supporting student creativity and craftsmanship")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("Search products...")}
                className="pl-10 pr-4 py-2 border border-border bg-card rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary focus:outline-none w-full sm:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">{t("Loading Products...")}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-24 bg-muted/20 border border-dashed border-border">
            <ShoppingBag className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-bold text-foreground uppercase tracking-tight">{t("No products found")}</p>
            <p className="text-sm text-muted-foreground uppercase tracking-widest mt-1">{t("Try adjusting your search or filters")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredProducts.map((product) => (
              <Card key={product._id} className="rounded-none border-border group hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-500 overflow-hidden flex flex-col h-full bg-card">
                <div className="aspect-[4/5] overflow-hidden bg-muted/10 relative">
                  <img
                    src={normalizeAssetUrl(product.image_url) || "/images/icc-1.jpg"}
                    alt={t(product.title)}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.fallbackApplied) {
                        target.dataset.fallbackApplied = "true";
                        target.src = "/images/icc-1.jpg";
                      }
                    }}
                  />
                  <div className="absolute top-4 right-4 translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
                    <span className="bg-primary text-primary-foreground text-[10px] font-black px-4 py-1.5 uppercase tracking-[0.2em] shadow-2xl">
                      {t("New Arrival")}
                    </span>
                  </div>
                  {product.link && (
                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                       <a
                        href={product.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-primary text-primary-foreground px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] translate-y-4 group-hover:translate-y-0 transition-all duration-500 shadow-2xl hover:bg-primary/90"
                      >
                        {t("Quick View")}
                      </a>
                    </div>
                  )}
                </div>
                <CardContent className="p-6 flex flex-col flex-grow">
                  <div className="space-y-1 mb-4">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">{t("Student Collection")}</span>
                    </div>
                    <h3 className="font-heading font-black text-xl uppercase tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                      {t(product.title)}
                    </h3>
                  </div>
                  
                  <p className="text-muted-foreground text-xs font-medium leading-relaxed uppercase tracking-tight line-clamp-3 mb-6 flex-grow">
                    {t(product.description)}
                  </p>

                  <div className="mt-auto pt-6 border-t border-border/50 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t("Investment")}</span>
                      <span className="text-2xl font-black text-foreground tracking-tighter">₹{product.price?.toLocaleString() || "0"}</span>
                    </div>
                    
                    {product.link ? (
                      <a
                        href={product.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-foreground text-background px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-2 group/btn"
                      >
                        {t("Buy Now")}
                        <ShoppingBag className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                      </a>
                    ) : (
                      <button className="bg-muted text-muted-foreground px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] cursor-not-allowed opacity-60">
                        {t("Sold Out")}
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ShopPage;
