/**
 * ChatPage — AI Security Assistant chat interface.
 */

import React, { useEffect, useState } from 'react';
import { Bot, Cpu } from 'lucide-react';
import ChatInterface from '../components/ChatInterface';
import useStore from '../store/useStore';
import { getDashboardStats } from '../api/client';

export default function ChatPage() {
  const { dashboardStats, setDashboardStats } = useStore();
  const scanId = dashboardStats?.latest_scan?.id;

  useEffect(() => {
    if (!dashboardStats) {
      getDashboardStats().then(setDashboardStats).catch(console.error);
    }
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 hairline-b">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-[#C4B5FD]/12 border border-[#C4B5FD]/25 flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#C4B5FD]" strokeWidth={1.75} />
            <span className="absolute -top-0.5 -right-0.5 flex">
              <span className="w-2 h-2 rounded-full bg-[#4ADE80]" />
              <span className="absolute inset-0 rounded-full bg-[#4ADE80] animate-ping opacity-60" />
            </span>
          </div>
          <div>
            <h1 className="text-[16px] font-display font-medium tracking-tight text-white/95">
              AI Security Assistant
            </h1>
            <p className="text-[11px] text-white/45 flex items-center gap-1.5 mt-0.5">
              <Cpu className="w-3 h-3" strokeWidth={1.75} />
              Llama 3.3 70B · online
            </p>
          </div>
        </div>

        {scanId && (
          <span className="text-[11px] text-white/60 bg-white/[0.04] px-3 py-1.5 rounded-full border border-white/[0.08] font-mono">
            Scan #{scanId} in context
          </span>
        )}
      </div>

      {/* Chat */}
      <div className="flex-1 min-h-0">
        <ChatInterface scanId={scanId} />
      </div>
    </div>
  );
}
