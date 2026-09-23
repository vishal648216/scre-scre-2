import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Image as ImageIcon, Stamp, PenTool } from "lucide-react";
import { toast } from "sonner";

const CenterAssetsPage = () => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    center_name: "",
    signature_url: "",
    stamp_url: "",
    background_url: "",
  });

  const load = async () => {
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/center/assets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setForm({
            center_name: data.center_name || "",
            signature_url: data.signature_url || "",
            stamp_url: data.stamp_url || "",
            background_url: data.background_url || "",
          });
        }
      }
    } catch {
      toast.error("Failed to load assets");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Center Certificate Assets</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">View your certificate branding assets. These are managed by Admin.</p>
        </div>
        <Card className="rounded-none border-border shadow-md">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Building className="w-4 h-4 text-primary" />
              Branding Assets
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1">Center Name</label>
              <input className="w-full px-4 py-2.5 rounded-none border border-border bg-muted text-sm" value={form.center_name} readOnly disabled />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1">Signature URL</label>
              <div className="relative">
                <PenTool className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-muted text-sm" value={form.signature_url} readOnly disabled />
              </div>
              {form.signature_url && (
                <div className="mt-2">
                  <a href={form.signature_url} target="_blank" rel="noreferrer" className="text-xs font-bold underline">
                    Preview signature
                  </a>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1">Stamp URL</label>
              <div className="relative">
                <Stamp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-muted text-sm" value={form.stamp_url} readOnly disabled />
              </div>
              {form.stamp_url && (
                <div className="mt-2">
                  <a href={form.stamp_url} target="_blank" rel="noreferrer" className="text-xs font-bold underline">
                    Preview stamp
                  </a>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1">Certificate Background URL</label>
              <div className="relative">
                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-muted text-sm" value={form.background_url} readOnly disabled />
              </div>
              {form.background_url && (
                <div className="mt-2">
                  <a href={form.background_url} target="_blank" rel="noreferrer" className="text-xs font-bold underline">
                    Preview background
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CenterAssetsPage;
