import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Printer, Download, Award, Search, CheckCircle2, User, Building2, Calendar, MapPin, Briefcase, GraduationCap, ArrowLeft, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface InternItem {
  id: string;
  _id?: string;
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  enrollment_number?: string;
  serial_number?: string;
  course?: string;
  internshipDomain?: string;
  internshipMode?: string;
  college?: string;
  highestQualification?: string;
  address?: string;
  city?: string;
  state?: string;
  district?: string;
  country?: string;
  pincode?: string;
  registration_date?: string;
}

const AdminInternLettersPage = () => {
  const [loading, setLoading] = useState(true);
  const [interns, setInterns] = useState<InternItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIntern, setSelectedIntern] = useState<InternItem | null>(null);
  const [letterType, setLetterType] = useState<"offer" | "completion">("offer");

  // Editable Letter Fields
  const [companyName, setCompanyName] = useState("SCREduc Innovation & Technologies");
  const [centerName, setCenterName] = useState("Main Regional Training Hub");
  const [duration, setDuration] = useState("3 Months");
  const [stipend, setStipend] = useState("₹5,000 / Month (Performance Based)");
  const [stipendType, setStipendType] = useState("Paid");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split("T")[0];
  });
  const [grade, setGrade] = useState("A+ (Excellent)");
  const [learningModules, setLearningModules] = useState([
    "Industrial Project Architecture & Agile Methodology",
    "Frontend Development with React & Tailwind CSS",
    "Backend REST API Design & MongoDB Database Management",
    "Deployment, Git Workflow & Production Monitoring",
  ]);

  const letterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInterns();
  }, []);

  const fetchInterns = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/interns");
      if (res.ok) {
        const data = await res.json();
        const mapped = (Array.isArray(data) ? data : []).map((i: any) => ({
          ...i,
          id: i.id || i._id,
          fullName: i.fullName || i.full_name || i.name || "Intern Candidate",
          enrollment_number: i.enrollment_number || i.enrollmentNumber || `INT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          internshipDomain: i.internshipDomain || i.course || "Software Engineering",
          internshipMode: i.internshipMode || "Remote",
        }));
        setInterns(mapped);
        if (mapped.length > 0) {
          setSelectedIntern(mapped[0]);
        }
      }
    } catch {
      toast.error("Failed to load intern records");
    } finally {
      setLoading(false);
    }
  };

  const filtered = interns.filter((i) =>
    (i.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.enrollment_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.internshipDomain || "").toLowerCase().includes(search.toLowerCase())
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Print Styles */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #printable-letter, #printable-letter * { visibility: visible; }
            #printable-letter {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20px;
              background: white !important;
              color: black !important;
            }
          }
        `}</style>

        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-500/20 shadow-xl">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
              <FileText className="w-4 h-4" /> Official Letter & Certificate Studio
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Internship Offer Letters & Completion Certificates
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Generate, preview, print, and issue verified Joining Letters & Completion Certificates for all interns.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Print / Save PDF Letter
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Select Candidate & Settings */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-xl overflow-hidden">
              <CardHeader className="border-b border-slate-800 py-4 px-5 bg-slate-900/50">
                <CardTitle className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-cyan-400" /> Select Intern Candidate
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    placeholder="Search candidate name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs outline-none"
                  />
                </div>

                {loading ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {filtered.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedIntern(item)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          selectedIntern?.id === item.id
                            ? "bg-cyan-500/10 border-cyan-500/50 text-white"
                            : "bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-900"
                        }`}
                      >
                        <div className="font-bold text-sm text-slate-100">{item.fullName}</div>
                        <div className="text-[11px] text-cyan-400 mt-0.5">{item.internshipDomain}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">ID: {item.enrollment_number}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Document Controls Card */}
            <Card className="rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-xl overflow-hidden">
              <CardHeader className="border-b border-slate-800 py-4 px-5 bg-slate-900/50">
                <CardTitle className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" /> Letter Customization
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Document Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setLetterType("offer")}
                      className={`py-2 px-3 rounded-xl font-bold border text-center transition-all ${
                        letterType === "offer"
                          ? "bg-cyan-600 text-white border-cyan-500 shadow-md"
                          : "bg-slate-900 border-slate-800 text-slate-400"
                      }`}
                    >
                      Offer / Joining Letter
                    </button>
                    <button
                      onClick={() => setLetterType("completion")}
                      className={`py-2 px-3 rounded-xl font-bold border text-center transition-all ${
                        letterType === "completion"
                          ? "bg-emerald-600 text-white border-emerald-500 shadow-md"
                          : "bg-slate-900 border-slate-800 text-slate-400"
                      }`}
                    >
                      Completion Certificate
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Company / Organization</label>
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-bold block mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Duration</label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl outline-none"
                    >
                      <option value="1 Month">1 Month</option>
                      <option value="2 Months">2 Months</option>
                      <option value="3 Months">3 Months</option>
                      <option value="6 Months">6 Months</option>
                      <option value="12 Months">12 Months</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Stipend Status</label>
                    <select
                      value={stipendType}
                      onChange={(e) => setStipendType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl outline-none"
                    >
                      <option value="Paid">Paid Stipend</option>
                      <option value="Unpaid">Unpaid / Academic</option>
                    </select>
                  </div>
                </div>

                {stipendType === "Paid" && (
                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Monthly Stipend Amount</label>
                    <input
                      value={stipend}
                      onChange={(e) => setStipend(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl outline-none"
                    />
                  </div>
                )}

                {letterType === "completion" && (
                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Performance Grade</label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl outline-none"
                    >
                      <option value="A+ (Outstanding)">A+ (Outstanding)</option>
                      <option value="A (Excellent)">A (Excellent)</option>
                      <option value="B+ (Very Good)">B+ (Very Good)</option>
                      <option value="B (Good)">B (Good)</option>
                    </select>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Live Printable Document Preview */}
          <div className="lg:col-span-8">
            <Card className="rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-800 py-4 px-6 bg-slate-900/50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Printer className="w-4 h-4 text-cyan-400" /> Live Document Document Preview
                </CardTitle>
                <button
                  onClick={handlePrint}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Letter
                </button>
              </CardHeader>
              <CardContent className="p-6 bg-slate-900/30 flex justify-center">
                {/* Official White Letter Page Container */}
                <div
                  id="printable-letter"
                  ref={letterRef}
                  className="w-full max-w-2xl bg-white text-slate-900 p-10 rounded-xl shadow-2xl space-y-6 font-serif border border-slate-200"
                >
                  {/* Header Letterhead */}
                  <div className="border-b-2 border-slate-900 pb-6 flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 font-sans">
                        {companyName}
                      </h2>
                      <p className="text-xs text-slate-600 font-sans font-semibold mt-0.5">
                        {centerName} • Corporate Internship & Talent Allotment Division
                      </p>
                      <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                        Ref: SCRE/INT/2026/{(selectedIntern?.enrollment_number || "REG").slice(-6)}
                      </p>
                    </div>
                    <div className="text-right font-sans text-xs">
                      <div className="font-bold text-slate-900">Date: {new Date().toLocaleDateString("en-IN")}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        VERIFIED DOCUMENT
                      </div>
                    </div>
                  </div>

                  {/* Letter Title */}
                  <div className="text-center py-2">
                    <h3 className="text-xl font-black uppercase tracking-wider font-sans text-slate-900 border-b-2 border-slate-300 inline-block pb-1">
                      {letterType === "offer" ? "INTERNSHIP OFFER & JOINING LETTER" : "INTERNSHIP COMPLETION CERTIFICATE"}
                    </h3>
                  </div>

                  {/* Candidate Info Block */}
                  {selectedIntern && (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 font-sans text-xs space-y-1.5">
                      <div className="grid grid-cols-2">
                        <span><strong>Intern Name:</strong> {selectedIntern.fullName}</span>
                        <span><strong>Enrollment No:</strong> {selectedIntern.enrollment_number}</span>
                      </div>
                      <div className="grid grid-cols-2">
                        <span><strong>Domain:</strong> {selectedIntern.internshipDomain}</span>
                        <span><strong>Mode:</strong> {selectedIntern.internshipMode || "Remote"}</span>
                      </div>
                      <div className="grid grid-cols-2">
                        <span><strong>College/University:</strong> {selectedIntern.college || "N/A"}</span>
                        <span><strong>Degree/Branch:</strong> {selectedIntern.highestQualification || "B.Tech"}</span>
                      </div>
                      {selectedIntern.address && (
                        <div>
                          <strong>Address:</strong> {selectedIntern.address}, {selectedIntern.city}, {selectedIntern.state} - {selectedIntern.pincode}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Letter Body Text */}
                  {letterType === "offer" ? (
                    <div className="text-xs text-slate-800 leading-relaxed space-y-3 font-sans">
                      <p>
                        Dear <strong>{selectedIntern?.fullName || "Candidate"}</strong>,
                      </p>
                      <p>
                        We are pleased to inform you that based on your academic credentials and application, you have been selected for the <strong>{selectedIntern?.internshipDomain}</strong> Internship Program at <strong>{companyName}</strong>.
                      </p>
                      <p>
                        Your internship will officially commence on <strong>{startDate}</strong> for a total duration of <strong>{duration}</strong> ending on <strong>{endDate}</strong>.
                      </p>

                      <div className="bg-slate-100 p-3 rounded border border-slate-200 space-y-1 my-3">
                        <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Key Terms & Stipend Details:</div>
                        <div>• <strong>Stipend Status:</strong> {stipendType} ({stipend})</div>
                        <div>• <strong>Location / Mode:</strong> {selectedIntern?.internshipMode || "Remote Working"}</div>
                        <div>• <strong>Reporting Center:</strong> {centerName}</div>
                      </div>

                      <p>During this period, you will be trained under senior industry engineers on the following learning modules:</p>
                      <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-700">
                        {learningModules.map((m, idx) => (
                          <li key={idx}>{m}</li>
                        ))}
                      </ul>

                      <p className="pt-2">
                        We welcome you to our team and wish you a highly productive and enriching learning experience!
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-800 leading-relaxed space-y-3 font-sans">
                      <p>
                        This is to certify that <strong>{selectedIntern?.fullName || "Candidate"}</strong> (Enrollment No: <strong>{selectedIntern?.enrollment_number}</strong>) from <strong>{selectedIntern?.college || "Partner Institution"}</strong> has successfully completed the <strong>{selectedIntern?.internshipDomain}</strong> Internship at <strong>{companyName}</strong>.
                      </p>

                      <p>
                        The internship was conducted from <strong>{startDate}</strong> to <strong>{endDate}</strong> for a duration of <strong>{duration}</strong>.
                      </p>

                      <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200 text-center space-y-1 my-4">
                        <div className="text-emerald-900 font-bold text-sm">Overall Performance Grade: {grade}</div>
                        <div className="text-emerald-700 text-[11px]">Demonstrated exceptional technical skill, teamwork, and project delivery.</div>
                      </div>

                      <p>We appreciate their hard work and dedication throughout the internship tenure and wish them great success in future endeavors.</p>
                    </div>
                  )}

                  {/* Signatures & Seal Footer */}
                  <div className="pt-10 border-t border-slate-300 flex items-end justify-between font-sans text-xs">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center mx-auto mb-1">
                        <QrCode className="w-8 h-8 text-slate-800" />
                      </div>
                      <span className="text-[9px] text-slate-500 block">Scan to Verify</span>
                    </div>

                    <div className="text-center space-y-1">
                      <div className="font-bold text-slate-900 uppercase">Authorized Officer</div>
                      <div className="text-[10px] text-slate-500">Corporate HR & Academic Division</div>
                      <div className="text-[10px] text-indigo-700 font-mono font-bold">DIGITALLY SIGNED & SEALED</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminInternLettersPage;
