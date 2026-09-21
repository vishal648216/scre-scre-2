import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag, Plus, Search, Loader2, Trash2, Edit2, Package, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Product {
  id?: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  status: string;
}

const AdminProductsPage = () => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<Product>({
    name: "",
    description: "",
    price: 0,
    image_url: "",
    category: "",
    status: "active",
  });

  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const res = await apiFetch('/api/admin/products');
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    try {
      const res = await apiFetch("/api/uploads", {
        method: "POST",
        body: uploadFormData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFormData(prev => ({ ...prev, image_url: data.url }));
        toast.success("Image uploaded");
      } else {
        toast.error("Upload failed");
      }
    } catch (error) {
      toast.error("Error uploading image");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingProduct ? "PUT" : "POST";
    const url = editingProduct ? `/api/admin/products/${editingProduct.id}` : "/api/admin/products";

    try {
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(editingProduct ? "Product updated" : "Product created");
        setIsAdding(false);
        setEditingProduct(null);
        setFormData({ name: "", description: "", price: 0, image_url: "", category: "", status: "active" });
        queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      } else {
        toast.error("Failed to save product");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure?")) return;

    try {
      const res = await apiFetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Product deleted");
        queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      } else {
        toast.error("Failed to delete");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  return (
    <DashboardLayout role="Admin">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight flex items-center gap-3">
              <Package className="w-8 h-8 text-primary" />
              Shop Management
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-wider">Manage products available in the student shop.</p>
          </div>
          <button 
            onClick={() => { setIsAdding(true); setEditingProduct(null); setFormData({ name: "", description: "", price: 0, image_url: "", category: "", status: "active" }); }}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add New Product
          </button>
        </div>

        {(isAdding || editingProduct) && (
          <Card className="rounded-none border-border shadow-md">
            <CardHeader className="bg-muted/30 border-b border-border py-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">
                {editingProduct ? "Edit Product" : "Create New Product"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Product Name</label>
                    <input 
                      required 
                      className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Description</label>
                    <textarea 
                      required 
                      rows={4}
                      className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">Price (₹)</label>
                      <input 
                        required 
                        type="number"
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none"
                        value={formData.price}
                        onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1">Category</label>
                      <input 
                        required 
                        className="w-full px-4 py-3 rounded-none border border-border bg-background text-sm font-bold focus:border-primary focus:outline-none"
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1">Product Image</label>
                    <div className="w-full aspect-video border-2 border-dashed border-border flex items-center justify-center bg-muted/20 relative group overflow-hidden">
                      {formData.image_url ? (
                        <img src={formData.image_url} alt="Preview" className="w-full h-full object-contain" />
                      ) : (
                        <ShoppingBag className="w-12 h-12 text-muted-foreground/30" />
                      )}
                      {uploading && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <input 
                        type="file" 
                        id="product-image" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                      />
                      <label 
                        htmlFor="product-image" 
                        className="cursor-pointer bg-muted text-muted-foreground px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-2"
                      >
                        <Upload className="w-3 h-3" />
                        Upload Image
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button 
                      type="submit"
                      className="flex-1 bg-primary text-primary-foreground py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 transition-all"
                    >
                      {editingProduct ? "Update Product" : "Create Product"}
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setIsAdding(false); setEditingProduct(null); }}
                      className="flex-1 bg-muted text-muted-foreground py-3 rounded-none font-heading font-black text-[10px] uppercase tracking-[0.2em] hover:bg-muted/80 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Active Products ({products?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Retrieving Inventory...</p>
              </div>
            ) : products?.length === 0 ? (
              <div className="p-20 text-center text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                No products found in database.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Product</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Category</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Price</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products?.map((product, i) => (
                      <tr key={product.id?.toString() || product._id?.toString() || i} className="border-b border-border hover:bg-muted/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-muted/20 border border-border flex items-center justify-center overflow-hidden">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <ShoppingBag className="w-4 h-4 text-muted-foreground/30" />
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-foreground uppercase tracking-tight">{product.name}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest line-clamp-1">{product.description}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-primary/5 border border-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-black text-foreground">₹{product.price.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${product.status === 'active' ? 'text-green-500' : 'text-orange-500'}`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => { setEditingProduct(product); setFormData(product); setIsAdding(false); }}
                              className="p-2 border border-border hover:border-primary hover:text-primary transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(product.id!)}
                              className="p-2 border border-border hover:border-destructive hover:text-destructive transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminProductsPage;
