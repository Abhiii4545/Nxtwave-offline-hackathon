/**
 * Sidebar — Glass nav rail with quiet type and considered spacing.
 */

import React, { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard, ScanLine, ShieldAlert, MessageSquare, FileText, LogOut,
} from 'lucide-react';
import { healthCheck } from '../api/client';
import useStore from '../store/useStore';
import { useAuth } from '../auth/AuthContext';

const navLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/scan', icon: ScanLine, label: 'New Scan' },
  { to: '/vulnerabilities', icon: ShieldAlert, label: 'Vulnerabilities' },
  { to: '/chat', icon: MessageSquare, label: 'Assistant' },
  { to: '/reports', icon: FileText, label: 'Reports' },
];

export default function Sidebar() {
  const [apiConnected, setApiConnected] = useState(false);
  const scanStatus = useStore((s) => s.scanStatus);
  const dashboardStats = useStore((s) => s.dashboardStats);
  const { user, logout } = useAuth();

  useEffect(() => {
    const checkApi = async () => {
      try {
        await healthCheck();
        setApiConnected(true);
      } catch {
        setApiConnected(false);
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 15000);
    return () => clearInterval(interval);
  }, []);

  const score = dashboardStats?.security_score ?? '—';

  return (
    <aside className="w-[232px] min-w-[232px] h-screen flex flex-col relative">
      {/* Vertical hairline */}
      <div className="absolute top-0 right-0 bottom-0 w-px bg-white/[0.05]" />

      {/* Brand — links to the landing page */}
      <div className="px-6 pt-8 pb-10">
        <Link
          to="/landing"
          title="Go to landing page"
          className="flex items-center gap-2.5 group focus-ring rounded-lg"
        >
          <div className="relative w-7 h-7 rounded-lg overflow-hidden transition-transform group-hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-br from-[#7BB8FF] to-[#C4B5FD] opacity-90" />
            <div className="absolute inset-[1px] rounded-[7px] bg-[#07090F]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-[#7BB8FF] to-[#C4B5FD]" />
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-medium tracking-tight text-white/92 group-hover:text-white transition-colors">
              Vanguard
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/38 mt-1">
              Security · AI
            </span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3">
        <div className="px-3 mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/38">
          Workspace
        </div>
        <div className="space-y-0.5">
          {navLinks.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-white/95 bg-white/[0.05]'
                    : 'text-white/55 hover:text-white/90 hover:bg-white/[0.03]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-white/70 rounded-r" />
                  )}
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-white/85' : 'text-white/45 group-hover:text-white/75'
                    }`}
                    strokeWidth={1.75}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Bottom status card */}
      <div className="p-4">
        <div className="glass p-3.5 space-y-2.5">
          <StatusRow label="Status">
            <span className="flex items-center gap-1.5 text-[11px] text-white/85">
              <span className="relative flex">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    scanStatus === 'running'
                      ? 'bg-[#7BB8FF]'
                      : scanStatus === 'completed'
                      ? 'bg-[#4ADE80]'
                      : 'bg-white/30'
                  }`}
                />
                {scanStatus === 'running' && (
                  <span className="absolute inset-0 rounded-full bg-[#7BB8FF] animate-ping opacity-60" />
                )}
              </span>
              {scanStatus === 'running'
                ? 'Scanning'
                : scanStatus === 'completed'
                ? 'Ready'
                : 'Idle'}
            </span>
          </StatusRow>

          <StatusRow label="Score">
            <span className="text-[11px] font-mono text-white/85 numeric">
              {score}
              <span className="text-white/30">/100</span>
            </span>
          </StatusRow>

          <StatusRow label="API">
            <span
              className={`flex items-center gap-1.5 text-[11px] ${
                apiConnected ? 'text-white/85' : 'text-[#F87171]'
              }`}
            >
              <span
                className={`w-1 h-1 rounded-full ${
                  apiConnected ? 'bg-[#4ADE80]' : 'bg-[#F87171]'
                }`}
              />
              {apiConnected ? 'Live' : 'Offline'}
            </span>
          </StatusRow>
        </div>

        {/* Signed-in user + logout */}
        {user && (
          <div className="mt-2 flex items-center gap-2.5 px-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-[#7BB8FF]/30 to-[#C4B5FD]/30 border border-white/10 text-[11px] font-medium text-white/85 shrink-0">
              {(user.email || '?').charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 min-w-0 text-[11.5px] text-white/60 truncate" title={user.email || ''}>
              {user.email}
            </span>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 rounded-md text-white/40 hover:text-[#F87171] hover:bg-white/[0.04] transition-colors focus-ring"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function StatusRow({ label, children }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-[0.12em] text-white/38">{label}</span>
      {children}
    </div>
  );
}
