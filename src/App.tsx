import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import SetupPage from "./pages/SetupPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import LinksPage from "./pages/LinksPage";
import LinkDetailPage from "./pages/LinkDetailPage";
import DomainsPage from "./pages/DomainsPage";
import TeamPage from "./pages/TeamPage";
import ApiKeysPage from "./pages/ApiKeysPage";
import ApiDocsPage from "./pages/ApiDocsPage";

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading, needsSetup } = useAuth();
  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to={needsSetup ? "/setup" : "/login"} replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading, needsSetup } = useAuth();

  return (
    <Routes>
      <Route
        path="/setup"
        element={loading ? <FullScreenSpinner /> : user ? <Navigate to="/" replace /> : <SetupPage />}
      />
      <Route
        path="/login"
        element={
          loading ? (
            <FullScreenSpinner />
          ) : user ? (
            <Navigate to="/" replace />
          ) : needsSetup ? (
            <Navigate to="/setup" replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="links" element={<LinksPage />} />
        <Route path="links/:id" element={<LinkDetailPage />} />
        <Route path="domains" element={<DomainsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="api-keys" element={<ApiKeysPage />} />
        <Route path="docs" element={<ApiDocsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
