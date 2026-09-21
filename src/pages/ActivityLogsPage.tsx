import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Filter } from "lucide-react";
import { toast } from "sonner";

type LogItem = {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: string;
  created_at: string;
};

const ActivityLogsPage = () => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [action, setAction] = useState<string>("all");
  const [entityType, setEntityType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, [action, entityType, page, limit]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const params = new URLSearchParams();
      if (action !== "all") params.set("action", action);
      if (entityType !== "all") params.set("entity_type", entityType);
      params.set("page", String(page));
      params.set("limit", String(limit));
      const res = await fetch(`/api/admin/logs?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${token || ""}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.items || []);
        setTotal(data.total || 0);
      } else {
        toast.error(data.message || "Failed to load logs");
      }
    } catch {
      toast.error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        <div className="flex items-center justify-between">
          <h1 className="font-heading font-extrabold text-3xl text-foreground uppercase tracking-tight">Activity Logs</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Action</label>
            <select value={action} onChange={e => { setPage(1); setAction(e.target.value); }} className="px-3 py-2 border border-border bg-background text-sm">
              <option value="all">All</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="publish">Publish</option>
              <option value="unpublish">Unpublish</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Entity</label>
            <select value={entityType} onChange={e => { setPage(1); setEntityType(e.target.value); }} className="px-3 py-2 border border-border bg-background text-sm">
              <option value="all">All</option>
              <option value="blog">Blog</option>
              <option value="news">News</option>
            </select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button className="px-4 py-2 border border-border text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Filter className="w-4 h-4"/> Filter
            </button>
            <div className="text-xs font-mono">Page {page} of {Math.max(1, Math.ceil(total / Math.max(1, limit)))}</div>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-2 py-1 border border-border disabled:opacity-50">Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= total} className="px-2 py-1 border border-border disabled:opacity-50">Next</button>
            <select value={limit} onChange={e => { setPage(1); setLimit(Number(e.target.value)); }} className="px-2 py-1 border border-border text-xs">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <Card className="rounded-none border-border shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em]">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary"/></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Time</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Action</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Entity</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Actor</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id} className="border-b border-border hover:bg-muted/10">
                        <td className="px-4 py-3 text-xs font-mono">{new Date(l.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 text-xs uppercase font-bold">{l.action}</td>
                        <td className="px-4 py-3 text-xs">{l.entity_type} {l.entity_id ? `(${l.entity_id.slice(0,6)}…)` : ""}</td>
                        <td className="px-4 py-3 text-xs font-mono">{l.actor_id.slice(0,8)}…</td>
                        <td className="px-4 py-3 text-xs">{l.details || "-"}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-muted-foreground">No logs</td></tr>
                    )}
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

export default ActivityLogsPage;
