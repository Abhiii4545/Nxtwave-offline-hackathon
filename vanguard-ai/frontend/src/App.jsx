import React, { Suspense, lazy, Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ScanPage = lazy(() => import('./pages/ScanPage'));
const VulnList = lazy(() => import('./pages/VulnList'));
const VulnDetail = lazy(() => import('./pages/VulnDetail'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

function Loader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="typing-dots"><span /><span /><span /></div>
    </div>
  );
}

class ErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-[18px] font-display font-medium text-white/90 mb-2">Something went wrong</h2>
            <p className="text-[13px] text-white/50 mb-6">An unexpected error occurred.</p>
            <button onClick={() => window.location.reload()} className="btn btn-primary">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<Loader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/landing" element={<Landing />} />
                <Route path="/login" element={<Login />} />

                {/* Authenticated app */}
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard/:scanId" element={<Dashboard />} />
                  <Route path="/scan" element={<ScanPage />} />
                  <Route path="/vulnerabilities" element={<VulnList />} />
                  <Route path="/vulnerabilities/:id" element={<VulnDetail />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
