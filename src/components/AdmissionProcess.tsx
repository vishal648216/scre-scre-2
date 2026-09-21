import { ClipboardList, UserCheck, BookOpen, FileText, Award } from "lucide-react";
import { useHomeData } from "@/hooks/useHomeData";

const AdmissionProcess = () => {
  const { data: homeData } = useHomeData();
  const t = (key: string) => homeData?.static_texts?.[key] || key;

  const steps = [
    { icon: ClipboardList, step: "01", title: t("Enquiry"), desc: t("Fill the enquiry form or visit our center for counseling.") },
    { icon: UserCheck, step: "02", title: t("Counseling"), desc: t("Get personalized course guidance based on your goals.") },
    { icon: BookOpen, step: "03", title: t("Enrollment"), desc: t("Complete admission formalities and start your journey.") },
    { icon: FileText, step: "04", title: t("Exam"), desc: t("Appear for regular assessments and final examinations.") },
    { icon: Award, step: "05", title: t("Certification"), desc: t("Complete your course and receive industry-recognized certificate.") },
  ];

  return (
    <section className="section-padding bg-card">
      <div className="container mx-auto">
        <div className="text-center mb-14">
          <span className="inline-block bg-primary/10 text-primary font-heading font-bold text-xs uppercase tracking-widest px-4 py-1.5 rounded-full">{t("How to Join")}</span>
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-foreground mt-4">{t("Admission Process")}</h2>
          <div className="w-16 h-1 bg-accent mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {steps.map((s, i) => (
            <div key={s.step} className="relative text-center group hover-popup-subtle p-6 rounded-3xl transition-all">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[50%] w-[100%] h-0.5 bg-border z-0" />
              )}
              <div className="relative z-10">
                <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-xl transition-shadow group-hover:scale-105 transition-transform">
                  <s.icon className="w-10 h-10 text-primary-foreground" />
                </div>
                <span className="inline-block bg-accent text-accent-foreground text-xs font-heading font-bold px-4 py-1.5 rounded-full mb-3 shadow-sm">{t("Step")} {s.step}</span>
                <h3 className="font-heading font-bold text-lg text-foreground mb-2">{s.title}</h3>
                <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AdmissionProcess;
