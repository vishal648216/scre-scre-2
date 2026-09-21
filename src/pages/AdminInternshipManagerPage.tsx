import React, { useState, useEffect } from "react";
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  IndianRupee,
  Building,
  Edit,
  Trash2,
  ChevronRight,
  Loader2,
  Eye,
  Award,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const AdminInternshipManagerPage = () => {
  const { t } = useTranslation();
  const [postings, setPostings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedPosting, setSelectedPosting] = useState<any | null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("SCREduc Innovation Lab");
  const [domain, setDomain] = useState("Web Development");
  const [locationType, setLocationType] = useState("Remote");
  const [city, setCity] = useState("National");
  const [durationMonths, setDurationMonths] = useState(3);
  const [stipendAmount, setStipendAmount] = useState(5000);
  const [skillsRequired, setSkillsRequired] = useState("React, JavaScript, CSS");
  const [totalOpenings, setTotalOpenings] = useState(5);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPostings = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/internships/all");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setPostings(json.data);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to fetch admin internships", err);
    }
    // Fallback seed
    setPostings([
      {
        _id: "post_1",
        title: "Frontend Web Developer Intern",
        company_name: "SCREduc Technologies",
        domain: "Web Development",
        location_type: "Remote",
        duration_months: 3,
        stipend_amount: 5000,
        skills_required: ["React", "CSS", "API"],
        total_openings: 5,
        description: "Hands-on web UI development.",
        status: "Open",
      },
    ]);
    setLoading(false);
  };

  useEffect(() => {
    fetchPostings();
  }, []);

  const handleCreatePosting = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        title,
        company_name: companyName,
        domain,
        location_type: locationType,
        city,
        duration_months: Number(durationMonths),
        stipend_amount: Number(stipendAmount),
        skills_required: skillsRequired.split(",").map((s) => s.trim()).filter(Boolean),
        total_openings: Number(totalOpenings),
        description,
      };

      const res = await apiFetch("/api/internships", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(t("Internship posted successfully!"));
        setCreateModalOpen(false);
        // Reset form
        setTitle("");
        setDescription("");
        fetchPostings();
      } else {
        toast.error(json.message || t("Failed to post internship"));
      }
    } catch {
      toast.error(t("Error creating internship posting"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewApplicants = async (posting: any) => {
    setSelectedPosting(posting);
    setLoadingApplicants(true);
    try {
      const res = await apiFetch(`/api/internships/${posting._id || posting.id}/applications`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setApplicants(json.data);
          setLoadingApplicants(false);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to fetch applicants", err);
    }
    setApplicants([]);
    setLoadingApplicants(false);
  };

  const handleUpdateStatus = async (appId: string, newStatus: string) => {
    try {
      const res = await apiFetch(`/api/internships/applications/${appId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(t("Status updated to {{status}}", { status: newStatus }));
        setApplicants((prev) =>
          prev.map((a) => ((a._id || a.id) === appId ? { ...a, status: newStatus } : a))
        );
      } else {
        toast.error(t("Failed to update status"));
      }
    } catch {
      toast.error(t("Error updating application status"));
    }
  };

  const handleDeletePosting = async (id: string) => {
    if (!window.confirm(t("Are you sure you want to delete this internship posting?"))) return;
    try {
      const res = await apiFetch(`/api/internships/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("Internship deleted successfully"));
        setPostings((prev) => prev.filter((p) => (p._id || p.id) !== id));
      }
    } catch {
      toast.error(t("Failed to delete internship"));
    }
  };

  const filteredPostings = postings.filter((p) =>
    p.title?.toLowerCase().includes(search.toLowerCase()) ||
    p.domain?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="p-6 md:p-8 bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Badge className="bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-none mb-2">
            Career & Placement Admin
          </Badge>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground">
            {t("Internship Program Manager")}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("Create internship openings, manage candidate recruitment pipelines, and issue verified completion certificates.")}
          </p>
        </div>

        <Button
          onClick={() => setCreateModalOpen(true)}
          className="rounded-none text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground h-11 px-5 shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {t("Post New Internship")}
        </Button>
      </div>

      {/* Search & Metrics */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 border border-border">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("Search by role title, domain, or company...")}
            className="pl-9 rounded-none border-border bg-background text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
          {filteredPostings.length} {t("Active Postings")}
        </span>
      </div>

      {/* Postings Table */}
      <div className="border border-border bg-card overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t("Internship Title")}
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t("Domain & Mode")}
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t("Stipend & Duration")}
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t("Status")}
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">
                {t("Actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-xs font-black uppercase tracking-widest text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                  {t("Loading...")}
                </td>
              </tr>
            ) : filteredPostings.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-xs text-muted-foreground font-bold">
                  {t("No internship postings found. Click 'Post New Internship' to add one.")}
                </td>
              </tr>
            ) : (
              filteredPostings.map((p) => (
                <tr key={p._id || p.id} className="hover:bg-primary/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary/10 text-primary flex items-center justify-center rounded-none shrink-0 font-bold">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-tight text-foreground block">
                          {p.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {p.company_name}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest rounded-none">
                        {p.domain}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground block">
                        {p.location_type || "Remote"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-primary block">
                      {p.stipend_amount ? `₹${p.stipend_amount}/mo` : "Unpaid"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {p.duration_months} Months • {p.total_openings} Seats
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      className={`text-[9px] font-black uppercase tracking-widest rounded-none ${
                        p.status === "Open"
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.status || "Open"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewApplicants(p)}
                        className="rounded-none text-[10px] font-black uppercase tracking-widest h-8 px-3 border-border"
                      >
                        <Users className="w-3.5 h-3.5 mr-1" />
                        {t("Applicants")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePosting(p._id || p.id)}
                        className="rounded-none h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Internship Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-xl rounded-none bg-card border-border p-0">
          <form onSubmit={handleCreatePosting}>
            <div className="p-6 bg-primary/5 border-b border-border">
              <Badge className="bg-primary text-primary-foreground font-black text-[9px] uppercase tracking-widest rounded-none mb-2">
                New Opportunity
              </Badge>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">
                {t("Post Internship Opening")}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {t("Publish hands-on apprenticeship opportunities visible to enrolled candidates.")}
              </DialogDescription>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[65vh] overflow-y-auto">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  {t("Internship Title")} *
                </Label>
                <Input
                  required
                  placeholder="e.g. Junior Web Developer Intern"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-none border-border bg-background h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    {t("Company / Organization")} *
                  </Label>
                  <Input
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="rounded-none border-border bg-background h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    {t("Domain")} *
                  </Label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full h-10 px-3 border border-border bg-background text-xs font-bold uppercase tracking-wider rounded-none focus:outline-none"
                  >
                    <option value="Web Development">Web Development</option>
                    <option value="Graphic Design">Graphic Design</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                    <option value="Office Automation">Office Automation</option>
                    <option value="Hardware & AI">Hardware & AI</option>
                    <option value="Business Admin">Business Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    {t("Location Mode")}
                  </Label>
                  <select
                    value={locationType}
                    onChange={(e) => setLocationType(e.target.value)}
                    className="w-full h-10 px-3 border border-border bg-background text-xs font-bold uppercase tracking-wider rounded-none focus:outline-none"
                  >
                    <option value="Remote">Remote</option>
                    <option value="On-site">On-site</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    {t("Duration (Mo)")}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(Number(e.target.value))}
                    className="rounded-none border-border bg-background h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    {t("Monthly Stipend (₹)")}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={stipendAmount}
                    onChange={(e) => setStipendAmount(Number(e.target.value))}
                    className="rounded-none border-border bg-background h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  {t("Skills Required (comma-separated)")}
                </Label>
                <Input
                  placeholder="e.g. React, Node.js, Git, Responsive Design"
                  value={skillsRequired}
                  onChange={(e) => setSkillsRequired(e.target.value)}
                  className="rounded-none border-border bg-background h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  {t("Detailed Role Description & Tasks")} *
                </Label>
                <Textarea
                  required
                  rows={4}
                  placeholder={t("Key responsibilities, learning goals, and requirements...")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-none border-border bg-background text-xs"
                />
              </div>
            </div>

            <DialogFooter className="p-6 pt-0 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-none text-xs font-bold uppercase tracking-wider"
              >
                {t("Cancel")}
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-none text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                {t("Publish Internship")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Applicants Modal */}
      <Dialog open={!!selectedPosting} onOpenChange={(open) => !open && setSelectedPosting(null)}>
        <DialogContent className="max-w-3xl rounded-none bg-card border-border p-0">
          <div className="p-6 bg-muted/40 border-b border-border flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold uppercase tracking-tight">
                {t("Applicants")}: {selectedPosting?.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {selectedPosting?.company_name} • {applicants.length} {t("Total Applications")}
              </DialogDescription>
            </div>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {loadingApplicants ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              </div>
            ) : applicants.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground font-bold">
                {t("No candidates have applied for this position yet.")}
              </div>
            ) : (
              <div className="divide-y divide-border border border-border">
                {applicants.map((app) => (
                  <div
                    key={app._id || app.id}
                    className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-muted/10 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase text-foreground">
                          {app.student_name}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest rounded-none">
                          {app.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {app.student_email} • {app.student_phone} {app.enrollment_no && `• ${app.enrollment_no}`}
                      </p>
                      {app.cover_note && (
                        <p className="text-xs text-muted-foreground/80 italic mt-1 line-clamp-2">
                          "{app.cover_note}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {app.resume_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(app.resume_url, "_blank")}
                          className="rounded-none text-[10px] font-black uppercase tracking-widest h-8 border-border"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          Resume
                        </Button>
                      )}

                      <select
                        value={app.status || "Applied"}
                        onChange={(e) => handleUpdateStatus(app._id || app.id, e.target.value)}
                        className="h-8 px-2 border border-border bg-background text-[10px] font-black uppercase tracking-wider rounded-none focus:outline-none"
                      >
                        <option value="Applied">Applied</option>
                        <option value="Shortlisted">Shortlisted</option>
                        <option value="Selected">Selected</option>
                        <option value="Completed">Completed (Issue Cert)</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInternshipManagerPage;
