import { useEffect, useState, useRef, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Upload, Image as ImageIcon, Video, X, ChevronLeft, Youtube } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Custom Image Blot with size styles
const BlockEmbed = Quill.import('blots/block/embed') as any;
class ImageBlot extends BlockEmbed {
  static blotName = 'image';
  static tagName = 'img';

  static create(value: any) {
    let node;
    if (typeof value === 'string') {
      node = super.create(value);
      node.setAttribute('src', value);
      node.style.borderRadius = '8px';
    } else {
      node = super.create(value.src);
      node.setAttribute('src', value.src);
      if (value.width) node.style.width = value.width;
      if (value.height) node.style.height = value.height;
      node.style.borderRadius = '8px';
    }
    return node;
  }

  static value(node: HTMLElement) {
    return {
      src: node.getAttribute('src'),
      width: node.style.width,
      height: node.style.height
    };
  }
}

// Custom Video Blot to support direct video files with size styles
class VideoBlot extends BlockEmbed {
  static blotName = 'video';
  static tagName = 'video';

  static create(value: any) {
    let node;
    if (typeof value === 'string') {
      node = super.create(value);
      node.setAttribute('controls', 'true');
      node.setAttribute('src', value);
      node.setAttribute('width', '100%');
      node.style.borderRadius = '8px';
    } else {
      node = super.create(value.src);
      node.setAttribute('controls', 'true');
      node.setAttribute('src', value.src);
      if (value.width) node.style.width = value.width;
      if (value.height) node.style.height = value.height;
      node.style.borderRadius = '8px';
    }
    return node;
  }

  static value(node: HTMLElement) {
    return {
      src: node.getAttribute('src'),
      width: node.style.width,
      height: node.style.height
    };
  }
}

// Custom YouTube Blot with size styles
class YouTubeBlot extends BlockEmbed {
  static blotName = 'youtube';
  static tagName = 'div';

  static create(value: any) {
    let node = super.create();
    node.classList.add('youtube-embed-container');

    let videoId = '';
    let width = '100%';
    let height = '315px';

    if (typeof value === 'string') {
      videoId = value;
    } else {
      videoId = value.videoId;
      width = value.width || '100%';
      height = value.height || '315px';
    }

    // Extract video ID from URL if needed
    if (typeof videoId === 'string') {
      const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
      const match = videoId.match(youtubeRegex);
      if (match) {
        videoId = match[2] || match[1];
      }
    }

    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', `https://www.youtube.com/embed/${videoId}`);
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.style.width = width;
    iframe.style.height = height;
    iframe.style.borderRadius = '8px';
    node.appendChild(iframe);

    // Add overlay to prevent interaction
    const overlay = document.createElement('div');
    overlay.classList.add('youtube-overlay');
    node.appendChild(overlay);

    return node;
  }

  static value(node: HTMLElement) {
    const iframe = node.querySelector('iframe');
    if (iframe) {
      const src = iframe.getAttribute('src');
      let videoId = '';
      if (src) {
        videoId = src.replace('https://www.youtube.com/embed/', '');
      }
      return {
        videoId: videoId,
        width: iframe.style.width,
        height: iframe.style.height
      };
    }
    return '';
  }
}

let blotsRegistered = false;

if (!blotsRegistered) {
  try {
    Quill.register(ImageBlot, true);
    Quill.register(VideoBlot, true);
    Quill.register(YouTubeBlot, true);
    blotsRegistered = true;
  } catch (e) {
    console.warn("Quill blot registration failed", e);
  }
}

type Status = "draft" | "published";

const AdminBlogEditorPage = () => {
  const { slug } = useParams();
  const [loading, setLoading] = useState(false);
  const [blogId, setBlogId] = useState("");
  const [title, setTitle] = useState("");
  const [slugValue, setSlugValue] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [content, setContent] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [status, setStatus] = useState<Status>("draft");
  const [publishedAt, setPublishedAt] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [allCategories, setAllCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [authors, setAuthors] = useState<string>("");
  const [lang, setLang] = useState("en");
  const [featured, setFeatured] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<HTMLElement | null>(null);
  const quillRef = useRef<any>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiFetch("/api/admin/blog-categories");
        const data = await res.json();
        if (res.ok && data.items) {
          setAllCategories(data.items);
        }
      } catch (e) {
        console.error("Failed to load categories", e);
      }
    };
    fetchCategories();
  }, []);

  // Function to generate slug from title
  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .trim();
  };

  // Update slug when title changes, only if not manually edited yet
  useEffect(() => {
    if (!isSlugManuallyEdited && title) {
      setSlugValue(generateSlug(title));
    }
  }, [title, isSlugManuallyEdited]);

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'font': [] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
        [{ 'align': [] }],
        ['link', 'image', 'video', 'youtube'],
        ['clean']
      ],
      handlers: {
        image: function () {
          const input = document.createElement('input');
          input.setAttribute('type', 'file');
          input.setAttribute('accept', 'image/*');
          input.click();
          input.onchange = async () => {
            if (input.files && input.files[0]) {
              const file = input.files[0];
              // @ts-ignore
              await handleEditorUpload(file, 'image', this.quill);
            }
          };
        },
        video: function () {
          const input = document.createElement('input');
          input.setAttribute('type', 'file');
          input.setAttribute('accept', 'video/*');
          input.click();
          input.onchange = async () => {
            if (input.files && input.files[0]) {
              const file = input.files[0];
              // @ts-ignore
              await handleEditorUpload(file, 'video', this.quill);
            }
          };
        },
        youtube: function () {
          const url = prompt('Enter YouTube video URL or ID');
          if (url) {
            const quill = this.quill;
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, 'youtube', url);
            quill.setSelection(range.index + 1);
          }
        }
      }
    },
    clipboard: {
      matchVisual: false,
    }
  }), []);

  const handleEditorUpload = async (file: File, type: 'image' | 'video', quillInstance?: any) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        const quill = quillInstance || quillRef.current.getEditor();
        const range = quill.getSelection(true);
        if (type === 'image') {
          quill.insertEmbed(range.index, 'image', data.url);
        } else {
          // For videos, we want to ensure they are playable. 
          // Quill's default video embed uses iframe. If it's a direct file link, 
          // we might need a custom blot or just use the default.
          quill.insertEmbed(range.index, 'video', data.url);
        }
        quill.setSelection(range.index + 1);
        toast.success(`${type === 'image' ? 'Image' : 'Video'} uploaded and inserted`);
      } else {
        toast.error(data.message || "Upload failed");
      }
    } catch (err) {
      toast.error("Error uploading file");
    } finally {
      setUploading(false);
    }
  };

  const deleteSelectedMedia = () => {
    if (!selectedMedia) return;

    selectedMedia.remove();
    setSelectedMedia(null);
    setContent(quillRef.current?.root.innerHTML || "");
  };

  const changeMediaSize = (size: 'small' | 'medium' | 'large' | 'full') => {
    if (!selectedMedia) return;

    const widthMap = {
      small: '300px',
      medium: '500px',
      large: '700px',
      full: '100%'
    };

    if (selectedMedia.tagName === 'IMG' || selectedMedia.tagName === 'VIDEO') {
      selectedMedia.style.width = widthMap[size];
      selectedMedia.style.height = 'auto';
    } else if (selectedMedia.classList.contains('youtube-embed-container')) {
      const iframe = selectedMedia.querySelector('iframe');
      if (iframe) {
        iframe.style.width = widthMap[size];
        if (size === 'full') {
          iframe.style.height = '400px';
        } else {
          iframe.style.height = `${parseInt(widthMap[size]) * 0.5625}px`;
        }
      }
    }

    // Update the content state with the latest HTML - ReactQuill will pick this up
    const newContent = quillRef.current?.root.innerHTML || "";
    console.log("Updated content with media size:", newContent);

    setContent(newContent);
  };

  const handleFeaturedImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setFeaturedImage(data.url);
        toast.success("Featured image updated");
      } else {
        toast.error(data.message || "Upload failed");
      }
    } catch (err) {
      toast.error("Error uploading file");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    // Inject YouTube icon into Quill toolbar
    const toolbar = document.querySelector('.ql-toolbar');
    if (toolbar) {
      let youtubeBtn = toolbar.querySelector('.ql-youtube');
      if (youtubeBtn && !youtubeBtn.querySelector('svg')) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');

        const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path1.setAttribute('d', 'M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17');

        const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path2.setAttribute('d', 'm10 15 5-3-5-3z');

        svg.appendChild(path1);
        svg.appendChild(path2);

        youtubeBtn.appendChild(svg);
      }
    }
  }, []);

  // Handle media selection in editor
  useEffect(() => {
    const handleEditorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const mediaElement =
        target.closest('img') ||
        target.closest('video') ||
        target.closest('.youtube-embed-container');

      if (mediaElement) {
        e.preventDefault();
        e.stopPropagation();

        // Remove selected class from previous selection
        document.querySelectorAll('.ql-editor img.selected, .ql-editor video.selected, .ql-editor .youtube-embed-container.selected').forEach(el => {
          el.classList.remove('selected');
        });

        // Add selected class to new element
        mediaElement.classList.add('selected');

        setSelectedMedia(mediaElement as HTMLElement);
      } else {
        // Clicked on empty space in editor - unselect media
        document.querySelectorAll('.ql-editor img.selected, .ql-editor video.selected, .ql-editor .youtube-embed-container.selected').forEach(el => {
          el.classList.remove('selected');
        });
        setSelectedMedia(null);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('.ql-editor') &&
        !target.closest('.media-toolbar')
      ) {
        // Remove selected class
        document.querySelectorAll('.ql-editor img.selected, .ql-editor video.selected, .ql-editor .youtube-embed-container.selected').forEach(el => {
          el.classList.remove('selected');
        });
        setSelectedMedia(null);
      }
    };

    const editor = document.querySelector('.ql-editor');
    if (editor) {
      editor.addEventListener('click', handleEditorClick);
    }
    document.addEventListener('click', handleClickOutside);

    return () => {
      if (editor) {
        editor.removeEventListener('click', handleEditorClick);
      }
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (slug) {
      loadExisting(slug);
    }
  }, [slug]);

  const loadExisting = async (s: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/blog/by-slug/${encodeURIComponent(s)}`);
      if (res.status === 200) {
        const b = await res.json();
        setBlogId(b.id || "");
        setTitle(b.title || "");
        setSlugValue(b.slug || "");
        setIsSlugManuallyEdited(true); // Existing blog, so consider slug manually edited
        setContent(b.content || "");
        setMetaTitle(b.meta_title || "");
        setMetaDescription(b.meta_description || "");
        setFeaturedImage(b.featured_image || "");
        setStatus(b.status || "draft");
        setPublishedAt(b.published_at || "");
        setSelectedCategory(b.categories?.[0] || "");
        setAuthors((b.authors || []).join(","));
        setLang(b.lang || "en");
        setFeatured(b.featured || false);
      }
    } catch {
      toast.error("Failed to load blog");
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    // Validate slug is not empty
    if (!slugValue.trim()) {
      toast.error("Slug cannot be empty");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        title,
        slug: slugValue,
        content,
        meta_title: metaTitle || null,
        meta_description: metaDescription || null,
        featured_image: featuredImage || null,
        status,
        published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
        categories: selectedCategory ? [selectedCategory] : [],
        authors: authors ? authors.split(",").map(s => s.trim()).filter(Boolean) : [],
        lang,
        featured
      };
      const res = await apiFetch(slug ? `/api/admin/blog/${encodeURIComponent(blogId)}` : "/api/admin/blog", {
        method: slug ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(slug ? "Blog updated" : "Blog created");
        navigate("/dashboard/cms/blogs");
      } else {
        toast.error(data.message || "Save failed");
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard/cms/blogs")}
              className="p-2 border border-border hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">{slug ? "Edit Blog" : "Create Blog"}</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                const win = window.open(`/blog/${slugValue}?preview=true`, '_blank');
                win?.focus();
              }}
              disabled={!slugValue}
              className="bg-muted text-muted-foreground px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-muted/80 disabled:opacity-50"
            >
              Preview
            </button>
            <button onClick={onSave} className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">Create New Blog Post</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Slug</label>
                <input
                  value={slugValue}
                  onChange={e => {
                    setSlugValue(e.target.value);
                    setIsSlugManuallyEdited(true);
                  }}
                  className="w-full px-3 py-2 border border-border bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Excerpt</label>
                <input value={metaDescription} onChange={e => setMetaDescription(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Meta Title</label>
                <input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Featured Image</label>
                <div className="flex gap-2">
                  <input value={featuredImage} onChange={e => setFeaturedImage(e.target.value)} className="flex-1 px-3 py-2 border border-border bg-background text-sm" placeholder="Image URL" />
                  <div className="relative">
                    <button className="bg-muted hover:bg-muted/80 p-2 border border-border flex items-center justify-center">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFeaturedImageUpload(e.target.files[0]);
                        }
                      }}
                    />
                  </div>
                </div>
                {featuredImage && (
                  <div className="mt-2 relative group w-32 aspect-video">
                    <img src={featuredImage} className="w-full h-full object-cover border border-border" alt="Preview" />
                    <button
                      onClick={() => setFeaturedImage("")}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as Status)} className="w-full px-3 py-2 border border-border bg-background text-sm">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Publish At (UTC)</label>
                <input type="datetime-local" value={publishedAt} onChange={e => setPublishedAt(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-background text-sm"
                >
                  <option value="">Select Category</option>
                  {allCategories.map(cat => (
                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Author(s) (comma)</label>
                <input value={authors} onChange={e => setAuthors(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Language</label>
                <input value={lang} onChange={e => setLang(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Featured</label>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setFeatured(!featured)}
                    className={`w-10 h-5 rounded-full transition-colors flex items-center ${featured ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ml-1 ${featured ? 'translate-x-5' : ''} translate-x-0.5`} />
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Content</label>
              <div
                ref={editorRef}
                className="prose-editor relative"
              >
                {/* Media Toolbar */}
                {selectedMedia && (
                  <div className="media-toolbar absolute -top-12 left-0 bg-white border border-border shadow-lg rounded-lg p-2 flex items-center gap-2 z-50">
                    <button
                      onClick={() => changeMediaSize('small')}
                      className="px-3 py-1 text-xs font-bold uppercase hover:bg-muted rounded text-black"
                    >
                      Small
                    </button>
                    <button
                      onClick={() => changeMediaSize('medium')}
                      className="px-3 py-1 text-xs font-bold uppercase hover:bg-muted rounded text-black"
                    >
                      Medium
                    </button>
                    <button
                      onClick={() => changeMediaSize('large')}
                      className="px-3 py-1 text-xs font-bold uppercase hover:bg-muted rounded text-black"
                    >
                      Large
                    </button>
                    <button
                      onClick={() => changeMediaSize('full')}
                      className="px-3 py-1 text-xs font-bold uppercase hover:bg-muted rounded text-black"
                    >
                      Full
                    </button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <button
                      onClick={deleteSelectedMedia}
                      className="px-3 py-1 text-xs font-bold uppercase text-destructive hover:bg-destructive/10 rounded"
                    >
                      Delete
                    </button>
                  </div>
                )}

                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={content}
                  onChange={setContent}
                  modules={modules}
                  className="bg-background min-h-[400px]"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <style>{`
        .prose-editor .ql-container {
          min-height: 400px;
          font-size: 14px;
          border-color: hsl(var(--border)) !important;
        }
        .prose-editor .ql-toolbar {
          border-color: hsl(var(--border)) !important;
          background: hsl(var(--muted) / 0.3);
        }
        .prose-editor .ql-editor {
          min-height: 400px;
          padding-top: 32px;
          padding-bottom: 32px;
        }
        .prose-editor .ql-editor img,
        .prose-editor .ql-editor video,
        .prose-editor .ql-editor .youtube-embed-container {
          max-width: 100%;
          height: auto;
          max-height: 400px;
          object-fit: contain;
          margin: 24px 0;
          display: block;
          border: 2px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }
        /* YouTube overlay to prevent interaction */
        .prose-editor .ql-editor .youtube-embed-container .youtube-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 10;
          border-radius: 8px;
        }
        .prose-editor .ql-editor img:hover,
        .prose-editor .ql-editor video:hover,
        .prose-editor .ql-editor .youtube-embed-container:hover {
          border-color: hsl(var(--primary) / 0.5);
          box-shadow: 0 0 0 4px hsl(var(--primary) / 0.1);
        }
        /* Selected media styles */
        .prose-editor .ql-editor img.selected,
        .prose-editor .ql-editor video.selected,
        .prose-editor .ql-editor .youtube-embed-container.selected {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 4px hsl(var(--primary) / 0.2);
        }
        /* Style the YouTube button */
        .ql-toolbar .ql-youtube {
          width: auto !important;
          padding: 0 8px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .ql-toolbar .ql-youtube svg {
          width: 18px;
          height: 18px;
        }
        /* Ensure spacing for text insertion around media */
        .prose-editor .ql-editor::before {
          content: '';
          display: block;
          height: 20px;
        }
        .prose-editor .ql-editor::after {
          content: '';
          display: block;
          height: 20px;
        }
      `}</style>
    </DashboardLayout>
  );
};

export default AdminBlogEditorPage;
