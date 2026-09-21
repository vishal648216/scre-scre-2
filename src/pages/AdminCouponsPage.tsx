import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Pencil, Trash2, Search, Ticket, User, Home, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { format, isValid } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const safeFormatDate = (dateStr: string | undefined, fallback: string = "∞") => {
  if (!dateStr) return fallback;
  const date = new Date(dateStr);
  if (isValid(date)) {
    return format(date, "dd MMM yy");
  }
  return fallback;
};

interface Coupon {
  _id?: string;
  code: string;
  coupon_type: "student" | "center";
  discount_type: "percentage" | "fixed";
  discount_value: number;
  target_id?: string;
  target_name?: string;
  start_date?: string;
  end_date?: string;
  expiry_date?: string;
  usage_limit?: number;
  usage_count: number;
  is_active: boolean;
  created_at?: string;
}

const AdminCouponsPage = () => {
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [activeTab, setActiveTab] = useState<string>("student");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [form, setForm] = useState<Coupon>({
    code: "",
    coupon_type: "student",
    discount_type: "percentage",
    discount_value: 0,
    is_active: true,
    usage_count: 0
  });

  useEffect(() => {
    fetchCoupons();
  }, [activeTab]);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/coupons?coupon_type=${activeTab}`);
      const data = await response.json();
      if (response.ok) {
        setCoupons(data);
      }
    } catch (error) {
      toast.error("Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await apiFetch(`/api/coupons/search-targets?q=${q}&target_type=${form.coupon_type}`);
      const data = await response.json();
      if (response.ok) {
        setSearchResults(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = isEditing ? `/api/coupons/${form._id}` : "/api/coupons";
      const method = isEditing ? "PUT" : "POST";

      const response = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (response.ok) {
        toast.success(isEditing ? "Coupon updated" : "Coupon created");
        setIsDialogOpen(false);
        fetchCoupons();
      } else {
        const data = await response.json();
        toast.error(data.message || "Operation failed");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setForm(coupon);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;
    try {
      const response = await apiFetch(`/api/coupons/${id}`, { method: "DELETE" });
      if (response.ok) {
        toast.success("Coupon deleted");
        fetchCoupons();
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm({ ...form, code });
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <Ticket className="w-8 h-8 text-primary" />
              Discount Coupons
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">Manage and generate discount coupons for students and centers.</p>
          </div>
          <Button onClick={() => {
            setIsEditing(false);
            setForm({
              code: "",
              coupon_type: activeTab as "student" | "center",
              discount_type: "percentage",
              discount_value: 0,
              is_active: true,
              usage_count: 0
            });
            setIsDialogOpen(true);
          }} className="rounded-none font-black uppercase tracking-widest">
            <Plus className="w-4 h-4 mr-2" /> Generate Coupon
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-auto">
            <TabsTrigger value="student" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-8 py-3 text-xs font-black uppercase tracking-widest transition-all">
              <User className="w-4 h-4 mr-2" /> Students/Academic
            </TabsTrigger>
            <TabsTrigger value="center" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-8 py-3 text-xs font-black uppercase tracking-widest transition-all">
              <Home className="w-4 h-4 mr-2" /> Centers
            </TabsTrigger>
          </TabsList>

          <div className="mt-8">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : coupons.length === 0 ? (
              <Card className="rounded-none border-dashed border-2 flex flex-col items-center justify-center py-20 opacity-60">
                <Ticket className="w-12 h-12 mb-4 text-muted-foreground" />
                <p className="font-black uppercase tracking-widest text-sm">No coupons found</p>
                <p className="text-xs font-bold mt-2">Generate your first coupon to get started.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {coupons.map((coupon) => (
                  <Card key={coupon._id} className="rounded-none border-border shadow-md overflow-hidden group hover:border-primary/50 transition-all">
                    <CardHeader className="bg-muted/30 border-b border-border py-4 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 text-primary flex items-center justify-center font-black rounded-full">
                          {coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `₹${coupon.discount_value}`}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-black uppercase tracking-widest">{coupon.code}</CardTitle>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">
                            {coupon.target_name ? `For: ${coupon.target_name}` : "For: All"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(coupon)} className="p-2 hover:bg-primary/10 text-primary rounded-none transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(coupon._id!)} className="p-2 hover:bg-destructive/10 text-destructive rounded-none transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-muted-foreground">Usage:</span>
                        <span>{coupon.usage_count} / {coupon.usage_limit || "∞"}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-muted-foreground">Validity:</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {safeFormatDate(coupon.start_date, "Now")} - {safeFormatDate(coupon.end_date || coupon.expiry_date)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-muted-foreground">Status:</span>
                        <span className={cn("flex items-center gap-1", coupon.is_active ? "text-emerald-500" : "text-red-500")}>
                          {coupon.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {coupon.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md max-h-[95vh] overflow-y-auto rounded-none border-border">
            <DialogHeader>
              <DialogTitle className="font-heading font-extrabold uppercase tracking-tight">
                {isEditing ? "Edit Coupon" : "Generate Coupon"}
              </DialogTitle>
              <DialogDescription className="text-xs font-medium">
                Create a new discount code for {activeTab === "student" ? "students" : "centers"}.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6 pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Coupon Code</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      placeholder="SUMMER2024"
                      className="rounded-none border-border font-bold uppercase"
                      required
                    />
                    {!isEditing && (
                      <Button type="button" variant="outline" onClick={generateCode} className="rounded-none border-border font-black text-[10px] uppercase">
                        Generate
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Discount Type</Label>
                    <Select value={form.discount_type} onValueChange={(v: any) => setForm({ ...form, discount_type: v })}>
                      <SelectTrigger className="rounded-none border-border text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Discount Value</Label>
                    <Input
                      type="number"
                      value={form.discount_value}
                      onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) })}
                      className="rounded-none border-border font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Assign to Specific {activeTab === "student" ? "Student" : "Center"} (Optional)</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Search className="w-4 h-4" />
                    </div>
                    <Input
                      placeholder={`Search ${activeTab === "student" ? "student" : "center"} name or email...`}
                      className="pl-10 rounded-none border-border text-xs font-bold"
                      value={form.target_name || searchQuery}
                      onChange={(e) => {
                        setForm({ ...form, target_id: undefined, target_name: undefined });
                        handleSearch(e.target.value);
                      }}
                    />
                    {searching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    )}
                    {searchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border border-border shadow-lg max-h-48 overflow-y-auto">
                        {searchResults.map((res) => (
                          <button
                            key={res.id}
                            type="button"
                            className="w-full px-4 py-2 text-left hover:bg-muted transition-colors border-b border-border/50 last:border-0"
                            onClick={() => {
                              setForm({ ...form, target_id: res.id, target_name: res.name });
                              setSearchResults([]);
                              setSearchQuery("");
                            }}
                          >
                            <p className="text-xs font-bold uppercase">{res.name}</p>
                            <p className="text-[10px] text-muted-foreground">{res.email}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {form.target_name && (
                    <div className="mt-2 p-2 bg-primary/5 border border-primary/20 flex items-center justify-between">
                      <p className="text-[10px] font-bold text-primary uppercase">Assigned to: {form.target_name}</p>
                      <button type="button" onClick={() => setForm({ ...form, target_id: undefined, target_name: undefined })} className="text-primary hover:text-primary/80">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Start Date</Label>
                    <Input
                      type="date"
                      value={form.start_date ? form.start_date.split('T')[0] : ""}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                      className="rounded-none border-border font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">End Date</Label>
                    <Input
                      type="date"
                      value={form.end_date ? form.end_date.split('T')[0] : (form.expiry_date ? form.expiry_date.split('T')[0] : "")}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value ? new Date(e.target.value).toISOString() : undefined, expiry_date: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                      className="rounded-none border-border font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Usage Limit</Label>
                  <Input
                    type="number"
                    value={form.usage_limit || ""}
                    onChange={(e) => setForm({ ...form, usage_limit: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="No limit"
                    className="rounded-none border-border font-bold"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4 rounded-none border-border"
                  />
                  <Label htmlFor="is_active" className="text-[10px] font-black uppercase tracking-widest cursor-pointer">Active</Label>
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={saving} className="w-full rounded-none font-black uppercase tracking-widest">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ticket className="w-4 h-4 mr-2" />}
                  {isEditing ? "Update Coupon" : "Create Coupon"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminCouponsPage;
