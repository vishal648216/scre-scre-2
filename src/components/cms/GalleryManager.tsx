import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  Plus,
  Loader2,
  X,
  Upload,
  CheckCircle2,
  Star,
  RefreshCcw,
  Film,
  Layers,
  Edit2,
  Save,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

interface GalleryItem {
  _id?: string | any;
  category?: string;
  title: string;
  description?: string;
  image_url: string;
  video_url?: string;
  active: boolean;
  order: number;
  link?: string;
  is_featured?: boolean;
  is_main?: boolean;
  designation?: string;
  content?: string;
}

interface GalleryCategory {
  _id?: string | any;
  title: string;
  active: boolean;
  order: number;
}

const GalleryManager = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<
    GalleryCategory[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddClip, setShowAddClip] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showEditItem, setShowEditItem] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [editingCategory, setEditingCategory] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [clipData, setClipData] = useState({
    title: "",
    url: "",
    category: "",
  });
  const [addingClip, setAddingClip] = useState(false);

  // New bulk upload state
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkMetadata, setBulkMetadata] = useState({
    title: "",
    description: "",
    category: "",
  });
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const getItemId = (item: any): string => {
    if (!item) return "";
    const id = item._id || item.id;
    if (!id) return "";
    if (typeof id === "string") return id;
    if (typeof id === "object") {
      if (id.$oid) return id.$oid;
      return JSON.stringify(id);
    }
    return String(id);
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/cms?category=gallery");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setItems(data);
        }
      }
    } catch (err) {
      console.error("Gallery fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiFetch("/api/cms?category=gallerycategory");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDynamicCategories(data);
          // Set default category for clip and bulk if not set
          if (data.length > 0) {
            if (!clipData.category)
              setClipData((prev) => ({
                ...prev,
                category: data[0].title.toLowerCase(),
              }));
            if (!bulkMetadata.category)
              setBulkMetadata((prev) => ({
                ...prev,
                category: data[0].title.toLowerCase(),
              }));
          }
        }
      }
    } catch (err) {
      console.error("Categories fetch error:", err);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, []);

  const handleAddCategory = async () => {
    if (!newCategoryTitle.trim()) return toast.error(t("Category title is required"));
    setAddingCategory(true);
    try {
      if (editingCategory) {
        const res = await apiFetch(
          `/api/admin/cms/${editingCategory.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: newCategoryTitle,
              category: "gallerycategory",
              active: true,
            }),
          }
        );
        if (res.ok) {
          toast.success(t("Category updated"));
          setNewCategoryTitle("");
          setEditingCategory(null);
          fetchCategories();
        }
      } else {
        const res = await apiFetch("/api/admin/cms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newCategoryTitle,
            category: "gallerycategory",
            active: true,
            order: dynamicCategories.length,
          }),
        });
        if (res.ok) {
          toast.success(t("Category added"));
          setNewCategoryTitle("");
          fetchCategories();
        }
      }
    } catch (err) {
      toast.error(t("Failed to save category"));
    } finally {
      setAddingCategory(false);
    }
  };

  const handleEditCategory = (cat: GalleryCategory) => {
    const id = getItemId(cat);
    setEditingCategory({ id, title: cat.title });
    setNewCategoryTitle(cat.title);
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
    setNewCategoryTitle("");
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(t("Delete this category?"))) return;
    try {
      const res = await apiFetch(`/api/admin/cms/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(t("Category deleted"));
        fetchCategories();
      }
    } catch (err) {
      toast.error(t("Failed to delete category"));
    }
  };

  const saveClip = async () => {
    if (!clipData.title || !clipData.url || !clipData.category)
      return toast.error(t("Please fill title, URL and category"));

    setAddingClip(true);
    try {
      // Get a thumbnail from YouTube if possible, or use a default placeholder
      let thumbnailUrl = "https://img.youtube.com/vi/DEFAULT/hqdefault.jpg";
      const regExp =
        /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = clipData.url.match(regExp);
      if (match && match[2].length === 11) {
        thumbnailUrl = `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg`;
      }

      const res = await apiFetch("/api/admin/cms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: clipData.title,
          description: "YouTube Clip",
          category: "gallery",
          link: clipData.category,
          image_url: thumbnailUrl,
          content: clipData.url, // Store original URL in content
          active: true,
          order: items.length,
          designation: "video", // Marker to identify as video/clip
        }),
      });

      if (res.ok) {
        toast.success(t("YouTube clip added to gallery"));
        setShowAddClip(false);
        setClipData({ title: "", url: "", category: "" });
        fetchItems();
      }
    } catch (err) {
      toast.error(t("Failed to add clip"));
    } finally {
      setAddingClip(false);
    }
  };

  const handleUpload = async (file: File) => {
    const token = sessionStorage.getItem("token");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (res.ok && data.url) return data.url;
    throw new Error(data.message || "Upload failed");
  };

  const saveBulk = async () => {
    if (bulkFiles.length === 0)
      return toast.error(t("Please select at least one image or video"));
    if (!bulkMetadata.title || !bulkMetadata.category)
      return toast.error(t("Please fill title and category"));

    setSaving(true);
    setUploadProgress({ current: 0, total: bulkFiles.length });

    try {
      for (let i = 0; i < bulkFiles.length; i++) {
        setUploadProgress({ current: i + 1, total: bulkFiles.length });
        const file = bulkFiles[i];
        const isVideo = file.type.startsWith("video/");

        if (isVideo) {
          // Upload video file
          const videoUrl = await handleUpload(file);
          await apiFetch("/api/admin/cms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: bulkMetadata.title,
              description: bulkMetadata.description,
              category: "gallery",
              link: bulkMetadata.category,
              video_url: videoUrl,
              content: videoUrl,
              image_url: videoUrl, // Use video as its own thumbnail for now
              active: true,
              order: items.length + i,
              designation: "video",
            }),
          });
        } else {
          // Upload image file
          const imageUrl = await handleUpload(file);
          await apiFetch("/api/admin/cms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: bulkMetadata.title,
              description: bulkMetadata.description,
              category: "gallery",
              link: bulkMetadata.category,
              image_url: imageUrl,
              active: true,
              order: items.length + i,
            }),
          });
        }
      }
      toast.success(
        t("{{count}} media items added to gallery", { count: bulkFiles.length })
      );
      setShowAddBatch(false);
      setBulkFiles([]);
      setBulkMetadata({ title: "", description: "", category: "" });
      queryClient.invalidateQueries({ queryKey: ["cms-gallery"] });
      fetchItems();
    } catch (err: any) {
      toast.error(t("Error: {{message}}", { message: err.message }));
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const saveEditItem = async () => {
    if (!editingItem || !editingItem.title)
      return toast.error(t("Please fill title"));
    setSaving(true);
    try {
      const id = getItemId(editingItem);
      const res = await apiFetch(`/api/admin/cms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingItem),
      });

      if (res.ok) {
        toast.success(t("Item updated"));
        setShowEditItem(false);
        setEditingItem(null);
        fetchItems();
      }
    } catch (err) {
      toast.error(t("Failed to update item"));
    } finally {
      setSaving(false);
    }
  };

  const toggleHomeSelection = async (
    item: GalleryItem,
    type: "featured"
  ) => {
    const id = getItemId(item);
    if (!id) return;

    if (type === "featured" && !item.is_featured) {
      const featuredCount = items.filter((i) => i.is_featured).length;
      if (featuredCount >= 4) {
        toast.error(t("You can only select up to 4 featured images"));
        return;
      }
    }

    try {
      const updated = {
        ...item,
        is_featured: !item.is_featured,
      };

      const res = await apiFetch(`/api/admin/cms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });

      if (res.ok) {
        toast.success(t("Home page selection updated"));
        queryClient.invalidateQueries({ queryKey: ["cms-gallery"] });
        fetchItems();
      }
    } catch (err) {
      toast.error(t("Failed to update selection"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    if (!confirm(t("Delete this gallery image?"))) return;
    try {
      const res = await apiFetch(`/api/admin/cms/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(t("Image deleted"));
        fetchItems();
      }
    } catch (err) {
      toast.error(t("Delete failed"));
    }
  };

  const deleteAllDefaults = async () => {
    if (!confirm(t("Are you sure you want to delete all gallery images?")))
      return;
    try {
      for (const item of items) {
        const id = getItemId(item);
        if (id) {
          await apiFetch(`/api/admin/cms/${id}`, {
            method: "DELETE",
          });
        }
      }
      toast.success(t("All images deleted"));
      fetchItems();
    } catch (err) {
      toast.error(t("Batch delete failed"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-primary uppercase tracking-tight">
            {t("Gallery Management")}
          </h2>
          <p className="text-xs text-muted-foreground uppercase font-black tracking-widest mt-1">
            {t("Manage gallery images. Add 4 images at a time.")}
          </p>
        </div>
      </div>

      <Card className="rounded-none border-primary/20 shadow-xl overflow-hidden bg-card/50 backdrop-blur-xl">
        <CardHeader className="bg-primary/5 border-b py-6">
          <CardTitle className="text-lg font-black uppercase tracking-[0.2em] text-primary flex items-center gap-3">
            <ImageIcon className="w-5 h-5" />
            {t("Media Assets")}
          </CardTitle>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-2">
            {t(
              "Control your gallery content and structure. Add new media or organize with categories."
            )}
          </p>
        </CardHeader>
        <CardContent className="p-8 flex flex-wrap gap-6">
          <Button
            onClick={() => setShowAddBatch(true)}
            className="rounded-none gap-3 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest h-14 px-8 shadow-lg hover:shadow-primary/20 transition-all"
          >
            <Plus className="w-5 h-5" />
            {t("Add Images")}
          </Button>
          <Button
            onClick={() => setShowAddClip(true)}
            variant="outline"
            className="rounded-none gap-3 font-black uppercase tracking-widest h-14 px-8 border-primary/20 hover:bg-primary/5 hover:border-primary/40 transition-all"
          >
            <Film className="w-5 h-5" />
            {t("Add YouTube Clip")}
          </Button>
          <Button
            onClick={() => setShowCategoryManager(!showCategoryManager)}
            variant="secondary"
            className="rounded-none gap-3 font-black uppercase tracking-widest h-14 px-8 bg-muted/50 hover:bg-muted transition-all"
          >
            <Layers className="w-5 h-5" />
            {t("Manage Categories")}
          </Button>
        </CardContent>
      </Card>

      {showCategoryManager && (
        <Card className="rounded-none border-primary/20 shadow-2xl animate-in fade-in slide-in-from-top-4 overflow-hidden bg-card/80 backdrop-blur-2xl">
          <CardHeader className="bg-primary/10 border-b py-6">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex justify-between items-center text-primary">
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                {t("Gallery Categories")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCategoryManager(false)}
                className="hover:bg-primary/10 rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="flex gap-4 p-4 bg-muted/30 border border-primary/10 rounded-none max-w-2xl">
              <Input
                value={newCategoryTitle}
                onChange={(e) => setNewCategoryTitle(e.target.value)}
                placeholder={t("Enter category name (e.g. Events, Campus, Sports)")}
                className="rounded-none border-primary/20 focus:border-primary h-12 bg-background/50"
              />
              <Button
                onClick={handleAddCategory}
                disabled={addingCategory}
                className="rounded-none bg-primary text-primary-foreground font-black uppercase tracking-widest px-8 h-12"
              >
                {addingCategory ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : editingCategory ? (
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                ) : (
                  <Plus className="w-5 h-5 mr-2" />
                )}
                {editingCategory ? t("Update") : t("Create")}
              </Button>
              {editingCategory && (
                <Button
                  onClick={cancelEditCategory}
                  variant="outline"
                  className="rounded-none font-black uppercase tracking-widest px-4 h-12 border-red-200 text-red-500 hover:bg-red-50"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {dynamicCategories.map((cat) => (
                <div
                  key={getItemId(cat)}
                  className="group flex items-center justify-between p-5 bg-background border border-primary/10 hover:border-primary/40 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/80 group-hover:text-primary transition-colors">
                    {cat.title}
                  </span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditCategory(cat)}
                      className="text-primary hover:bg-primary/10 h-8 w-8 rounded-none"
                    >
                      <RefreshCcw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteCategory(getItemId(cat))}
                      className="text-red-500 hover:bg-red-50 h-8 w-8 rounded-none"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {dynamicCategories.length === 0 && (
                <div className="col-span-full py-12 text-center bg-muted/20 border border-dashed border-primary/20">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-50">
                    No categories defined yet
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showAddClip && (
        <Card className="rounded-none border-primary/20 shadow-xl animate-in fade-in slide-in-from-top-4 overflow-hidden">
          <CardHeader className="bg-primary/5 border-b py-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex justify-between items-center">
              <span>{t("Add YouTube Clip")}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddClip(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  {t("Clip Title")}
                </Label>
                <Input
                  value={clipData.title}
                  onChange={(e) =>
                    setClipData({ ...clipData, title: e.target.value })
                  }
                  className="rounded-none"
                  placeholder={t("e.g. Campus Tour")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  {t("YouTube URL")}
                </Label>
                <Input
                  value={clipData.url}
                  onChange={(e) =>
                    setClipData({ ...clipData, url: e.target.value })
                  }
                  className="rounded-none"
                  placeholder="https://youtube.com/shorts/..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  {t("Category")}
                </Label>
                <Select
                  value={clipData.category}
                  onValueChange={(v) =>
                    setClipData({ ...clipData, category: v })
                  }
                >
                  <SelectTrigger className="rounded-none">
                    <SelectValue placeholder={t("Select category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {dynamicCategories.map((cat) => (
                      <SelectItem
                        key={getItemId(cat)}
                        value={cat.title.toLowerCase()}
                      >
                        {t(cat.title)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowAddClip(false)}
                className="rounded-none"
              >
                {t("Cancel")}
              </Button>
              <Button
                onClick={saveClip}
                disabled={addingClip}
                className="rounded-none bg-primary text-white"
              >
                {addingClip ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                {t("Save Clip")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showAddBatch && (
        <Card className="rounded-none border-primary/20 shadow-xl animate-in fade-in slide-in-from-top-4 overflow-hidden">
          <CardHeader className="bg-primary/5 border-b py-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex justify-between items-center">
              <span>{t("Bulk Gallery Upload")}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddBatch(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">
              {t(
                "Select multiple images and provide common details for all of them."
              )}
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    {t("Select Images/Videos")}
                  </Label>
                  <div className="min-h-[120px] bg-muted flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 group relative overflow-hidden p-4">
                    {bulkFiles.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2 w-full">
                        {Array.from(bulkFiles)
                          .slice(0, 8)
                          .map((file, i) => (
                            <div
                              key={i}
                              className="aspect-square bg-background border border-border rounded-sm overflow-hidden relative"
                            >
                              {file.type.startsWith("image/") ? (
                                <img
                                  src={URL.createObjectURL(file)}
                                  className="w-full h-full object-cover"
                                  alt={t("Selected")}
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full bg-muted">
                                  <Film className="w-8 h-8 text-muted-foreground/50" />
                                </div>
                              )}
                              {i === 7 && bulkFiles.length > 8 && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[10px] font-black">
                                  +{bulkFiles.length - 8}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground/30 mb-2" />
                        <p className="text-[10px] font-black uppercase text-muted-foreground">
                          {t("Click to select files")}
                        </p>
                      </>
                    )}
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        if (e.target.files)
                          setBulkFiles(Array.from(e.target.files));
                      }}
                    />
                  </div>
                  {bulkFiles.length > 0 && (
                    <p className="text-[10px] text-primary font-black uppercase">
                      {t("{{count}} files selected", {
                        count: bulkFiles.length,
                      })}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    {t("Common Title")}
                  </Label>
                  <Input
                    value={bulkMetadata.title}
                    onChange={(e) =>
                      setBulkMetadata({
                        ...bulkMetadata,
                        title: e.target.value,
                      })
                    }
                    className="rounded-none h-10 text-xs"
                    placeholder={t("Title for all images")}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    {t("Common Alt Text")}
                  </Label>
                  <Input
                    value={bulkMetadata.description}
                    onChange={(e) =>
                      setBulkMetadata({
                        ...bulkMetadata,
                        description: e.target.value,
                      })
                    }
                    className="rounded-none h-10 text-xs"
                    placeholder={t("Description for all images")}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    {t("Category")}
                  </Label>
                  <Select
                    value={bulkMetadata.category}
                    onValueChange={(v) =>
                      setBulkMetadata({ ...bulkMetadata, category: v })
                    }
                  >
                    <SelectTrigger className="rounded-none h-10 text-xs">
                      <SelectValue placeholder={t("Select category")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      {dynamicCategories.map((cat) => (
                        <SelectItem
                          key={getItemId(cat)}
                          value={cat.title.toLowerCase()}
                          className="text-xs uppercase font-black tracking-widest"
                        >
                          {t(cat.title)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {uploadProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase">
                  <span>
                    {t("Uploading")} {uploadProgress.current} /{" "}
                    {uploadProgress.total}
                  </span>
                  <span>
                    {Math.round(
                      (uploadProgress.current / uploadProgress.total) * 100
                    )}
                    %
                  </span>
                </div>
                <div className="h-1 bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${(uploadProgress.current / uploadProgress.total) * 100
                        }%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button
                onClick={saveBulk}
                disabled={saving}
                className="rounded-none gap-3 flex-1 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest h-12"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                {t("Upload All Media")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddBatch(false)}
                className="rounded-none font-black uppercase tracking-widest h-12 sm:w-32"
              >
                {t("Cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showEditItem && editingItem && (
        <Card className="rounded-none border-primary/20 shadow-xl animate-in fade-in slide-in-from-top-4 overflow-hidden">
          <CardHeader className="bg-primary/5 border-b py-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex justify-between items-center">
              <span>{t("Edit Gallery Item")}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowEditItem(false);
                  setEditingItem(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  {t("Title")}
                </Label>
                <Input
                  value={editingItem.title}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, title: e.target.value })
                  }
                  className="rounded-none"
                  placeholder={t("Title")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  {t("Category")}
                </Label>
                <Select
                  value={editingItem.link || ""}
                  onValueChange={(v) =>
                    setEditingItem({ ...editingItem, link: v })
                  }
                >
                  <SelectTrigger className="rounded-none">
                    <SelectValue placeholder={t("Select category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {dynamicCategories.map((cat) => (
                      <SelectItem
                        key={getItemId(cat)}
                        value={cat.title.toLowerCase()}
                      >
                        {t(cat.title)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  {t("Description")}
                </Label>
                <Textarea
                  value={editingItem.description || ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      description: e.target.value,
                    })
                  }
                  className="rounded-none min-h-[100px]"
                  placeholder={t("Description")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  {t("Image/Video File")}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={editingItem.image_url}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        image_url: e.target.value,
                      })
                    }
                    className="rounded-none"
                    placeholder="https://..."
                  />
                  <div className="relative">
                    <Button
                      variant="outline"
                      className="rounded-none gap-2 h-10"
                      disabled={saving}
                    >
                      <Upload className="w-4 h-4" />
                    </Button>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const url = await handleUpload(file);
                            const isVideo = file.type.startsWith("video/");
                            setEditingItem({
                              ...editingItem,
                              image_url: url,
                              video_url: isVideo ? url : undefined,
                              content: isVideo ? url : undefined,
                              designation: isVideo ? "video" : undefined,
                            });
                            toast.success(t("File uploaded"));
                          } catch (err) {
                            toast.error(t("Upload failed"));
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  {t("Video URL (YouTube/Vimeo/etc.)")}
                </Label>
                <Input
                  value={editingItem.content || editingItem.video_url || ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      content: e.target.value,
                      video_url: e.target.value,
                      designation: e.target.value ? "video" : undefined,
                    })
                  }
                  className="rounded-none"
                  placeholder="https://youtube.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  {t("Order")}
                </Label>
                <Input
                  type="number"
                  value={editingItem.order}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      order: parseInt(e.target.value) || 0,
                    })
                  }
                  className="rounded-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditItem(false);
                  setEditingItem(null);
                }}
                className="rounded-none"
              >
                {t("Cancel")}
              </Button>
              <Button
                onClick={saveEditItem}
                disabled={saving}
                className="rounded-none bg-primary text-white"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {t("Save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-foreground uppercase tracking-tight">
              {t("Gallery Images")} ({items.length})
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchItems}
              className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full"
            >
              <RefreshCcw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          <div className="flex gap-4">
            <Button
              variant="destructive"
              size="sm"
              onClick={deleteAllDefaults}
              className="rounded-none h-8 text-[10px] font-black uppercase tracking-widest bg-red-500 hover:bg-red-600"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              {t("Delete All Defaults")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map((item, idx) => {
            const id = getItemId(item);
            return (
              <Card
                key={id || idx}
                className={`rounded-none border-border overflow-hidden group shadow-sm hover:shadow-md transition-all ${item.is_featured
                  ? "ring-2 ring-accent ring-offset-2"
                  : ""
                  }`}
              >
                <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                  {item.designation === "video" ? (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                      <video
                        src={item.video_url || item.content || item.image_url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                    </div>
                  ) : (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  )}

                  <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                    <span className="bg-[#0d504b] text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm shadow-sm">
                      {t(item.link || "Default")}
                    </span>
                    {item.designation === "video" && (
                      <span className="bg-red-600 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm shadow-sm">
                        {t("Video")}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons on Top Right */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem(item);
                        setShowEditItem(true);
                      }}
                      className="h-8 w-8 bg-white/20 hover:bg-primary/80 text-white backdrop-blur-sm rounded-full border border-white/30"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (id) handleDelete(id);
                      }}
                      className="h-8 w-8 bg-red-500/80 hover:bg-red-600 text-white backdrop-blur-sm rounded-full border border-white/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                    <Button
                      onClick={() => toggleHomeSelection(item, "featured")}
                      className={`w-full rounded-none h-8 text-[10px] font-black uppercase tracking-widest ${item.is_featured
                        ? "bg-white text-accent"
                        : "bg-accent text-white"
                        }`}
                    >
                      {item.is_featured ? t("Unset Featured") : t("Set Featured")}
                    </Button>
                  </div>
                </div>
                <CardContent className="p-3 space-y-2">
                  <div className="min-h-[40px]">
                    <h4 className="text-xs font-black uppercase truncate text-foreground">
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest truncate">
                      {t(item.link || "Infrastructure")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GalleryManager;
