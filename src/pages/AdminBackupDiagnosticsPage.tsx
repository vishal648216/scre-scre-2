import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  Activity, 
  Server, 
  ShieldCheck, 
  HardDrive, 
  RefreshCw, 
  Users, 
  Building2, 
  GraduationCap, 
  FileCheck, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface DiagnosticsData {
  success: boolean;
  status: string;
  database_name: string;
  database_latency_ms: number;
  is_connected: boolean;
  collections_count: number;
  collections: string[];
  metrics: {
    total_users: number;
    total_students: number;
    total_centers: number;
    total_courses: number;
    total_certificates: number;
    total_marksheets: number;
    total_tickets: number;
    total_notifications_dispatched: number;
  };
  server_environment: {
    os: string;
    arch: string;
    timestamp: string;
  };
}

export const AdminBackupDiagnosticsPage: React.FC = () => {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('token');

  const fetchDiagnostics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/admin/system/diagnostics'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch diagnostics');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error fetching system status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleDownloadBackup = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(apiUrl('/api/admin/system/backup'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Backup creation failed on server');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `scre_database_backup_${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Error downloading backup file');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
          <span>Running MongoDB Health & Diagnostics Suite...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Database Backup & System Diagnostics
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              1-Click JSON Snapshot generator, live MongoDB ping latency, and enterprise resource telemetry.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDiagnostics}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-check Status
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* DB Health Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Database Engine</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-black text-white">{data.database_name}</span>
            <span className="text-xs font-bold text-emerald-400">({data.database_latency_ms}ms)</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Ping Healthy & Responsive
          </p>
        </div>

        {/* Collections Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Active Collections</span>
            <HardDrive className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-white">{data.collections_count}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Indexed schemas & transactional logs
          </p>
        </div>

        {/* Students Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Students Enrolled</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-white">{data.metrics.total_students.toLocaleString()}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Across {data.metrics.total_centers} affiliated centers
          </p>
        </div>

        {/* Credentials Issued */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Verified Credentials</span>
            <FileCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-black text-white">
              {(data.metrics.total_certificates + data.metrics.total_marksheets).toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Certificates & marksheets in ledger
          </p>
        </div>
      </div>

      {/* 1-Click Backup Export Action Card */}
      <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Automated 1-Click Database Backup Snapshot
            </h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Exports a consolidated, sanitized JSON dump of all courses, affiliated centers, CMS pages, system configuration tokens, and academic catalogs with ISO timestamps. Perfect for disaster recovery and offline audit archives.
          </p>
        </div>

        <button
          onClick={handleDownloadBackup}
          disabled={isExporting}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xl shadow-indigo-500/25 active:scale-95 transition flex-shrink-0"
        >
          {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isExporting ? 'Generating Snapshot...' : 'Download Full Backup (.json)'}
        </button>
      </div>

      {/* Metrics Breakdown & Server Specs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Records Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" /> Primary Collection Record Counts
          </h3>

          <div className="divide-y divide-slate-800 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-blue-400" /> Total Registered Users
              </span>
              <span className="font-bold text-white">{data.metrics.total_users}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Registered Centers
              </span>
              <span className="font-bold text-white">{data.metrics.total_centers}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <GraduationCap className="w-3.5 h-3.5 text-purple-400" /> Active Approved Courses
              </span>
              <span className="font-bold text-white">{data.metrics.total_courses}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <FileCheck className="w-3.5 h-3.5 text-amber-400" /> Generated Certificates
              </span>
              <span className="font-bold text-white">{data.metrics.total_certificates}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-teal-400" /> Issued Marksheets
              </span>
              <span className="font-bold text-white">{data.metrics.total_marksheets}</span>
            </div>
          </div>
        </div>

        {/* Server & Environment Details */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" /> Environment & Architecture
          </h3>

          <div className="divide-y divide-slate-800 text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Operating System</span>
              <span className="font-mono text-white capitalize">{data.server_environment.os}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400">CPU Architecture</span>
              <span className="font-mono text-white uppercase">{data.server_environment.arch}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Server Time (UTC)</span>
              <span className="font-mono text-slate-300">{new Date(data.server_environment.timestamp).toUTCString()}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Backend Engine</span>
              <span className="font-semibold text-emerald-400">Rust (Axum + Tokio Async)</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-slate-400">Database Driver</span>
              <span className="font-semibold text-cyan-400">MongoDB Official Rust Driver v2</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
