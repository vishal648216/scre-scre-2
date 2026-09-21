import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Pencil, Save, X, Loader2, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

export type CMSType = "page" | "slider" | "gallery" | "teacher" | "partner" | "download" | "verification" | "ticker" | "faq" | "idcard_template" | "shop" | "directormessage" | "gallerycategory" | "student" | "university" | "heropartners";

interface CMSItem {
  _id?: any;
  category: CMSType;
  title: string;
  description?: string;
  image_url?: string;
  mobile_image_url?: string;
  video_url?: string;
  video_urls?: string[];
  link?: string;
  content?: string;
  order: number;
  active: boolean;
  // Category specific fields
  designation?: string; // For teachers
  specialization?: string; // For teachers
  education?: string; // For teachers
  file_size?: string; // For downloads
  file_type?: string; // For downloads
  button_text?: string; // For sliders
  view_courses_button_text?: string; // For sliders
  view_courses_button_link?: string; // For sliders
  tag?: string; // For sliders
  highlight?: string; // For sliders
  show_stats?: boolean | string; // For sliders
  stat1_text?: string; // For sliders
  stat2_text?: string; // For sliders
  stat3_text?: string; // For sliders
  stat4_text?: string; // For sliders
  pdf_url?: string; // For verification
  price?: number; // For shop items
  download_category_id?: string; // For downloads
}

interface CMSManagerProps {
  category: CMSType;
  title: string;
  downloadCategoryId?: string;
  onBack?: () => void;
}

const CMSManager = ({ category, title, downloadCategoryId, onBack }: CMSManagerProps) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<CMSItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<CMSItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const getItemId = (item: CMSItem): string => {
    if (!item._id) return "";
    if (typeof item._id === "string") return item._id;
    if (typeof item._id === "object") {
      if (item._id.$oid) return item._id.$oid;
      return JSON.stringify(item._id);
    }
    return String(item._id);
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      let url = `/api/cms?category=${category}`;
      if (downloadCategoryId) {
        url += `&download_category_id=${downloadCategoryId}`;
      }
      const res = await apiFetch(url);
      const data = await res.json();
      if (Array.isArray(data)) {
        // Sort items by order
        const sorted = [...data].sort((a, b) => (a.order || 0) - (b.order || 0));
        setItems(sorted);
      }
    } catch (err) {
      toast.error(t("Failed to fetch CMS items"));
    } finally {
      setLoading(false);
    }
  };

  const [downloadCategories, setDownloadCategories] = useState<any[]>([]);

  useEffect(() => {
    fetchItems();
    if (category === "download") {
      fetchDownloadCategories();
    }
  }, [category]);

  const fetchDownloadCategories = async () => {
    try {
      const res = await apiFetch("/api/download-categories");
      if (res.ok) setDownloadCategories(await res.json());
    } catch (err) {
      console.error("Failed to fetch download categories", err);
    }
  };

  const handleUpload = async (file: File, field: "image_url" | "mobile_image_url" | "pdf_url" = "image_url") => {
    setUploading(true);
    try {
      const token = sessionStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);

      // Auto-detect file size and type for downloads
      if (category === "download" && editingItem && field === "image_url") {
        const sizeInMb = (file.size / (1024 * 1024)).toFixed(2) + " MB";
        const type = file.name.split('.').pop()?.toUpperCase() || "FILE";
        setEditingItem({
          ...editingItem,
          file_size: sizeInMb,
          file_type: type,
          title: editingItem.title || file.name.split('.')[0]
        });
      }

      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        if (editingItem) {
          setEditingItem({ ...editingItem, [field]: data.url });
        }
        toast.success(t("File uploaded successfully"));
      } else {
        toast.error(t(data.message || "Upload failed"));
      }
    } catch (err) {
      toast.error(t("Error uploading file"));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      const id = getItemId(editingItem);
      const url = id ? `/api/admin/cms/${id}` : "/api/admin/cms";
      const method = id ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingItem),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(t(id ? "Item updated" : "Item created"));
        setEditingItem(null);
        setIsAdding(false);
        fetchItems();
      } else {
        toast.error(t(data.message || "Failed to save item"));
      }
    } catch (err: any) {
      toast.error(t(err.message || "Failed to save item"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    if (!confirm(t("Are you sure you want to delete this item?"))) return;
    try {
      const res = await apiFetch(`/api/admin/cms/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("Item deleted"));
        fetchItems();
      } else {
        toast.error(t("Failed to delete item"));
      }
    } catch (err) {
      toast.error(t("Failed to delete item"));
    }
  };

  const startEdit = (item: CMSItem) => {
    setEditingItem({
      ...item,
      video_urls: item.video_urls || []
    });
    setIsAdding(false);
  };

  const startAdd = () => {
    setEditingItem({
      category,
      title: "",
      description: "",
      image_url: "",
      mobile_image_url: "",
      link: "",
      content: "",
      order: items.length,
      active: true,
      designation: "",
      specialization: "",
      file_size: "",
      file_type: "",
      button_text: category === "slider" ? t("Learn More") : "",
      tag: category === "slider" ? t("🎓 FEATURED") : "",
      highlight: "",
      price: category === "shop" ? 0 : undefined,
      download_category_id: downloadCategoryId,
      video_urls: [],
    });
    setIsAdding(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderForm = () => {
    if (!editingItem) return null;

    switch (category) {
      case "idcard_template":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Template Name")}</Label>
                <Input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="rounded-none"
                  placeholder={t("Enter template name")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Template Preview Image")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingItem.image_url}
                    onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                    className="rounded-none"
                    placeholder="https://..."
                  />
                  <div className="relative">
                    <Button variant="outline" className="rounded-none gap-2" disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {t("Upload Image")}
                    </Button>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Template HTML Content")}</Label>
              <Textarea
                value={editingItem.content}
                onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                className="rounded-none min-h-[300px] font-mono text-xs"
                placeholder={t("Enter template HTML with placeholders like {{name}}, {{id}}, etc.")}
              />
            </div>
          </div>
        );

      case "faq":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Question")}</Label>
                <Input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="rounded-none"
                  placeholder={t("Enter the question...")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Order")}</Label>
                <Input
                  type="number"
                  value={editingItem.order}
                  onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) })}
                  className="rounded-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Answer")}</Label>
              <Textarea
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="rounded-none min-h-[150px]"
                placeholder={t("Enter the detailed answer...")}
              />
            </div>
          </div>
        );

      case "ticker":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Ticker Title (Bold Text)")}</Label>
                <Input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="rounded-none"
                  placeholder={t("e.g. ADMISSIONS OPEN")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Order")}</Label>
                <Input
                  type="number"
                  value={editingItem.order}
                  onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) })}
                  className="rounded-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Ticker Description (Normal Text)")}</Label>
              <Input
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="rounded-none"
                placeholder={t("e.g. for academic year 2026-27")}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Click URL / Link (Optional)")}</Label>
              <Input
                value={editingItem.link}
                onChange={(e) => setEditingItem({ ...editingItem, link: e.target.value })}
                className="rounded-none"
                placeholder="https://..."
              />
            </div>
          </div>
        );

      case "teacher":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Teacher Name")}</Label>
                <Input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="rounded-none"
                  placeholder={t("Full Name")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Designation")}</Label>
                <Input
                  value={editingItem.designation}
                  onChange={(e) => setEditingItem({ ...editingItem, designation: e.target.value })}
                  className="rounded-none"
                  placeholder={t("e.g. Senior Faculty")}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Specialization")}</Label>
                <Input
                  value={editingItem.specialization}
                  onChange={(e) => setEditingItem({ ...editingItem, specialization: e.target.value })}
                  className="rounded-none"
                  placeholder={t("e.g. Web Development")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Education")}</Label>
                <Input
                  value={editingItem.education || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, education: e.target.value })}
                  className="rounded-none"
                  placeholder={t("e.g. M.Tech, B.Tech, MBA")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Display Order")}</Label>
              <Input
                type="number"
                value={editingItem.order}
                onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) })}
                className="rounded-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Short Bio")}</Label>
              <Textarea
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="rounded-none min-h-[80px]"
                placeholder={t("Brief introduction...")}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Profile Photo URL")}</Label>
              <div className="flex gap-2">
                <Input
                  value={editingItem.image_url}
                  onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                  className="rounded-none"
                  placeholder="https://..."
                />
                <div className="relative">
                  <Button variant="outline" className="rounded-none gap-2" disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {t("Upload")}
                  </Button>
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                </div>
              </div>
            </div>
          </div>
        );

      case "slider":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Main Heading</Label>
                <Textarea
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="rounded-none min-h-[80px]"
                  placeholder="Hero Title"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Highlight Text (Optional)</Label>
                <Textarea
                  value={editingItem.highlight}
                  onChange={(e) => setEditingItem({ ...editingItem, highlight: e.target.value })}
                  className="rounded-none min-h-[80px]"
                  placeholder="e.g. IT & Skill Education"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Small Tag (Top)</Label>
                <Input
                  value={editingItem.tag}
                  onChange={(e) => setEditingItem({ ...editingItem, tag: e.target.value })}
                  className="rounded-none"
                  placeholder="e.g. 🎓 Admissions Open"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Order</Label>
                <Input
                  type="number"
                  value={editingItem.order}
                  onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) })}
                  className="rounded-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Subheading / Description</Label>
              <Textarea
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="rounded-none min-h-[80px]"
                placeholder="Enter slider text..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Primary Button Text</Label>
                <Input
                  value={editingItem.button_text}
                  onChange={(e) => setEditingItem({ ...editingItem, button_text: e.target.value })}
                  className="rounded-none"
                  placeholder="e.g. Join Now"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Primary Button Link</Label>
                <Input
                  value={editingItem.link}
                  onChange={(e) => setEditingItem({ ...editingItem, link: e.target.value })}
                  className="rounded-none"
                  placeholder="/contact"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">View Courses Button Text</Label>
                <Input
                  value={editingItem.view_courses_button_text}
                  onChange={(e) => setEditingItem({ ...editingItem, view_courses_button_text: e.target.value })}
                  className="rounded-none"
                  placeholder="View Courses"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">View Courses Button Link</Label>
                <Input
                  value={editingItem.view_courses_button_link}
                  onChange={(e) => setEditingItem({ ...editingItem, view_courses_button_link: e.target.value })}
                  className="rounded-none"
                  placeholder="/courses"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Switch
                checked={editingItem.show_stats || false}
                onCheckedChange={(v) => setEditingItem({ ...editingItem, show_stats: v })}
              />
              <Label className="text-[10px] font-black uppercase tracking-widest">Show Stats Badges</Label>
            </div>
            {(editingItem.show_stats === true || editingItem.show_stats === "true") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Stat 1 Text</Label>
                  <Input
                    value={editingItem.stat1_text}
                    onChange={(e) => setEditingItem({ ...editingItem, stat1_text: e.target.value })}
                    className="rounded-none"
                    placeholder="Certified Courses"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Stat 2 Text</Label>
                  <Input
                    value={editingItem.stat2_text}
                    onChange={(e) => setEditingItem({ ...editingItem, stat2_text: e.target.value })}
                    className="rounded-none"
                    placeholder="Industry Recognized"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Stat 3 Text</Label>
                  <Input
                    value={editingItem.stat3_text}
                    onChange={(e) => setEditingItem({ ...editingItem, stat3_text: e.target.value })}
                    className="rounded-none"
                    placeholder="5000+ Alumni"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Stat 4 Text</Label>
                  <Input
                    value={editingItem.stat4_text}
                    onChange={(e) => setEditingItem({ ...editingItem, stat4_text: e.target.value })}
                    className="rounded-none"
                    placeholder="100% Placement"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-[10px] font-black uppercase tracking-widest">Background Image URL</Label>
              <div className="flex gap-2">
                <Input
                  value={editingItem.image_url}
                  onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                  className="rounded-none"
                  placeholder="https://..."
                />
                <div className="relative">
                  <Button variant="outline" className="rounded-none gap-2" disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload Image
                  </Button>
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                </div>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Mobile Background Image URL</Label>
              <div className="flex gap-2">
                <Input
                  value={editingItem.mobile_image_url || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, mobile_image_url: e.target.value })}
                  className="rounded-none"
                  placeholder="https://..."
                />
                <div className="relative">
                  <Button variant="outline" className="rounded-none gap-2" disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload Mobile Image
                  </Button>
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "mobile_image_url")} />
                </div>
              </div>
            </div>
          </div>
        );

      case "download":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!downloadCategoryId && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary">{t("Download Category *")}</Label>
                  <select
                    required
                    value={editingItem.download_category_id || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, download_category_id: e.target.value })}
                    className="w-full h-10 border border-border bg-background px-3 py-2 text-sm rounded-none focus:outline-none focus:border-primary"
                  >
                    <option value="">{t("Select Category")}</option>
                    {downloadCategories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Order")}</Label>
                <Input
                  type="number"
                  value={editingItem.order}
                  onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) })}
                  className="rounded-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("File Name / Title")}</Label>
                <Input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="rounded-none"
                  placeholder={t("e.g. Prospectus 2026")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("File Type")}</Label>
                <Input
                  value={editingItem.file_type}
                  onChange={(e) => setEditingItem({ ...editingItem, file_type: e.target.value })}
                  className="rounded-none"
                  placeholder={t("PDF, DOCX, etc.")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("File Size")}</Label>
                <Input
                  value={editingItem.file_size}
                  onChange={(e) => setEditingItem({ ...editingItem, file_size: e.target.value })}
                  className="rounded-none"
                  placeholder={t("e.g. 2.4 MB")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Short Description")}</Label>
              <Input
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="rounded-none"
                placeholder={t("What is this file about?")}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("File URL")}</Label>
              <div className="flex gap-2">
                <Input
                  value={editingItem.image_url}
                  onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                  className="rounded-none"
                  placeholder="https://..."
                />
                <div className="relative">
                  <Button variant="outline" className="rounded-none gap-2" disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {t("Upload File")}
                  </Button>
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                </div>
              </div>
            </div>
          </div>
        );

      case "verification":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Letter Heading")}</Label>
                <Input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="rounded-none"
                  placeholder={t("e.g. Authorized Training Center 2026")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Display Order")}</Label>
                <Input
                  type="number"
                  value={editingItem.order}
                  onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) })}
                  className="rounded-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Letter Description")}</Label>
              <Textarea
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="rounded-none min-h-[80px]"
                placeholder={t("Enter details about this verification...")}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Preview Image URL")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingItem.image_url}
                    onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                    className="rounded-none"
                    placeholder="https://..."
                  />
                  <div className="relative">
                    <Button variant="outline" className="rounded-none gap-2" disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {t("Image")}
                    </Button>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Verification PDF URL")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingItem.pdf_url}
                    onChange={(e) => setEditingItem({ ...editingItem, pdf_url: e.target.value })}
                    className="rounded-none"
                    placeholder="https://..."
                  />
                  <div className="relative">
                    <Button variant="outline" className="rounded-none gap-2" disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {t("PDF")}
                    </Button>
                    <input type="file" accept="application/pdf" className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploading(true);
                          try {
                            const token = sessionStorage.getItem("token");
                            const formData = new FormData();
                            formData.append("file", file);
                            const res = await fetch("/api/uploads", {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}` },
                              body: formData,
                            });
                            const data = await res.json();
                            if (res.ok && data.url) {
                              setEditingItem({ ...editingItem, pdf_url: data.url });
                              toast.success(t("PDF uploaded successfully"));
                            }
                          } catch (err) {
                            toast.error(t("Error uploading PDF"));
                          } finally {
                            setUploading(false);
                          }
                        }
                      }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "shop":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">{t("Product Name *")}</Label>
                <Input
                  required
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="rounded-none h-11"
                  placeholder={t("e.g. Student Design Hoodie")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">{t("Price (₹) *")}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                  <Input
                    type="number"
                    required
                    value={editingItem.price || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setEditingItem({ ...editingItem, price: isNaN(val) ? 0 : val });
                    }}
                    className="rounded-none h-11 pl-8"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Product Description")}</Label>
              <Textarea
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="rounded-none min-h-[100px] resize-none"
                placeholder={t("Describe the product features, material, etc.")}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">{t("Product Image *")}</Label>
                <div className="flex gap-2">
                  <Input
                    required
                    value={editingItem.image_url}
                    onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                    className="rounded-none h-11"
                    placeholder="https://..."
                  />
                  <div className="relative">
                    <Button variant="outline" className="rounded-none h-11 gap-2 font-black uppercase text-[10px] tracking-widest" disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {t("Upload")}
                    </Button>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Direct Purchase Link (Optional)")}</Label>
                <Input
                  value={editingItem.link}
                  onChange={(e) => setEditingItem({ ...editingItem, link: e.target.value })}
                  className="rounded-none h-11"
                  placeholder="https://buy.stripe.com/..."
                />
                <p className="text-[9px] text-muted-foreground uppercase font-medium mt-1">{t("If provided, 'Buy Now' will redirect here.")}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Display Order")}</Label>
                <Input
                  type="number"
                  value={editingItem.order}
                  onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) || 0 })}
                  className="rounded-none h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Stock Status")}</Label>
                <div className="flex items-center h-11 gap-4 bg-muted/20 px-4 border border-border">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!editingItem.link}
                      disabled
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {editingItem.link ? t("Available") : t("Out of Stock")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "directormessage":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Director Name / Heading")}</Label>
                <Input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="rounded-none"
                  placeholder={t("e.g. Message from the Director")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Display Order")}</Label>
                <Input
                  type="number"
                  value={editingItem.order}
                  onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) || 0 })}
                  className="rounded-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Director's Message")}</Label>
              <Textarea
                value={editingItem.content}
                onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                className="rounded-none min-h-[200px]"
                placeholder={t("Enter the detailed message...")}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Last Line / Signature")}</Label>
              <Input
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="rounded-none"
                placeholder={t("e.g. — Director, SCRE Pvt. Ltd.")}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Director Image URL")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingItem.image_url}
                    onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                    className="rounded-none"
                    placeholder="https://..."
                  />
                  <div className="relative">
                    <Button variant="outline" className="rounded-none gap-2" disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {t("Upload")}
                    </Button>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("YouTube Video Clip URL (Optional)")}</Label>
                <Input
                  value={editingItem.video_url}
                  onChange={(e) => setEditingItem({ ...editingItem, video_url: e.target.value })}
                  className="rounded-none"
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Uploaded Video Clips (Multiple)")}</Label>
                <div className="relative">
                  <Button variant="outline" className="rounded-none gap-2 h-9" disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {t("Add Video")}
                  </Button>
                  <input type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploading(true);
                        try {
                          const token = sessionStorage.getItem("token");
                          const formData = new FormData();
                          formData.append("file", file);
                          const res = await fetch("/api/uploads", {
                            method: "POST",
                            headers: { Authorization: `Bearer ${token}` },
                            body: formData,
                          });
                          const data = await res.json();
                          if (res.ok && data.url) {
                            setEditingItem({
                              ...editingItem,
                              video_urls: [...(editingItem.video_urls || []), data.url]
                            });
                            toast.success(t("Video uploaded successfully"));
                          }
                        } catch (err) {
                          toast.error(t("Error uploading video"));
                        } finally {
                          setUploading(false);
                        }
                      }
                    }} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(editingItem.video_urls || []).map((url, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-muted/50 border border-border rounded px-3 py-2">
                    <span className="text-xs font-bold truncate max-w-[200px]">{url.split('/').pop()}</span>
                    <button
                      type="button"
                      onClick={() => setEditingItem({
                        ...editingItem,
                        video_urls: (editingItem.video_urls || []).filter((_, i) => i !== idx)
                      })}
                      className="text-destructive hover:text-destructive/80"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "student":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Student Name")}</Label>
                <Input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="rounded-none"
                  placeholder={t("Full Name")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Role")}</Label>
                <Input
                  value={editingItem.role || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, role: e.target.value })}
                  className="rounded-none"
                  placeholder={t("e.g. Alumni, Current Student")}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Course")}</Label>
                <Input
                  value={editingItem.description || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="rounded-none"
                  placeholder={t("e.g. Digital Marketing")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Display Order")}</Label>
                <Input
                  type="number"
                  value={editingItem.order}
                  onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) || 0 })}
                  className="rounded-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Description")}</Label>
              <Textarea
                value={editingItem.student_description || ""}
                onChange={(e) => setEditingItem({ ...editingItem, student_description: e.target.value })}
                className="rounded-none min-h-[80px]"
                placeholder={t("A short description about the student")}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Student Photo URL")}</Label>
              <div className="flex gap-2">
                <Input
                  value={editingItem.image_url}
                  onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                  className="rounded-none"
                  placeholder="https://..."
                />
                <div className="relative">
                  <Button variant="outline" className="rounded-none gap-2" disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {t("Upload")}
                  </Button>
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                </div>
              </div>
            </div>
          </div>
        );

      case "university":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("University Name")}</Label>
                <Input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="rounded-none"
                  placeholder={t("University Name")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Display Order")}</Label>
                <Input
                  type="number"
                  value={editingItem.order}
                  onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) || 0 })}
                  className="rounded-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("University Logo URL")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingItem.image_url}
                    onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                    className="rounded-none"
                    placeholder="https://..."
                  />
                  <div className="relative">
                    <Button variant="outline" className="rounded-none gap-2" disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {t("Upload")}
                    </Button>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("University URL (Redirect Link)")}</Label>
                <Input
                  value={editingItem.link || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, link: e.target.value })}
                  className="rounded-none"
                  placeholder="https://university.example.com"
                />
              </div>
            </div>
          </div>
        );

      case "partner":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Partner Name")}</Label>
                <Input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="rounded-none"
                  placeholder={t("e.g. Microsoft")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Display Order")}</Label>
                <Input
                  type="number"
                  value={editingItem.order}
                  onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) || 0 })}
                  className="rounded-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Partner Logo URL")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingItem.image_url}
                    onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                    className="rounded-none"
                    placeholder="https://..."
                  />
                  <div className="relative">
                    <Button variant="outline" className="rounded-none gap-2" disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {t("Upload")}
                    </Button>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Partner URL (Redirect Link)")}</Label>
                <Input
                  value={editingItem.link || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, link: e.target.value })}
                  className="rounded-none"
                  placeholder="https://partner.example.com"
                />
              </div>
            </div>
          </div>
        );

      case "heropartners":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Partner Name")}</Label>
                <Input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="rounded-none"
                  placeholder={t("e.g. Microsoft")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Display Order")}</Label>
                <Input
                  type="number"
                  value={editingItem.order}
                  onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) || 0 })}
                  className="rounded-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Partner Logo URL")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingItem.image_url}
                    onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                    className="rounded-none"
                    placeholder="https://..."
                  />
                  <div className="relative">
                    <Button variant="outline" className="rounded-none gap-2" disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {t("Upload")}
                    </Button>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Partner URL (Redirect Link)")}</Label>
                <Input
                  value={editingItem.link || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, link: e.target.value })}
                  className="rounded-none"
                  placeholder="https://partner.example.com"
                />
              </div>
            </div>
          </div>
        );

      default:
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Title")}</Label>
                <Input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="rounded-none"
                  placeholder={t("Enter title")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Order")}</Label>
                <Input
                  type="number"
                  value={editingItem.order}
                  onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) })}
                  className="rounded-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Description")}</Label>
              <Textarea
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                className="rounded-none min-h-[100px]"
                placeholder={t("Enter description or summary")}
              />
            </div>

            {category === "page" && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Page Content (HTML/Text)")}</Label>
                <Textarea
                  value={editingItem.content}
                  onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                  className="rounded-none min-h-[300px] font-mono text-xs"
                  placeholder={t("Enter detailed page content...")}
                />
                <p className="text-[10px] text-muted-foreground mt-1">{t("HTML tags are supported for formatting.")}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  {t("Image URL")}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={editingItem.image_url}
                    onChange={(e) => setEditingItem({ ...editingItem, image_url: e.target.value })}
                    className="rounded-none"
                    placeholder="https://..."
                  />
                  <div className="relative">
                    <Button variant="outline" className="rounded-none gap-2" disabled={uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {t("Upload Image")}
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(file);
                      }}
                      disabled={uploading}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">{t("Link (Optional)")}</Label>
                <Input
                  value={editingItem.link}
                  onChange={(e) => setEditingItem({ ...editingItem, link: e.target.value })}
                  className="rounded-none"
                  placeholder="/page-or-url"
                />
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card p-4 border border-border">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack} className="rounded-none gap-2">
              <X className="w-4 h-4" />
              {t("Back")}
            </Button>
          )}
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight">{t(title)}</h2>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{t("Manage items and content")}</p>
          </div>
        </div>
        {!editingItem && !isAdding && (
          <Button onClick={startAdd} className="rounded-none gap-2 font-black uppercase text-[10px] tracking-widest px-6 h-11">
            <Plus className="w-4 h-4" />
            {t("Add New Item")}
          </Button>
        )}
      </div>

      {editingItem && (
        <Card className="rounded-none border-primary/20 shadow-lg animate-in fade-in slide-in-from-top-4">
          <CardHeader className="bg-primary/5 border-b py-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex justify-between items-center">
              <span>{t(editingItem._id ? "Edit Item" : "Add New Item")}</span>
              <Button variant="ghost" size="sm" onClick={() => { setEditingItem(null); setIsAdding(false); }}>
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {renderForm()}

            <div className="flex items-center gap-2">
              <Switch
                checked={editingItem.active}
                onCheckedChange={(v) => setEditingItem({ ...editingItem, active: v })}
              />
              <Label className="text-[10px] font-black uppercase tracking-widest">{t("Active / Visible")}</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => { setEditingItem(null); setIsAdding(false); }} className="rounded-none">
                {t("Cancel")}
              </Button>
              <Button onClick={handleSave} disabled={saving} className="rounded-none gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t("Save Changes")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.length === 0 ? (
          <div className="col-span-full p-20 text-center border border-dashed rounded-none">
            <p className="text-muted-foreground uppercase text-[10px] font-black tracking-widest">{t("No items found in this category.")}</p>
          </div>
        ) : (
          items.map((item, idx) => {
            const id = getItemId(item);
            return (
              <Card key={id || idx} className="rounded-none border-border group overflow-hidden hover:border-primary/50 transition-colors">
                <div className="aspect-video relative bg-muted overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}
                  {!item.active && (
                    <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground px-2 py-1 text-[8px] font-black uppercase tracking-widest">
                      {t("Inactive")}
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 text-[8px] font-black uppercase tracking-widest">
                    {t("Order")}: {item.order}
                  </div>
                </div>
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-bold text-sm uppercase truncate">{item.title}</h3>
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground line-clamp-2 h-8">{item.description}</p>
                    {category === "teacher" && (
                      <p className="text-[10px] font-bold text-primary uppercase">{item.designation}</p>
                    )}
                    {category === "download" && (
                      <p className="text-[10px] font-bold text-primary uppercase">{item.file_type} • {item.file_size}</p>
                    )}
                    {category === "shop" && (
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs font-black text-primary uppercase">₹{item.price?.toLocaleString()}</p>
                        {item.link ? (
                          <span className="text-[8px] font-black bg-green-500/10 text-green-600 px-1.5 py-0.5 uppercase tracking-tighter">
                            {t("Link Added")}
                          </span>
                        ) : (
                          <span className="text-[8px] font-black bg-orange-500/10 text-orange-600 px-1.5 py-0.5 uppercase tracking-tighter">
                            {t("No Link")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => startEdit(item)} className="h-8 w-8 p-0 rounded-none">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(id)} className="h-8 w-8 p-0 rounded-none">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CMSManager;
