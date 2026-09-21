import { Clock } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  code: string;
  duration: string;
  image?: string;
};

const CourseHero = ({ title, subtitle, code, duration, image }: Props) => {
  return (
    <section className="bg-gradient-to-b from-[#0B2C48] to-[#082136] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-start gap-4">
          {image && (
            <img
              src={image}
              alt={title}
              className="w-16 h-16 rounded-full border-2 border-white/20 object-cover"
            />
          )}
          <div className="flex-1">
            <div className="text-[10px] font-black uppercase tracking-widest bg-white/10 text-white px-2 py-1 inline-block rounded">
              Bestseller – Computer Courses
            </div>
            <h1 className="mt-3 font-heading font-extrabold text-2xl md:text-3xl tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-white/80">{subtitle}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold">Code:</span> {code}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span className="font-semibold">{duration}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#16A34A] px-2 py-1 font-bold">
                Verified Course
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F47C20] px-2 py-1 font-bold">
                4.9 ★
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CourseHero;
