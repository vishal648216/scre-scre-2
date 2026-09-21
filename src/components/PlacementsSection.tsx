import { Star, Quote, User, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface Review {
  public_id: string;
  student_name: string;
  student_photo?: string;
  rating: number;
  comment: string;
}

const PlacementsSection = () => {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await apiFetch("/api/public/reviews");
        if (res.ok) {
          const data = await res.json();
          setReviews(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Failed to fetch reviews:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, []);

  return (
    <section id="placements" className="section-padding bg-card">
      <div className="container mx-auto">
        <div className="text-center mb-14">
          <span className="inline-block bg-accent/10 text-accent font-heading font-bold text-xs uppercase tracking-widest px-4 py-1.5 rounded-full border border-accent/20">
            {t("Success Stories")}
          </span>
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-foreground mt-4">
            {t("Our Students, Our Pride")}
          </h2>
          <div className="w-16 h-1 bg-accent mx-auto mt-4 rounded-full" />
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground italic">
            {t("Be the first student to share your success story!")}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {reviews.map((t_review) => (
              <div key={t_review.public_id} className="bg-background rounded-2xl p-6 hover-popup-subtle relative group">
                <Quote className="w-10 h-10 text-primary/10 absolute top-4 right-4" />
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t_review.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed mb-5 italic line-clamp-4">"{t(t_review.comment)}"</p>
                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-3">
                    {t_review.student_photo ? (
                      <img src={t_review.student_photo} alt={t_review.student_name} className="w-10 h-10 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-heading font-bold text-sm">
                        {t_review.student_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-heading font-bold text-sm text-foreground">{t(t_review.student_name)}</p>
                      <p className="text-secondary text-[10px] font-semibold uppercase tracking-wider">{t("Verified Student")}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default PlacementsSection;
