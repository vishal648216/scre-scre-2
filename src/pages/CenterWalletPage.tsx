import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, IndianRupee, History, Loader2, PlusCircle, Download } from "lucide-react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";
import { loadRazorpayScript } from "@/lib/loadRazorpay";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";

declare global {
  interface Window {
    Razorpay: any;
  }
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
  paid_amount?: number | null;
  net_amount: number;
  description?: string | null;
  payment_method?: string | null;
  gateway?: string | null;
  gateway_order_id?: string | null;
  gateway_payment_id?: string | null;
  receipt_number?: string | null;
  verified?: boolean;
  created_by: string;
  created_at: string;
};

type TxListResponse = {
  items: WalletTx[];
  total: number;
  page: number;
  limit: number;
};

const CenterWalletPage = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [wallet, setWallet] = useState<WalletInfo | null>(null);
    const [txData, setTxData] = useState<TxListResponse>({ items: [], total: 0, page: 1, limit: 20 });
    const [txLoading, setTxLoading] = useState(false);
    const [rechargeAmount, setRechargeAmount] = useState<string>("500");
    const [isRecharging, setIsRecharging] = useState(false);
    const [showRechargeDialog, setShowRechargeDialog] = useState(false);
    const [orderData, setOrderData] = useState<any>(null);

    // Calculate payable amount instantly
    const calculatePayableAmount = () => {
        if (!wallet) return 0;
        const amount = parseFloat(rechargeAmount) || 0;
        const royaltyPercent = wallet.royalty_percentage || 0;
        return (amount * royaltyPercent) / 100;
    };
    const payableAmount = calculatePayableAmount();
    const royaltyAmount = calculatePayableAmount();

  const loadData = async () => {
    try {
      const [wRes, tRes] = await Promise.all([
        apiFetch("/api/center/wallet"),
        apiFetch("/api/center/wallet/transactions?page=1&limit=20"),
      ]);
      const wData = await wRes.json().catch(() => null);
      const tData = await tRes.json().catch(() => null);
      if (wRes.ok && wData) setWallet(wData as WalletInfo);
      if (tRes.ok && tData) setTxData(tData as TxListResponse);
    } finally {
      setLoading(false);
      setTxLoading(false);
    }
  };

  useEffect(() => {
    setTxLoading(true);
    loadData();
  }, []);

  const handleRecharge = async () => {
        const amount = parseFloat(rechargeAmount);
        if (isNaN(amount) || amount < 100) {
            toast.error(t("Minimum recharge amount is ₹100"));
            return;
        }

        setIsRecharging(true);
        setOrderData(null);
        try {
            const res = await loadRazorpayScript();
            if (!res) {
                toast.error(t("Razorpay SDK failed to load. Are you online?"));
                return;
            }

            const orderRes = await apiFetch("/api/payments/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recharge_amount: amount }),
            });

            const orderData = await orderRes.json();
            if (!orderRes.ok) {
                toast.error(t(orderData.message) || t("Failed to create order"));
                return;
            }
            setOrderData(orderData);

            const userStr = sessionStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : {};

            const options = {
                key: orderData.key_id,
                amount: Math.round(orderData.amount * 100), // amount is now in INR, convert to paise
                currency: "INR",
                name: t("SCRE ERP"),
                description: t("Wallet Recharge"),
                order_id: orderData.order_id,
                handler: async (response: any) => {
                    console.log("FRONTEND: Payment Success Callback entered");
                    console.log("   Razorpay response:", response);
                    console.log("   Calling verify payment API");
                    const verifyRes = await apiFetch("/api/payments/verify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        }),
                    });

                    console.log("FRONTEND: Verify payment API response status:", verifyRes.status);
                    const verifyData = await verifyRes.json();
                    console.log("FRONTEND: Verify payment API response data:", verifyData);
                    if (verifyRes.ok && verifyData.success) {
                        console.log("FRONTEND: Payment verification successful, refreshing data");
                        toast.success(t("Wallet recharged successfully!"));
                        setShowRechargeDialog(false);
                        setOrderData(null);
                        loadData(); // Refresh balance and transactions
                    } else {
                        console.error("FRONTEND: Payment verification failed:", verifyData);
                        toast.error(t(verifyData.message) || t("Payment verification failed"));
                    }
                },
                prefill: {
                    name: user.full_name || user.username || "",
                    email: user.email || "",
                    contact: user.phone || "",
                },
                theme: { color: "#0F172A" },
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (error) {
            console.error("Recharge error:", error);
            toast.error(t("Something went wrong with the payment"));
        } finally {
            setIsRecharging(false);
        }
    };

  const totalCredit = txData.items.reduce((s, t) => s + (t.credit_amount || 0), 0);
  const totalRoyalty = txData.items.reduce((s, t) => s + (t.royalty_amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
              {t("Wallet")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {t("Your center's wallet balance and royalty-adjusted credits.")}
            </p>
          </div>

          <Dialog open={showRechargeDialog} onOpenChange={setShowRechargeDialog}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-3 bg-primary text-primary-foreground px-8 py-4 rounded-none font-heading font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:opacity-90 transition-all group">
                <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                {t("Recharge Wallet")}
              </button>
            </DialogTrigger>
            <DialogContent className="rounded-none border-border max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-heading font-bold uppercase tracking-tight">{t("Recharge Wallet")}</DialogTitle>
                <DialogDescription className="text-xs">
                  {t("Enter the amount you want to add to your center wallet.")}
                </DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("Amount (INR)")}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₹</span>
                    <input
                      type="number"
                      value={rechargeAmount}
                      onChange={(e) => { setRechargeAmount(e.target.value); setOrderData(null); }}
                      className="w-full border border-border bg-background pl-8 pr-4 py-3 text-lg font-bold focus:outline-none focus:border-primary"
                      placeholder="500"
                      min="100"
                      disabled={isRecharging}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{t("Minimum recharge amount: ₹100")}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["500", "1000", "2000"].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => { setRechargeAmount(amt); setOrderData(null); }}
                      disabled={isRecharging}
                      className={cn(
                        "py-2 text-[10px] font-black border transition-all",
                        rechargeAmount === amt ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                      )}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
                {wallet && (
                  <div className="bg-muted/30 p-4 space-y-2 border border-border">
                    <p className="text-xs font-bold uppercase tracking-tight">{t("Recharge Summary")}</p>
                    <div className="flex justify-between text-sm">
                      <span>{t("Credit to Wallet")}</span>
                      <span className="font-bold">₹{parseFloat(rechargeAmount).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t("Royalty")} ({wallet?.royalty_percentage || 0}%)</span>
                      <span className="font-bold">₹{royaltyAmount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t border-border pt-2">
                      <span>{t("You Pay")}</span>
                      <span className="text-primary">₹{payableAmount.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <button
                  disabled={isRecharging}
                  onClick={handleRecharge}
                  className="w-full bg-primary text-primary-foreground py-4 font-heading font-black text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isRecharging ? <Loader2 className="w-4 h-4 animate-spin" /> : <IndianRupee className="w-4 h-4" />}
                  {isRecharging ? t("Processing...") : t("Proceed to Pay")}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="rounded-none border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Wallet className="w-8 h-8 text-primary" />
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">{t("Payable Balance")}</p>
                        <p className="text-2xl font-bold text-primary">
                          ₹{(wallet?.balance ?? 0).toLocaleString("en-IN")}
                        </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-none border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <IndianRupee className="w-8 h-8 text-muted-foreground" />
                    <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground">{t("Total Credited")}</p>
                        <p className="text-2xl font-bold">
                          ₹{totalCredit.toLocaleString("en-IN")}
                        </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-none border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <History className="w-8 h-8 text-muted-foreground" />
                    <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground">
                          {t("Royalty")} ({(wallet?.royalty_percentage ?? 0).toLocaleString("en-IN")}%)
                        </p>
                        <p className="text-2xl font-bold">
                          ₹{totalRoyalty.toLocaleString("en-IN")}
                        </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-none border-border overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-tight">{t("Recent Wallet Transactions")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {txLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : txData.items.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">{t("No transactions yet.")}</div>
                ) : (
                  <div className="divide-y divide-border">
                    {txData.items.slice(0, 15).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between px-6 py-3">
                        <div>
                          <p className="font-mono text-sm">{tx.transaction_id}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.created_at), "dd MMM yyyy")}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {t(tx.description || "—")}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          {tx.receipt_number && (
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await apiFetch(`/api/wallet/transactions/${tx.id}/receipt`);
                                if (!res.ok) return;
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `receipt-${tx.receipt_number}.pdf`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-extrabold border border-border px-2 py-1 hover:border-primary transition"
                            >
                              <Download className="w-3 h-3" />
                              {t("Receipt")}
                            </button>
                          )}
                          {tx.credit_amount ? (
                            <p className="font-bold text-primary">
                              +₹{Number(tx.credit_amount).toLocaleString("en-IN")}
                            </p>
                          ) : null}
                          {tx.royalty_amount ? (
                            <p className="text-xs text-red-500">
                              {t("Royalty")}: -₹{Number(tx.royalty_amount).toLocaleString("en-IN")}
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {t("Net")}: ₹{Number(tx.net_amount).toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CenterWalletPage;
