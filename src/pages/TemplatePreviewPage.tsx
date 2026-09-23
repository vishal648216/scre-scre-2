import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { normalizeAssetUrl } from "@/lib/utils";

interface Template {
  _id: string;
  template_name: string;
  page_size: string;
  orientation: string;
  background_image?: string;
  logo_left?: string;
  logo_right?: string;
  authority_signature?: string;
}

interface TemplateField {
  _id: string;
  field_name: string;
  field_type: string;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  font_size?: number;
  font_family?: string;
  color?: string;
  text_align?: string;
  custom_text?: string;
}

export default function TemplatePreviewPage() {
  const { id } = useParams();
  const [template, setTemplate] = useState<Template | null>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const [tRes, fRes] = await Promise.all([
          apiFetch("/api/templates/" + id),
          apiFetch("/api/templates/" + id + "/fields"),
        ]);
        if (tRes.ok) setTemplate(await tRes.json());
        if (fRes.ok) setFields(await fRes.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!template) return <div>Template not found</div>;

  const isPortrait = template.orientation === "Portrait";
  const isA4 = template.page_size === "A4";
  const isA3 = template.page_size === "A3";
  const isLetter = template.page_size === "Letter";

  let width = "210mm";
  let height = "297mm";

  if (isA4) {
    width = isPortrait ? "210mm" : "297mm";
    height = isPortrait ? "297mm" : "210mm";
  } else if (isA3) {
    width = isPortrait ? "297mm" : "420mm";
    height = isPortrait ? "420mm" : "297mm";
  } else if (isLetter) {
    width = isPortrait ? "215.9mm" : "279.4mm";
    height = isPortrait ? "279.4mm" : "215.9mm";
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-8">
      <div 
        className="bg-white shadow-2xl relative overflow-hidden"
        style={{ width, height }}
      >
        {/* Background */}
        {template.background_image && (
          <img
            src={normalizeAssetUrl(template.background_image)}
            className="absolute inset-0 w-full h-full object-fill pointer-events-none"
            alt="Background"
          />
        )}

        {/* Logos */}
        {template.logo_left && (
          <img 
            src={normalizeAssetUrl(template.logo_left)} 
            className="absolute left-[5%] top-[8%] w-[12%] h-auto object-contain pointer-events-none"
            alt="Logo Left"
          />
        )}
        {template.logo_right && (
          <img 
            src={normalizeAssetUrl(template.logo_right)} 
            className="absolute right-[5%] top-[8%] w-[12%] h-auto object-contain pointer-events-none"
            alt="Logo Right"
          />
        )}

        {/* Signature */}
        {template.authority_signature && (
          <div className="absolute right-[10%] bottom-[12%] w-[15%] flex flex-col items-center gap-1 pointer-events-none">
            <img 
              src={normalizeAssetUrl(template.authority_signature)} 
              className="w-full h-auto object-contain"
              alt="Signature"
            />
            <div className="w-full h-px bg-black/20" />
            <span className="text-[8px] font-bold uppercase tracking-widest opacity-60 text-black">Authorized Signatory</span>
          </div>
        )}

        {/* Fields */}
        {fields.map((f) => (
          <div
            key={f._id}
            className="absolute flex items-center p-1"
            style={{
              left: `${f.x_position}%`,
              top: `${f.y_position}%`,
              width: `${f.width}%`,
              height: `${f.height}%`,
              fontSize: `${f.font_size || 14}pt`,
              fontFamily: f.font_family || "Arial",
              color: f.color || "#000",
              textAlign: (f.text_align as any) || "left",
            }}
          >
            {f.field_type === "photo" ? (
              <div className="w-full h-full border border-dashed border-black/20" />
            ) : f.field_type === "qr_code" ? (
              <div className="w-full h-full border border-dashed border-black/20" />
            ) : (
              <div className="w-full leading-tight">
                {f.field_name === "custom_text" ? f.custom_text : `{{${f.field_name}}}`}
              </div>
            )}
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: none; padding: 0; }
          .min-h-screen { background: none; padding: 0; }
          div[style*="width"] { box-shadow: none; margin: 0; }
        }
      `}} />
    </div>
  );
}
