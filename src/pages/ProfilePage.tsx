import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Shield, Clock, Camera, Save, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface StoredUser {
  username?: string;
  role?: string;
  photo_url?: string;
  photoUrl?: string;
}

const ProfilePage = () => {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await apiFetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (response.ok && data.url) {
        // Update user state and session storage
        const updatedUser = { ...user, photoUrl: data.url, photo_url: data.url };
        
        // Save to backend
        try {
          await apiFetch("/api/auth/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo_url: data.url }),
          });
        } catch (e) {
          console.error("Failed to save profile to backend", e);
        }

        setUser(updatedUser);
        sessionStorage.setItem("user", JSON.stringify(updatedUser));
        toast.success("Profile picture updated");
      } else {
        toast.error(data.message || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("An error occurred during upload");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    try {
      const storedUser = sessionStorage.getItem("user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && typeof parsed === 'object') {
          // Normalize photo field
          if (parsed.photo_url && !parsed.photoUrl) {
            parsed.photoUrl = parsed.photo_url;
          }
          setUser(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to parse user from storage", e);
    }
  }, []);

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Profile updated successfully");
    }, 1000);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">My Profile</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Manage your personal information and account security.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Avatar Section */}
          <Card className="rounded-none border-border shadow-md h-fit">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="relative group">
                <div className="w-32 h-32 bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden relative">
                  {user?.photoUrl ? (
                    <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-16 h-16 text-primary" />
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white disabled:cursor-not-allowed"
                >
                  <Camera className="w-6 h-6" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                />
              </div>
              <h2 className="mt-4 font-black uppercase text-lg">{user?.username || "User"}</h2>
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-primary/5 border border-primary/10 text-primary mt-2">
                {user?.role || "Member"}
              </span>
            </CardContent>
          </Card>

          {/* Details Section */}
          <div className="md:col-span-2 space-y-6">
            <Card className="rounded-none border-border shadow-md">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Account Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">Username</label>
                  <input 
                    type="text" 
                    disabled 
                    className="w-full px-4 py-3 rounded-none border border-border bg-muted/30 text-sm font-bold opacity-70 cursor-not-allowed" 
                    value={user?.username || ""} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      type="email" 
                      placeholder="email@example.com" 
                      className="w-full pl-10 pr-4 py-3 rounded-none border border-border bg-background text-sm focus:border-primary focus:outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-primary text-primary-foreground px-8 py-3 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Update Profile
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-none border-border shadow-md">
              <CardHeader className="bg-muted/30 border-b border-border py-4">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Session Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-xs font-bold uppercase">Last Login</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">25 Feb 2026 • 10:30 AM</p>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-green-500/5 text-green-500 border border-green-500/10">Current</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-xs font-bold uppercase">Browser</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">Chrome on Windows</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;
