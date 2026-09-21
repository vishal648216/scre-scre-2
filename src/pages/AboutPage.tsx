import { ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useHomeData } from "@/hooks/useHomeData";
import Header from "@/components/Header";
import AboutSection from "@/components/AboutSection";
import Footer from "@/components/Footer";
import { apiFetch } from "@/lib/api";

const AboutPage = () => {
  const { t, i18n } = useTranslation();
  const { data: homeData } = useHomeData();
  const [content, setContent] = useState<any>(null);
  const [directorMessages, setDirectorMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const lang = i18n.language.split("-")[0].toLowerCase();

        // Fetch about page content
        const res = await apiFetch(`/api/cms?category=page&active_only=true&lang=${lang}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          const about = data.find(item =>
            item.link === "/about" ||
            item.title?.toLowerCase().includes("about")
          );
          if (about) setContent(about);
        }

        // Fetch director messages
        const dRes = await apiFetch(`/api/cms?category=directormessage&active_only=true&lang=${lang}`);
        const dData = await dRes.json();
        if (Array.isArray(dData)) {
          setDirectorMessages(dData);
        }
      } catch (err) {
        console.error("Failed to fetch about content", err);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [i18n.language]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // If no dynamic content, we can still show the static version or a mix
  // For now, let's keep the static version as a fallback or structure provider
  // and inject dynamic parts where they make sense.

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Header />
      <AboutSection />

      {/* ================= PREMIUM HERO ================= */}
      <section className="relative py-28 bg-background overflow-hidden">
        <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-20 items-center">

          {/* ===== LEFT CONTENT ===== */}
          <div>
            <span className="text-accent text-xs uppercase tracking-[0.2em] font-bold">
              {t("About SCRE")}
            </span>

            <h1 className="text-5xl md:text-6xl font-extrabold text-foreground mt-8 leading-tight">
              {content?.title || t("Education That transforms Into Careers")}
            </h1>

            <p className="text-muted-foreground mt-8 text-lg leading-relaxed max-w-xl">
              {content?.description || t("For over a decade, SCRE has empowered students with practical, industry-aligned learning experiences that translate into real professional success.")}
            </p>

            <Link
              to="/admission"
              className="inline-flex items-center gap-3 mt-10 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold hover:bg-primary-dark transition"
            >
              {t("Begin Your Journey")}
              <ArrowRight size={18} />
            </Link>
          </div>

          {/* ===== RIGHT IMAGE BLOCK ===== */}
          <div className="relative flex justify-center">

            {/* Accent Glow Behind */}
            <div className="absolute -bottom-12 -right-12 w-80 h-80 bg-accent/30 rounded-full blur-3xl"></div>

            {/* Secondary Subtle Glow */}
            <div className="absolute -top-10 -left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl"></div>

            {/* Image Card */}
            <div className="relative w-full max-w-lg h-[420px] rounded-3xl overflow-hidden shadow-2xl border border-border">

              <img
                src={content?.image_url || "/images/icc-3.jpg"}
                alt="About SCRE"
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Soft Overlay for Professional Tone */}
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-transparent to-transparent"></div>

            </div>

          </div>

        </div>
      </section>

      {content?.content && (
        <section className="py-20 bg-background border-t border-border">
          <div className="container mx-auto px-4 prose prose-slate max-w-none prose-headings:font-extrabold prose-headings:uppercase prose-headings:tracking-tight">
            <div dangerouslySetInnerHTML={{ __html: content.content }} />
          </div>
        </section>
      )}


      {/* ================= STORY SECTION (NO CARDS) ================= */}
      <section className="py-28 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-20">

          <div className="relative">

            {/* Accent Vertical Line */}
            <div className="absolute left-0 top-0 w-1 h-full bg-accent"></div>

            <div className="pl-6">

              <h2 className="text-4xl font-extrabold text-foreground">
                {t("Our Journey")}
              </h2>

              {/* Establishment Year */}
              <div className="mt-10">
                <div className="text-6xl font-extrabold text-primary leading-none">
                  2014
                </div>
                <p className="text-muted-foreground mt-2 uppercase tracking-widest text-xs font-bold">
                  {t("Established")}
                </p>
              </div>

              {/* Milestones */}
              <div className="mt-12 space-y-6 text-sm">

                <div>
                  <p className="font-semibold text-foreground">
                    {t("Expansion of Academic Network")}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    {t("Built a strong franchise ecosystem ensuring standardized quality education.")}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-foreground">
                    {t("Placement-Driven Curriculum")}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    {t("Introduced industry-aligned programs with real-world project training.")}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-foreground">
                    {t("Digital Transformation")}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    {t("Integrated modern tools, labs, and digital infrastructure for advanced learning.")}
                  </p>
                </div>

              </div>

            </div>
          </div>

          <div className="space-y-8 text-muted-foreground leading-relaxed">
            <p>
              {t("Founded with a mission to bridge the gap between academic education and industry demand, SCRE has evolved into a trusted institution offering professional courses in technology, design, finance, and skill development.")}
            </p>

            <p>
              {t("Our commitment to structured training, standardized curriculum, and placement-focused learning has helped thousands of students build sustainable careers.")}
            </p>

            <p>
              {t("We continuously upgrade our academic framework to align with global digital transformation trends.")}
            </p>
          </div>

        </div>
      </section>

      {/* ================= TIMELINE STRIP ================= */}
      {/* <section className="py-24">
          <div className="container mx-auto px-4">

            <div className="flex justify-between border-t border-border pt-10 text-center">

              <div>
                <div className="text-4xl font-extrabold text-primary">2014</div>
                <p className="text-muted-foreground text-sm mt-2">{t("Founded")}</p>
              </div>

              <div>
                <div className="text-4xl font-extrabold text-primary">5000+</div>
                <p className="text-muted-foreground text-sm mt-2">{t("Students")}</p>
              </div>

              <div>
                <div className="text-4xl font-extrabold text-primary">20+</div>
                <p className="text-muted-foreground text-sm mt-2">{t("Courses")}</p>
              </div>

              <div>
                <div className="text-4xl font-extrabold text-primary">3000+</div>
                <p className="text-muted-foreground text-sm mt-2">{t("Placements")}</p>
              </div>

            </div>

          </div>
        </section> */}

      {/* ================= DIRECTOR MESSAGES ================= */}
      {directorMessages.length > 0 ? directorMessages.map((directorMessage, index) => (
        <section
          key={index}
          className={`${index % 2 === 0 ? "bg-primary text-primary-foreground" : "bg-muted/30"} py-28 relative overflow-hidden`}
        >
          <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-20 items-center">
            {/* ===== LEFT/RIGHT CONTENT ===== */}
            <div className={index % 2 === 0 ? "" : "order-2"}>
              <h2 className="text-4xl font-extrabold leading-tight">
                {directorMessage?.title || t("Message From The Director")}
              </h2>

              <div className="mt-8 leading-relaxed space-y-4">
                {directorMessage?.content ? (
                  <div className="whitespace-pre-wrap">{directorMessage.content}</div>
                ) : (
                  <>
                    <p>
                      {t("“Our vision has always been to create a skill-driven ecosystem where students are not only educated but professionally prepared to thrive in competitive industries. At SCRE, we believe that true learning goes beyond textbooks — it requires practical exposure, discipline, adaptability, and a deep understanding of industry expectations.”")}
                    </p>
                    <p>
                      {t("We remain committed to innovation, continuous improvement, and maintaining the highest standards of educational excellence across all our centers.")}
                    </p>
                  </>
                )}
              </div>

              <p className="mt-8 font-bold">
                {directorMessage?.description ? directorMessage.description : `— ${t("Director, SCRE Pvt. Ltd.")}`}
              </p>
            </div>

            {/* ===== RIGHT/LEFT IMAGE / VIDEO BLOCK ===== */}
            <div className={`relative flex justify-center ${index % 2 === 0 ? "" : "order-1"}`}>
              {/* Accent Glow */}
              <div className="absolute -bottom-10 -right-10 w-72 h-72 bg-accent/30 rounded-full blur-3xl"></div>

              {/* Media Card */}
              <div className="relative w-full max-w-md aspect-[4/5] md:h-[420px] rounded-3xl overflow-hidden shadow-2xl border bg-black/20">
                {(() => {
                  const videos = directorMessage?.video_urls || [];
                  const hasVideos = videos.length > 0;
                  const videoUrl = directorMessage?.video_url;

                  if (hasVideos || videoUrl) {
                    const url = hasVideos ? videos[0] : videoUrl;
                    let embedUrl = "";
                    if (url) {
                      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                      const match = url.match(regExp);
                      if (match && match[2].length === 11) {
                        embedUrl = `https://www.youtube.com/embed/${match[2]}?autoplay=0`;
                      }
                    }

                    if (embedUrl) {
                      return (
                        <div className="w-full h-full">
                          <iframe
                            src={embedUrl}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      );
                    } else if (url) {
                      return (
                        <div className="w-full h-full">
                          <video
                            src={url}
                            className="w-full h-full object-cover"
                            controls
                            playsInline
                          />
                        </div>
                      );
                    }
                  }

                  return (
                    <img
                      src={directorMessage?.image_url || "/images/icc-1.jpg"}
                      alt="Director SCRE"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  );
                })()}

                {/* Soft Overlay for premium tone - only show if it's an image */}
                {!directorMessage?.video_url && (!directorMessage?.video_urls || directorMessage.video_urls.length === 0) && (
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/40 via-transparent to-transparent pointer-events-none"></div>
                )}
              </div>
            </div>
          </div>
        </section>
      )) : null}
      {/* ================= RECOGNITION BAND ================= */}
      <section className="py-20 bg-background border-t border-border relative overflow-hidden">
        {/* subtle background accents */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-muted-foreground uppercase tracking-[0.25em] text-xs font-bold">
              {t("Recognitions & Certifications")}
            </p>

            <h3 className="text-3xl md:text-4xl font-extrabold text-foreground mt-4">
              {t("Trusted. Verified.")} <span className="text-primary">{t("Recognized.")}</span>
            </h3>

            <p className="text-muted-foreground mt-5 leading-relaxed">
              {t("Our certifications and registrations reflect our commitment to quality, compliance, and consistent learning standards across all centers.")}
            </p>
          </div>

          {/* badges */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ISO */}
            <div className="group bg-card border border-border rounded-2xl p-7 shadow-sm hover:shadow-xl transition-all">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <div className="w-6 h-6 rounded-full bg-primary" />
              </div>
              <h4 className="text-lg font-bold text-foreground text-center mt-5">
                {t("ISO Certified")}
              </h4>
              <p className="text-muted-foreground text-sm text-center mt-2 leading-relaxed">
                {t("Quality standards aligned to ensure structured training and consistent outcomes.")}
              </p>
              <div className="mt-6 h-[2px] w-14 bg-accent mx-auto rounded-full opacity-70 group-hover:w-20 transition-all" />
            </div>

            {/* MSME */}
            <div className="group bg-card border border-border rounded-2xl p-7 shadow-sm hover:shadow-xl transition-all">
              <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto">
                <div className="w-6 h-6 rounded-full bg-secondary" />
              </div>
              <h4 className="text-lg font-bold text-foreground text-center mt-5">
                {t("MSME Registered")}
              </h4>
              <p className="text-muted-foreground text-sm text-center mt-2 leading-relaxed">
                {t("Officially recognized under MSME for trusted operations and verified institution identity.")}
              </p>
              <div className="mt-6 h-[2px] w-14 bg-accent mx-auto rounded-full opacity-70 group-hover:w-20 transition-all" />
            </div>

            {/* Company Act */}
            <div className="group bg-card border border-border rounded-2xl p-7 shadow-sm hover:shadow-xl transition-all">
              <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center mx-auto">
                <div className="w-6 h-6 rounded-full bg-accent" />
              </div>
              <h4 className="text-lg font-bold text-foreground text-center mt-5">
                {t("Company Act 2013 Registered")}
              </h4>
              <p className="text-muted-foreground text-sm text-center mt-2 leading-relaxed">
                {t("Registered as a compliant organization with verified legal structure and credibility.")}
              </p>
              <div className="mt-6 h-[2px] w-14 bg-accent mx-auto rounded-full opacity-70 group-hover:w-20 transition-all" />
            </div>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="py-28 bg-muted/30 border-t border-border relative overflow-hidden">
        {/* glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-accent/12 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative">
          <div className="bg-card border border-border rounded-3xl p-10 md:p-14 shadow-xl overflow-hidden relative">
            {/* accent strip */}
            <div className="absolute top-0 left-0 h-full w-1 bg-accent" />

            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* LEFT */}
              <div>
                <p className="text-accent text-xs uppercase tracking-[0.25em] font-bold">
                  {t("Start Your Admission")}
                </p>

                <h2 className="text-4xl md:text-5xl font-extrabold text-foreground mt-6 leading-tight">
                  {t("The Future Belongs")} <br />
                  {t("To")} <span className="text-primary">{t("Skilled Professionals")}</span>
                </h2>

                <p className="text-muted-foreground mt-6 leading-relaxed max-w-xl">
                  {t("Join SCRE and learn with practical training, modern labs, expert mentorship and placement-focused preparation — built to help you succeed in today’s competitive market.")}
                </p>

                <div className="mt-10 flex flex-col sm:flex-row gap-4">
                  <Link
                    to="/admission"
                    className="inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground font-bold px-10 py-4 rounded-xl hover:opacity-90 transition"
                  >
                    {t("Apply Now")}
                  </Link>

                  <Link
                    to="/courses"
                    className="inline-flex items-center justify-center gap-2 bg-primary/10 text-primary font-bold px-10 py-4 rounded-xl hover:bg-primary/15 transition"
                  >
                    {t("Explore Courses")}
                  </Link>
                </div>
              </div>

              {/* RIGHT */}
              <div className="relative">
                <div className="rounded-3xl bg-primary text-primary-foreground p-10 md:p-12 shadow-2xl relative overflow-hidden">
                  <div className="absolute -top-16 -right-16 w-72 h-72 bg-accent/25 rounded-full blur-3xl" />

                  <h3 className="text-2xl font-extrabold leading-snug">
                    {t("Get job-ready skills with structured learning.")}
                  </h3>

                  <ul className="mt-6 space-y-4 text-primary-foreground/85 text-sm">
                    <li className="flex gap-3">
                      <span className="mt-1 w-2.5 h-2.5 rounded-full bg-accent" />
                      {t("Practical training with real assignments & projects")}
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-1 w-2.5 h-2.5 rounded-full bg-accent" />
                      {t("Interview preparation + placement support system")}
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-1 w-2.5 h-2.5 rounded-full bg-accent" />
                      {t("Modern labs, updated curriculum, career guidance")}
                    </li>
                  </ul>

                  <p className="mt-8 text-accent font-bold text-sm">
                    {t("Admissions open — Limited seats available.")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />

    </div >
  );
};

export default AboutPage;