import React, { useState } from "react";
import { Users, ChevronRight, ChevronDown, Award, Percent, DollarSign, Building2, User, ShieldCheck } from "lucide-react";

export interface TreeNode {
  id: string;
  name: string;
  code: string;
  role: "center" | "student" | "admin";
  level: number;
  royalty_percentage: number;
  total_earnings: number;
  referrals_count: number;
  children?: TreeNode[];
}

interface Props {
  data?: TreeNode[];
}

const SAMPLE_TREE: TreeNode[] = [
  {
    id: "node_head",
    name: "Sir Chhotu Ram Education HQ (Company)",
    code: "SCRE-HQ-001",
    role: "admin",
    level: 0,
    royalty_percentage: 100,
    total_earnings: 250000,
    referrals_count: 12,
    children: [
      {
        id: "node_c1",
        name: "Rohtak Central Campus",
        code: "SCRE-CENT-101",
        role: "center",
        level: 1,
        royalty_percentage: 20,
        total_earnings: 45000,
        referrals_count: 5,
        children: [
          {
            id: "node_c1_s1",
            name: "Rahul Sharma (Student)",
            code: "SCRE-STUD-501",
            role: "student",
            level: 2,
            royalty_percentage: 10,
            total_earnings: 5000,
            referrals_count: 2,
            children: [
              {
                id: "node_c1_s1_sub1",
                name: "Amit Kumar",
                code: "SCRE-STUD-602",
                role: "student",
                level: 3,
                royalty_percentage: 5,
                total_earnings: 1200,
                referrals_count: 0
              },
              {
                id: "node_c1_s1_sub2",
                name: "Pooja Verma",
                code: "SCRE-STUD-603",
                role: "student",
                level: 3,
                royalty_percentage: 5,
                total_earnings: 1200,
                referrals_count: 0
              }
            ]
          },
          {
            id: "node_c1_s2",
            name: "Priya Singh (Student)",
            code: "SCRE-STUD-502",
            role: "student",
            level: 2,
            royalty_percentage: 10,
            total_earnings: 3000,
            referrals_count: 0
          }
        ]
      },
      {
        id: "node_c2",
        name: "Jhajjar Branch Campus",
        code: "SCRE-CENT-102",
        role: "center",
        level: 1,
        royalty_percentage: 20,
        total_earnings: 32000,
        referrals_count: 3,
        children: [
          {
            id: "node_c2_s1",
            name: "Vikas Yadav (Student)",
            code: "SCRE-STUD-508",
            role: "student",
            level: 2,
            royalty_percentage: 10,
            total_earnings: 2000,
            referrals_count: 0
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

      <div className="bg-card border border-border hover:border-primary/50 shadow-md p-4 rounded-xl w-full max-w-xl transition-all">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {hasChildren && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1 rounded bg-muted hover:bg-primary/20 text-foreground transition"
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}

            <div className={`p-2 rounded-lg border ${
              node.role === "admin" ? "bg-amber-500/10 border-amber-500/30 text-amber-500" :
              node.role === "center" ? "bg-blue-500/10 border-blue-500/30 text-blue-500" :
              "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
            }`}>
              {node.role === "admin" ? <ShieldCheck className="w-5 h-5" /> :
               node.role === "center" ? <Building2 className="w-5 h-5" /> :
               <User className="w-5 h-5" />}
            </div>

            <div>
              <h4 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                {node.name}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                  {node.code}
                </span>
              </h4>
              <p className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                <span className="font-bold text-primary">Level {node.level}</span>
                <span>•</span>
                <span className="text-amber-600 font-bold">{node.referrals_count} Direct Referrals</span>
              </p>
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-primary/10 text-primary border border-primary/20 block mb-1">
              Royalty: {node.royalty_percentage}%
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

import { apiFetch } from "@/lib/api";

export const ReferralTreeVisualizer: React.FC<Props> = ({ data }) => {
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>(data || []);
  const [fetching, setFetching] = useState(!data || data.length === 0);

  useEffect(() => {
    if (data && data.length > 0) {
      setTreeNodes(data);
      setFetching(false);
      return;
    }

    const loadLiveTree = async () => {
      try {
        const res = await apiFetch("/api/referrals/tree");
        if (res.ok) {
          const liveData = await res.json();
          if (Array.isArray(liveData) && liveData.length > 0) {
            setTreeNodes(liveData);
          } else {
            setTreeNodes(SAMPLE_TREE);
          }
        } else {
          setTreeNodes(SAMPLE_TREE);
        }
      } catch {
        setTreeNodes(SAMPLE_TREE);
      } finally {
        setFetching(false);
      }
    };

    void loadLiveTree();
  }, [data]);

  const treeData = treeNodes.length > 0 ? treeNodes : SAMPLE_TREE;

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h3 className="font-heading font-black text-lg text-foreground uppercase tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Referral Hierarchy Tree & Royalty Rewards Format
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Multi-tier referral tree showing parent-child node connections, percentage of royalty share per level, and total rewards earned.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              <Percent className="w-3.5 h-3.5" /> Level 1: 20% Royalty
            </span>
            <span className="flex items-center gap-1 text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
              <Percent className="w-3.5 h-3.5" /> Level 2: 10% Royalty
            </span>
            <span className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <Percent className="w-3.5 h-3.5" /> Level 3: 5% Royalty
            </span>
          </div>
        </div>

        {/* Tree Container */}
        <div className="pt-6 overflow-x-auto">
          {treeData.map((node) => (
            <ReferralTreeNodeItem key={node.id} node={node} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReferralTreeVisualizer;
