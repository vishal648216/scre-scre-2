import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { normalizeAssetUrl } from "@/lib/utils";

type TemplateKind = "certificate" | "marksheet" | "id_card";

const normalizeCreateType = (raw: string | null): TemplateKind | null => {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t === "idcard") return "id_card";
  if (t === "certificate" || t === "marksheet" || t === "id_card") return t;
  return null;
};

const TYPE_HEADING: Record<TemplateKind, string> = {
  certificate: "Create certificate design",
  marksheet: "Create marksheet design",
  id_card: "Create ID card design",
};

export default function TemplateCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateType = normalizeCreateType(searchParams.get("type"));

  const [loading, setLoading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const bgInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    template_name: "",
    course_id: "__all__",
    page_size: "a4",
    orientation: "portrait",
    background_image: "",
  });
  const [courses, setCourses] = useState<Array<{ id: string; course_name: string; status?: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/courses?status=active");
        const data = await res.json().catch(() => []);
        setCourses(Array.isArray(data) ? data : []);
      } catch {
        setCourses([]);
      }
    })();
  }, []);

  const uploadBackground = async (file: File) => {
    setBgUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.url) {
        setForm((f) => ({ ...f, background_image: String(data.url) }));
        toast.success("Background uploaded");
      } else {
        toast.error(data?.message || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setBgUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateType) return;
    if (!form.template_name.trim()) {
      toast.error("Name is required");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_name: form.template_name.trim(),
          template_type: templateType,
          course_id:
            templateType === "certificate" && form.course_id !== "__all__" ? form.course_id : undefined,
          page_size: form.page_size,
          orientation: form.orientation,
          background_image: form.background_image.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        toast.success("Design created");
        navigate(`/dashboard/templates/editor/${data.id}`);
      } else {
        toast.error(data.message || "Failed to create design");
      }
    } catch {
      toast.error("Failed to create design");
    } finally {
      setLoading(false);
    }
  };

  const cancelHref = templateType
    ? `/dashboard/attachments/templates?type=${templateType}`
    : "/dashboard/attachments/templates?type=certificate";

  if (!templateType) {
    return <Navigate to="/dashboard/attachments/templates?type=certificate" replace />;
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-xl">
        <h1 className="font-heading font-bold text-2xl uppercase tracking-tight mb-6">{TYPE_HEADING[templateType]}</h1>
        <Card className="rounded-none border-border">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-widest">Name</Label>
                <Input
                  className="rounded-none mt-1"
                  value={form.template_name}
                  onChange={(e) => setForm((f) => ({ ...f, template_name: e.target.value }))}
                  placeholder="e.g. Course Completion Certificate Design"
                  required
                />
              </div>
              {templateType === "certificate" && (
                <div>
                  <Label className="text-xs uppercase tracking-widest">Certificate For Course</Label>
                  <Select value={form.course_id} onValueChange={(v) => setForm((f) => ({ ...f, course_id: v }))}>
                    <SelectTrigger className="rounded-none mt-1">
                      <SelectValue placeholder="All Courses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Courses</SelectItem>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.course_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-widest">Page Size</Label>
                  <Select value={form.page_size} onValueChange={(v) => setForm((f) => ({ ...f, page_size: v }))}>
                    <SelectTrigger className="rounded-none mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4</SelectItem>
                      <SelectItem value="a3">A3</SelectItem>
                      <SelectItem value="letter">Letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-widest">Orientation</Label>
                  <Select value={form.orientation} onValueChange={(v) => setForm((f) => ({ ...f, orientation: v }))}>
                    <SelectTrigger className="rounded-none mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest">Background Image (optional)</Label>
                <div
                  className="mt-2 border border-dashed border-border bg-muted/20 p-4 rounded-none"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) uploadBackground(file);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <div className="font-semibold">Drag & drop an image here</div>
                      <div className="text-xs text-muted-foreground">or upload from your computer</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-none"
                      disabled={bgUploading}
                      onClick={() => bgInputRef.current?.click()}
                    >
                      {bgUploading ? "Uploading..." : "Upload"}
                    </Button>
                    <input
                      ref={bgInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadBackground(file);
                      }}
                    />
                  </div>
                  <div className="mt-3">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Background URL</Label>
                    <Input
                      className="rounded-none mt-1"
                      value={form.background_image}
                      onChange={(e) => setForm((f) => ({ ...f, background_image: e.target.value }))}
                      placeholder="https://... (auto-filled after upload)"
                    />
                    {form.background_image ? (
                      <div className="mt-3 border border-border bg-background p-2">
                        <img src={normalizeAssetUrl(form.background_image)} alt="Background preview" className="w-full h-40 object-contain" />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading} className="rounded-none">
                  Create & Open Designer
                </Button>
                <Button type="button" variant="outline" className="rounded-none" onClick={() => navigate(cancelHref)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
