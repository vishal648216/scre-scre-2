import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type UsageBucket = { key: string; count: number };
type UsageStats = {
  total_events: number;
  last_24h_events: number;
  by_source: UsageBucket[];
  by_language: UsageBucket[];
};

const AdminTranslationUsagePage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UsageStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem("token");
        const res = await fetch("/api/admin/translation-usage", {
          headers: { Authorization: `Bearer ${token || ""}` },
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data?.message || "Failed to load translation usage");
          return;
        }
        setStats(data);
      } catch {
        toast.error("Failed to load translation usage");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        <div className="flex items-center justify-between">
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">
            Translation Usage
          </h1>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="rounded-none border-border shadow-md">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">Total Events</CardTitle>
                </CardHeader>
                <CardContent className="py-6">
                  <div className="text-3xl font-extrabold">{stats?.total_events ?? 0}</div>
                </CardContent>
              </Card>
              <Card className="rounded-none border-border shadow-md">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">Last 24 Hours</CardTitle>
                </CardHeader>
                <CardContent className="py-6">
                  <div className="text-3xl font-extrabold">{stats?.last_24h_events ?? 0}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="rounded-none border-border shadow-md">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">By Source</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Source</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stats?.by_source || []).map((b) => (
                        <tr key={b.key} className="border-b border-border">
                          <td className="px-4 py-3 text-xs uppercase">{b.key}</td>
                          <td className="px-4 py-3 text-xs font-mono">{b.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card className="rounded-none border-border shadow-md">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">By Language</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Language</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stats?.by_language || []).map((b) => (
                        <tr key={b.key} className="border-b border-border">
                          <td className="px-4 py-3 text-xs uppercase">{b.key}</td>
                          <td className="px-4 py-3 text-xs font-mono">{b.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminTranslationUsagePage;
