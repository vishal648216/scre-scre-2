import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, User, Award, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

const toId = (v: any): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in v) return v.$oid;
  return String(v || "");
};

interface Student {
  _id: string | { $oid: string };
  username: string;
  fullName?: string;
  course?: string;
}

const ManualCertificatePage = () => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await apiFetch("/api/students");
      const data = await res.json();
      if (res.ok) setStudents(data);
    } catch (e) {
      console.error("Failed to load students", e);
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s =>
    (s.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
    s.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleGenerateCertificate = async () => {
    if (!selectedStudent) {
      toast.error("Please select a student first");
      return;
    }

    setGenerating(true);
    try {
      toast.success("Certificate generation started! This may take a few seconds...");
      
      const studentId = toId(selectedStudent._id);
      
      const res = await apiFetch("/api/certificates/generate-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });

      if (res.ok) {
        toast.success("Certificate generated successfully!");
        fetchStudents();
        setSelectedStudent(null);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Failed to generate certificate");
      }
    } catch (e) {
      toast.error("An error occurred");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              Manual Certificate Generation
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Generate certificates manually for students
            </p>
          </div>
        </div>

        <Card className="rounded-none border-border shadow-sm">
          <CardHeader className="bg-muted/20 border-b border-border">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">
              AUTOMATION SYSTEM OVERVIEW
            </CardTitle>
            <p className="text-muted-foreground text-xs font-medium mt-1">
              How the automatic certificate & marksheet generation works with the exam system
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-border p-4 rounded-none">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Automatic Certificate Generation
                </h3>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
                  <li>Student completes online exams</li>
                  <li>System detects all subjects are completed</li>
                  <li>Certificate is automatically generated</li>
                  <li>Certificate stored in /uploads/certificates/</li>
                  <li>Certificate appears in Student Certificates section</li>
                </ol>
              </div>
              <div className="border border-border p-4 rounded-none">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Automatic Marksheet Generation
                </h3>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
                  <li>Student completes online exams</li>
                  <li>System collects marks from all subjects</li>
                  <li>Marksheet is automatically generated with marks</li>
                  <li>Marksheet stored in /uploads/marksheets/</li>
                  <li>Marksheet appears in Student Marksheets section</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border shadow-sm">
          <CardHeader className="bg-muted/20 border-b border-border">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">
              MANUAL CERTIFICATE GENERATION
            </CardTitle>
            <p className="text-muted-foreground text-xs font-medium mt-1">
              Generate a certificate manually for a selected student
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  placeholder="Search students by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-none text-xs font-bold uppercase tracking-widest focus:border-primary outline-none"
                />
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading students...</div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground bg-muted/5 border border-border">
                  No students found
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto border border-border">
                  {filteredStudents.map((student) => {
                    const isSelected = selectedStudent && toId(selectedStudent._id) === toId(student._id);
                    return (
                      <div
                        key={toId(student._id)}
                        onClick={() => setSelectedStudent(isSelected ? null : student)}
                        className={`p-4 border-b border-border cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/5 border-l-4 border-l-primary" : "hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-none flex items-center justify-center">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-bold text-sm">{student.fullName || student.username}</p>
                              <p className="text-xs text-muted-foreground">{student.username}</p>
                            </div>
                          </div>
                          {student.course && (
                            <p className="text-xs font-bold text-muted-foreground">{student.course}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedStudent && (
                <div className="pt-4 border-t border-border">
                  <div className="bg-muted/30 p-4 rounded-none mb-4">
                    <p className="text-sm font-bold mb-1">Selected Student:</p>
                    <p className="text-sm">{selectedStudent.fullName || selectedStudent.username}</p>
                    <p className="text-xs text-muted-foreground">{selectedStudent.username}</p>
                    {selectedStudent.course && (
                      <p className="text-xs text-muted-foreground mt-1">Course: {selectedStudent.course}</p>
                    )}
                  </div>
                  <Button
                    onClick={handleGenerateCertificate}
                    disabled={generating}
                    className="w-full py-6 text-sm font-black uppercase tracking-widest rounded-none"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating Certificate...
                      </>
                    ) : (
                      "Generate Certificate"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ManualCertificatePage;
