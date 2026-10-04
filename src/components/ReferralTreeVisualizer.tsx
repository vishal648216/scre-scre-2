import React, { useState, useEffect } from "react";
import { 
  Users, 
  ChevronRight, 
  ChevronDown, 
  Percent, 
  Building2, 
  User, 
  ShieldCheck, 
  Briefcase,
  GitFork,
  ArrowLeftRight,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  Check
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export interface TreeNode {
  id: string;
  name: string;
  code: string;
  role: "center" | "student" | "staff" | "admin";
  level: number;
  royalty_percentage: number;
  total_earnings: number;
  referrals_count: number;
  branch?: "left" | "right";
  children?: TreeNode[];
}

interface Props {
  data?: TreeNode[];
}

const SAMPLE_5_LEVEL_TREE: TreeNode[] = [
  {
    id: "node_hq",
    name: "Sir Chhotu Ram Education HQ (Company)",
    code: "SCRE-HQ-001",
    role: "admin",
    level: 0,
    royalty_percentage: 100,
    total_earnings: 500000,
    referrals_count: 8,
    children: [
      {
        id: "node_c1",
        name: "Rohtak Central Campus (Center)",
        code: "SCRE-CENT-101",
        role: "center",
        level: 1,
        branch: "left",
        royalty_percentage: 20,
        total_earnings: 85000,
        referrals_count: 4,
        children: [
          {
            id: "node_stf1",
            name: "Vikas Verma (Staff Coordinator)",
            code: "SCRE-STAF-201",
            role: "staff",
            level: 2,
            branch: "left",
            royalty_percentage: 10,
            total_earnings: 15000,
            referrals_count: 2,
            children: [
              {
                id: "node_s1",
                name: "Rahul Sharma (Student)",
                code: "SCRE-STUD-501",
                role: "student",
                level: 3,
                branch: "left",
                royalty_percentage: 5,
                total_earnings: 5000,
                referrals_count: 2,
                children: [
                  {
                    id: "node_s1_sub1",
                    name: "Amit Kumar (Student)",
                    code: "SCRE-STUD-602",
                    role: "student",
                    level: 4,
                    branch: "left",
                    royalty_percentage: 3,
                    total_earnings: 2500,
                    referrals_count: 1,
                    children: [
                      {
                        id: "node_s1_sub1_l5",
                        name: "Kavita Rani (Level 5 Sub-Referral)",
                        code: "SCRE-STUD-701",
                        role: "student",
                        level: 5,
                        branch: "left",
                        royalty_percentage: 2,
                        total_earnings: 1000,
                        referrals_count: 0
                      }
                    ]
                  },
                  {
                    id: "node_s1_sub2",
                    name: "Pooja Verma (Student)",
                    code: "SCRE-STUD-603",
                    role: "student",
                    level: 4,
                    branch: "right",
                    royalty_percentage: 3,
                    total_earnings: 1800,
                    referrals_count: 0
                  }
                ]
              }
            ]
          },
          {
            id: "node_s2",
            name: "Priya Singh (Direct Student)",
            code: "SCRE-STUD-502",
            role: "student",
            level: 2,
            branch: "right",
            royalty_percentage: 10,
            total_earnings: 4000,
            referrals_count: 0
          }
        ]
      },
      {
        id: "node_c2",
        name: "Jhajjar Branch Campus (Center)",
        code: "SCRE-CENT-102",
        role: "center",
        level: 1,
        branch: "right",
        royalty_percentage: 20,
        total_earnings: 62000,
        referrals_count: 2,
        children: [
          {
            id: "node_stf2",
            name: "Sanjay Yadav (Staff Manager)",
            code: "SCRE-STAF-202",
            role: "staff",
            level: 2,
            branch: "right",
            royalty_percentage: 10,
            total_earnings: 12000,
            referrals_count: 1,
            children: [
              {
                id: "node_s3",
                name: "Deepak Saini (Student)",
                code: "SCRE-STUD-509",
                role: "student",
                level: 3,
                branch: "right",
                royalty_percentage: 5,
                total_earnings: 2000,
                referrals_count: 0
              }
            ]
          }
        ]
      }
    ]
  }
];

export const ReferralTreeNodeItem: React.FC<{ node: TreeNode; isLast?: boolean }> = ({ node }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col items-start relative ml-4 pl-4 border-l-2 border-primary/30 my-2 transition-all">
      {/* Connector line dot */}
      <div className="absolute -left-[9px] top-4 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
      </div>

      <div className="bg-card border border-border hover:border-primary/50 shadow-md p-4 rounded-xl w-full max-w-2xl transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {hasChildren && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="p-1 rounded bg-muted hover:bg-primary/20 text-foreground transition"
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}

            <div className={`p-2 rounded-lg border ${
              node.role === "admin" ? "bg-amber-500/10 border-amber-500/30 text-amber-500" :
              node.role === "center" ? "bg-blue-500/10 border-blue-500/30 text-blue-500" :
              node.role === "staff" ? "bg-purple-500/10 border-purple-500/30 text-purple-500" :
              "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
            }`}>
              {node.role === "admin" ? <ShieldCheck className="w-5 h-5" /> :
               node.role === "center" ? <Building2 className="w-5 h-5" /> :
               node.role === "staff" ? <Briefcase className="w-5 h-5" /> :
               <User className="w-5 h-5" />}
            </div>

            <div>
              <h4 className="font-extrabold text-sm text-foreground flex items-center gap-2 flex-wrap">
                {node.name}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                  {node.code}
                </span>
                {node.branch && (
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                    node.branch === "left" ? "bg-cyan-500/10 text-cyan-600 border border-cyan-500/30" : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                  }`}>
                    {node.branch === "left" ? "👈 Left Leg" : "👉 Right Leg"}
                  </span>
                )}
              </h4>
              <p className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                <span className="font-bold text-primary">Level {node.level}</span>
                <span>•</span>
                <span className="text-amber-600 font-bold">{node.referrals_count} Direct Referrals</span>
              </p>
            </div>
          </div>

          <div className="text-right font-mono flex sm:flex-col items-center sm:items-end justify-between gap-1">
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-primary/10 text-primary border border-primary/20">
              Level {node.level}: {node.royalty_percentage}% Commission
            </span>
            <span className="text-xs font-black text-emerald-600">
              ₹{node.total_earnings.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </div>

      {/* Render Subtree Children */}
      {hasChildren && expanded && (
        <div className="w-full pl-2">
          {node.children!.map((child) => (
            <ReferralTreeNodeItem key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
};

export const ReferralTreeVisualizer: React.FC<Props> = ({ data }) => {
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>(data || []);
  const [fetching, setFetching] = useState(!data || data.length === 0);
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (data && data.length > 0) {
      setTreeNodes(data);
      setFetching(false);
      return;
    }

    const loadLiveTree = async () => {
      try {
        const userStr = sessionStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : null;
        const uid = user ? (user._id || user.id || user.user_id || "") : "";
        const uName = user ? (user.name || user.fullName || user.username || "My Account") : "My Account";
        const uCode = user ? (user.referral_code || user.code || `REF-${uid.slice(-6).toUpperCase()}`) : "REF-001";
        const uRole = user ? (user.role?.toLowerCase() || "student") : "student";

        const treeUrl = uid ? `/api/referrals/tree?user_id=${encodeURIComponent(uid)}` : "/api/referrals/tree";
        const res = await apiFetch(treeUrl);
        if (res.ok) {
          const liveData = await res.json();
          if (Array.isArray(liveData) && liveData.length > 0) {
            setTreeNodes(liveData);
            return;
          }
        }

        // Fallback personalized tree for student/center so SuperAdmin HQ is NEVER shown at root for regular users
        const personalizedTree: TreeNode[] = [
          {
            id: uid || "my_root_node",
            name: `${uName} (My Referral Network)`,
            code: uCode,
            role: uRole as any,
            level: 0,
            royalty_percentage: 100,
            total_earnings: 0,
            referrals_count: 0,
            children: []
          }
        ];
        setTreeNodes(personalizedTree);
      } catch {
        const userStr = sessionStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : null;
        const uName = user ? (user.name || user.fullName || user.username || "My Account") : "My Account";
        const uCode = user ? (user.referral_code || user.code || "REF-001") : "REF-001";
        setTreeNodes([{
          id: "my_root_node",
          name: `${uName} (My Referral Network)`,
          code: uCode,
          role: "student",
          level: 0,
          royalty_percentage: 100,
          total_earnings: 0,
          referrals_count: 0,
          children: []
        }]);
      } finally {
        setFetching(false);
      }
    };

    void loadLiveTree();
  }, [data]);

  const treeData = treeNodes.length > 0 ? treeNodes : SAMPLE_5_LEVEL_TREE;

  const flattenTree = (nodes: TreeNode[]): TreeNode[] => {
    let result: TreeNode[] = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children && node.children.length > 0) {
        result = result.concat(flattenTree(node.children));
      }
    }
    return result;
  };

  const flattenedNodes = flattenTree(treeData).filter(
    (n) =>
      !searchQuery ||
      n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h3 className="font-heading font-black text-lg text-foreground uppercase tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              5-Tier Hierarchical Network Tree & Multi-Level Directory
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Multi-tier referral network showing Level 1 to Level 5 parent-child node connections, Left & Right branches, and Super Admin commission distribution.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* DUAL VIEW TOGGLE SWITCHER */}
            <div className="flex items-center bg-muted p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setViewMode("tree")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition flex items-center gap-1.5 ${
                  viewMode === "tree" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GitFork className="w-3.5 h-3.5" /> 🌳 Tree View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition flex items-center gap-1.5 ${
                  viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="w-3.5 h-3.5" /> 📋 List View ({flattenedNodes.length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                L1: 20%
              </span>
              <span className="flex items-center gap-1 text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                L2: 10%
              </span>
              <span className="flex items-center gap-1 text-purple-500 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                L3: 5%
              </span>
              <span className="flex items-center gap-1 text-cyan-500 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                L4: 3%
              </span>
              <span className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                L5: 2%
              </span>
            </div>
          </div>
        </div>

        {/* Search bar for List View */}
        {viewMode === "list" && (
          <div className="pt-4 pb-2">
            <input
              type="text"
              placeholder="Search user, referral code, or role in tree directory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md px-4 py-2 rounded-xl border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
            />
          </div>
        )}

        {/* RENDER TREE OR LIST VIEW */}
        {viewMode === "list" ? (
          <div className="pt-4 overflow-x-auto">
            <table className="w-full text-xs text-left text-foreground">
              <thead className="bg-muted text-muted-foreground font-bold uppercase border-b border-border">
                <tr>
                  <th className="p-3">Hierarchy Level</th>
                  <th className="p-3">User / Campus Name</th>
                  <th className="p-3">Referral Code</th>
                  <th className="p-3 text-center font-sans">Role</th>
                  <th className="p-3 text-center font-sans">Branch Leg</th>
                  <th className="p-3 text-center font-sans">Direct Referrals</th>
                  <th className="p-3 text-right font-sans">Commission Rate</th>
                  <th className="p-3 text-right font-sans">Total Earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {flattenedNodes.map((node) => (
                  <tr key={node.id} className="hover:bg-muted/40 transition">
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        node.level === 0 ? "bg-amber-500/10 text-amber-600 border border-amber-500/30" :
                        node.level === 1 ? "bg-blue-500/10 text-blue-600 border border-blue-500/30" :
                        node.level === 2 ? "bg-purple-500/10 text-purple-600 border border-purple-500/30" :
                        node.level === 3 ? "bg-cyan-500/10 text-cyan-600 border border-cyan-500/30" :
                        "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                      }`}>
                        Level {node.level}
                      </span>
                    </td>
                    <td className="p-3 font-sans font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${
                          node.role === "admin" ? "bg-amber-500/10 text-amber-500" :
                          node.role === "center" ? "bg-blue-500/10 text-blue-500" :
                          node.role === "staff" ? "bg-purple-500/10 text-purple-500" :
                          "bg-emerald-500/10 text-emerald-500"
                        }`}>
                          {node.role === "admin" ? <ShieldCheck className="w-3.5 h-3.5" /> :
                           node.role === "center" ? <Building2 className="w-3.5 h-3.5" /> :
                           node.role === "staff" ? <Briefcase className="w-3.5 h-3.5" /> :
                           <User className="w-3.5 h-3.5" />}
                        </div>
                        <span>{node.name}</span>
                      </div>
                    </td>
                    <td className="p-3 font-bold text-primary flex items-center gap-1.5">
                      <span>{node.code}</span>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(node.code); toast.success(`Code ${node.code} copied!`); }}
                        className="p-1 rounded bg-muted hover:bg-primary/20 text-foreground transition"
                        title="Copy Code"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </td>
                    <td className="p-3 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground border border-border">
                        {node.role}
                      </span>
                    </td>
                    <td className="p-3 text-center font-sans">
                      {node.branch ? (
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          node.branch === "left" ? "bg-cyan-500/10 text-cyan-600 border border-cyan-500/30" : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                        }`}>
                          {node.branch === "left" ? "👈 Left Leg" : "👉 Right Leg"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-sans font-bold text-foreground">
                      {node.referrals_count} users
                    </td>
                    <td className="p-3 text-right font-bold text-amber-600">
                      {node.royalty_percentage}%
                    </td>
                    <td className="p-3 text-right font-black text-emerald-600">
                      ₹{node.total_earnings.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="pt-6 overflow-x-auto">
            {treeData.map((node) => (
              <ReferralTreeNodeItem key={node.id} node={node} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralTreeVisualizer;
