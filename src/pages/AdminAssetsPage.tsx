import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Image as ImageIcon, Stamp, PenTool, Save, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

const AdminAssetsPage = () => {
  const [loading, setLoading] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [form, setForm] = useState({
    signature_url: "",
    stamp_url: "",
  });

  const load = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/admin/assets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setForm({
            signature_url: data.signature_url || "",
            stamp_url: data.stamp_url || "",
          });
        }
      } else {
        const err = await res.json().catch(() => null);
        if (err?.message) toast.error(err.message);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/admin/assets", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Admin certificate assets updated");
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.message || "Failed to update admin assets");
      }
    } catch {
      toast.error("Error updating admin assets");
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (field: "signature_url" | "stamp_url", file: File) => {
    setUploadingField(field);
    try {
      const token = sessionStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        setForm((prev) => ({ ...prev, [field]: data.url }));
        toast.success("File uploaded");
      } else {
        toast.error(data?.message || "Failed to upload file");
      }
    } catch {
      toast.error("Error uploading file");
    } finally {
      setUploadingField(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            Admin Certificate Assets
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Manage your admin-level sign, stamp, and certificate background. These are applied when you approve certificates.
          </p>
        </div>
        <Card className="rounded-none border-border shadow-md">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Admin Branding Assets
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1">Signature URL</label>
              <div className="relative">
                <PenTool className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  className="w-full pl-10 pr-24 py-2.5 rounded-none border border-border bg-background text-sm"
                  value={form.signature_url}
                  onChange={(e) => setForm({ ...form, signature_url: e.target.value })}
                  placeholder="https://.../signature.png"
                />
                <label className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                  <Upload className="w-3 h-3" />
                  <span>{uploadingField === "signature_url" ? "Uploading..." : "Upload"}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile("signature_url", file);
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1">Stamp URL</label>
              <div className="relative">
                <Stamp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  className="w-full pl-10 pr-24 py-2.5 rounded-none border border-border bg-background text-sm"
                  value={form.stamp_url}
                  onChange={(e) => setForm({ ...form, stamp_url: e.target.value })}
                  placeholder="https://.../stamp.png"
                />
                <label className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer">
                  <Upload className="w-3 h-3" />
                  <span>{uploadingField === "stamp_url" ? "Uploading..." : "Upload"}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile("stamp_url", file);
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={save}
                disabled={loading}
                className="bg-primary text-primary-foreground px-10 py-3 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Assets
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminAssetsPage;

