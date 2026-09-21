import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Layers, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Template {
  _id: string;
  template_name: string;
  template_type: string;
  page_size: string;
  orientation: string;
  background_image?: string;
}

const toId = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in (v as object)) return (v as { $oid: string }).$oid;
  return String(v ?? "");
};

export type TemplateListKind = "certificate" | "marksheet" | "id_card";

const TYPE_LABEL: Record<TemplateListKind, string> = {
  certificate: "Certificate",
  marksheet: "Marksheet",
  id_card: "ID Card",
};

const PAGE_TITLE: Record<TemplateListKind, string> = {
  certificate: "Certificate designs",
  marksheet: "Marksheet designs",
  id_card: "ID card designs",
};

const PAGE_SUBTITLE: Record<TemplateListKind, string> = {
  certificate: "Create and edit certificate templates for generation.",
  marksheet: "Create and edit marksheet templates for generation.",
  id_card: "Create and edit ID card templates for generation.",
};

function normalizeListType(raw: string | null): TemplateListKind | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t === "idcard") return "id_card";
  if (t === "certificate" || t === "marksheet" || t === "id_card") return t;
  return null;
}

export default function TemplateListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const listKind = useMemo(
    () => normalizeListType(searchParams.get("type")),
    [searchParams]
  );

  useEffect(() => {
    if (location.pathname === "/dashboard/attachments/templates" && !listKind) {
      navigate("/dashboard/attachments/templates?type=certificate", { replace: true });
    }
  }, [location.pathname, listKind, navigate]);

  useEffect(() => {
    if (!listKind) return;
    load(listKind);
  }, [listKind]);

  const load = async (kind: TemplateListKind) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ template_type: kind });
      const res = await apiFetch("/api/templates?" + q.toString());
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : []);
      } else setTemplates([]);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (id: string, name: string) => {
    if (!confirm("Delete \"" + name + "\"?")) return;
    try {
      const res = await apiFetch("/api/templates/" + id, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success("Deleted");
        if (listKind) load(listKind);
      } else toast.error(data.message || "Delete failed");
    } catch {
      toast.error("Delete failed");
    }
  };

  const createHref = listKind ? `/dashboard/templates/create?type=${listKind}` : "/dashboard/templates/create?type=certificate";

  if (!listKind) {
    return (
      <DashboardLayout>
        <div className="p-6 text-muted-foreground">Loading…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading font-bold text-2xl uppercase tracking-tight">{PAGE_TITLE[listKind]}</h1>
            <p className="text-muted-foreground text-sm">{PAGE_SUBTITLE[listKind]}</p>
          </div>
          <Link to={createHref}>
            <Button className="rounded-none gap-2">
              <PlusCircle className="w-4 h-4" />
              Create {TYPE_LABEL[listKind]}
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="text-muted-foreground py-12 text-center">Loading...</div>
        ) : templates.length === 0 ? (
          <Card className="rounded-none border-border">
            <CardContent className="py-16 text-center">
              <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No {TYPE_LABEL[listKind].toLowerCase()} designs yet</p>
              <Link to={createHref}>
                <Button variant="outline" className="rounded-none">
                  Create your first {TYPE_LABEL[listKind].toLowerCase()}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => {
              const tid = toId(t._id);
              return (
                <Card key={tid} className="rounded-none border-border overflow-hidden">
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <span className="font-bold text-sm uppercase">{t.template_name}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {(t.page_size || "A4") + " • " + (t.orientation || "Portrait")}
                    </span>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex gap-2">
                      <Link to={"/dashboard/templates/editor/" + tid}>
                        <Button size="sm" variant="outline" className="rounded-none gap-1">
                          <Pencil className="w-3 h-3" /> Edit
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-none text-destructive hover:text-destructive gap-1"
                        onClick={() => deleteTemplate(tid, t.template_name)}
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
