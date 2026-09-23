import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const rows = [
  { label: "Industry-aligned curriculum", scr: true, other: false, note: "Updated modules + job-focused topics" },
  { label: "Practical lab + live projects", scr: true, other: false, note: "Hands-on training with assignments" },
  { label: "Placement support", scr: true, other: false, note: "Interview prep + guidance" },
  { label: "Regular tests & progress tracking", scr: true, other: false, note: "Assessments + improvement plan" },
  { label: "Modern lab infrastructure", scr: true, other: false, note: "Updated systems + tools" },
  { label: "Career guidance & roadmap", scr: true, other: false, note: "Role-based learning path" },
];

const StatChip = ({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "primary" | "accent" | "secondary";
}) => {
  const toneCls =
    tone === "primary"
      ? "bg-primary/10 text-primary border-primary/15"
      : tone === "secondary"
      ? "bg-secondary/10 text-secondary border-secondary/15"
      : "bg-accent/15 text-accent-dark border-accent/20";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneCls}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-80">
        {title}
      </div>
      <div className="text-lg font-extrabold mt-1">{value}</div>
    </div>
  );
};

const ComparisonSection = () => {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10 mb-12">
          <div>
            <span className="inline-flex items-center gap-2 bg-accent/15 text-accent-dark border border-accent/20 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.18em]">
              Comparison Chart
            </span>

            <h2 className="mt-5 text-3xl md:text-4xl font-extrabold text-foreground leading-tight">
              SCR Education vs Other Centers
            </h2>

            <p className="mt-3 text-muted-foreground max-w-2xl leading-relaxed">
              A clear, honest comparison so students choose the right institute
              with confidence.
            </p>
          </div>

          {/* <div className="grid grid-cols-3 gap-3 w-full lg:w-[460px]">
            <StatChip title="Students" value="5000+" tone="primary" />
            <StatChip title="Courses" value="20+" tone="secondary" />
            <StatChip title="Placements" value="3000+" tone="accent" />
          </div> */}
        </div>

        {/* Table Card */}
        <div className="rounded-3xl border border-border bg-card shadow-xl overflow-hidden">
          {/* top bar */}
          <div className="h-1 bg-gradient-to-r from-primary via-accent to-secondary" />

          {/* table header */}
          <div className="grid grid-cols-12 gap-4 px-6 md:px-10 py-5 bg-muted/30 border-b border-border">
            <div className="col-span-12 md:col-span-6">
              <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-muted-foreground">
                Feature
              </p>
            </div>

            <div className="col-span-6 md:col-span-3">
              <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-primary">
                SCR Education
              </p>
            </div>

            <div className="col-span-6 md:col-span-3">
              <p className="text-[11px] uppercase tracking-[0.22em] font-bold text-muted-foreground">
                Other Centers
              </p>
            </div>
          </div>

          {/* rows */}
          <div className="divide-y divide-border">
            {rows.map((r, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-4 px-6 md:px-10 py-6 hover:bg-muted/20 transition-colors"
              >
                <div className="col-span-12 md:col-span-6">
                  <p className="text-foreground font-bold">{r.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.note}
                  </p>
                </div>

                {/* SCR */}
                <div className="col-span-6 md:col-span-3 flex items-center gap-3">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <span className="font-extrabold text-foreground">Yes</span>
                  </span>
                </div>

                {/* Others */}
                <div className="col-span-6 md:col-span-3 flex items-center gap-3">
                  <span className="inline-flex items-center gap-2">
                    <XCircle className="w-6 h-6 text-red-600" />
                    <span className="font-extrabold text-foreground">No</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* CTA row */}
          <div className="px-6 md:px-10 py-6 bg-muted/30 border-t border-border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Want to talk to our counselor and pick the best course for you?
            </p>

            <Link
              to="/admission"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:bg-primary-dark transition"
            >
              Get Free Counseling <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ComparisonSection;