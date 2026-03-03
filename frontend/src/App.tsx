import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/context/AuthContext';
import { UserLayout } from '@/components/layouts/UserLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminRoute } from '@/components/AdminRoute';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ConfirmPage } from '@/pages/ConfirmPage';
import { SearchPage } from '@/pages/SearchPage';
import { MediaDetailPage } from '@/pages/MediaDetailPage';
import { RequestsPage } from '@/pages/RequestsPage';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { RequestQueuePage } from '@/pages/admin/RequestQueuePage';
import { SettingsPage } from '@/pages/admin/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="bottom-right" theme="dark" richColors />
        <Routes>
          {/* Public routes inside UserLayout */}
          <Route element={<UserLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/confirm" element={<ConfirmPage />} />
            {/* Authenticated routes */}
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <SearchPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/search/:mediaType/:id"
              element={
                <ProtectedRoute>
                  <MediaDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests"
              element={
                <ProtectedRoute>
                  <RequestsPage />
                </ProtectedRoute>
              }
            />

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Admin routes inside AdminLayout */}
          <Route
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route path="/admin" element={<DashboardPage />} />
            <Route path="/admin/requests" element={<RequestQueuePage />} />
            <Route path="/admin/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
