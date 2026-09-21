import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { usePublicSystemSettings } from "@/hooks/usePublicSystemSettings";
import { useEffect } from "react";
import Header from "@/components/Header";

import {
  ArrowLeft,
  Clock,
  IndianRupee,
  MapPin,
  Share2,
  ChevronDown,
  BadgeCheck,
} from "lucide-react";
import Footer from "@/components/Footer";
import { courseTypeLabel, formatCourseDuration, stripHtml } from "@/lib/courseDisplay";
import { cn, normalizeAssetUrl } from "@/lib/utils";

interface Course {
  id: string;
  category_id: string;
  course_name: string;
  course_code: string;
  course_type?: string;
  duration_months: number;
  duration_value?: number;
  duration_unit?: string;
  description?: string;
  image_url?: string;
  og_image_url?: string;
  syllabus?: string;
  fees?: number;
  registration_fee?: number;
  exam_fees_applicable?: boolean;
  exam_fee_amount?: number;
  backlog_fees_applicable?: boolean;
  backlog_fee_amount?: number;
  has_course_structure_units?: boolean;
  eligibility?: string;
  status: string;
  created_at: string;
}

const formatInr = (n?: number) =>
  n != null && n > 0 ? `₹${n.toLocaleString("en-IN")}` : "—";

function RichDescription({ html, className }: { html?: string; className?: string }) {
  if (!html) return null;
  if (html.trim().includes("<")) {
    return (
      <div
        className={cn("prose prose-lg max-w-none dark:prose-invert prose-headings:font-bold", className)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <p className={className}>{html}</p>;
}

import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";

const CoursePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: settings } = usePublicSystemSettings();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  // ================= SYLLABUS DATA (YOU CAN EDIT PER COURSE LATER) =================
  const syllabusData = useMemo(
    () => [
      {
        title: "Module 1: Fundamentals & Basics",
        topics: [
          "Introduction to core concepts and terminology",
          "Computer fundamentals & basic workflow",
          "File management, productivity basics",
          "Best practices for beginners",
        ],
      },
      {
        title: "Module 2: Practical Training & Tools",
        topics: [
          "Hands-on lab sessions with guided tasks",
          "Working with real tools used in industry",
          "Assignments and practice sets",
          "Common errors and troubleshooting",
        ],
      },
      {
        title: "Module 3: Advanced Concepts",
        topics: [
          "Advanced features and efficiency techniques",
          "Real-world use cases and scenarios",
          "Professional workflow & quality standards",
          "Speed + accuracy improvement methods",
        ],
      },
      {
        title: "Module 4: Projects & Career Readiness",
        topics: [
          "Mini project + final live project",
          "Portfolio / practical record preparation",
          "Interview preparation & communication tips",
          "Final assessment & certification guidance",
        ],
      },
    ],
    []
  );

  useEffect(() => {
    const fetchCourse = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await apiFetch(`/api/public/courses/${slug}`);
        const data = await res.json();
        if (res.ok && data?.id) {
          setCourse(data);
        } else {
          setCourse(null);
        }
      } catch (error) {
        console.error("Failed to fetch course", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [slug]);

  useEffect(() => {
    if (!course) return;
    document.title = `${course.course_name} | SCRE`;
    const og = course.og_image_url || course.image_url;
    if (typeof window === "undefined" || !og) return;
    const abs = normalizeAssetUrl(og);
    let meta = document.querySelector('meta[property="og:image"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("property", "og:image");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", abs);
  }, [course]);

  const [activeModule, setActiveModule] = useState<number | null>(0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="font-heading font-extrabold text-3xl text-foreground mb-2">
            Course not found
          </h1>
          <p className="text-muted-foreground mb-6 text-sm">
            The course you are looking for may have been moved or is not available.
          </p>
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-heading font-bold text-primary-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ================= HERO ================= */}
      <section className="relative py-20 bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent/25 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center relative">
          <div>
            <Link
              to="/courses"
              className="inline-flex items-center gap-2 text-sm font-bold text-accent mb-6"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Courses
            </Link>

            <p className="text-xs font-black uppercase tracking-[0.2em] text-accent-foreground/90 mb-2">
              {courseTypeLabel(course.course_type)} · {course.course_code}
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              {course.course_name}
            </h1>

            <div className="mt-4 text-primary-foreground/90 text-lg max-w-xl">
              {course.description?.includes("<") ? (
                <div
                  className="prose prose-invert prose-sm max-w-none line-clamp-4 [&_p]:text-primary-foreground/90 [&_li]:text-primary-foreground/90"
                  dangerouslySetInnerHTML={{ __html: course.description }}
                />
              ) : (
                <p>{course.description?.trim() || "See the full overview below."}</p>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Clock size={18} />
                <span>{formatCourseDuration(course)}</span>
              </div>
              <div className="flex items-center gap-2">
                <IndianRupee size={18} />
                <span>{formatInr(course.fees)} course fee</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={18} />
                <span>Available at centers</span>
              </div>
            </div>
            {course.has_course_structure_units && (
              <p className="mt-3 text-sm font-semibold text-accent-foreground/95">
                Structured in semesters / yearly units
              </p>
            )}
            {course.eligibility ? (
              <div className="mt-6 flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <BadgeCheck size={18} className="text-accent" />
                  <span>Eligibility: {course.eligibility}</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl overflow-hidden shadow-2xl">
            <img
              src={normalizeAssetUrl(course.image_url) || "/images/icc-1.jpg"}
              alt={course.course_name}
              className="w-full h-[300px] object-cover"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.fallbackApplied) {
                  target.dataset.fallbackApplied = "true";
                  target.src = "/images/icc-1.jpg";
                }
              }}
            />
          </div>
        </div>
      </section>

      {/* ================= MAIN CONTENT ================= */}
      <section className="container mx-auto px-4 py-16 grid lg:grid-cols-[2fr_1fr] gap-12">
        {/* LEFT SIDE */}
        <div className="space-y-14">
          {/* Overview */}
          <div>
            <h2 className="text-3xl font-extrabold text-foreground mb-6">
              Course Overview
            </h2>
            <div className="text-muted-foreground leading-relaxed text-lg">
              <RichDescription html={course.description} />
              {!course.description && <p>No detailed description yet.</p>}
            </div>
          </div>

          {/* Why Join */}
          <div>
            <h2 className="text-3xl font-extrabold text-foreground mb-6">
              Why Join This Course?
            </h2>

            <div className="space-y-4 text-muted-foreground">
              <p>• Structured and updated curriculum</p>
              <p>• Experienced and industry-trained faculty</p>
              <p>• Practical exposure with live assignments</p>
              <p>• Placement guidance & career support</p>
            </div>
          </div>

          {/* ================= SYLLABUS COVERED (NEW) ================= */}
          <div>
            <h2 className="text-3xl font-extrabold text-foreground mb-6">
              Syllabus Covered
            </h2>

            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
              This course follows a structured module-based curriculum to build
              strong fundamentals, practical skills, and job-ready confidence.
            </p>

            <div className="prose prose-slate max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{course.syllabus}</ReactMarkdown>
            </div>
          </div>

          {/* <ComparisonSection 
              title="Why SCRE is the Smarter Choice"
              subtitle="A transparent comparison so students can choose the right training environment with confidence."
              duration="6 Months"
              price="₹8,500"
              image={course.image_url}
              desc={course.description}
          /> */}
        </div>

        {/* ================= SIDEBAR ================= */}
        <aside className="space-y-8">
          {/* ✅ Make whole sidebar sticky */}
          <div className="sticky top-24 space-y-8">

            {/* ===== Fee Structure Card ===== */}
            <div className="bg-card border border-border rounded-3xl p-8 shadow-lg">
              <h3 className="text-2xl font-extrabold text-foreground">Fee Structure</h3>

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Course Fee</span>
                  <span className="font-extrabold text-foreground">{formatInr(course.fees)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Admission Fee</span>
                  <span className="font-extrabold text-foreground">{formatInr(course.registration_fee)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Exam Fee</span>
                  <span className="font-extrabold text-foreground">
                    {course.exam_fees_applicable ? formatInr(course.exam_fee_amount) : "Not applicable"}
                  </span>
                </div>

                {course.backlog_fees_applicable ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-semibold">Backlog Fee</span>
                    <span className="font-extrabold text-foreground">{formatInr(course.backlog_fee_amount)}</span>
                  </div>
                ) : null}

                <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                  <span className="text-foreground font-extrabold">Total (course + admission + exam)</span>
                  <span className="text-primary font-extrabold text-lg">
                    {formatInr(
                      (course.fees ?? 0) +
                      (course.registration_fee ?? 0) +
                      (course.exam_fees_applicable ? course.exam_fee_amount ?? 0 : 0),
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-muted/40 border border-border px-4 py-3 text-sm">
                <p className="text-foreground font-bold">EMI Option Available</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Installment plans available. Contact center for EMI details & eligibility.
                </p>
              </div>

              <Link
                to="/admission"
                className="block mt-6 text-center bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:bg-primary-dark transition"
              >
                Apply Now
              </Link>

              <a
                href={`tel:${(settings?.contact_phone as string) || "+919466317100"}`}
                className="flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-foreground px-8 py-4 font-bold hover:bg-accent-dark transition shadow-lg"
              >
                Call for Advice
              </a>

              <div className="mt-6 border-t border-border pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold mb-3">
                  <Share2 size={16} />
                  Share this course
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Check this course: ${course.course_name}\n${typeof window !== "undefined" ? window.location.href : ""
                      }`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-center bg-accent text-accent-foreground font-bold py-2.5 rounded-xl hover:bg-accent-dark transition"
                  >
                    WhatsApp
                  </a>

                  <button
                    type="button"
                    onClick={async () => {
                      const url = typeof window !== "undefined" ? window.location.href : "";
                      try {
                        await navigator.clipboard.writeText(url);
                        alert("Link copied!");
                      } catch {
                        alert("Copy failed. Please copy manually.");
                      }
                    }}
                    className="text-center border border-border font-bold py-2.5 rounded-xl hover:border-primary transition"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>

            {/* ===== Available Centers Card ===== */}
            <div className="bg-card border border-border rounded-3xl p-8 shadow-lg">
              <h3 className="text-xl font-extrabold text-foreground">
                Available at Centers
              </h3>

              <p className="text-muted-foreground text-sm mt-2">
                This course is available at selected SCRE centers.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-border bg-muted/30 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-extrabold text-foreground">SCRE Center</p>
                      <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
                        <MapPin size={16} className="text-accent" />
                        Jind, Haryana
                      </p>
                    </div>

                    <Link
                      to="/centers"
                      className="shrink-0 inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-bold hover:bg-primary-dark transition"
                    >
                      View Center
                    </Link>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </aside>
      </section>

      <Footer />
    </div>
  );
};

export default CoursePage;