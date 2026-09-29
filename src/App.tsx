import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AzaBotWidget from "@/components/AzaBot/AzaBotWidget";
import LoginPortalPage from "./pages/auth/LoginPortalPage.tsx";
import SignupUnifiedPage from "./pages/auth/SignupUnifiedPage.tsx";
import VerifyPage from "./pages/auth/VerifyPage.tsx";
import ResolvePage from "./pages/auth/ResolvePage.tsx";
import OAuthConsentPage from "./pages/auth/OAuthConsentPage.tsx";
import SettingsPage from "./pages/auth/SettingsPage.tsx";
import SecurityPage from "./pages/auth/SecurityPage.tsx";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage.tsx";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import AdminLayout from "./pages/admin/AdminLayout.tsx";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage.tsx";
import AuthAdminPage from "./pages/admin/AuthAdminPage.tsx";
import WebhooksAdminPage from "./pages/admin/WebhooksAdminPage.tsx";
import AppsAdminPage from "./pages/admin/AppsAdminPage.tsx";
import AuditAdminPage from "./pages/admin/AuditAdminPage.tsx";
import ApiGatewayPage from "./pages/admin/ApiGatewayPage.tsx";
import DatabasePage from "./pages/admin/DatabasePage.tsx";
import UsersAdminPage from "./pages/admin/UsersAdminPage.tsx";
import AuthAgentAdminPage from "./pages/admin/AuthAgentAdminPage.tsx";
import PortalRefreshPage from "./pages/portal/RefreshPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LoginPortalPage />} />
              <Route path="/signup" element={<SignupUnifiedPage />} />
              <Route path="/verify" element={<VerifyPage />} />
              <Route path="/resolve" element={<ResolvePage />} />
              <Route path="/consent" element={<OAuthConsentPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/sessions" element={<SecurityPage />} />

              {/* Temporary compatibility redirects for previously published URLs. */}
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/auth/login" element={<Navigate to="/" replace />} />
              <Route path="/signup/:type" element={<Navigate to="/signup" replace />} />
              <Route path="/auth/verify" element={<Navigate to="/verify" replace />} />
              <Route path="/auth/success" element={<Navigate to="/resolve" replace />} />
              <Route path="/oauth/consent" element={<OAuthConsentPage />} />
              <Route path="/auth/settings" element={<Navigate to="/settings" replace />} />
              <Route path="/auth/security" element={<Navigate to="/security" replace />} />
              <Route path="/auth/sessions" element={<Navigate to="/sessions" replace />} />
              <Route path="/auth/forgot-password" element={<Navigate to="/forgot-password" replace />} />
              <Route path="/auth/reset-password" element={<Navigate to="/reset-password" replace />} />

              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/portal/refresh" element={<PortalRefreshPage />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverviewPage />} />
                <Route path="users" element={<UsersAdminPage />} />
                <Route path="agent" element={<AuthAgentAdminPage />} />
                <Route path="auth" element={<AuthAdminPage />} />
                <Route path="apps" element={<AppsAdminPage />} />
                <Route path="audit" element={<AuditAdminPage />} />
                <Route path="api" element={<ApiGatewayPage />} />
                <Route path="database" element={<DatabasePage />} />
                <Route path="webhooks" element={<WebhooksAdminPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <AzaBotWidget />
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
