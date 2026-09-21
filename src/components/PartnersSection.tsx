const partners = [
  "Microsoft", "Google", "Adobe", "Tally Solutions", "NSDC",
  "NIELIT", "PMKVY", "Skill India", "HARTRON", "ISO Certified",
];

const PartnersSection = () => {
  return (
    <section className="py-12 bg-card border-y border-border/50 overflow-hidden">
      <div className="container mx-auto mb-6">
        <p className="text-center text-muted-foreground font-heading font-semibold text-sm uppercase tracking-widest">
          Trusted Partners & Affiliations
        </p>
      </div>
      <div className="relative">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...partners, ...partners].map((name, i) => (
            <div
              key={`${name}-${i}`}
              className="inline-flex items-center justify-center mx-6 px-8 py-4 bg-cream-light rounded-xl border border-border/30 min-w-[180px]"
            >
              <span className="font-heading font-bold text-primary text-sm">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PartnersSection;
