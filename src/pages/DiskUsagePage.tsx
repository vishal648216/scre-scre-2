import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDrive, Database, Image as ImageIcon, FileText, AlertTriangle, RefreshCcw, PieChart, Loader2, Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface SystemStats {
  total_capacity_gb: number;
  used_capacity_gb: number;
  database_size_gb: number;
  media_assets_gb: number;
  student_docs_gb: number;
  course_materials_gb: number;
  profile_images_gb: number;
  system_logs_gb: number;
  max_disk_space_gb: number;
  storage_warning_threshold: number;
}

const DiskUsagePage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // Edit State
  const [isEditing, setIsSuperEditing] = useState(false);
  const [maxDiskSpace, setMaxDiskSpace] = useState(20);
  const [warningThreshold, setWarningThreshold] = useState(0.8);
  const [saving, setSaving] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/system/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setMaxDiskSpace(data.max_disk_space_gb);
        setWarningThreshold(data.storage_warning_threshold);
      } else {
        toast.error("Failed to fetch system stats");
      }
    } catch (error) {
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const user = JSON.parse(sessionStorage.getItem("user") || "{}");
    setIsSuperAdmin(user.role?.toLowerCase() === "superadmin");
  }, []);

  const handleUpdateSettings = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/system/stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_disk_space_gb: maxDiskSpace,
          storage_warning_threshold: warningThreshold,
        }),
      });

      if (res.ok) {
        toast.success("System limits updated successfully");
        setIsSuperEditing(false);
        fetchStats();
      } else {
        toast.error("Failed to update system limits");
      }
    } catch (error) {
      toast.error("Error updating system limits");
    } finally {
      setSaving(false);
    }
  };

  const usedPercent = stats ? Math.round((stats.used_capacity_gb / stats.total_capacity_gb) * 100) : 0;
  const thresholdPercent = stats ? stats.storage_warning_threshold * 100 : 80;

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Disk & Storage</h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Monitor server capacity, database size, and media storage.</p>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <button 
                onClick={() => setIsSuperEditing(!isEditing)}
                className="flex items-center gap-2 px-4 py-2.5 border border-primary/20 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary/10 transition-all"
              >
                <Settings className="w-3.5 h-3.5" />
                {isEditing ? "Cancel Editing" : "Adjust Limits"}
              </button>
            )}
            <button 
              onClick={fetchStats}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 border border-border bg-card text-[10px] font-black uppercase tracking-[0.2em] hover:bg-muted transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
              Refresh Data
            </button>
          </div>
        </div>

        {isEditing && isSuperAdmin && (
          <Card className="rounded-none border-primary/30 bg-primary/5 shadow-lg animate-in slide-in-from-top-4 duration-300">
            <CardHeader className="py-4 border-b border-primary/10">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-primary">
                <Settings className="w-4 h-4" /> System Resource Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Max Allowed Disk Space (GB)</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      step="5"
                      value={maxDiskSpace}
                      onChange={(e) => setMaxDiskSpace(parseInt(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-xl font-black text-primary min-w-[60px]">{maxDiskSpace} GB</span>
                  </div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Sets the total virtual capacity available to the system.</p>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Storage Warning Threshold (%)</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="50" 
                      max="95" 
                      step="5"
                      value={warningThreshold * 100}
                      onChange={(e) => setWarningThreshold(parseInt(e.target.value) / 100)}
                      className="flex-1 accent-orange-500"
                    />
                    <span className="text-xl font-black text-orange-500 min-w-[60px]">{Math.round(warningThreshold * 100)}%</span>
                  </div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Alerts will trigger once usage exceeds this percentage.</p>
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <button 
                  onClick={handleUpdateSettings}
                  disabled={saving}
                  className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Apply System Limits
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading && !stats ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : stats ? (
          <>
            {/* Storage Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="rounded-none border-border shadow-md">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Capacity</CardTitle>
                  <HardDrive className="w-4 h-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black">{stats.total_capacity_gb.toFixed(1)} GB</div>
                  <div className="mt-4 h-2 w-full bg-muted rounded-none overflow-hidden">
                    <div className="bg-primary h-full" style={{ width: `${usedPercent}%` }} />
                  </div>
                  <p className="text-[9px] font-bold text-muted-foreground mt-2 uppercase tracking-widest">{stats.used_capacity_gb.toFixed(2)} GB Used ({usedPercent}%)</p>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border shadow-md">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Database Size</CardTitle>
                  <Database className="w-4 h-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black">{stats.database_size_gb.toFixed(2)} GB</div>
                  <div className="mt-4 h-2 w-full bg-muted rounded-none overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `${Math.min(100, (stats.database_size_gb / 2) * 100)}%` }} />
                  </div>
                  <p className="text-[9px] font-bold text-muted-foreground mt-2 uppercase tracking-widest">MongoDB (scre_db)</p>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border shadow-md">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Media Assets</CardTitle>
                  <ImageIcon className="w-4 h-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black">{stats.media_assets_gb.toFixed(2)} GB</div>
                  <div className="mt-4 h-2 w-full bg-muted rounded-none overflow-hidden">
                    <div className="bg-green-500 h-full" style={{ width: `${Math.min(100, (stats.media_assets_gb / 5) * 100)}%` }} />
                  </div>
                  <p className="text-[9px] font-bold text-muted-foreground mt-2 uppercase tracking-widest">Images, PDFs, Certs</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Detailed Breakdown */}
              <Card className="rounded-none border-border shadow-md">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-primary" />
                    Storage Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {[
                    { label: "Student Documents", size: `${stats.student_docs_gb.toFixed(2)} GB`, percent: (stats.student_docs_gb / Math.max(stats.media_assets_gb, 0.1)) * 100, icon: FileText, color: "bg-blue-500" },
                    { label: "Course Materials", size: `${stats.course_materials_gb.toFixed(2)} GB`, percent: (stats.course_materials_gb / Math.max(stats.media_assets_gb, 0.1)) * 100, icon: FileText, color: "bg-green-500" },
                    { label: "User Profile Images", size: `${stats.profile_images_gb.toFixed(2)} GB`, percent: (stats.profile_images_gb / Math.max(stats.media_assets_gb, 0.1)) * 100, icon: ImageIcon, color: "bg-purple-500" },
                    { label: "System Logs", size: `${stats.system_logs_gb.toFixed(3)} GB`, percent: 5, icon: RefreshCcw, color: "bg-orange-500" },
                  ].map((item) => (
                    <div key={item.label} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                        </div>
                        <span className="text-[10px] font-black">{item.size}</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-none overflow-hidden">
                        <div className={cn("h-full", item.color)} style={{ width: `${Math.min(100, item.percent)}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* System Alerts */}
              <Card className="rounded-none border-border shadow-md">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    Storage Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {usedPercent > thresholdPercent ? (
                    <div className="flex gap-4 items-start p-4 bg-destructive/5 border border-destructive/20">
                      <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-destructive">Critical: Storage Threshold Exceeded</p>
                        <p className="text-xs font-bold text-muted-foreground mt-1">Usage ({usedPercent}%) has exceeded your configured limit of {thresholdPercent}%. Consider upgrading storage.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 items-start p-4 bg-green-500/5 border border-green-500/20">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0 mt-0.5">
                        <RefreshCcw className="w-3 h-3 text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-green-600">Storage Status: Optimal</p>
                        <p className="text-xs font-bold text-muted-foreground mt-1">Current disk usage is within safe limits. No immediate action required.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default DiskUsagePage;
