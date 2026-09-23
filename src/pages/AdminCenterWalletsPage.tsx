import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import { Building2, CalendarClock, Download, IndianRupee, Loader2, Pencil, PlusCircle, Wallet } from "lucide-react";

interface Center {
  id: string;
  name?: string;
  code?: string;
}

type WalletInfo = {
  center_id: string;
  balance: number;
  royalty_percentage: number;
};

type TxType = "credit" | "debit";

type WalletTx = {
  id: string;
  center_id: string;
  transaction_id: string;
  type: TxType;
  credit_amount?: number | null;
  royalty_amount?: number | null;
  net_amount: number;
  description?: string | null;
  payment_method?: string | null;
  created_by: string;
  created_at: string;
};

type TxListResponse = {
  items: WalletTx[];
  total: number;
  page: number;
  limit: number;
};

const AdminCenterWalletsPage = () => {
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>("");
  const [wallet, setWallet] = useState<WalletInfo | null>(null);

  const [txLoading, setTxLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [txLimit] = useState(20);
  const [txData, setTxData] = useState<TxListResponse>({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [addAmount, setAddAmount] = useState<string>("");
  const [addPaymentMethod, setAddPaymentMethod] = useState<string>("Cash");
  const [addDescription, setAddDescription] = useState<string>("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [editDateOpen, setEditDateOpen] = useState(false);
  const [editTxId, setEditTxId] = useState<string>("");
  const [editDateValue, setEditDateValue] = useState<string>("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const toId = (v: unknown): string => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "$oid" in v) {
      return (v as { $oid: string }).$oid;
    }
    return String(v);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const centerRes = await apiFetch("/api/centers");
      const centerData = await centerRes.json().catch(() => []);
      if (centerRes.ok) {
        const list = Array.isArray(centerData) ? (centerData as Center[]) : [];
        setCenters(list);
        if (!selectedCenterId && list.length > 0) {
          setSelectedCenterId(toId(list[0].id));
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCenter = useMemo(
    () => centers.find((c) => c.id === selectedCenterId) || null,
    [centers, selectedCenterId]
  );
  const centerLabel = (c: Center) => c.name || c.code || toId(c.id);

  const fetchWallet = async (centerId: string) => {
    const res = await apiFetch(`/api/admin/center-wallet/${encodeURIComponent(centerId)}`);
    const data = await res.json().catch(() => null);
    if (res.ok && data) setWallet(data as WalletInfo);
    else setWallet(null);
  };

  const fetchTransactions = async (centerId: string, page: number) => {
    setTxLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(txLimit),
      });
      const res = await apiFetch(
        `/api/admin/center-wallet/transactions/${encodeURIComponent(centerId)}?${params.toString()}`
      );
      const data = await res.json().catch(() => null);
      if (res.ok && data) setTxData(data as TxListResponse);
      else setTxData({ items: [], total: 0, page, limit: txLimit });
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedCenterId) return;
    setTxPage(1);
    fetchWallet(selectedCenterId);
    fetchTransactions(selectedCenterId, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCenterId]);

  useEffect(() => {
    if (!selectedCenterId) return;
    fetchTransactions(selectedCenterId, txPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txPage]);

  const submitAddFunds = async () => {
    if (!selectedCenterId) return;
    const amount = Number(addAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Amount must be > 0");
      return;
    }
    setAddSubmitting(true);
    try {
      const res = await apiFetch("/api/admin/center-wallet/add-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          center_id: selectedCenterId,
          amount,
          description: addDescription || undefined,
          payment_method: addPaymentMethod || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.message || "Failed to add funds");
        return;
      }
      setAddOpen(false);
      setAddAmount("");
      setAddDescription("");
      await fetchWallet(selectedCenterId);
      await fetchTransactions(selectedCenterId, 1);
      setTxPage(1);
    } finally {
      setAddSubmitting(false);
    }
  };

  const openEditDate = (tx: WalletTx) => {
    setEditTxId(tx.id);
    const d = new Date(tx.created_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    const v = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
    setEditDateValue(v);
    setEditDateOpen(true);
  };

  const submitEditDate = async () => {
    if (!editTxId || !editDateValue) return;
    setEditSubmitting(true);
    try {
      const iso = new Date(editDateValue).toISOString();
      const res = await apiFetch(
        `/api/admin/center-wallet/transactions/${encodeURIComponent(editTxId)}/date`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ created_at: iso }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.message || "Failed to update date");
        return;
      }
      setEditDateOpen(false);
      if (selectedCenterId) await fetchTransactions(selectedCenterId, txPage);
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            Center Wallet Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            View wallet balance, add funds, and track royalty deductions.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="rounded-none border-border overflow-hidden lg:col-span-1">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Wallet
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Center Selector</div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <select
                        value={selectedCenterId}
                        onChange={(e) => setSelectedCenterId(e.target.value)}
                        className="w-full border border-border bg-background px-3 py-2 text-sm"
                      >
                        {centers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {centerLabel(c)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedCenter ? (
                      <div className="text-xs text-muted-foreground">
                        Center ID: <span className="font-mono">{selectedCenter.id}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="border border-border p-4 bg-muted/10">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Balance</div>
                    <div className="mt-1 flex items-center gap-2">
                      <IndianRupee className="w-5 h-5 text-primary" />
                      <div className="text-2xl font-extrabold text-primary">
                        ₹{(wallet?.balance ?? 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 items-start">
                    <div className="border border-border p-3 space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Royalty %
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={wallet?.royalty_percentage ?? 0}
                          onChange={async (e) => {
                            if (!selectedCenterId) return;
                            const v = Number(e.target.value);
                            if (!Number.isFinite(v)) return;
                            const res = await apiFetch(
                              `/api/admin/center-wallet/${encodeURIComponent(selectedCenterId)}`,
                              {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ royalty_percentage: v }),
                              }
                            );
                            const data = await res.json().catch(() => null);
                            if (!res.ok) {
                              alert(data?.message || "Failed to update royalty");
                              return;
                            }
                            await fetchWallet(selectedCenterId);
                          }}
                          className="w-20 border border-border bg-background px-2 py-1 text-sm"
                        />
                        <span className="text-xs font-semibold text-muted-foreground">%</span>
                      </div>
                    </div>
                    <div className="border border-border p-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Wallet Center ID</div>
                      <div className="mt-1 text-xs font-mono truncate">{toId(wallet?.center_id) || "—"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border overflow-hidden lg:col-span-2">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" />
                    Admin Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <Dialog open={addOpen} onOpenChange={setAddOpen}>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        disabled={!selectedCenterId}
                        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-sm font-extrabold hover:opacity-90 disabled:opacity-50"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Add Funds Manually
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Add Funds</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="text-xs text-muted-foreground">
                          Center: <span className="font-mono">{selectedCenterId}</span>
                        </div>
                        <input
                          type="number"
                          min={1}
                          step="0.01"
                          value={addAmount}
                          onChange={(e) => setAddAmount(e.target.value)}
                          placeholder="Amount (₹)"
                          className="w-full border border-border bg-background px-4 py-3"
                        />
                        <select
                          value={addPaymentMethod}
                          onChange={(e) => setAddPaymentMethod(e.target.value)}
                          className="w-full border border-border bg-background px-4 py-3"
                        >
                          <option>Cash</option>
                          <option>Online</option>
                          <option>UPI</option>
                          <option>Bank Transfer</option>
                          <option>Cheque</option>
                        </select>
                        <textarea
                          value={addDescription}
                          onChange={(e) => setAddDescription(e.target.value)}
                          placeholder="Description (optional)"
                          rows={3}
                          className="w-full border border-border bg-background px-4 py-3"
                        />
                        <button
                          type="button"
                          onClick={submitAddFunds}
                          disabled={addSubmitting}
                          className="w-full bg-primary text-primary-foreground px-5 py-3 text-sm font-extrabold hover:opacity-90 disabled:opacity-50"
                        >
                          {addSubmitting ? "Submitting..." : "Submit"}
                        </button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <div className="text-sm text-muted-foreground leading-relaxed">
                    Full amount is credited to wallet; royalty is paid separately.
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-none border-border overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                  <CalendarClock className="w-4 h-4" />
                  Transaction History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {txLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : txData.items.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">No transactions yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          <th className="text-left px-6 py-3 text-[10px] font-black uppercase">Date</th>
                          <th className="text-left px-6 py-3 text-[10px] font-black uppercase">Transaction ID</th>
                          <th className="text-right px-6 py-3 text-[10px] font-black uppercase">Credit</th>
                          <th className="text-right px-6 py-3 text-[10px] font-black uppercase">Royalty Deduction</th>
                          <th className="text-right px-6 py-3 text-[10px] font-black uppercase">Net Amount</th>
                          <th className="text-left px-6 py-3 text-[10px] font-black uppercase">Description</th>
                          <th className="text-left px-6 py-3 text-[10px] font-black uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txData.items.map((t) => (
                          <tr key={t.id} className="border-b border-border hover:bg-muted/10">
                            <td className="px-6 py-3 text-sm whitespace-nowrap">{format(new Date(t.created_at), "dd MMM yyyy")}</td>
                            <td className="px-6 py-3 text-xs font-mono whitespace-nowrap">{toId(t.transaction_id)}</td>
                            <td className="px-6 py-3 text-right text-sm">
                              {t.credit_amount ? `₹${Number(t.credit_amount).toLocaleString("en-IN")}` : "—"}
                            </td>
                            <td className="px-6 py-3 text-right text-sm">
                              {t.royalty_amount ? `₹${Number(t.royalty_amount).toLocaleString("en-IN")}` : "—"}
                            </td>
                            <td className="px-6 py-3 text-right text-sm font-extrabold text-primary">
                              ₹{Number(t.net_amount).toLocaleString("en-IN")}
                            </td>
                            <td className="px-6 py-3 text-sm">{t.description || "—"}</td>
                            <td className="px-6 py-3 text-sm">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditDate(t)}
                                  className="inline-flex items-center gap-2 border border-border px-3 py-2 text-xs font-extrabold hover:border-primary transition"
                                >
                                  <Pencil className="w-3 h-3" />
                                  Edit Date
                                </button>
                                {t.receipt_number && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const res = await apiFetch(`/api/wallet/transactions/${t.id}/receipt`);
                                      if (!res.ok) return;
                                      const blob = await res.blob();
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = `receipt-${t.receipt_number}.pdf`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    }}
                                    className="inline-flex items-center gap-2 border border-border px-3 py-2 text-xs font-extrabold hover:border-primary transition"
                                  >
                                    <Download className="w-3 h-3" />
                                    Receipt
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex items-center justify-between px-6 py-4 text-sm border-t border-border">
                  <div className="text-muted-foreground">
                    Page <span className="font-bold text-foreground">{txData.page}</span> of{" "}
                    <span className="font-bold text-foreground">{Math.max(1, Math.ceil((txData.total || 0) / txData.limit))}</span>{" "}
                    • Total: <span className="font-bold text-foreground">{txData.total}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                      disabled={txData.page <= 1}
                      className="border border-border px-4 py-2 text-xs font-extrabold disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxPage((p) => p + 1)}
                      disabled={txData.page >= Math.ceil((txData.total || 0) / txData.limit)}
                      className="border border-border px-4 py-2 text-xs font-extrabold disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Dialog open={editDateOpen} onOpenChange={setEditDateOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Transaction Date</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Transaction: <span className="font-mono">{editTxId}</span>
                  </div>
                  <input
                    type="datetime-local"
                    value={editDateValue}
                    onChange={(e) => setEditDateValue(e.target.value)}
                    className="w-full border border-border bg-background px-4 py-3"
                  />
                  <button
                    type="button"
                    onClick={submitEditDate}
                    disabled={editSubmitting}
                    className="w-full bg-primary text-primary-foreground px-5 py-3 text-sm font-extrabold hover:opacity-90 disabled:opacity-50"
                  >
                    {editSubmitting ? "Saving..." : "Save"}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminCenterWalletsPage;
