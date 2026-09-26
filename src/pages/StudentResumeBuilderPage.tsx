import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Download, User, Mail, Phone, MapPin, Briefcase, GraduationCap,
  Award, Code, Sparkles, CheckCircle2, Plus, Trash2, Globe, Linkedin, Github, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  location: string;
  duration: string;
  details: string;
}

interface EducationItem {
  id: string;
  degree: string;
  institution: string;
  year: string;
  score: string;
}

interface ProjectItem {
  id: string;
  title: string;
  tech: string;
  description: string;
}

export default function StudentResumeBuilderPage() {
  const { t } = useTranslation();

  const [activeTheme, setActiveTheme] = useState<"modern" | "executive">("modern");

  // Form State
  const [personalInfo, setPersonalInfo] = useState({
    fullName: "Aditya Sharma",
    jobTitle: "Software Developer Intern",
    email: "aditya.sharma@example.com",
    phone: "+91 98765 43210",
    location: "Rohtak, Haryana",
    linkedin: "linkedin.com/in/adityasharma",
    github: "github.com/adityasharma",
    summary:
      "Passionate and detail-oriented candidate trained in Web Development and Office Automation. Experienced in building responsive user interfaces, database optimization, and team collaboration.",
  });

  const [skills, setSkills] = useState<string>("React.js, JavaScript, HTML5/CSS3, Python, Advanced Excel, Tally Prime, Communication, Problem Solving");

  const [education, setEducation] = useState<EducationItem[]>([
    {
      id: "edu_1",
      degree: "B.Tech in Computer Science & Engineering",
      institution: "State University of Technology",
      year: "2022 - 2026",
      score: "8.4 CGPA",
    },
    {
      id: "edu_2",
      degree: "Senior Secondary (12th CBSE)",
      institution: "Government Model Senior Secondary School",
      year: "2022",
      score: "88%",
    },
  ]);

  const [experience, setExperience] = useState<ExperienceItem[]>([
    {
      id: "exp_1",
      role: "Frontend Engineering Intern",
      company: "SCREduc Technologies",
      location: "Remote / Center",
      duration: "Jan 2026 - Present",
      details:
        "Developed modular UI components, integrated RESTful APIs, optimized page load speed, and participated in daily team standups.",
    },
  ]);

  const [projects, setProjects] = useState<ProjectItem[]>([
    {
      id: "proj_1",
      title: "Student Management & Verification Portal",
      tech: "React, Node.js, MongoDB",
      description:
        "Built a full-stack dashboard featuring QR verification, automated marksheets, and role-based admin controls.",
    },
  ]);

  const [certifications, setCertifications] = useState<string[]>(
    ["Certified Web Development Professional - SCREduc", "Advanced Tally Prime & GST Filing - Government Approved Center"]
  );

  useEffect(() => {
    // Autofill from stored user if available
    const userStr = sessionStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.full_name || user.fullName) {
          setPersonalInfo((prev) => ({
            ...prev,
            fullName: user.full_name || user.fullName || prev.fullName,
            email: user.email || prev.email,
            phone: user.phone || prev.phone,
            location: user.city ? `${user.city}, ${user.state || ""}` : prev.location,
            jobTitle: user.course ? `${user.course} Candidate` : prev.jobTitle,
          }));
        }
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const addExperience = () => {
    setExperience([
      ...experience,
      {
        id: `exp_${Date.now()}`,
        role: "Trainee / Intern",
        company: "Partner Company",
        location: "City",
        duration: "3 Months",
        details: "Key tasks and project contributions.",
      },
    ]);
  };

  const removeExperience = (id: string) => {
    setExperience(experience.filter((e) => e.id !== id));
  };

  const addEducation = () => {
    setEducation([
      ...education,
      {
        id: `edu_${Date.now()}`,
        degree: "Diploma / Degree",
        institution: "Institution Name",
        year: "2024",
        score: "Passed",
      },
    ]);
  };

  const removeEducation = (id: string) => {
    setEducation(education.filter((e) => e.id !== id));
  };

  const addProject = () => {
    setProjects([
      ...projects,
      {
        id: `proj_${Date.now()}`,
        title: "Project Name",
        tech: "Tech Stack",
        description: "Project outcomes and features.",
      },
    ]);
  };

  const removeProject = (id: string) => {
    setProjects(projects.filter((p) => p.id !== id));
  };

  return (
    <DashboardLayout>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-resume, #printable-resume * {
            visibility: visible;
          }
          #printable-resume {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="space-y-6 pb-16 no-print">
        {/* Top Header */}
        <div className="p-6 md:p-8 bg-card border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-none">
                Job Placement Ready
              </Badge>
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest rounded-none border-border">
                ATS Friendly Format
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />
              {t("Pro AI Resume Builder")}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-xl">
              {t(
                "Build, customize, and export a polished professional resume in seconds. Perfectly tailored for internship & campus placement applications."
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handlePrint}
              className="rounded-none text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
            >
              <Download className="w-4 h-4 mr-2" />
              {t("Download PDF Resume")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Form Controls */}
          <div className="lg:col-span-6 space-y-6">
            {/* Personal Details */}
            <Card className="rounded-none border-border bg-card">
              <CardHeader className="p-5 border-b border-border bg-muted/20">
                <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  {t("1. Personal Details")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name *</label>
                    <Input
                      value={personalInfo.fullName}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, fullName: e.target.value })}
                      className="rounded-none text-xs border-border mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Role / Title *</label>
                    <Input
                      value={personalInfo.jobTitle}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, jobTitle: e.target.value })}
                      className="rounded-none text-xs border-border mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address *</label>
                    <Input
                      value={personalInfo.email}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                      className="rounded-none text-xs border-border mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Phone Number *</label>
                    <Input
                      value={personalInfo.phone}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                      className="rounded-none text-xs border-border mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">City & State *</label>
                    <Input
                      value={personalInfo.location}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, location: e.target.value })}
                      className="rounded-none text-xs border-border mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">LinkedIn URL</label>
                    <Input
                      value={personalInfo.linkedin}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, linkedin: e.target.value })}
                      className="rounded-none text-xs border-border mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Professional Summary</label>
                  <Textarea
                    rows={3}
                    value={personalInfo.summary}
                    onChange={(e) => setPersonalInfo({ ...personalInfo, summary: e.target.value })}
                    className="rounded-none text-xs border-border mt-1 resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Experience & Internships */}
            <Card className="rounded-none border-border bg-card">
              <CardHeader className="p-5 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  {t("2. Internship & Work Experience")}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={addExperience} className="rounded-none text-[10px] font-bold uppercase">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {experience.map((exp, i) => (
                  <div key={exp.id} className="p-3 border border-border bg-background relative space-y-2">
                    <button
                      type="button"
                      onClick={() => removeExperience(exp.id)}
                      className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Role / Position"
                        value={exp.role}
                        onChange={(e) => {
                          const updated = [...experience];
                          updated[i].role = e.target.value;
                          setExperience(updated);
                        }}
                        className="rounded-none text-xs border-border"
                      />
                      <Input
                        placeholder="Company Name"
                        value={exp.company}
                        onChange={(e) => {
                          const updated = [...experience];
                          updated[i].company = e.target.value;
                          setExperience(updated);
                        }}
                        className="rounded-none text-xs border-border"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Duration (e.g. Jan 2026 - Present)"
                        value={exp.duration}
                        onChange={(e) => {
                          const updated = [...experience];
                          updated[i].duration = e.target.value;
                          setExperience(updated);
                        }}
                        className="rounded-none text-xs border-border"
                      />
                      <Input
                        placeholder="Location"
                        value={exp.location}
                        onChange={(e) => {
                          const updated = [...experience];
                          updated[i].location = e.target.value;
                          setExperience(updated);
                        }}
                        className="rounded-none text-xs border-border"
                      />
                    </div>
                    <Textarea
                      rows={2}
                      placeholder="Key contributions and achievements..."
                      value={exp.details}
                      onChange={(e) => {
                        const updated = [...experience];
                        updated[i].details = e.target.value;
                        setExperience(updated);
                      }}
                      className="rounded-none text-xs border-border resize-none"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Education */}
            <Card className="rounded-none border-border bg-card">
              <CardHeader className="p-5 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  {t("3. Education & Academic Background")}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={addEducation} className="rounded-none text-[10px] font-bold uppercase">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {education.map((edu, i) => (
                  <div key={edu.id} className="p-3 border border-border bg-background relative space-y-2">
                    <button
                      type="button"
                      onClick={() => removeEducation(edu.id)}
                      className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <Input
                      placeholder="Degree / Qualification"
                      value={edu.degree}
                      onChange={(e) => {
                        const updated = [...education];
                        updated[i].degree = e.target.value;
                        setEducation(updated);
                      }}
                      className="rounded-none text-xs border-border"
                    />
                    <Input
                      placeholder="College / School Name"
                      value={edu.institution}
                      onChange={(e) => {
                        const updated = [...education];
                        updated[i].institution = e.target.value;
                        setEducation(updated);
                      }}
                      className="rounded-none text-xs border-border"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Year (e.g. 2022 - 2026)"
                        value={edu.year}
                        onChange={(e) => {
                          const updated = [...education];
                          updated[i].year = e.target.value;
                          setEducation(updated);
                        }}
                        className="rounded-none text-xs border-border"
                      />
                      <Input
                        placeholder="Percentage / CGPA"
                        value={edu.score}
                        onChange={(e) => {
                          const updated = [...education];
                          updated[i].score = e.target.value;
                          setEducation(updated);
                        }}
                        className="rounded-none text-xs border-border"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Skills & Certifications */}
            <Card className="rounded-none border-border bg-card">
              <CardHeader className="p-5 border-b border-border bg-muted/20">
                <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <Code className="w-4 h-4 text-primary" />
                  {t("4. Key Skills & Certifications")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Skills (Comma Separated)</label>
                  <Input
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    className="rounded-none text-xs border-border mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Live ATS Printable Resume Document */}
          <div className="lg:col-span-6">
            <div className="sticky top-6">
              <div className="flex items-center justify-between mb-3 no-print">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Live ATS Preview
                </span>
                <Badge variant="outline" className="text-[9px] uppercase font-bold border-emerald-500/40 text-emerald-500">
                  Ready to Download
                </Badge>
              </div>

              {/* Document Container */}
              <div
                id="printable-resume"
                className="bg-white text-slate-900 p-8 shadow-2xl border border-slate-200 min-h-[750px] font-sans text-left space-y-6"
              >
                {/* Header */}
                <div className="border-b-2 border-slate-900 pb-4">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{personalInfo.fullName}</h1>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">{personalInfo.jobTitle}</p>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mt-3 font-medium">
                    {personalInfo.email && <span>📧 {personalInfo.email}</span>}
                    {personalInfo.phone && <span>📞 {personalInfo.phone}</span>}
                    {personalInfo.location && <span>📍 {personalInfo.location}</span>}
                    {personalInfo.linkedin && <span>🔗 {personalInfo.linkedin}</span>}
                  </div>
                </div>

                {/* Professional Summary */}
                {personalInfo.summary && (
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                      Professional Summary
                    </h2>
                    <p className="text-xs text-slate-700 leading-relaxed font-normal">{personalInfo.summary}</p>
                  </div>
                )}

                {/* Work Experience */}
                {experience.length > 0 && (
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-3">
                      Internship & Work Experience
                    </h2>
                    <div className="space-y-3">
                      {experience.map((exp) => (
                        <div key={exp.id}>
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs font-bold text-slate-900">{exp.role}</span>
                            <span className="text-[11px] font-semibold text-slate-500">{exp.duration}</span>
                          </div>
                          <div className="flex justify-between items-baseline text-[11px] text-slate-600 font-medium">
                            <span>{exp.company}</span>
                            <span>{exp.location}</span>
                          </div>
                          {exp.details && <p className="text-[11px] text-slate-700 mt-1 leading-normal">{exp.details}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education */}
                {education.length > 0 && (
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-3">
                      Education & Qualifications
                    </h2>
                    <div className="space-y-2">
                      {education.map((edu) => (
                        <div key={edu.id} className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold text-slate-900">{edu.degree}</p>
                            <p className="text-[11px] text-slate-600">{edu.institution}</p>
                          </div>
                          <div className="text-right text-[11px] font-semibold text-slate-600">
                            <p>{edu.year}</p>
                            <p className="text-slate-800 font-bold">{edu.score}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Skills */}
                {skills && (
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                      Key Technical & Soft Skills
                    </h2>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.split(",").map((s, idx) => (
                        <span key={idx} className="text-[10px] bg-slate-100 text-slate-800 font-semibold px-2 py-0.5 rounded border border-slate-300">
                          {s.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Certifications */}
                {certifications.length > 0 && (
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                      Verified Certifications & Credentials
                    </h2>
                    <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-0.5">
                      {certifications.map((c, idx) => (
                        <li key={idx}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
