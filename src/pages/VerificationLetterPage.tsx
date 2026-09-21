import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, ShieldCheck, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface VerificationItem {
  _id?: any;
  title: string;
  description?: string;
  image_url?: string;
  pdf_url?: string;
  order: number;
}

const VerificationLetterPage = () => {
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await apiFetch("/api/cms?category=verification&active_only=true");
        const data = await res.json();
        if (Array.isArray(data)) {
          setItems(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
        }
      } catch (err) {
        console.error("Failed to fetch verification letters");
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-primary py-20 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-white/10 p-4 rounded-full backdrop-blur-sm">
              <ShieldCheck className="w-12 h-12 text-accent" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
            Verification Letters
          </h1>
          <p className="text-primary-foreground/80 max-w-2xl mx-auto text-lg font-medium">
            Official recognition and authorization documents for our centers and partners.
          </p>
        </div>
      </section>

      {/* Letters Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Loading documents...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-3xl max-w-2xl mx-auto">
              <p className="text-muted-foreground font-bold uppercase tracking-widest">No verification letters found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {items.map((item, idx) => (
                <Card key={idx} className="rounded-3xl border-border/50 overflow-hidden group hover:border-primary/50 transition-all duration-500 shadow-xl hover:shadow-2xl flex flex-col h-full">
                  {/* Image Preview */}
                  <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-16 h-16 text-muted-foreground/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </div>

                  <CardContent className="p-8 flex flex-col flex-1">
                    <h3 className="text-xl font-black uppercase tracking-tight mb-3 text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-8 flex-1">
                      {item.description || "Official verification document for our authorized entities."}
                    </p>
                    
                    <div className="flex flex-col gap-3">
                      {item.pdf_url && (
                        <Button 
                          asChild
                          className="w-full rounded-2xl h-12 font-bold uppercase tracking-widest text-xs gap-2 shadow-lg shadow-primary/20"
                        >
                          <a href={item.pdf_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                            View Official PDF
                          </a>
                        </Button>
                      )}
                      
                      <div className="flex items-center justify-center py-2 px-4 rounded-xl bg-muted/50 border border-border/50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <ShieldCheck className="w-3 h-3" />
                          Verified Document
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default VerificationLetterPage;
