import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, CheckCircle2, Clock, Zap, BarChart3, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SubscriptionPage = () => {
  const [plans] = useState([
    { name: "Starter", price: "₹2,500", centers: "Up to 5", status: "Active", color: "text-blue-500", bg: "bg-blue-500/5" },
    { name: "Professional", price: "₹7,500", centers: "Up to 20", status: "Popular", color: "text-primary", bg: "bg-primary/5" },
    { name: "Enterprise", price: "Custom", centers: "Unlimited", status: "Contact Us", color: "text-purple-500", bg: "bg-purple-500/5" },
  ]);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Subscription Management</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Control billing, plan tiers, and franchise revenue streams.</p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-none border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Monthly Recurring Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-foreground">₹1.24L</span>
                <span className="text-[10px] font-black text-green-500 uppercase flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> +8%</span>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-none border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Active Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-black text-foreground">42</span>
            </CardContent>
          </Card>
          <Card className="rounded-none border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Pending Renewals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-orange-500">05</span>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Next 7 Days</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plan Configuration */}
        <div className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Active Plan Tiers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card key={plan.name} className="rounded-none border-border shadow-md group hover:border-primary transition-all">
                <CardHeader className={cn("border-b border-border py-4", plan.bg)}>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xs font-black uppercase tracking-widest">{plan.name}</CardTitle>
                    <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 border rounded-none", plan.color.replace("text", "border"), plan.color)}>{plan.status}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="text-2xl font-black">{plan.price}<span className="text-xs text-muted-foreground font-medium"> / month</span></div>
                  <ul className="space-y-2">
                    <li className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500" /> {plan.centers} Centers
                    </li>
                    <li className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500" /> Student Management
                    </li>
                    <li className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500" /> Exam Portal Access
                    </li>
                  </ul>
                  <button className="w-full py-3 border border-border text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all">
                    Edit Plan Details
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Recent Subscription Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/10 text-muted-foreground uppercase text-[10px] font-black tracking-widest">
                    <th className="py-4 pl-6">Transaction ID</th>
                    <th className="py-4">Center</th>
                    <th className="py-4 text-center">Amount</th>
                    <th className="py-4 text-center">Status</th>
                    <th className="py-4 text-right pr-6">Date</th>
                  </tr>
                </thead>
                <tbody className="font-medium">
                  {[1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-4 pl-6 font-bold text-xs">#TXN-99203{i}</td>
                      <td className="py-4 text-xs font-black uppercase">Global IT Center - Delhi</td>
                      <td className="py-4 text-center font-bold">₹7,500</td>
                      <td className="py-4">
                        <div className="flex justify-center">
                          <span className="px-2 py-0.5 bg-green-500/5 border border-green-500/20 text-green-500 text-[9px] font-black uppercase tracking-widest">Success</span>
                        </div>
                      </td>
                      <td className="py-4 text-right pr-6 text-[10px] font-bold text-muted-foreground uppercase">25 Feb 2026</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SubscriptionPage;
