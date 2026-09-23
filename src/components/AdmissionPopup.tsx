import { useEffect, useState } from "react";
import { GraduationCap, Loader2, Send, X } from "lucide-react";

// Module-level flag: persists across SPA navigations, resets on full reload.
let hasShownThisPageLoad = false;

const COURSES = [
  "DCA",
  "ADCA",
  "Tally",
  "Web Designing",
  "Graphic Designing",
  "Spoken English",
  "Skill Development",
  "Other",
];

const AdmissionPopup = () => {
  const [show, setShow] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    course: "",
    centerId: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [centers, setCenters] = useState<{id: string, name: string, code: string}[]>([]);
  const [centerSearch, setCenterSearch] = useState("");

  useEffect(() => {
    // Show only once per full page load (first visit / browser reload),
    // not again on SPA route navigations.
    if (!hasShownThisPageLoad) {
      hasShownThisPageLoad = true;
      setShow(true);
    }
    fetchCenters();
  }, []);

  const fetchCenters = async () => {
    try {
      const res = await fetch("/api/public/centers");
      if (res.ok) {
        const data = await res.json();
        setCenters(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch centers", err);
    }
  };

  const filteredCenters = centers.filter(c => 
    c.name.toLowerCase().includes(centerSearch.toLowerCase()) || 
    c.code.toLowerCase().includes(centerSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    // Basic validation
    const trimmedPhone = formData.phone.trim();
    if (!/^\d{10,15}$/.test(trimmedPhone)) {
      setError("Please enter a valid phone number (10-15 digits)");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: trimmedPhone,
          email: formData.email.trim() || undefined,
          course: formData.course,
          center_id: formData.centerId || undefined,
          message: formData.message.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit enquiry");
      }

      setSubmitted(true);
      setFormData({ name: "", phone: "", email: "", course: "", centerId: "", message: "" });
      window.setTimeout(() => setShow(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-foreground/50 backdrop-blur-sm animate-fade-in-up"
      onClick={() => setShow(false)}
    >
      <div 
        className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 relative border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setShow(false)}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h3 className="font-heading font-extrabold text-xl text-foreground mb-2">Enquiry Form</h3>
          <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
            Share your details and we’ll call you back for free counseling.
          </p>
        </div>

        {submitted && (
          <div className="bg-secondary/10 text-secondary rounded-xl p-4 mb-4 font-semibold text-sm text-center">
            Thank you! We&apos;ll contact you soon.
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive rounded-xl p-4 mb-4 font-semibold text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Your Full Name"
            maxLength={100}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            disabled={isSubmitting || submitted}
          />

          <input
            type="tel"
            required
            placeholder="Phone Number"
            maxLength={15}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
            value={formData.phone}
            onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
            disabled={isSubmitting || submitted}
          />

          <input
            type="email"
            placeholder="Email Address (Optional)"
            maxLength={255}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            disabled={isSubmitting || submitted}
          />

          <select
            required
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
            value={formData.course}
            onChange={(e) => setFormData((p) => ({ ...p, course: e.target.value }))}
            disabled={isSubmitting || submitted}
          >
            <option value="">Select Course</option>
            {COURSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="space-y-1.5">
            <input
              type="text"
              placeholder="Search center by name or code..."
              className="w-full px-4 py-2 text-xs rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary"
              value={centerSearch}
              onChange={(e) => setCenterSearch(e.target.value)}
              disabled={isSubmitting || submitted}
            />
            <select
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none transition-all"
              value={formData.centerId}
              onChange={(e) => setFormData((p) => ({ ...p, centerId: e.target.value }))}
              disabled={isSubmitting || submitted}
            >
              <option value="">Select Center (Admin Default)</option>
              {filteredCenters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <textarea
            placeholder="Your Message (Optional)"
            maxLength={1000}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none resize-none transition-all"
            value={formData.message}
            onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
            disabled={isSubmitting || submitted}
          />

          <button
            type="submit"
            disabled={isSubmitting || submitted}
            className="w-full bg-gradient-to-r from-primary to-primary-dark text-primary-foreground px-6 py-3.5 rounded-xl font-heading font-bold text-base hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {isSubmitting ? "Submitting..." : "Submit Enquiry"}
          </button>

          <button
            type="button"
            onClick={() => setShow(false)}
            className="w-full text-muted-foreground text-sm hover:text-foreground transition-colors"
            disabled={isSubmitting}
          >
            Maybe Later
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdmissionPopup;
