import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import CustomCursor from "@/components/CustomCursor";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import i18n from "@/i18n";
import { syncServerTime } from "@/lib/time";
import LanguageSync from "@/components/LanguageSync";
import { PortalErrorBoundary } from "./main";

// Core Pages
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Dashboards
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const CenterDashboard = lazy(() => import("./pages/CenterDashboard"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const StaffDashboard = lazy(() => import("./pages/StaffDashboard"));

// Management Pages
const StaffListPage = lazy(() => import("./pages/StaffListPage"));
const AddStaffPage = lazy(() => import("./pages/AddStaffPage"));
const AddCenterPage = lazy(() => import("./pages/AddCenterPage"));
const CenterListPage = lazy(() => import("./pages/CenterListPage"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));
const DiskUsagePage = lazy(() => import("./pages/DiskUsagePage"));
const UserManagementPage = lazy(() => import("./pages/UserManagementPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AddAdminPage = lazy(() => import("./pages/AddAdminPage"));
const AdminListPage = lazy(() => import("./pages/AdminListPage"));
const PlaceholderPage = lazy(() => import("./pages/PlaceholderPage"));
const AddStudentPage = lazy(() => import("./pages/AddStudentPage"));
const AttendanceRegisterPage = lazy(() => import("./pages/AttendanceRegisterPage"));
const AttendanceReportPage = lazy(() => import("./pages/AttendanceReportPage"));
const StudentAttendancePage = lazy(() => import("./pages/StudentAttendancePage"));
const StudentFeesPage = lazy(() => import("./pages/StudentFeesPage"));
const StudentFeeDetailsPage = lazy(() => import("./pages/StudentFeeDetailsPage"));
const AdminFeesPage = lazy(() => import("./pages/AdminFeesPage"));
const AdminCoursesPage = lazy(() => import("./pages/AdminCoursesPage"));
const AdminAnnouncementsPage = lazy(() => import("./pages/AdminAnnouncementsPage"));
const ActivityLogsPage = lazy(() => import("./pages/ActivityLogsPage"));
const AdminTranslationUsagePage = lazy(() => import("./pages/AdminTranslationUsagePage"));
const StudentAnnouncementsPage = lazy(() => import("./pages/StudentAnnouncementsPage"));
const TypingLanguagesPage = lazy(() => import("./pages/TypingLanguagesPage"));
const TypingLessonsPage = lazy(() => import("./pages/TypingLessonsPage"));
const AdminTypingTestsPage = lazy(() => import("./pages/AdminTypingTestsPage"));
const AdminTypingAllotPage = lazy(() => import("./pages/AdminTypingAllotPage"));
const AdminFinanceWalletPage = lazy(() => import("./pages/AdminFinanceWalletPage"));
const AdminFinanceCommissionsPage = lazy(() => import("./pages/AdminFinanceCommissionsPage"));
const AdminFinancePaymentsPage = lazy(() => import("./pages/AdminFinancePaymentsPage"));
const AdminReferralsPage = lazy(() => import("./pages/AdminReferralsPage"));
const AdminCenterRequestsPage = lazy(() => import("./pages/AdminCenterRequestsPage"));
const AdminCenterFeesPage = lazy(() => import("./pages/AdminCenterFeesPage"));
const AdminCenterWalletsPage = lazy(() => import("./pages/AdminCenterWalletsPage"));
const AdminLocationsPage = lazy(() => import("./pages/AdminLocationsPage"));
const AdminRevenuePage = lazy(() => import("./pages/AdminRevenuePage"));
const AdminCenterStatsPage = lazy(() => import("./pages/AdminCenterStatsPage"));
const AdminRolePermissionsPage = lazy(() => import("./pages/AdminRolePermissionsPage"));
const CenterBatchesPage = lazy(() => import("./pages/CenterBatchesPage"));
const CenterBatchStudentsPage = lazy(() => import("./pages/CenterBatchStudentsPage"));
const CenterTodayStatsPage = lazy(() => import("./pages/CenterTodayStatsPage"));
const CenterActivityPage = lazy(() => import("./pages/CenterActivityPage"));
const CenterEnquiriesPage = lazy(() => import("./pages/CenterEnquiriesPage"));
const CenterWalletPage = lazy(() => import("./pages/CenterWalletPage"));
const StudentProgressPage = lazy(() => import("./pages/StudentProgressPage"));
const StudentCoursesPage = lazy(() => import("./pages/StudentCoursesPage"));
const StudentReviewPage = lazy(() => import("./pages/StudentReviewPage"));
const AdminReviewPage = lazy(() => import("./pages/AdminReviewPage"));

const StudentAttendanceReportPage = lazy(() => import("./pages/StudentAttendanceReportPage"));
const CenterCourseMaterialsPage = lazy(() => import("./pages/CenterCourseMaterialsPage"));
const CenterLiveClassesPage = lazy(() => import("./pages/CenterLiveClassesPage"));
const CenterPracticalsPage = lazy(() => import("./pages/CenterPracticalsPage"));
const StudentCourseMaterialsPage = lazy(() => import("./pages/StudentCourseMaterialsPage"));
const StudentLiveClassesPage = lazy(() => import("./pages/StudentLiveClassesPage"));
const StudentPracticalsPage = lazy(() => import("./pages/StudentPracticalsPage"));
const StudentRecordedClassesPage = lazy(() => import("./pages/StudentRecordedClassesPage"));
const StudentMessagesPage = lazy(() => import("./pages/StudentMessagesPage"));
const CenterAllottedCoursesPage = lazy(() => import("./pages/CenterAllottedCoursesPage"));
const CenterStudentsPage = lazy(() => import("./pages/CenterStudentsPage"));
const StudentMarksheetsPage = lazy(() => import("./pages/StudentMarksheetsPage"));
const EditStudentPage = lazy(() => import("./pages/EditStudentPage"));
const AddInternPage = lazy(() => import("./pages/AddInternPage"));
const InternListPage = lazy(() => import("./pages/InternListPage"));
const EditInternPage = lazy(() => import("./pages/EditInternPage"));
const InternTasksManagerPage = lazy(() => import("./pages/InternTasksManagerPage"));
const InternProgressPage = lazy(() => import("./pages/InternProgressPage"));
const InternDashboard = lazy(() => import("./pages/InternDashboard"));
const InternAttendancePage = lazy(() => import("./pages/InternAttendancePage"));
const InternTasksPage = lazy(() => import("./pages/InternTasksPage"));
const InternCertificatesPage = lazy(() => import("./pages/InternCertificatesPage"));
const AdminCollegesPage = lazy(() => import("./pages/AdminCollegesPage"));
const AdminInternshipEnquiriesPage = lazy(() => import("./pages/AdminInternshipEnquiriesPage"));

const StudentExamListPage = lazy(() => import("./pages/StudentExamListPage"));
const TakeExamPage = lazy(() => import("./pages/TakeExamPage"));
const ExamResultPage = lazy(() => import("./pages/ExamResultPage"));
const MarksheetPage = lazy(() => import("./pages/MarksheetPage"));
const CenterDocumentRequestPage = lazy(() => import("./pages/CenterDocumentRequestPage"));
const AdminStudentApprovalPage = lazy(() => import("./pages/AdminStudentApprovalPage"));
const LeadsPage = lazy(() => import("./pages/LeadsPage"));


const AdminBlogListPage = lazy(() => import("./pages/AdminBlogListPage"));
const AdminBlogCategoriesPage = lazy(() => import("./pages/AdminBlogCategoriesPage"));
const AdminNewsListPage = lazy(() => import("./pages/AdminNewsListPage"));
const BlogListPage = lazy(() => import("./pages/BlogListPage"));
const BlogDetailsPage = lazy(() => import("./pages/BlogDetailsPage"));
const AdminEnquiriesPage = lazy(() => import("./pages/AdminEnquiriesPage"));
const AdminEnquiryDetailsPage = lazy(() => import("./pages/AdminEnquiryDetailsPage"));
const AdminEnquiryPipelinePage = lazy(() => import("./pages/AdminEnquiryPipelinePage"));
const AdminEnquiryRemindersPage = lazy(() => import("./pages/AdminEnquiryRemindersPage"));
const AdminCourseCategoriesPage = lazy(() => import("./pages/AdminCourseCategoriesPage"));
const AdminSubjectsPage = lazy(() => import("./pages/AdminSubjectsPage"));
const AdminCourseSubjectMappingPage = lazy(() => import("./pages/AdminCourseSubjectMappingPage"));
const AdminRecycleBinPage = lazy(() => import("./pages/AdminRecycleBinPage"));
const MessagingPage = lazy(() => import("./pages/MessagingPage"));
const StudentRecycleBinPage = lazy(() => import("./pages/StudentRecycleBinPage"));
const AdminSessionsPage = lazy(() => import("./pages/AdminSessionsPage"));
const AdminStudyMaterialPage = lazy(() => import("./pages/AdminStudyMaterialPage"));
const AdminSystemSettingsPage = lazy(() => import("./pages/AdminSystemSettingsPage"));
const MaintenancePage = lazy(() => import("./pages/maintenance/MaintenancePage"));
const AdminMaintenancePage = lazy(() => import("./pages/AdminMaintenancePage"));
const ReferAndEarnPage = lazy(() => import("./pages/ReferAndEarnPage"));
const FAQPage = lazy(() => import("./pages/FAQPage"));
const AdminExamBlueprintsPage = lazy(() => import("./pages/AdminExamBlueprintsPage"));
const AdminMockTestsPage = lazy(() => import("./pages/AdminMockTestsPage"));
const AdminExamAllotPage = lazy(() => import("./pages/AdminExamAllotPage"));
const AdminAllotedExamsPage = lazy(() => import("./pages/AdminAllotedExams"));
const AdminExamListPage = lazy(() => import("./pages/AdminExamListPage"));
const AdminExamResultsPage = lazy(() => import("./pages/AdminExamResultsPage"));
const ManualEvaluationPage = lazy(() => import("./pages/ManualEvaluationPage"));
const AdminQuestionFeedbackPage = lazy(() => import("./pages/AdminQuestionFeedbackPage"));
const PrintQuestionPaper = lazy(() => import("./pages/PrintQuestionPaper"));
const CenterSubjectsPage = lazy(() => import("./pages/CenterSubjectsPage"));
const CenterSessionsPage = lazy(() => import("./pages/CenterSessionsPage"));
const StudentSubjectsPage = lazy(() => import("./pages/StudentSubjectsPage"));
const AdminCouponsPage = lazy(() => import("./pages/AdminCouponsPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const CoursesPage = lazy(() => import("./pages/CoursesPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const StudentInquiryPage = lazy(() => import("./pages/StudentInquiryPage"));
const StudentInternshipPage = lazy(() => import("./pages/StudentInternshipPage"));
const FranchisePage = lazy(() => import("./pages/FranchisePage"));
const CoursePage = lazy(() => import("./pages/CoursePage"));
const FranchiseWhyUsPage = lazy(() => import("./pages/FranchiseWhyUsPage"));
const FranchiseRequirementsPage = lazy(() => import("./pages/FranchiseRequirementsPage"));
const FranchisePartnersPage = lazy(() => import("./pages/FranchisePartnersPage"));
const FranchiseSupportPage = lazy(() => import("./pages/FranchiseSupportPage"));
const FranchiseInvestmentPage = lazy(() => import("./pages/FranchiseInvestmentPage"));
const FranchiseApplyPage = lazy(() => import("./pages/FranchiseApplyPage"));
const FranchiseLoginPage = lazy(() => import("./pages/FranchiseLoginPage"));
const ShopPage = lazy(() => import("./pages/ShopPage"));
const StudentZonePage = lazy(() => import("./pages/StudentZonePage"));
const GalleryPage = lazy(() => import("./pages/GalleryPage"));
const AboutGallery = lazy(() => import("./pages/AboutGallery"));
const AdmissionPage = lazy(() => import("./pages/AdmissionPage"));
const NewsListPage = lazy(() => import("./pages/NewsListPage"));
const NewsDetailsPage = lazy(() => import("./pages/NewsDetailsPage"));
const CentersPage = lazy(() => import("./pages/CentersPage"));
const CenterPublicDetailsPage = lazy(() => import("./pages/CenterPublicDetailsPage"));
const CenterProfilePage = lazy(() => import("./pages/CenterProfilePage"));
const CenterProfileUpdatePage = lazy(() => import("./pages/CenterProfileUpdatePage"));
const DownloadsPage = lazy(() => import("./pages/DownloadsPage"));
const AttachmentCreateIdCardPage = lazy(() => import("./pages/AttachmentCreateIdCardPage"));
const AttachmentListIdCardsPage = lazy(() => import("./pages/AttachmentListIdCardsPage"));
const TemplateListPage = lazy(() => import("./pages/TemplateListPage"));
const TemplateCreatePage = lazy(() => import("./pages/TemplateCreatePage"));
const TemplateEditorPage = lazy(() => import("./pages/TemplateEditorPage"));
const VerificationLetterPage = lazy(() => import("./pages/VerificationLetterPage"));
const AdminExamV2Hub = lazy(() => import("./pages/exam-v2/AdminExamV2Hub"));
const CenterExamV2Page = lazy(() => import("./pages/exam-v2/CenterExamV2Page"));
const BankListPage = lazy(() => import("./pages/qb/BankListPage"));
const QuestionListPage = lazy(() => import("./pages/qb/QuestionListPage"));
const QuestionFormPage = lazy(() => import("./pages/qb/QuestionFormPage"));

const CenterMarksEntryPage = lazy(() => import("./pages/exam-v2/CenterMarksEntryPage"));
const CenterDownloadPaperPage = lazy(() => import("./pages/CenterDownloadPaperPage"));
const CenterExamMarksEntryPage = lazy(() => import("./pages/CenterExamMarksEntryPage"));
const CenterReappearManagementPage = lazy(() => import("./pages/CenterReappearManagementPage"));
const AdminExamCenterRequestsPage = lazy(() => import("./pages/AdminExamCenterRequestsPage"));
const AdminMarksApprovalPage = lazy(() => import("./pages/exam-v2/AdminMarksApprovalPage"));

const TypingHistoryPage = lazy(() => import("./pages/TypingHistoryPage"));
const TypingLeaderboardPage = lazy(() => import("./pages/TypingLeaderboardPage"));
const CenterTypingReportsPage = lazy(() => import("./pages/CenterTypingReportsPage"));
const AdminTypingAnalyticsPage = lazy(() => import("./pages/AdminTypingAnalyticsPage"));
const GenerateCertificatesPage = lazy(() => import("./pages/GenerateCertificatesPage"));
const StudentCertificatesListPage = lazy(() => import("./pages/StudentCertificatesListPage"));
const AttachmentListCertificatesPage = lazy(() => import("./pages/AttachmentListCertificatesPage"));
const VerifyCertificatePage = lazy(() => import("./pages/VerifyCertificatePage"));
const StudentVerificationPage = lazy(() => import("./pages/StudentVerificationPage"));
const CenterVerificationPage = lazy(() => import("./pages/CenterVerificationPage"));
const CertificateDesignerListPage = lazy(() => import("./pages/CertificateDesignerListPage"));
const CertificateDesignerCanvasPage = lazy(() => import("./pages/CertificateDesignerCanvasPage"));

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

const AdminFinanceTransactionsPage = lazy(() => import("./pages/AdminFinanceTransactionsPage"));
const AdminCMSPage = lazy(() => import("./pages/AdminCMSPage"));
const TypingPracticePage = lazy(() => import("./pages/TypingPracticePage"));
const AdminBlogEditorPage = lazy(() => import("./pages/AdminBlogEditorPage"));
const AdminNewsEditorPage = lazy(() => import("./pages/AdminNewsEditorPage"));
const AdminAssetsPage = lazy(() => import("./pages/AdminAssetsPage"));
const AdminCertificateApprovalPage = lazy(() => import("./pages/AdminCertificateApprovalPage"));
const LibraryManagementPage = lazy(() => import("./pages/LibraryManagementPage"));
const StudentLibraryPage = lazy(() => import("./pages/StudentLibraryPage"));
const StudentInternshipPortalPage = lazy(() => import("./pages/StudentInternshipPortalPage"));
const AdminInternshipManagerPage = lazy(() => import("./pages/AdminInternshipManagerPage"));

const queryClient = new QueryClient();

function LanguageQueryBridge() {
  const qc = useQueryClient();
  useEffect(() => {
    const handler = () => {
      qc.invalidateQueries();
    };
    i18n.on("languageChanged", handler);
    return () => {
      i18n.off("languageChanged", handler);
    };
  }, [qc]);
  return null;
}

// Auth Guard Component
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const token = sessionStorage.getItem("token");
  const userStr = sessionStorage.getItem("user");

  let user: any = null;
  try {
    user = userStr && userStr !== "undefined" ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error("Error parsing user from sessionStorage:", error);
    user = null;
  }

  const role = user?.role?.toLowerCase().replace(" ", "") || "";

  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase().replace(" ", ""));

  if (!normalizedAllowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Portal Route Wrapper - wraps portal routes in PortalErrorBoundary
const PortalRouteWrapper = ({ children }: { children: React.ReactNode }) => {
  return <PortalErrorBoundary>{children}</PortalErrorBoundary>;
};

const AppRoutes = () => {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await apiFetch("/api/public/system-settings");
      return res.json();
    },
  });

  const isBypassed = localStorage.getItem("maintenance_bypass") === "true";

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Initializing Portal...</p>
      </div>
    </div>
  );

  if (settings?.maintenance_mode && !isBypassed) {
    return (
      <Routes>
        <Route path="*" element={<MaintenancePage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/en/*" element={<LanguageRouteRedirect lang="en" />} />
      <Route path="/hi/*" element={<LanguageRouteRedirect lang="hi" />} />
      <Route path="/" element={<Index />} />
      <Route path="/shop" element={<ShopPage />} />
      <Route path="/verification-letter" element={<VerificationLetterPage />} />
      <Route path="/franchise/login" element={<FranchiseLoginPage />} />

      {/* Dashboard Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={["superadmin", "admin", "center", "student", "staff"]}>
            <DashboardSelector />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/superadmin"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/admin"
        element={
          <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/dashboard/revenue" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminRevenuePage /></ProtectedRoute>} />
      <Route path="/dashboard/center-stats" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCenterStatsPage /></ProtectedRoute>} />
      <Route
        path="/dashboard/students/approvals"
        element={
          <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
            <AdminStudentApprovalPage />
          </ProtectedRoute>
        }
      />


      <Route
        path="/dashboard/centers/add"
        element={
          <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
            <AddCenterPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/centers"
        element={
          <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
            <CenterListPage />
          </ProtectedRoute>
        }
      />
      <Route path="/dashboard/centers/requests" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCenterRequestsPage /></ProtectedRoute>} />
      <Route path="/dashboard/centers/fees" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCenterFeesPage /></ProtectedRoute>} />
      <Route path="/dashboard/admin/fees" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminFeesPage /></ProtectedRoute>} />
      <Route path="/dashboard/centers/wallets" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCenterWalletsPage /></ProtectedRoute>} />
      <Route path="/dashboard/admin/bin" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminRecycleBinPage /></ProtectedRoute>} />

      <Route path="/dashboard/typing/languages" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><TypingLanguagesPage /></ProtectedRoute>} />
      <Route path="/dashboard/typing/lessons" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><TypingLessonsPage /></ProtectedRoute>} />
      <Route path="/dashboard/typing/analytics" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminTypingAnalyticsPage /></ProtectedRoute>} />

      <Route path="/dashboard/typing/history" element={<ProtectedRoute allowedRoles={["student"]}><TypingHistoryPage /></ProtectedRoute>} />
      <Route path="/dashboard/typing/tests" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminTypingTestsPage /></ProtectedRoute>} />
      <Route path="/dashboard/typing/allot" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminTypingAllotPage /></ProtectedRoute>} />

      <Route path="/dashboard/finance/wallet" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminFinanceWalletPage /></ProtectedRoute>} />
      <Route path="/dashboard/finance/transactions" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminFinanceTransactionsPage /></ProtectedRoute>} />
      <Route path="/dashboard/finance/commissions" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminFinanceCommissionsPage /></ProtectedRoute>} />
      <Route path="/dashboard/finance/payments" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminFinancePaymentsPage /></ProtectedRoute>} />
      <Route path="/dashboard/finance/referrals" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminReferralsPage /></ProtectedRoute>} />
      <Route path="/dashboard/referrals" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminReferralsPage /></ProtectedRoute>} />
      <Route path="/dashboard/refer-and-earn" element={<ProtectedRoute allowedRoles={["center", "student"]}><ReferAndEarnPage /></ProtectedRoute>} />
      <Route path="/dashboard/locations" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminLocationsPage /></ProtectedRoute>} />
      <Route path="/dashboard/locations/countries" element={<Navigate to="/dashboard/locations" replace />} />
      <Route path="/dashboard/locations/states" element={<Navigate to="/dashboard/locations" replace />} />
      <Route path="/dashboard/locations/cities" element={<Navigate to="/dashboard/locations" replace />} />
      <Route path="/dashboard/system/roles" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminRolePermissionsPage /></ProtectedRoute>} />
      <Route path="/dashboard/academics/categories" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCourseCategoriesPage /></ProtectedRoute>} />
      <Route path="/dashboard/categories" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCourseCategoriesPage /></ProtectedRoute>} />
      <Route path="/dashboard/academics/courses" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCoursesPage /></ProtectedRoute>} />
      <Route path="/dashboard/courses" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCoursesPage /></ProtectedRoute>} />
      <Route path="/dashboard/academics/subjects" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminSubjectsPage /></ProtectedRoute>} />
      <Route path="/dashboard/subjects" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminSubjectsPage /></ProtectedRoute>} />
      <Route path="/dashboard/academics/mapping" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCourseSubjectMappingPage /></ProtectedRoute>} />
      <Route path="/dashboard/academics/sessions" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminSessionsPage /></ProtectedRoute>} />
      <Route path="/dashboard/sessions" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminSessionsPage /></ProtectedRoute>} />
      <Route path="/dashboard/academics/study-material" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminStudyMaterialPage /></ProtectedRoute>} />
      <Route path="/dashboard/study-material" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminStudyMaterialPage /></ProtectedRoute>} />
      <Route path="/dashboard/assets" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminAssetsPage /></ProtectedRoute>} />
      <Route path="/dashboard/certificates/approvals" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCertificateApprovalPage /></ProtectedRoute>} />
      <Route path="/dashboard/attachments/approvals" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCertificateApprovalPage /></ProtectedRoute>} />
      <Route path="/dashboard/exam-v2/hub" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminExamV2Hub /></ProtectedRoute>} />
      <Route path="/dashboard/exam-v2/marks-approval" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminMarksApprovalPage /></ProtectedRoute>} />
      <Route path="/dashboard/academics/blueprints" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminExamBlueprintsPage /></ProtectedRoute>} />
      <Route path="/dashboard/academics/mock-tests" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminMockTestsPage /></ProtectedRoute>} />
      <Route path="/dashboard/academics/question-bank" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><BankListPage /></ProtectedRoute>} />
      <Route path="/dashboard/academics/question-bank/:bankId" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><QuestionListPage /></ProtectedRoute>} />
      <Route path="/dashboard/academics/question-bank/:bankId/add" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><QuestionFormPage /></ProtectedRoute>} />
      <Route path="/dashboard/academics/question-bank/:bankId/edit/:id" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><QuestionFormPage /></ProtectedRoute>} />
      <Route path="/dashboard/academics/question-feedback" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminQuestionFeedbackPage /></ProtectedRoute>} />
      <Route path="/dashboard/exams/allot" element={<ProtectedRoute allowedRoles={["admin", "superadmin", "center"]}><AdminExamAllotPage /></ProtectedRoute>} />
      <Route path="/dashboard/exams/alloted" element={<ProtectedRoute allowedRoles={["admin", "superadmin", "center"]}><AdminAllotedExamsPage /></ProtectedRoute>} />
      <Route path="/dashboard/exams/papers" element={<ProtectedRoute allowedRoles={["admin", "superadmin", "center"]}><AdminExamListPage /></ProtectedRoute>} />
      <Route path="/dashboard/exams/results" element={<ProtectedRoute allowedRoles={["admin", "superadmin", "center"]}><AdminExamResultsPage /></ProtectedRoute>} />
      <Route path="/dashboard/exams/center-requests" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminExamCenterRequestsPage /></ProtectedRoute>} />
      <Route path="/dashboard/exams/evaluate/:id" element={<ProtectedRoute allowedRoles={["admin", "superadmin", "center"]}><ManualEvaluationPage /></ProtectedRoute>} />
      <Route path="/dashboard/exams/print/:id" element={<ProtectedRoute allowedRoles={["admin", "superadmin", "center"]}><PrintQuestionPaper /></ProtectedRoute>} />
      <Route path="/dashboard/exams/results/:id" element={<ProtectedRoute allowedRoles={["admin", "superadmin", "center"]}><ExamResultPage /></ProtectedRoute>} />
      <Route path="/dashboard/admin/logs" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><ActivityLogsPage /></ProtectedRoute>} />
      <Route path="/dashboard/system/logs" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><ActivityLogsPage /></ProtectedRoute>} />
      <Route path="/dashboard/system/translation-usage" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminTranslationUsagePage /></ProtectedRoute>} />
      <Route path="/dashboard/admin/reviews" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminReviewPage /></ProtectedRoute>} />

      <Route path="/dashboard/staff" element={<ProtectedRoute allowedRoles={["staff"]}><StaffDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/staff/add" element={<ProtectedRoute allowedRoles={["admin", "superadmin", "center"]}><AddStaffPage /></ProtectedRoute>} />
      <Route path="/dashboard/staff/list" element={<ProtectedRoute allowedRoles={["admin", "superadmin", "center"]}><StaffListPage /></ProtectedRoute>} />

      <Route path="/dashboard/system/settings" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminSystemSettingsPage /></ProtectedRoute>} />
      <Route path="/dashboard/system/shop" element={<Navigate to="/dashboard/cms/shop" replace />} />
      <Route path="/dashboard/system/maintenance" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminMaintenancePage /></ProtectedRoute>} />
      <Route path="/dashboard/system/notifications" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminAnnouncementsPage /></ProtectedRoute>} />

      <Route path="/dashboard/crm/enquiries" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminEnquiriesPage /></ProtectedRoute>} />
      <Route path="/dashboard/crm/enquiries/:id" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><AdminEnquiryDetailsPage /></ProtectedRoute>} />
      <Route path="/dashboard/crm/pipeline" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminEnquiryPipelinePage /></ProtectedRoute>} />
      <Route path="/dashboard/crm/reminders" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminEnquiryRemindersPage /></ProtectedRoute>} />
      <Route path="/dashboard/crm/coupons" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCouponsPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/pages" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/slider" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/gallery" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/teachers" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/partners" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/downloads" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/download_categories" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/verification" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/ticker" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/faq" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/idcard_templates" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/shop" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/director_message" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/students" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/universities" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/hero_partners" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCMSPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/blogs" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminBlogListPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/blog-categories" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminBlogCategoriesPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/blogs/new" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminBlogEditorPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/blogs/edit/:slug" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminBlogEditorPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/news" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminNewsListPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/news/new" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminNewsEditorPage /></ProtectedRoute>} />
      <Route path="/dashboard/cms/news/edit/:slug" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminNewsEditorPage /></ProtectedRoute>} />

      <Route
        path="/dashboard/subscriptions"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <SubscriptionPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/disk-usage"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <DiskUsagePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/users/active"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <UserManagementPage type="active" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/users/inactive"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <UserManagementPage type="inactive" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/admins/add"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <AddAdminPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/admins"
        element={
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <AdminListPage />
          </ProtectedRoute>
        }
      />

      <Route path="/dashboard/center"
        element={
          <ProtectedRoute allowedRoles={["center"]}>
            <CenterDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/dashboard/center/profile" element={<ProtectedRoute allowedRoles={["center"]}><CenterProfilePage /></ProtectedRoute>} />
      <Route path="/dashboard/center/profile/update" element={<ProtectedRoute allowedRoles={["center"]}><CenterProfileUpdatePage /></ProtectedRoute>} />

      <Route path="/dashboard/center/batches" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><CenterBatchesPage /></ProtectedRoute>} />
      <Route
  path="/dashboard/center/batches/:batch_id/students"
  element={
    <ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}>
      <CenterBatchStudentsPage />
    </ProtectedRoute>
  }
/>

      {/* Attachment - Marksheet, ID Card */}
      <Route path="/dashboard/attachment/idcard/create" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><AttachmentCreateIdCardPage /></ProtectedRoute>} />
      <Route path="/dashboard/attachment/idcards" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><AttachmentListIdCardsPage /></ProtectedRoute>} />
      {/* Templates / designer — list is /attachments/templates?type=marksheet|id_card */}
      <Route
        path="/dashboard/templates"
        element={
          <ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}>
            <Navigate to="/dashboard/attachments/templates?type=marksheet" replace />
          </ProtectedRoute>
        }
      />
      <Route path="/dashboard/templates/create" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><TemplateCreatePage /></ProtectedRoute>} />
      <Route path="/dashboard/templates/editor/:id" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><TemplateEditorPage /></ProtectedRoute>} />
      {/* Attachments menu shortcuts */}
      <Route path="/dashboard/attachments/templates" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><TemplateListPage /></ProtectedRoute>} />
      <Route
        path="/dashboard/attachments/designer"
        element={
          <ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}>
            <Navigate to="/dashboard/attachments/templates?type=marksheet" replace />
          </ProtectedRoute>
        }
      />
      <Route path="/dashboard/attachments/generate/marksheet" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><GenerateCertificatesPage /></ProtectedRoute>} />
      <Route path="/dashboard/attachments/generate/certificate" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><GenerateCertificatesPage /></ProtectedRoute>} />
      <Route path="/dashboard/attachments/certificates" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><AttachmentListCertificatesPage /></ProtectedRoute>} />
      <Route path="/dashboard/attachments/certificate-designer" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><CertificateDesignerListPage /></ProtectedRoute>} />
      <Route path="/dashboard/attachments/certificate-designer/:id" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><CertificateDesignerCanvasPage /></ProtectedRoute>} />

      {/* Center Role Specific Routes */}
      <Route path="/dashboard/stats/today" element={<ProtectedRoute allowedRoles={["center"]}><CenterTodayStatsPage /></ProtectedRoute>} />
      <Route path="/dashboard/activity" element={<ProtectedRoute allowedRoles={["center"]}><CenterActivityPage /></ProtectedRoute>} />

      <Route path="/dashboard/attendance/register" element={<ProtectedRoute allowedRoles={["center"]}><AttendanceRegisterPage /></ProtectedRoute>} />
      <Route path="/dashboard/attendance/report" element={<ProtectedRoute allowedRoles={["center"]}><AttendanceReportPage /></ProtectedRoute>} />
      <Route path="/dashboard/exam-v2/center" element={<ProtectedRoute allowedRoles={["center"]}><CenterExamV2Page /></ProtectedRoute>} />
      <Route path="/dashboard/center/exam-v2" element={<ProtectedRoute allowedRoles={["center"]}><CenterExamV2Page /></ProtectedRoute>} />
      <Route path="/dashboard/exam-v2/marks-entry" element={<ProtectedRoute allowedRoles={["center"]}><CenterMarksEntryPage /></ProtectedRoute>} />
      <Route path="/dashboard/exams/marks-entry" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><CenterExamMarksEntryPage /></ProtectedRoute>} />
      <Route path="/dashboard/exams/reappear" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><CenterReappearManagementPage /></ProtectedRoute>} />
      <Route path="/dashboard/exams/download-paper" element={<ProtectedRoute allowedRoles={["center"]}><CenterDownloadPaperPage /></ProtectedRoute>} />

      <Route path="/dashboard/students" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><CenterStudentsPage /></ProtectedRoute>} />
      <Route path="/dashboard/students/add" element={<ProtectedRoute allowedRoles={["center"]}><AddStudentPage /></ProtectedRoute>} />
      <Route path="/dashboard/students/edit/:id" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><EditStudentPage /></ProtectedRoute>} />
      <Route path="/dashboard/students/bin" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><StudentRecycleBinPage /></ProtectedRoute>} />
      <Route path="/dashboard/students/marksheets" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><StudentMarksheetsPage /></ProtectedRoute>} />
      <Route path="/dashboard/students/reports" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><CenterStudentsPage /></ProtectedRoute>} />

      {/* Interns Routes */}
      <Route path="/dashboard/interns" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><InternListPage /></ProtectedRoute>} />
      <Route path="/dashboard/interns/add" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><AddInternPage /></ProtectedRoute>} />
      <Route path="/dashboard/interns/edit/:id" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><EditInternPage /></ProtectedRoute>} />
      <Route path="/dashboard/interns/tasks" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><InternTasksManagerPage /></ProtectedRoute>} />
      <Route path="/dashboard/interns/progress" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><InternProgressPage /></ProtectedRoute>} />
      <Route path="/dashboard/interns/enquiries" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminInternshipEnquiriesPage /></ProtectedRoute>} />
      <Route path="/dashboard/interns/colleges" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminCollegesPage /></ProtectedRoute>} />

      {/* Intern Dashboard Routes */}
      <Route
        path="/dashboard/intern"
        element={
          <ProtectedRoute allowedRoles={["intern"]}>
            <InternDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/intern/attendance"
        element={
          <ProtectedRoute allowedRoles={["intern"]}>
            <InternAttendancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/intern/tasks"
        element={
          <ProtectedRoute allowedRoles={["intern"]}>
            <InternTasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/intern/certificates"
        element={
          <ProtectedRoute allowedRoles={["intern"]}>
            <InternCertificatesPage />
          </ProtectedRoute>
        }
      />
      <Route path="/dashboard/students/fees" element={<ProtectedRoute allowedRoles={["center"]}><StudentFeesPage /></ProtectedRoute>} />

      <Route path="/dashboard/students/requests" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><CenterDocumentRequestPage /></ProtectedRoute>} />

      <Route path="/dashboard/leads/:type" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><LeadsPage /></ProtectedRoute>} />

      <Route path="/dashboard/live-classes/schedule" element={<ProtectedRoute allowedRoles={["center"]}><CenterLiveClassesPage /></ProtectedRoute>} />
      <Route path="/dashboard/live-classes/history" element={<ProtectedRoute allowedRoles={["center"]}><CenterLiveClassesPage /></ProtectedRoute>} />

      <Route path="/dashboard/enquiries/new" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><AdminEnquiriesPage /></ProtectedRoute>} />
      <Route path="/dashboard/enquiries/followups" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><AdminEnquiriesPage /></ProtectedRoute>} />
      <Route path="/dashboard/enquiries/converted" element={<ProtectedRoute allowedRoles={["center", "admin", "superadmin"]}><AdminEnquiriesPage /></ProtectedRoute>} />

      <Route path="/dashboard/courses/allotted" element={<ProtectedRoute allowedRoles={["center"]}><CenterAllottedCoursesPage /></ProtectedRoute>} />
      <Route path="/dashboard/courses/subjects" element={<ProtectedRoute allowedRoles={["center"]}><CenterSubjectsPage /></ProtectedRoute>} />
      <Route path="/dashboard/courses/sessions" element={<ProtectedRoute allowedRoles={["center"]}><CenterSessionsPage /></ProtectedRoute>} />
      <Route path="/dashboard/courses/materials" element={<ProtectedRoute allowedRoles={["center"]}><CenterCourseMaterialsPage /></ProtectedRoute>} />

      <Route path="/dashboard/practicals" element={<ProtectedRoute allowedRoles={["center"]}><CenterPracticalsPage /></ProtectedRoute>} />
      <Route path="/dashboard/practicals/create" element={<ProtectedRoute allowedRoles={["center"]}><CenterPracticalsPage /></ProtectedRoute>} />
      <Route path="/dashboard/practicals/submissions" element={<ProtectedRoute allowedRoles={["center"]}><CenterPracticalsPage /></ProtectedRoute>} />

      <Route path="/dashboard/wallet/balance" element={<ProtectedRoute allowedRoles={["center"]}><CenterWalletPage /></ProtectedRoute>} />
      <Route path="/dashboard/wallet/transactions" element={<ProtectedRoute allowedRoles={["center"]}><CenterWalletPage /></ProtectedRoute>} />
      <Route path="/dashboard/wallet/history" element={<ProtectedRoute allowedRoles={["center"]}><CenterWalletPage /></ProtectedRoute>} />

      <Route
        path="/dashboard/student"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />

      {/* Student Role Specific Routes */}
      <Route path="/dashboard/student/progress" element={<ProtectedRoute allowedRoles={["student"]}><StudentProgressPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/courses" element={<ProtectedRoute allowedRoles={["student"]}><StudentCoursesPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/subjects" element={<ProtectedRoute allowedRoles={["student"]}><StudentSubjectsPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/materials" element={<ProtectedRoute allowedRoles={["student"]}><StudentCourseMaterialsPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/recorded" element={<ProtectedRoute allowedRoles={["student"]}><StudentRecordedClassesPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/library" element={<ProtectedRoute allowedRoles={["student"]}><StudentLibraryPage /></ProtectedRoute>} />
      <Route path="/dashboard/library" element={<ProtectedRoute allowedRoles={["admin", "superadmin", "center"]}><LibraryManagementPage /></ProtectedRoute>} />
      <Route path="/dashboard/admin/library" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><LibraryManagementPage /></ProtectedRoute>} />
      <Route path="/dashboard/center/library" element={<ProtectedRoute allowedRoles={["center"]}><LibraryManagementPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/internships" element={<ProtectedRoute allowedRoles={["student"]}><StudentInternshipPortalPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/downloads" element={<ProtectedRoute allowedRoles={["student"]}><DownloadsPage /></ProtectedRoute>} />
      <Route path="/dashboard/internships/manage" element={<ProtectedRoute allowedRoles={["admin", "superadmin", "center"]}><AdminInternshipManagerPage /></ProtectedRoute>} />
      <Route path="/dashboard/admin/internships" element={<ProtectedRoute allowedRoles={["admin", "superadmin"]}><AdminInternshipManagerPage /></ProtectedRoute>} />
      <Route path="/dashboard/center/internships" element={<ProtectedRoute allowedRoles={["center"]}><AdminInternshipManagerPage /></ProtectedRoute>} />

      <Route path="/dashboard/student/typing" element={<ProtectedRoute allowedRoles={["student"]}><TypingPracticePage /></ProtectedRoute>} />
      <Route path="/dashboard/student/typing/history" element={<ProtectedRoute allowedRoles={["student"]}><TypingHistoryPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/typing/leaderboard" element={<ProtectedRoute allowedRoles={["student"]}><TypingLeaderboardPage /></ProtectedRoute>} />

      <Route path="/dashboard/student/live/join" element={<ProtectedRoute allowedRoles={["student"]}><StudentLiveClassesPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/live/schedule" element={<ProtectedRoute allowedRoles={["student"]}><StudentLiveClassesPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/live/history" element={<ProtectedRoute allowedRoles={["student"]}><StudentLiveClassesPage /></ProtectedRoute>} />

      <Route path="/dashboard/student/practicals" element={<ProtectedRoute allowedRoles={["student"]}><StudentPracticalsPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/practicals/submit" element={<ProtectedRoute allowedRoles={["student"]}><StudentPracticalsPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/practicals/history" element={<ProtectedRoute allowedRoles={["student"]}><StudentPracticalsPage /></ProtectedRoute>} />

      <Route path="/dashboard/student/attendance" element={<ProtectedRoute allowedRoles={["student"]}><StudentAttendancePage /></ProtectedRoute>} />
      <Route path="/dashboard/student/attendance/report" element={<ProtectedRoute allowedRoles={["student"]}><StudentAttendanceReportPage /></ProtectedRoute>} />

      <Route path="/dashboard/student/certificates" element={<ProtectedRoute allowedRoles={["student"]}><StudentCertificatesListPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/certificates/download" element={<ProtectedRoute allowedRoles={["student"]}><StudentCertificatesListPage /></ProtectedRoute>} />

      <Route path="/dashboard/student/exams" element={<ProtectedRoute allowedRoles={["student"]}><StudentExamListPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/exams/take/:id" element={<ProtectedRoute allowedRoles={["student"]}><TakeExamPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/exams/results/:id" element={<ProtectedRoute allowedRoles={["student"]}><ExamResultPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/marksheet/:studentId" element={<ProtectedRoute allowedRoles={["student"]}><MarksheetPage /></ProtectedRoute>} />

      <Route path="/dashboard/student/payments/fees" element={<ProtectedRoute allowedRoles={["student"]}><StudentFeeDetailsPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/payments/history" element={<ProtectedRoute allowedRoles={["student"]}><StudentFeeDetailsPage /></ProtectedRoute>} />

      <Route path="/dashboard/student/notifications" element={<ProtectedRoute allowedRoles={["student", "center", "admin", "superadmin"]}><StudentAnnouncementsPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/messages" element={<ProtectedRoute allowedRoles={["student", "center", "admin", "superadmin"]}><MessagingPage /></ProtectedRoute>} />
      <Route path="/dashboard/student/review" element={<ProtectedRoute allowedRoles={["student"]}><StudentReviewPage /></ProtectedRoute>} />

      {/* Public Blog */}
      <Route path="/blog" element={<BlogListPage />} />
      <Route path="/blog/:slug" element={<BlogDetailsPage />} />

      {/* Public News */}
      <Route path="/news" element={<NewsListPage />} />
      <Route path="/news/:slug" element={<NewsDetailsPage />} />

      {/* Public Multi-Pages */}
      <Route path="/about" element={<AboutPage />} />
      <Route path="/courses" element={<CoursesPage />} />
      <Route path="/student-inquiry" element={<StudentInquiryPage />} />
      <Route path="/student-internship" element={<StudentInternshipPage />} />
      <Route path="/franchise" element={<FranchisePage />} />
      <Route path="/courses/student-login" element={<Navigate to="/?login=true" replace />} />
      <Route path="/courses/student-registration" element={<Navigate to="/admission" replace />} />
      <Route path="/courses/:slug" element={<CoursePage />} />
      <Route path="/centers" element={<CentersPage />} />
      <Route path="/centers/:code" element={<CenterPublicDetailsPage />} />
      <Route path="/franchise" element={<FranchisePage />} />
      <Route path="/franchise/why-us" element={<FranchiseWhyUsPage />} />
      <Route path="/franchise/requirements" element={<FranchiseRequirementsPage />} />
      <Route path="/franchise/partners" element={<FranchisePartnersPage />} />
      <Route path="/franchise/support" element={<FranchiseSupportPage />} />
      <Route path="/franchise/investment" element={<FranchiseInvestmentPage />} />
      <Route path="/franchise/apply" element={<FranchiseApplyPage />} />
      <Route path="/dashboard/typing/center-reports" element={<ProtectedRoute allowedRoles={["admin", "superadmin", "center"]}><CenterTypingReportsPage /></ProtectedRoute>} />
      <Route path="/dashboard/typing/leaderboard" element={<ProtectedRoute allowedRoles={["admin", "superadmin", "center"]}><TypingLeaderboardPage /></ProtectedRoute>} />
      <Route path="/dashboard/typing/reports" element={<ProtectedRoute allowedRoles={["admin", "superadmin", "center"]}><CenterTypingReportsPage /></ProtectedRoute>} />
      <Route path="/student-zone" element={<StudentZonePage />} />
      <Route path="/downloads" element={<DownloadsPage />} />
      <Route path="/gallery" element={<GalleryPage />} />
      <Route path="/about/gallery" element={<Navigate to="/gallery" replace />} />
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/admission" element={<AdmissionPage />} />
      <Route path="/verify/:registration_number" element={<VerifyCertificatePage />} />
      <Route path="/verify-certificate/:id" element={<VerifyCertificatePage />} />
      <Route path="/verify/certificate" element={<VerifyCertificatePage />} />
      <Route path="/certificate-verification" element={<VerifyCertificatePage />} />
      <Route path="/verify/student" element={<StudentVerificationPage />} />
      <Route path="/student-verification" element={<StudentVerificationPage />} />
      <Route path="/verify/center" element={<CenterVerificationPage />} />
      <Route path="/center-verification" element={<CenterVerificationPage />} />

      <Route
        path="/dashboard/profile"
        element={
          <ProtectedRoute allowedRoles={["superadmin", "admin", "center", "student"]}>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/privacy"
        element={
          <ProtectedRoute allowedRoles={["superadmin", "admin", "center", "student"]}>
            <PrivacyPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/settings"
        element={
          <ProtectedRoute allowedRoles={["superadmin", "admin", "center", "student"]}>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const LanguageRouteRedirect = ({ lang }: { lang: string }) => {
  const location = useLocation();

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang]);

  const targetPath = location.pathname.replace(/^\/(en|hi)/, "") || "/";
  return <Navigate to={targetPath} replace />;
};

const SmoothScrollTop = () => {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    if (!location.pathname.startsWith("/dashboard")) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.pathname, location.hash]);
  return null;
};

const App = () => {
  useEffect(() => {
    // Clear the portal reload flag on successful load of the app
    sessionStorage.removeItem("portal_reload_on_error");
    syncServerTime();
    const rtlLanguages = ["ar", "ur", "ps", "fa", "he"];
    const updateDocLang = (lng: string) => {
      const normalized = (lng || "en").split("-")[0].toLowerCase();
      document.documentElement.setAttribute("lang", normalized);
      document.documentElement.setAttribute("dir", rtlLanguages.includes(normalized) ? "rtl" : "ltr");
    };

    updateDocLang(i18n.language);
    i18n.on("languageChanged", updateDocLang);
    return () => {
      i18n.off("languageChanged", updateDocLang);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageQueryBridge />
      <LanguageSync />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SmoothScrollTop />
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-background">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Loading Portal...</p>
              </div>
            </div>
          }>
            <AppRoutes />
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

// Helper to redirect to correct role-based dashboard
const DashboardSelector = () => {
  const userStr = sessionStorage.getItem("user");
  let user: any = null;
  try {
    user = userStr && userStr !== "undefined" ? JSON.parse(userStr) : null;
  } catch (e) {
    user = null;
  }
  const role = user?.role?.toLowerCase();

  if (role === "superadmin") return <Navigate to="/dashboard/superadmin" replace />;
  if (role === "admin") return <Navigate to="/dashboard/admin" replace />;
  if (role === "center") return <Navigate to="/dashboard/center" replace />;
  if (role === "student") return <Navigate to="/dashboard/student" replace />;
  if (role === "staff") return <Navigate to="/dashboard/staff" replace />;
  if (role === "intern") return <Navigate to="/dashboard/intern" replace />;

  return <Navigate to="/" replace />;
};

export default App;
