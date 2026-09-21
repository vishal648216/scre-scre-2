import React, { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle
} from "react-resizable-panels";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  School,
  GraduationCap,
  Settings,
  Bell,
  LogOut,
  Search,
  User as UserIcon,
  PlusCircle,
  List,
  ListTodo,
  Trash2,
  CreditCard,
  HardDrive,
  UserCheck,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  BarChart3,
  History,
  HelpCircle,
  Mail,
  CheckSquare,
  IndianRupee,
  Wallet,
  Award,
  FileSpreadsheet,
  BookOpen,
  Library,
  BookMarked,
  ClipboardList,
  Keyboard,
  Languages,
  BookCheck,
  Globe,
  MapPin,
  FileText,
  Image,
  Handshake,
  Download,
  Upload,
  ShieldCheck,
  Layers,
  Filter,
  Link2 as LinkIcon,
  Video,
  FlaskConical,
  ClipboardCheck,
  MessageSquare,
  Calendar,
  PenTool,
  Send,
  Stamp,
  Paperclip,
  IdCard,
  AlertTriangle,
  Trophy,
  Ticket,
  Zap,
  Star,
  Database,
  ShoppingBag,
  Palette,
  Sun,
  Moon,
  Monitor,
  Maximize2,
  Minimize2,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Briefcase,
  Building2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { USE_EXAM_V2 } from "@/config/featureFlags";
import { ExamLockRoot } from "@/components/exam-v2/ExamLockRoot";
import { NotificationBell } from "@/components/NotificationBell";
import { toast } from "sonner";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role?: string;
}

interface DashboardSidebarContextType {
  isSidebarHidden: boolean;
  setSidebarState: (state: 'hidden' | 'collapsed' | 'normal' | 'full') => void;
}

const DashboardSidebarContext = createContext<DashboardSidebarContextType | undefined>(undefined);

export const useDashboardSidebar = () => {
  const context = useContext(DashboardSidebarContext);
  if (!context) {
    throw new Error("useDashboardSidebar must be used within a DashboardLayout");
  }
  return context;
};

export interface SubMenuItem {
  icon: any;
  label: string;
  href?: string;
  onClick?: () => void;
  roles?: string[];
}

export interface MenuItem {
  icon: any;
  label: string;
  href?: string;
  roles?: string[];
  subItems?: SubMenuItem[];
}

const themes = [
  { name: "Blue", color: "212 83% 26%", dark: "214 86% 20%", class: "bg-[#0c4a6e]" },
  { name: "Green", color: "142 76% 36%", dark: "142 76% 26%", class: "bg-[#166534]" },
  { name: "Red", color: "0 72% 51%", dark: "0 72% 41%", class: "bg-[#b91c1c]" },
  { name: "Purple", color: "262 83% 58%", dark: "262 83% 48%", class: "bg-[#7e22ce]" },
  { name: "Orange", color: "24 95% 53%", dark: "24 95% 43%", class: "bg-[#ea580c]" },
  { name: "Custom", color: "", dark: "", class: "bg-gradient-to-r from-red-500 via-green-500 to-blue-500" },
];

export type DashboardAppearance = "light" | "dark" | "system";

const hexToHSL = (hex: string) => {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  r /= 255;
  g /= 255;
  b /= 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

export const getDashboardMenuItems = (role: string, permissions: any, userId?: string) => {
  const USE_EXAM_V2_VAL = USE_EXAM_V2;
  const menuItems: MenuItem[] = [
    // --- SHARED ADMIN/SUPERADMIN ITEMS ---
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["admin", "superadmin"],
      subItems: [
        { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
        { icon: TrendingUp, label: "Revenue Summary", href: "/dashboard/revenue" },
        { icon: BarChart3, label: "Center Statistics", href: "/dashboard/center-stats" },
      ]
    },
    {
      label: "CRM",
      icon: Handshake,
      roles: ["admin", "superadmin"],
      subItems: [
        { icon: Mail, label: "Enquiries", href: "/dashboard/crm/enquiries" },
        { icon: Filter, label: "Enquiry Pipeline", href: "/dashboard/crm/pipeline" },
        { icon: Bell, label: "Follow-up Reminders", href: "/dashboard/crm/reminders" },
        { icon: Ticket, label: "Coupons", href: "/dashboard/crm/coupons" },
        { icon: MessageSquare, label: "Student Leads", href: "/dashboard/leads/student" },
        { icon: Handshake, label: "Franchise Leads", href: "/dashboard/leads/franchise" },
        { icon: Mail, label: "General Leads", href: "/dashboard/leads/general" },
      ]
    },
    {
      label: "CMS",
      icon: PenTool,
      roles: ["admin", "superadmin"],
      subItems: [
        { icon: FileText, label: "Pages", href: "/dashboard/cms/pages" },
        { icon: Image, label: "Slider", href: "/dashboard/cms/slider" },
        { icon: Image, label: "Gallery", href: "/dashboard/cms/gallery" },
        { icon: Users, label: "Teachers", href: "/dashboard/cms/teachers" },
        { icon: Handshake, label: "Partners", href: "/dashboard/cms/partners" },
        { icon: Download, label: "Downloads", href: "/dashboard/cms/downloads" },
        { icon: Download, label: "Download Categories", href: "/dashboard/cms/download_categories" },
        { icon: ShieldCheck, label: "Verification Page", href: "/dashboard/cms/verification" },
        { icon: Layers, label: "Ticker", href: "/dashboard/cms/ticker" },
        { icon: HelpCircle, label: "FAQ", href: "/dashboard/cms/faq" },
        { icon: ShieldCheck, label: "ID Card Templates", href: "/dashboard/cms/idcard_templates" },
        { icon: BookOpen, label: "Director Message", href: "/dashboard/cms/director_message" },
        { icon: Users, label: "Students", href: "/dashboard/cms/students" },
        { icon: GraduationCap, label: "Universities", href: "/dashboard/cms/universities" },
        { icon: Handshake, label: "Hero Partners", href: "/dashboard/cms/hero_partners" },
        { icon: BookOpen, label: "Blogs", href: "/dashboard/cms/blogs" },
        { icon: FileText, label: "News", href: "/dashboard/cms/news" },
        { icon: ShoppingBag, label: "Student Shop", href: "/dashboard/cms/shop" },
      ]
    },
    {
      label: "Admins Management",
      icon: Users,
      roles: ["superadmin"],
      subItems: [
        { icon: PlusCircle, label: "Add New Admin", href: "/dashboard/admins/add" },
        { icon: List, label: "Admin List", href: "/dashboard/admins" },
      ]
    },
    // --- CENTER SPECIFIC DASHBOARD ---
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["center"],
      subItems: [
        { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
        { icon: BarChart3, label: "Today's Stats", href: "/dashboard/stats/today" },
        { icon: History, label: "Recent Activity", href: "/dashboard/activity" },
        { icon: School, label: "My Center Profile", href: "/dashboard/center/profile" },
        { icon: PenTool, label: "Request Profile Update", href: "/dashboard/center/profile/update" },
      ]
    },
    {
      label: "Attendance",
      icon: CheckSquare,
      roles: ["center"],
      subItems: [
        { icon: ClipboardList, label: "Attendance Register", href: "/dashboard/attendance/register" },
        { icon: FileSpreadsheet, label: "Monthly Report", href: "/dashboard/attendance/report" },
      ]
    },
    {
      label: "Centers",
      icon: School,
      roles: ["admin", "superadmin"],
      subItems: [
        { icon: List, label: "All Centers", href: "/dashboard/centers" },
        { icon: PlusCircle, label: "Add New Center", href: "/dashboard/centers/add", roles: ["superadmin"] },
        { icon: CheckSquare, label: "Center Requests", href: "/dashboard/centers/requests", roles: ["admin", "superadmin"] },
        { icon: IndianRupee, label: "Franchise Fees", href: "/dashboard/centers/fees", roles: ["admin", "superadmin"] },
        { icon: Wallet, label: "Center Wallets", href: "/dashboard/centers/wallets", roles: ["admin", "superadmin"] },
        { icon: MapPin, label: "Manage Locations", href: "/dashboard/locations" },
        { icon: HardDrive, label: "Recycle Bin", href: "/dashboard/admin/bin" },
      ]
    },
    {
      label: "Students",
      icon: GraduationCap,
      roles: ["admin", "superadmin"],
      subItems: [
        { icon: List, label: "All Students", href: "/dashboard/students" },
        { icon: CheckSquare, label: "Approvals", href: "/dashboard/students/approvals", roles: ["admin", "superadmin"] },
        { icon: Trash2, label: "Recycle Bin", href: "/dashboard/students/bin" },
        { icon: IndianRupee, label: "Student Fees", href: "/dashboard/admin/fees", roles: ["admin", "superadmin"] },
        { icon: FileSpreadsheet, label: "Student Marksheets", href: "/dashboard/students/marksheets", roles: ["admin", "superadmin"] },
        { icon: Send, label: "Document Requests", href: "/dashboard/students/requests", roles: ["admin", "superadmin"] },
        { icon: TrendingUp, label: "Enrollment Reports", href: "/dashboard/students/reports", roles: ["admin", "superadmin"] },
      ]
    },
    // --- INTERNS MANAGEMENT ---
    {
      label: "Interns",
      icon: Briefcase,
      roles: ["admin", "superadmin"],
      subItems: [
        { icon: List, label: "All Interns", href: "/dashboard/interns" },
        { icon: PlusCircle, label: "Add Intern", href: "/dashboard/interns/add" },
        { icon: Mail, label: "Internship Enquiries", href: "/dashboard/interns/enquiries" },
        { icon: Building2, label: "Manage College", href: "/dashboard/interns/colleges" },
      ]
    },

    // --- CENTER SPECIFIC STUDENTS ---
    {
      label: "Students",
      icon: GraduationCap,
      roles: ["center"],
      subItems: [
        { icon: List, label: "All Students", href: "/dashboard/students" },
        { icon: PlusCircle, label: "Add Student", href: "/dashboard/students/add" },
        { icon: Trash2, label: "Recycle Bin", href: "/dashboard/students/bin" },
        { icon: IndianRupee, label: "Student Fees", href: "/dashboard/students/fees" },
        { icon: FileSpreadsheet, label: "Student Marksheets", href: "/dashboard/students/marksheets" },
        { icon: FileSpreadsheet, label: "Issue marksheets", href: "/dashboard/attachments/generate/marksheet" },
        { icon: Send, label: "Document Requests", href: "/dashboard/students/requests" },
      ]
    },
    {
      label: "Live Classes",
      icon: Video,
      roles: ["center"],
      subItems: [
        { icon: ClipboardList, label: "Schedule Class", href: "/dashboard/live-classes/schedule" },
        { icon: History, label: "Class History", href: "/dashboard/live-classes/history" },
      ]
    },
    {
      label: "Enquiries",
      icon: MessageSquare,
      roles: ["center"],
      subItems: [
        { icon: Mail, label: "New Enquiries", href: "/dashboard/enquiries/new" },
        { icon: History, label: "Follow-ups", href: "/dashboard/enquiries/followups" },
        { icon: UserCheck, label: "Converted Leads", href: "/dashboard/enquiries/converted" },
        { icon: MessageSquare, label: "Internal Messages", href: "/dashboard/student/messages" },
        { icon: Bell, label: "Center Announcements", href: "/dashboard/student/notifications" },
      ]
    },
    {
      label: "Academics",
      icon: BookOpen,
      roles: ["admin", "superadmin"],
      subItems: [
        { icon: Layers, label: "Course Categories", href: "/dashboard/academics/categories" },
        { icon: BookOpen, label: "Courses", href: "/dashboard/academics/courses" },
        { icon: Library, label: "Subjects", href: "/dashboard/academics/subjects" },
        { icon: Database, label: "Question Bank", href: "/dashboard/academics/question-bank" },
        { icon: LinkIcon, label: "Subject Mapping", href: "/dashboard/academics/mapping" },
        { icon: Calendar, label: "Sessions", href: "/dashboard/academics/sessions" },
        { icon: FileText, label: "Study Material", href: "/dashboard/academics/study-material" },
        { icon: BookMarked, label: "Digital Library", href: "/dashboard/admin/library" },
        { icon: ClipboardList, label: "Exam Blueprints", href: "/dashboard/academics/blueprints" },
        { icon: FlaskConical, label: "Mock Tests", href: "/dashboard/academics/mock-tests" },
        ...(USE_EXAM_V2_VAL
          ? [
            { icon: Zap, label: "Exam Engine V2", href: "/dashboard/exam-v2/hub" },
            { icon: CheckSquare, label: "Marks Approval", href: "/dashboard/exam-v2/marks-approval" }
          ] as const
          : []),
        { icon: MessageSquare, label: "Question Feedback", href: "/dashboard/academics/question-feedback" },
      ]
    },
    {
      label: "Internships",
      icon: Briefcase,
      roles: ["admin", "superadmin", "center"],
      subItems: [
        { icon: Briefcase, label: "Internship Postings", href: "/dashboard/internships/manage" },
      ]
    },
    {
      label: "Exams",
      icon: FlaskConical,
      roles: ["center"],
      subItems: [
        { icon: Zap, label: "Exam Engine V2", href: "/dashboard/exam-v2/center" },
        { icon: ClipboardCheck, label: "Marks Entry", href: "/dashboard/exams/marks-entry" },
        { icon: Users, label: "Reappear Management", href: "/dashboard/exams/reappear" },
        { icon: ClipboardCheck, label: "Internal Marks Entry", href: "/dashboard/exam-v2/marks-entry" },
        { icon: Download, label: "Download Paper", href: "/dashboard/exams/download-paper" },
      ]
    },
    // --- CENTER SPECIFIC COURSES ---
    {
      label: "Courses",
      icon: BookOpen,
      roles: ["center"],
      subItems: [
        { icon: Layers, label: "Allotted Courses", href: "/dashboard/courses/allotted" },
        { icon: Library, label: "Course Subjects", href: "/dashboard/courses/subjects" },
        { icon: Calendar, label: "Batches", href: "/dashboard/center/batches" },
        { icon: Calendar, label: "Sessions", href: "/dashboard/courses/sessions" },
        { icon: FileText, label: "Course Materials", href: "/dashboard/courses/materials" },
        { icon: BookMarked, label: "Digital Library", href: "/dashboard/center/library" },
      ]
    },
    {
      label: "Typing Master",
      icon: Keyboard,
      roles: ["admin", "superadmin"],
      subItems: [
        { icon: Languages, label: "Languages", href: "/dashboard/typing/languages" },
        { icon: BookOpen, label: "Lessons", href: "/dashboard/typing/lessons" },
        { icon: BarChart3, label: "Typing Analytics", href: "/dashboard/typing/analytics" },
        { icon: BookCheck, label: "Tests & Allotment", href: "/dashboard/typing/tests" },
        { icon: FileText, label: "Global Reports", href: "/dashboard/typing/reports" },
      ]
    },
    // --- CENTER SPECIFIC TYPING ---
    {
      label: "Typing Master",
      icon: Keyboard,
      roles: ["center"],
      subItems: [
        { icon: FileText, label: "Student Reports", href: "/dashboard/typing/center-reports" },
        { icon: Trophy, label: "Center Leaderboard", href: "/dashboard/typing/leaderboard" },
      ]
    },
    // --- STUDENT SPECIFIC TYPING ---
    {
      label: "Typing Master",
      icon: Keyboard,
      roles: ["student"],
      subItems: [
        { icon: Zap, label: "Practice Now", href: "/dashboard/student/typing" },
        { icon: History, label: "My History", href: "/dashboard/student/typing/history" },
        { icon: Trophy, label: "Leaderboard", href: "/dashboard/student/typing/leaderboard" },
      ]
    },
    {
      label: "Exams",
      icon: FileText,
      roles: ["admin", "superadmin", "staff"],
      subItems: [
        { icon: PlusCircle, label: "Allot Exam", href: "/dashboard/exams/allot" },
        { icon: List, label: "Alloted Exams", href: "/dashboard/exams/alloted" },
        { icon: List, label: "Exam Papers", href: "/dashboard/exams/papers" },
        { icon: Award, label: "Exam Results", href: "/dashboard/exams/results" },
        { icon: CheckSquare, label: "Center Requests", href: "/dashboard/exams/center-requests", roles: ["admin", "superadmin"] },
        // { icon: FileSpreadsheet, label: "Academic Marksheets", href: "/dashboard/attachments/generate/marksheet" },
        ...(USE_EXAM_V2_VAL ? [{ icon: Upload, label: "Exam V2 (Center)", href: "/dashboard/exam-v2/center" } as const] : []),
      ]
    },
    {
      label: "Practicals",
      icon: FlaskConical,
      roles: ["center"],
      subItems: [
        { icon: List, label: "All Practicals", href: "/dashboard/practicals" },
        { icon: PlusCircle, label: "Create Practical", href: "/dashboard/practicals/create" },
        { icon: Download, label: "Submissions", href: "/dashboard/practicals/submissions" },
      ]
    },
    {
      label: "Finance",
      icon: IndianRupee,
      roles: ["admin", "superadmin"],
      subItems: [
        { icon: Wallet, label: "Wallet Management", href: "/dashboard/finance/wallet" },
        { icon: History, label: "Transactions", href: "/dashboard/finance/transactions" },
        { icon: Trophy, label: "Referral Tracking", href: "/dashboard/finance/referrals", roles: ["admin", "superadmin"] },
        { icon: FileSpreadsheet, label: "Commission Reports", href: "/dashboard/finance/commissions", roles: ["admin", "superadmin"] },
        { icon: CreditCard, label: "Franchise Payments", href: "/dashboard/finance/payments", roles: ["admin", "superadmin"] },
      ]
    },
    // --- CENTER SPECIFIC WALLET ---
    {
      label: "Wallet",
      icon: Wallet,
      roles: ["center"],
      subItems: [
        { icon: IndianRupee, label: "My Balance", href: "/dashboard/wallet/balance" },
        { icon: Trophy, label: "Refer & Earn", href: "/dashboard/refer-and-earn" },
        { icon: History, label: "Transactions", href: "/dashboard/wallet/transactions" },
        { icon: FileText, label: "Payment History", href: "/dashboard/wallet/history" },
      ]
    },
    // --- STUDENT SPECIFIC DASHBOARD ---
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["student"],
      subItems: [
        { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
        { icon: TrendingUp, label: "Progress Summary", href: "/dashboard/student/progress" },
      ]
    },
    {
      label: "My Course",
      icon: BookOpen,
      roles: ["student"],
      subItems: [
        { icon: List, label: "Enrolled Course", href: "/dashboard/student/courses" },
        { icon: Library, label: "My Subjects", href: "/dashboard/student/subjects" },
        { icon: FileText, label: "Course Materials", href: "/dashboard/student/materials" },
        { icon: Video, label: "Recorded Classes", href: "/dashboard/student/recorded" },
        { icon: BookMarked, label: "Digital Library", href: "/dashboard/student/library" },
        { icon: Download, label: "Download Center", href: "/dashboard/student/downloads" },
      ]
    },
    {
      label: "Internships",
      icon: Briefcase,
      roles: ["student"],
      subItems: [
        { icon: Briefcase, label: "Browse Internships", href: "/dashboard/student/internships" },
      ]
    },
    {
      label: "Live Classes",
      icon: Video,
      roles: ["student"],
      subItems: [
        { icon: Video, label: "Join Class", href: "/dashboard/student/live/join" },
        { icon: Calendar, label: "Class Schedule", href: "/dashboard/student/live/schedule" },
        { icon: History, label: "Class History", href: "/dashboard/student/live/history" },
      ]
    },
    {
      label: "Practicals",
      icon: FlaskConical,
      roles: ["student"],
      subItems: [
        { icon: List, label: "Assigned Practicals", href: "/dashboard/student/practicals" },
        { icon: Send, label: "Submit Practical", href: "/dashboard/student/practicals/submit" },
        { icon: History, label: "Submission History", href: "/dashboard/student/practicals/history" },
      ]
    },
    {
      label: "Attendance",
      icon: CheckSquare,
      roles: ["student"],
      subItems: [
        { icon: ClipboardList, label: "My Attendance", href: "/dashboard/student/attendance" },
        { icon: FileSpreadsheet, label: "Attendance Report", href: "/dashboard/student/attendance/report" },
      ]
    },

    {
      label: "My Examination",
      icon: FileText,
      roles: ["student"],
      subItems: [
        { icon: List, label: "Allotted Exams", href: "/dashboard/student/exams" },
        ...(userId ? [{ icon: FileSpreadsheet, label: "My Marksheet", href: `/dashboard/student/marksheet/${userId}` } as const] : []),
      ]
    },
    {
      label: "Payments",
      icon: CreditCard,
      roles: ["student"],
      subItems: [
        { icon: List, label: "Fee Details", href: "/dashboard/student/payments/fees" },
        { icon: Trophy, label: "Refer & Earn", href: "/dashboard/refer-and-earn" },
        { icon: History, label: "Payment History", href: "/dashboard/student/payments/history" },
      ]
    },
    {
      label: "Notifications",
      icon: Bell,
      roles: ["student"],
      subItems: [
        { icon: Bell, label: "Announcements", href: "/dashboard/student/notifications" },
        { icon: MessageSquare, label: "Messages", href: "/dashboard/student/messages" },
        { icon: Star, label: "Review Us", href: "/dashboard/student/review" },
      ]
    },
    // --- INTERN DASHBOARD ---
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      roles: ["intern"],
      subItems: [
        { icon: LayoutDashboard, label: "Overview", href: "/dashboard/intern" },
      ]
    },
    {
      label: "Attendance",
      icon: CheckSquare,
      roles: ["intern"],
      subItems: [
        { icon: ClipboardList, label: "My Attendance", href: "/dashboard/intern/attendance" },
      ]
    },
    {
      label: "Tasks",
      icon: List,
      roles: ["intern"],
      subItems: [
        { icon: List, label: "My Tasks", href: "/dashboard/intern/tasks" },
      ]
    },
    {
      label: "Certificates",
      icon: Award,
      roles: ["intern"],
      subItems: [
        { icon: Award, label: "My Certificates", href: "/dashboard/intern/certificates" },
      ]
    },

    {
      label: "Staff Management",
      icon: Users,
      roles: ["admin", "superadmin", "center"],
      subItems: [
        { icon: PlusCircle, label: "Add New Staff", href: "/dashboard/staff/add" },
        { icon: List, label: "Staff List", href: "/dashboard/staff/list" },
      ]
    },
    {
      label: "Attachments",
      icon: Paperclip,
      roles: ["admin", "superadmin", "center"],
      subItems: [
        { icon: Award, label: "Generate Certificate", href: "/dashboard/attachments/generate/certificate" },
        { icon: PenTool, label: "Certificate Designer", href: "/dashboard/attachments/certificate-designer" },
      ]
    },
    {
      label: "System",
      icon: Settings,
      roles: ["admin", "superadmin"],
      subItems: [
        { icon: Settings, label: "System Settings", href: "/dashboard/system/settings" },
        { icon: ShieldCheck, label: "Role Permissions", href: "/dashboard/system/roles" },
        { icon: History, label: "Activity Logs", href: "/dashboard/system/logs", roles: ["admin", "superadmin"] },
        { icon: Globe, label: "Translation Usage", href: "/dashboard/system/translation-usage", roles: ["admin", "superadmin"] },
        { icon: Bell, label: "Announcements Management", href: "/dashboard/system/notifications", roles: ["admin", "superadmin"] },
        { icon: HardDrive, label: "Disk & Storage", href: "/dashboard/disk-usage" },
        { icon: AlertTriangle, label: "Maintenance", href: "/dashboard/system/maintenance", roles: ["superadmin"] },
      ]
    },
  ];

  const filteredItems = menuItems.filter(item => {
    if (item.roles && !item.roles.includes(role)) return false;

    // Staff permissions
    if (role === "staff" && permissions) {
      const allowed = (
        (item.label === "Students" && permissions.can_manage_students) ||
        (item.label === "Attendance" && permissions.can_manage_attendance) ||
        (item.label === "Finance" && permissions.can_manage_fees) ||
        (item.label === "Academics" && permissions.can_manage_courses) ||
        (item.label === "Exams" && permissions.can_manage_exams) ||
        (item.label === "Dashboard") ||
        (item.label === "Staff Management" && permissions.can_manage_staff)
      );
      if (!allowed) return false;
    }

    // Sub-Admin role permissions
    if (role === "admin" && permissions) {
      const p = permissions.permissions || permissions;
      if (p && typeof p === "object" && Object.keys(p).length > 0) {
        if (item.label === "Dashboard") return true;
        if (item.label === "Centers" && p.centers && !p.centers.view) return false;
        if (item.label === "Students" && p.students && !p.students.view) return false;
        if (item.label === "Finance" && p.finance && !p.finance.view) return false;
        if (item.label === "Academics" && p.courses && !p.courses.view) return false;
        if (item.label === "Exams" && p.exams && !p.exams.view) return false;
        if ((item.label === "Staff Management" || item.label === "Interns") && p.staff && !p.staff.view) return false;
        if (item.label === "CRM" && p.leads && !p.leads.view) return false;
        if (item.label === "CMS" && p.cms && !p.cms.view) return false;
        if (item.label === "System" && p.settings && !p.settings.view) return false;
      }
    }

    return true;
  });

  return filteredItems.map(item => {
    if (item.subItems) {
      return {
        ...item,
        subItems: item.subItems.filter(sub => {
          if (sub.roles && !sub.roles.includes(role)) return false;
          if (role === "admin" && permissions) {
            const p = permissions.permissions || permissions;
            if (p && typeof p === "object") {
              if (sub.label.includes("Add New Center") && p.centers && !p.centers.add) return false;
              if (sub.label.includes("Add Student") && p.students && !p.students.add) return false;
            }
          }
          return true;
        })
      };
    }
    return item;
  });
};

const DashboardLayout = ({ children, role: propRole }: DashboardLayoutProps) => {
  const { t } = useTranslation();
  const colorInputRef = useRef<HTMLInputElement>(null);
  const sidebarPanelRef = useRef<any>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem("dashboard_theme") || "Blue");
  const [customColor, setCustomColor] = useState(() => localStorage.getItem("dashboard_custom_color") || "#2563eb");
  const [appearance, setAppearance] = useState<DashboardAppearance>(() => {
    const s = localStorage.getItem("dashboard_appearance") as DashboardAppearance | null;
    return s === "light" || s === "dark" || s === "system" ? s : "dark";
  });
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<{ username: string, role: string, photoUrl?: string } | null>(() => {
    const storedUser = sessionStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser.photo_url) {
          parsedUser.photoUrl = parsedUser.photo_url;
        }
        return parsedUser;
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [expandedMenus, setExpandedMenus] = useState<string[]>(() => {
    const saved = localStorage.getItem("dashboard_expanded_menus");
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [collapsedHoverTooltip, setCollapsedHoverTooltip] = useState<{
    label: string;
    x: number;
    y: number;
  } | null>(null);
  const [permissions, setPermissions] = useState<any>(null);

  useEffect(() => {
    const role = user?.role?.toLowerCase()?.replace(/\s+/g, "");
    if (role === "admin") {
      apiFetch("/api/admin/permissions/me")
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data && (data.permissions || data.role)) {
            setPermissions(data.permissions || data);
          }
        })
        .catch(err => console.error("Error fetching admin permissions:", err));
    }
  }, [user?.role]);

  const [sidebarSize, setSidebarSize] = useState(() => {
    const saved = localStorage.getItem("dashboard_sidebar_size");
    return saved ? parseFloat(saved) : 20;
  });
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [savedScrollPosition, setSavedScrollPosition] = useState<number>(0);

  const applyAppearance = useCallback((mode: DashboardAppearance) => {
    const root = document.documentElement;
    const run = () => {
      let dark = false;
      if (mode === "dark") dark = true;
      else if (mode === "light") dark = false;
      else dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", dark);
    };
    run();
    return run;
  }, []);

  const currentUserRole = user?.role?.toLowerCase()?.replace(/\s+/g, "") || "";
  const displayRole = propRole || (user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "User");
  const shouldUseCompactDashboardScale = ["admin", "center", "student"].includes(currentUserRole);
  const finalMenuItems = useMemo(() => {
    return getDashboardMenuItems(currentUserRole, permissions, (user as any)?.user_id || (user as any)?.id);
  }, [currentUserRole, permissions, user]);
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const suggestions: { label: string; href: string; icon: any; parentLabel?: string }[] = [];

    finalMenuItems.forEach(item => {
      const translatedParentLabel = t(item.label).toLowerCase();
      // Check parent item if it has a direct href
      if (item.href && (item.label.toLowerCase().includes(query) || translatedParentLabel.includes(query))) {
        suggestions.push({ label: item.label, href: item.href, icon: item.icon });
      }

      // Check subitems
      item.subItems?.forEach(subItem => {
        const translatedSubLabel = t(subItem.label).toLowerCase();
        if (subItem.href && (subItem.label.toLowerCase().includes(query) || translatedSubLabel.includes(query))) {
          suggestions.push({
            label: subItem.label,
            href: subItem.href,
            icon: subItem.icon,
            parentLabel: item.label
          });
        }
      });
    });

    return suggestions.slice(0, 10); // Limit to 10 suggestions
  }, [finalMenuItems, searchQuery]);

  const toggleMenu = (label: string) => {
    if (sidebarScrollRef.current) {
      setSavedScrollPosition(sidebarScrollRef.current.scrollTop);
    }

    setExpandedMenus(prev => {
      if (prev.includes(label)) {
        return prev.filter(l => l !== label);
      } else {
        return [label];
      }
    });
  };

  const setTooltipFromElement = (label: string, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setCollapsedHoverTooltip({
      label,
      x: rect.right + 12,
      y: rect.top + rect.height / 2,
    });
  };

  const isRouteActive = (href: string) => {
    if (!href || href === "#") return false;
    if (href === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(href);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    toast.success("Logged out successfully");
    navigate("/", { replace: true });
    // Using navigate instead of window.location.href to prevent full reload
  };

  useEffect(() => {
    localStorage.setItem("dashboard_appearance", appearance);
    const run = applyAppearance(appearance);
    if (appearance !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => run();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [appearance, applyAppearance]);

  useEffect(() => {
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);

  useEffect(() => {
    let color: string;
    let dark: string;

    if (currentTheme === "Custom") {
      const hsl = hexToHSL(customColor);
      color = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
      dark = `${hsl.h} ${hsl.s}% ${Math.max(0, hsl.l - 10)}%`;
      const light = `${hsl.h} ${Math.min(30, hsl.s)}% 95%`;
      document.documentElement.style.setProperty("--primary-light", light);
      localStorage.setItem("dashboard_custom_color", customColor);
    } else {
      const theme = themes.find(t => t.name === currentTheme) || themes[0];
      color = theme.color;
      dark = theme.dark;
      const hslParts = theme.color.split(' ');
      const light = `${hslParts[0]} 30% 95%`;
      document.documentElement.style.setProperty("--primary-light", light);
    }

    document.documentElement.style.setProperty("--primary", color);
    document.documentElement.style.setProperty("--primary-dark", dark);
    document.documentElement.style.setProperty("--ring", color);
    document.documentElement.style.setProperty("--sidebar-primary", color);
    document.documentElement.style.setProperty("--sidebar-ring", color);
    localStorage.setItem("dashboard_theme", currentTheme);
  }, [currentTheme, customColor]);

  useEffect(() => {
    localStorage.setItem("dashboard_expanded_menus", JSON.stringify(expandedMenus));
  }, [expandedMenus]);

  useEffect(() => {
    if (!user) {
      const storedUser = sessionStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser.photo_url) {
            parsedUser.photoUrl = parsedUser.photo_url;
          }
          setUser(parsedUser);
        } catch (e) { }
      }
    }
  }, []);

  useEffect(() => {
    if (currentUserRole === "staff") {
      apiFetch("/api/staff/permissions")
        .then(res => res.json())
        .then(data => setPermissions(data))
        .catch(() => { });
    }
  }, [currentUserRole]);

  // Auto-expand menu based on current location
  useEffect(() => {
    if (finalMenuItems.length > 0) {
      const activeMenu = finalMenuItems.find(item =>
        item.subItems?.some(sub => sub.href === location.pathname)
      );
      if (activeMenu && !expandedMenus.includes(activeMenu.label)) {
        setExpandedMenus(prev => [activeMenu.label]);
      }
    }
  }, [location.pathname, finalMenuItems]);

  // Restore sidebar scroll position
  useEffect(() => {
    if (sidebarScrollRef.current && savedScrollPosition > 0) {
      const restoreScroll = () => {
        if (sidebarScrollRef.current) {
          sidebarScrollRef.current.scrollTop = savedScrollPosition;
        }
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(restoreScroll); // Double RAF to ensure layout is complete
      });
    }
  }, [expandedMenus, finalMenuItems, location.pathname, savedScrollPosition]);

  const isCollapsed = sidebarSize <= 10 && !isSidebarHidden;
  const isFullWidth = sidebarSize > 40;
  const isActuallyFull = sidebarSize >= 98;

  const handleSidebarResize = (size: number) => {
    setSidebarSize(size);
    localStorage.setItem("dashboard_sidebar_size", size.toString());
  };

  const setSidebarState = (state: 'hidden' | 'collapsed' | 'normal' | 'full') => {
    if (!sidebarPanelRef.current) return;
    switch (state) {
      case 'hidden':
        sidebarPanelRef.current.collapse();
        break;
      case 'collapsed':
        sidebarPanelRef.current.resize(8);
        break;
      case 'normal':
        sidebarPanelRef.current.resize(20);
        break;
      case 'full':
        sidebarPanelRef.current.resize(100);
        break;
    }
  };

  return (
    <DashboardSidebarContext.Provider value={{ isSidebarHidden, setSidebarState }}>
      <div
        className={cn(
          "h-screen w-full overflow-hidden flex flex-col font-body antialiased bg-gradient-to-br from-slate-50 via-sky-50/40 to-violet-100/45 dark:from-black dark:via-neutral-950 dark:to-black relative text-foreground",
          shouldUseCompactDashboardScale && "dashboard-panel-scale"
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.14),transparent),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(139,92,246,0.1),transparent),radial-gradient(ellipse_50%_35%_at_0%_80%,rgba(14,165,233,0.06),transparent)] dark:hidden"
          aria-hidden
        />
        <header className="relative h-20 border-b border-white/50 dark:border-white/10 flex items-center justify-between px-5 sm:px-8 bg-white/70 dark:bg-black/85 backdrop-blur-2xl sticky top-0 z-50 shrink-0 shadow-dashboard-soft dark:shadow-black/60 ring-1 ring-white/30 dark:ring-white/10 transition-shadow duration-300 hover:shadow-dashboard-soft-lg dark:hover:shadow-black/70">
          <div className="flex items-center gap-6">
            <button
              onClick={() => isSidebarHidden ? setSidebarState('normal') : setSidebarState('hidden')}
              className="p-2.5 rounded-xl hover:bg-muted/60 dark:hover:bg-white/5 transition-colors text-muted-foreground hover:text-primary"
            >
              {isSidebarHidden ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
            <Link to="/dashboard" className="group/logo">
              <div className="p-1 rounded-2xl bg-gradient-to-br from-accent/20 to-transparent flex-shrink-0">
                <img
                  src="/images/logo.jpeg"
                  alt="SCRE Logo"
                  className="w-10 h-10 rounded-xl border-2 border-accent/40 object-cover shadow-md transition-all duration-500 group-hover/logo:scale-110 group-hover/logo:shadow-[0_30px_60px_-12px_rgba(0,74,137,0.4)] group-hover/logo:border-accent"
                />
              </div>
            </Link>
            <div className="flex flex-col">
              <h2 className="font-heading font-black text-lg text-primary uppercase tracking-tight leading-none">
                SCRE
              </h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1.5">
                {t(displayRole)} {t("Workspace")}
              </p>
            </div>
          </div>

          <div className="flex-1 max-w-2xl mx-12 hidden lg:block">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchSuggestions(true);
                }}
                onFocus={() => setShowSearchSuggestions(true)}
                placeholder={t("Search portal records, students, or settings...")}
                className="w-full pl-12 pr-4 py-3 bg-white/50 hover:bg-white/80 focus:bg-white dark:bg-neutral-950 dark:hover:bg-neutral-950 dark:focus:bg-black rounded-2xl border border-white/60 dark:border-white/10 shadow-inner shadow-slate-900/5 dark:shadow-black/40 focus:border-primary/25 focus:ring-4 focus:ring-primary/8 focus:outline-none transition-all duration-300 text-sm font-medium placeholder:text-muted-foreground"
              />

              {/* Search Suggestions Dropdown */}
              <AnimatePresence>
                {showSearchSuggestions && searchSuggestions.length > 0 && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowSearchSuggestions(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-card border border-border/60 rounded-2xl shadow-2xl z-20 overflow-hidden backdrop-blur-xl"
                    >
                      <div className="p-2 max-h-[400px] overflow-y-auto">
                        {searchSuggestions.map((suggestion, index) => (
                          <button
                            key={`${suggestion.href}-${index}`}
                            onClick={() => {
                              if (sidebarScrollRef.current) {
                                setSavedScrollPosition(sidebarScrollRef.current.scrollTop);
                              }
                              setSearchQuery("");
                              setShowSearchSuggestions(false);
                              if (isFullWidth) {
                                setSidebarState('normal');
                                // Small delay to ensure panel resize doesn't conflict with navigation
                                setTimeout(() => navigate(suggestion.href), 10);
                              } else {
                                navigate(suggestion.href);
                              }
                            }}
                            className="w-full flex items-center gap-4 px-4 py-3 hover:bg-primary/5 rounded-xl transition-colors text-left group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                              <suggestion.icon className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">
                                {t(suggestion.label)}
                              </p>
                              {suggestion.parentLabel && (
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                  {t(suggestion.parentLabel)}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground/30 group-hover:text-primary transition-colors" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Sidebar Mode Controls */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40">
              <button
                onClick={() => setSidebarState('collapsed')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  isCollapsed ? "bg-white dark:bg-white/10 shadow-sm text-primary" : "text-muted-foreground hover:text-primary hover:bg-white/50"
                )}
                title={t("Icons Only")}
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSidebarState('normal')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  (!isCollapsed && !isFullWidth && !isSidebarHidden) ? "bg-white dark:bg-white/10 shadow-sm text-primary" : "text-muted-foreground hover:text-primary hover:bg-white/50"
                )}
                title={t("Normal Sidebar")}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSidebarState('full')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  isFullWidth ? "bg-white dark:bg-white/10 shadow-sm text-primary" : "text-muted-foreground hover:text-primary hover:bg-white/50"
                )}
                title={t("Full Width Menu")}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>



            <NotificationBell />

            <div className="h-8 w-px bg-border/60 dark:bg-white/10" />

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-foreground leading-none">{user?.username || t("User")}</p>
                <p className="text-[10px] text-accent font-black uppercase tracking-widest mt-1.5">{t(user?.role || "User")}</p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-0.5 shadow-md hover:shadow-primary/20 transition-all focus:outline-none ring-offset-2 dark:ring-offset-black focus:ring-2 focus:ring-primary/20"
                  >
                    <div className="w-full h-full rounded-[14px] bg-white dark:bg-black overflow-hidden flex items-center justify-center">
                      {user?.photoUrl ? (
                        <img src={user.photoUrl} alt={t("Profile")} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-5 h-5 text-primary" />
                      )}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl border-border/60 bg-white dark:bg-card dark:border-border p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                  <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-4 py-3">
                    {t("Account Management")}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="mx-2 bg-border/60" />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/profile" className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 rounded-xl transition-all group">
                      <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <UserIcon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("My Profile")}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex items-center justify-between px-4 py-3 cursor-default hover:bg-transparent rounded-xl transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        {appearance === "dark" ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
                      </div>
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("Dark Mode")}</span>
                    </div>
                    <Switch
                      checked={appearance === "dark"}
                      onCheckedChange={(checked) => setAppearance(checked ? "dark" : "light")}
                    />
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 rounded-xl transition-all group">
                      <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <Palette className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("Select Theme")}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent align="start" className="w-48 rounded-2xl border-border/60 bg-white dark:bg-card p-2 shadow-2xl">
                      {themes.map((th) => (
                        <DropdownMenuItem
                          key={th.name}
                          onClick={() => {
                            if (th.name === "Custom") {
                              colorInputRef.current?.click();
                            } else {
                              setCurrentTheme(th.name);
                            }
                          }}
                          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-primary/5 rounded-xl transition-all group"
                        >
                          <div
                            className={cn("w-4 h-4 rounded-full border border-border/50", th.class)}
                            style={th.name === "Custom" ? { background: customColor } : {}}
                          />
                          <span className={cn("text-xs font-bold uppercase tracking-wider", currentTheme === th.name ? "text-primary" : "text-muted-foreground")}>
                            {t(th.name)}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/settings" className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 rounded-xl transition-all group">
                      <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <Settings className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("Settings")}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard/privacy" className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-primary/5 focus:bg-primary/5 rounded-xl transition-all group">
                      <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("Privacy")}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="mx-2 bg-border/60" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-destructive/5 focus:bg-destructive/5 text-destructive rounded-xl transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-destructive/5 flex items-center justify-center group-hover:bg-destructive/10 transition-colors">
                      <LogOut className="w-4 h-4 text-destructive" />
                    </div>
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("logout")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden">
          <PanelGroup direction="horizontal">
            <Panel
              ref={sidebarPanelRef}
              defaultSize={sidebarSize}
              minSize={0}
              collapsible
              maxSize={100}
              onResize={handleSidebarResize}
              onCollapse={() => setIsSidebarHidden(true)}
              onExpand={() => setIsSidebarHidden(false)}
              className="dashboard-sidebar-shell relative z-40 overflow-visible flex flex-col bg-white/40 dark:bg-black/40 backdrop-blur-3xl"
            >
              <div
                ref={sidebarScrollRef}
                onScroll={(e) => {
                  // Optional: You could save continuously, but let's just save when navigation happens
                  // For now, we'll keep as is, but let's ensure our existing handlers are correct
                }}
                className={cn(
                  "flex-1 py-8 space-y-2 overflow-y-auto transition-all duration-300",
                  isCollapsed ? "px-2" : isFullWidth ? "px-12" : "px-4",
                  isActuallyFull && "max-w-[1440px] mx-auto w-full"
                )}>
                {/* Mobile/Sidebar Search Bar */}
                {!isCollapsed && !isActuallyFull && (
                  <div className="lg:hidden mb-6 px-2">
                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowSearchSuggestions(true);
                        }}
                        onFocus={() => setShowSearchSuggestions(true)}
                        placeholder={t("Search...")}
                        className="w-full pl-9 pr-4 py-2 bg-white/50 dark:bg-neutral-950 rounded-xl border border-white/60 dark:border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />

                      {/* Mobile Suggestions */}
                      <AnimatePresence>
                        {showSearchSuggestions && searchSuggestions.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-card border border-border/60 rounded-xl shadow-xl z-[70] overflow-hidden"
                          >
                            <div className="p-1 max-h-[300px] overflow-y-auto">
                              {searchSuggestions.map((suggestion, index) => (
                                <button
                                key={`mobile-${suggestion.href}-${index}`}
                                onClick={() => {
                                  if (sidebarScrollRef.current) {
                                    setSavedScrollPosition(sidebarScrollRef.current.scrollTop);
                                  }
                                  setSearchQuery("");
                                  setShowSearchSuggestions(false);
                                  navigate(suggestion.href);
                                  if (isFullWidth) setSidebarState('normal');
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-primary/5 rounded-lg transition-colors text-left"
                              >
                                  <suggestion.icon className="w-3.5 h-3.5 text-primary" />
                                  <div>
                                    <p className="text-[11px] font-bold text-foreground line-clamp-1">{t(suggestion.label)}</p>
                                    {suggestion.parentLabel && (
                                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest">{t(suggestion.parentLabel)}</p>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
                {isFullWidth ? (
                  /* Full Width Grid Layout */
                  <div className={cn(
                    "grid gap-8 py-8 animate-in fade-in zoom-in-95 duration-500",
                    isActuallyFull
                      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                  )}>
                    {finalMenuItems.map((item: MenuItem) => (
                      <div key={item.label} className="flex flex-col gap-6 p-6 rounded-[2rem] bg-white/60 dark:bg-white/5 border border-white/80 dark:border-white/10 shadow-xl shadow-slate-900/5 backdrop-blur-xl group hover:-translate-y-2 transition-all duration-500">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
                            <item.icon className="w-7 h-7 text-white" />
                          </div>
                          <div>
                            <h3 className="font-heading font-black text-xl text-foreground uppercase tracking-tight">{t(item.label)}</h3>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                              {item.subItems?.length || 0} {t("Modules")}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {item.subItems?.map((subItem: SubMenuItem) => (
                            subItem.onClick ? (
                              <button
                                key={subItem.label}
                                onClick={() => {
                                  subItem.onClick?.();
                                  if (isFullWidth) setSidebarState('normal');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all duration-300 group/sub"
                              >
                                <subItem.icon className="w-4 h-4 group-hover/sub:scale-110 transition-transform opacity-70" />
                                <span className="tracking-tight uppercase">{t(subItem.label)}</span>
                              </button>
                            ) : (
                              <Link
                                key={subItem.label}
                                to={subItem.href || "#"}
                                onClick={(e) => {
                                  if (sidebarScrollRef.current) {
                                    setSavedScrollPosition(sidebarScrollRef.current.scrollTop);
                                  }
                                  if (isFullWidth) {
                                    e.preventDefault();
                                    setSidebarState('normal');
                                    setTimeout(() => navigate(subItem.href || "#"), 10);
                                  }
                                }}
                                className={cn(
                                  "flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all duration-300 group/sub",
                                  isRouteActive(subItem.href || "")
                                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                                    : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                                )}
                              >
                                <subItem.icon className="w-4 h-4 group-hover/sub:scale-110 transition-transform opacity-70" />
                                <span className="tracking-tight uppercase">{t(subItem.label)}</span>
                              </Link>
                            )
                          ))}
                          {item.href && (
                            <Link
                              to={item.href}
                              onClick={(e) => {
                                if (sidebarScrollRef.current) {
                                  setSavedScrollPosition(sidebarScrollRef.current.scrollTop);
                                }
                                if (isFullWidth) {
                                  e.preventDefault();
                                  setSidebarState('normal');
                                  setTimeout(() => navigate(item.href || "#"), 10);
                                }
                              }}
                              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all duration-300 group/sub"
                            >
                              <item.icon className="w-4 h-4 group-hover/sub:scale-110 transition-transform opacity-70" />
                              <span className="tracking-tight uppercase">{t("Launch")} {t(item.label)}</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Standard & Collapsed Layout */
                  finalMenuItems.map((item: MenuItem) => (
                    <div key={item.label} className="space-y-1">
                      {item.subItems ? (
                        <>
                          {isCollapsed ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className={cn(
                                    "w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 group relative",
                                    expandedMenus.includes(item.label)
                                      ? "text-primary bg-primary/10 shadow-md shadow-primary/10 border border-primary/10"
                                      : "text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-white dark:hover:bg-white/10 hover:shadow-md border border-transparent"
                                  )}
                                  onMouseEnter={(e) => setTooltipFromElement(t(item.label), e.currentTarget)}
                                  onMouseMove={(e) => setTooltipFromElement(t(item.label), e.currentTarget)}
                                  onMouseLeave={() => setCollapsedHoverTooltip(null)}
                                >
                                  <item.icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="right" align="start" className="w-64 ml-2 rounded-2xl p-2 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-border/40 shadow-2xl">
                                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-primary px-3 py-2">
                                  {t(item.label)}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-border/40" />
                                {item.subItems.map((subItem: SubMenuItem) => (
                                  <DropdownMenuItem key={subItem.label} asChild>
                                    {subItem.onClick ? (
                                      <button
                                        onClick={subItem.onClick}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-primary transition-all"
                                      >
                                        <subItem.icon className="w-4 h-4" />
                                        <span className="uppercase tracking-tight">{t(subItem.label)}</span>
                                      </button>
                                    ) : (
                                      <Link
                                        to={subItem.href || "#"}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-primary transition-all"
                                      >
                                        <subItem.icon className="w-4 h-4" />
                                        <span className="uppercase tracking-tight">{t(subItem.label)}</span>
                                      </Link>
                                    )}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <>
                              <button
                                onClick={() => toggleMenu(item.label)}
                                className={cn(
                                  "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                                  expandedMenus.includes(item.label)
                                    ? "text-primary bg-primary/10 font-bold shadow-md shadow-primary/10 border border-primary/10"
                                    : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/5 hover:shadow-md hover:-translate-y-0.5 border border-transparent hover:border-white/80 dark:hover:border-white/10"
                                )}
                              >
                                <div className="flex items-center gap-3.5 z-10">
                                  <item.icon className={cn(
                                    "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
                                    expandedMenus.includes(item.label) ? "text-primary" : "text-muted-foreground/70"
                                  )} />
                                  <span className="text-sm uppercase tracking-tight">{t(item.label)}</span>
                                </div>
                                {expandedMenus.includes(item.label) ? (
                                  <ChevronDown className="w-4 h-4 z-10" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 z-10 text-muted-foreground/40" />
                                )}
                              </button>

                              <AnimatePresence>
                                {expandedMenus.includes(item.label) && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="ml-6 space-y-1 mt-1.5 relative border-l-2 border-primary/10 pl-4 py-1 overflow-hidden"
                                  >
                                    {item.subItems.map((subItem) => (
                                      subItem.onClick ? (
                                        <button
                                          key={subItem.label}
                                          onClick={subItem.onClick}
                                          className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-white/70 dark:hover:bg-white/5 hover:shadow-sm transition-all duration-300 group"
                                        >
                                          <subItem.icon className="w-4 h-4 group-hover:scale-110 transition-transform opacity-70" />
                                          <span className="tracking-tight">{t(subItem.label)}</span>
                                        </button>
                                      ) : (
                                        <Link
                                          key={subItem.label}
                                          to={subItem.href || "#"}
                                          onClick={() => {
                                            if (sidebarScrollRef.current) {
                                              setSavedScrollPosition(sidebarScrollRef.current.scrollTop);
                                            }
                                          }}
                                          className={cn(
                                            "flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 group",
                                            isRouteActive(subItem.href || "") ? "text-primary font-bold bg-primary/5" : "text-muted-foreground hover:text-primary hover:bg-white/70 dark:hover:bg-white/5"
                                          )}
                                        >
                                          <subItem.icon className="w-4 h-4 group-hover:scale-110 transition-transform opacity-70" />
                                          <span className="tracking-tight">{t(subItem.label)}</span>
                                        </Link>
                                      )
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </>
                          )}
                        </>
                      ) : (
                        <Link
                          to={item.href || "#"}
                          onClick={() => {
                            if (sidebarScrollRef.current) {
                              setSavedScrollPosition(sidebarScrollRef.current.scrollTop);
                            }
                          }}
                          className={cn(
                            "flex items-center gap-3.5 rounded-2xl transition-all duration-300 group relative",
                            isCollapsed ? "w-12 h-12 justify-center" : "px-4 py-3.5",
                            isRouteActive(item.href || "")
                              ? "text-primary bg-primary/10 font-bold shadow-md shadow-primary/10 border border-primary/10"
                              : "text-muted-foreground hover:text-primary hover:bg-white/70 dark:hover:bg-white/5 hover:shadow-md hover:-translate-y-0.5 border border-transparent hover:border-white/80 dark:hover:border-white/10"
                          )}
                          onMouseEnter={(e) => {
                            if (isCollapsed) setTooltipFromElement(t(item.label), e.currentTarget);
                          }}
                          onMouseMove={(e) => {
                            if (isCollapsed) setTooltipFromElement(t(item.label), e.currentTarget);
                          }}
                          onMouseLeave={() => {
                            if (isCollapsed) setCollapsedHoverTooltip(null);
                          }}
                        >
                          <item.icon className="w-5 h-5 group-hover:scale-110 transition-transform opacity-70" />
                          {!isCollapsed && <span className="text-sm font-semibold uppercase tracking-tight">{t(item.label)}</span>}
                        </Link>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className={cn(
                "border-t border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/50 backdrop-blur-md transition-all duration-300",
                isCollapsed ? "p-2" : isActuallyFull ? "p-12 max-w-[1440px] mx-auto w-full" : isFullWidth ? "p-8" : "p-6"
              )}>
                <button
                  onClick={handleLogout}
                  className={cn(
                    "flex items-center justify-center gap-3 rounded-2xl bg-red-500/10 text-red-600 hover:bg-red-600 hover:text-white transition-all duration-300 font-bold uppercase text-xs tracking-widest shadow-md shadow-red-500/15 hover:-translate-y-0.5 hover:shadow-lg",
                    isCollapsed ? "w-12 h-12 p-0" : isActuallyFull ? "w-auto px-12 py-4" : "w-full py-4 px-4"
                  )}
                  title={t("logout")}
                >
                  <LogOut className="w-4 h-4" />
                  {!isCollapsed && <span>{t("logout")}</span>}
                </button>
              </div>
            </Panel>

            <PanelResizeHandle
              className={cn(
                "w-1.5 hover:bg-primary/30 active:bg-primary/50 transition-colors cursor-col-resize relative z-[60]",
                isActuallyFull && "fixed right-0 top-0 bottom-0 w-4 bg-primary/5 hover:bg-primary/20 backdrop-blur-sm shadow-[-4px_0_15px_rgba(0,0,0,0.1)]"
              )}
            >
              <div className={cn(
                "absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border/60 dark:bg-white/10",
                isActuallyFull && "hidden"
              )} />
              {isActuallyFull && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1 items-center">
                  <div className="w-1 h-8 rounded-full bg-primary/40" />
                  <div className="w-1 h-8 rounded-full bg-primary/40" />
                </div>
              )}
            </PanelResizeHandle>

            <Panel
              minSize={0}
              collapsible
              className={cn("bg-transparent relative", isActuallyFull && "hidden")}
            >
              <div className="absolute inset-0 overflow-y-auto p-5 sm:p-7 md:p-9 lg:p-11">
                <div className="dashboard-workspace-shell p-6 sm:p-8 md:p-10 lg:p-11">
                  {USE_EXAM_V2 ? <ExamLockRoot>{children}</ExamLockRoot> : children}
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </div>
        <input
          ref={colorInputRef}
          type="color"
          value={customColor}
          onChange={(e) => {
            setCustomColor(e.target.value);
            setCurrentTheme("Custom");
          }}
          className="hidden"
        />
        {isCollapsed && collapsedHoverTooltip && (
          <div
            className="pointer-events-none fixed z-[140] whitespace-nowrap rounded-lg border border-slate-300/80 dark:border-white/20 bg-white text-slate-900 dark:bg-slate-900 dark:text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-xl"
            style={{ left: collapsedHoverTooltip.x, top: collapsedHoverTooltip.y, transform: "translateY(-50%)" }}
          >
            {collapsedHoverTooltip.label}
          </div>
        )}
      </div>
    </DashboardSidebarContext.Provider>
  );
};


export default DashboardLayout;
