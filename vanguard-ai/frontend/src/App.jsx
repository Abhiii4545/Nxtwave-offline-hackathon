/**
 * App — Root application component with React Router.
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import ScanPage from './pages/ScanPage';
import VulnList from './pages/VulnList';
import VulnDetail from './pages/VulnDetail';
import ChatPage from './pages/ChatPage';
import ReportsPage from './pages/ReportsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/landing" element={<Landing />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard/:scanId" element={<Dashboard />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/vulnerabilities" element={<VulnList />} />
            <Route path="/vulnerabilities/:id" element={<VulnDetail />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
