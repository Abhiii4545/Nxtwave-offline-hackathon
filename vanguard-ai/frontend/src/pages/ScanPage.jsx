/**
 * ScanPage — Trigger scans and monitor progress. Considered, minimal.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, ChevronRight, Sparkles, X, Clock, Loader2, Radar,
} from 'lucide-react';
import { startScan, getScanStatus, getAllScans, seedDatabase } from '../api/client';
import useStore from '../store/useStore';
import ScanProgress from '../components/ScanProgress';
import SecuritySuggestions from '../components/SecuritySuggestions';

export default function ScanPage() {
  const navigate = useNavigate();
  const { scanStatus, scanProgress, updateScanProgress, setCurrentScan, resetScan } = useStore();
  const [scanId, setScanId] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [error, setError] = useState(null);
  const [targetUrl, setTargetUrl] = useState('');
  const [displayProgress, setDisplayProgress] = useState(0);
  const [waking, setWaking] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    getAllScans().then((d) => setScanHistory(Array.isArray(d) ? d : [])).catch(console.error);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Smooth, realistic progress: continuously ease toward the real backend
  // progress and gently trickle forward so the bar never appears frozen
  // between the (slower) status polls.
  useEffect(() => {
    if (scanStatus !== 'running' && scanStatus !== 'completed') {
      setDisplayProgress(0);
      return;
    }
    const id = setInterval(() => {
      setDisplayProgress((prev) => {
        const completed = scanStatus === 'completed';
        const target = completed ? 100 : scanProgress;
        // Ease toward the real target …
        let next = prev + (target - prev) * 0.14;
        // … and keep a slow trickle so it always feels alive mid-scan.
        if (!completed && next < 90) next += 0.45;
        const cap = completed ? 100 : 94;
        next = Math.min(next, cap);
        if (completed && next > 99.4) next = 100;
        return next;
      });
    }, 90);
    return () => clearInterval(id);
  }, [scanProgress, scanStatus]);

  const handleStartScan = async () => {
    const url = targetUrl.trim();
    if (!url) {
      setError('Enter a target URL to begin.');
      return;
    }
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      setError('That URL doesn\'t look right — try https://example.com');
      return;
    }
    setError(null);
    setWaking(false);
    // The free-tier backend spins down when idle; if the first request is slow,
    // it's waking up — surface that instead of a silently frozen progress bar.
    const wakeTimer = setTimeout(() => setWaking(true), 4000);
    try {
      setDisplayProgress(0);
      updateScanProgress(0, 'running');
      const data = await startScan(url);
      clearTimeout(wakeTimer);
      setScanId(data.scan_id);
      setCurrentScan(data);

      intervalRef.current = setInterval(async () => {
        try {
          const status = await getScanStatus(data.scan_id);
          setWaking(false);
          updateScanProgress(status.progress, status.status);
          if (status.status === 'completed') {
            clearInterval(intervalRef.current);
            setScanResult(status);
            getAllScans().then((d) => setScanHistory(Array.isArray(d) ? d : []));
          } else if (status.status === 'failed') {
            clearInterval(intervalRef.current);
            setError('Scan failed. Verify the target URL and retry.');
          }
        } catch {
          // Backend likely cold-starting — keep polling, but tell the user why.
          setWaking(true);
        }
      }, 1200);
    } catch {
      clearTimeout(wakeTimer);
      setError('Could not reach the scanner. The free-tier backend may be waking from sleep — wait a moment and try again.');
      resetScan();
    }
  };

  const handleSeedData = async () => {
    try {
      const data = await seedDatabase();
      setScanResult({
        total_vulns: data.total_vulns,
        security_score: data.security_score,
        status: 'completed',
        scan_id: data.scan_id,
      });
      setScanId(data.scan_id);
      updateScanProgress(100, 'completed');
      getAllScans().then(setScanHistory);
    } catch {
      setError('Failed to load demo data.');
    }
  };

  // ── Completed state ──
  if (scanStatus === 'completed' && scanResult) {
    const id = scanId || scanResult?.scan_id || scanResult?.id;
    return (
      <div className="max-w-xl mx-auto pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <div className="inline-flex w-12 h-12 rounded-full items-center justify-center bg-[#4ADE80]/10 border border-[#4ADE80]/25 mb-6">
            <Check className="w-5 h-5 text-[#4ADE80]" strokeWidth={2} />
          </div>

          <h1 className="text-[28px] font-display font-medium tracking-tight text-white/95 mb-2">
            Assessment complete
          </h1>
          <p className="text-[14px] text-white/55 mb-10">
            Found {scanResult.total_vulns} finding{scanResult.total_vulns === 1 ? '' : 's'} on your target.
          </p>

          {/* Score card */}
          <div className="glass-elevated p-8 mb-8">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-3">
              Security Score
            </p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-[56px] font-serif font-normal text-white/95 leading-none numeric">
                {scanResult.security_score}
              </span>
              <span className="text-[18px] text-white/30 font-mono">/100</span>
            </div>
          </div>

          <div className="flex gap-2 justify-center">
            <button
              onClick={() => navigate(id ? `/dashboard/${id}` : '/')}
              className="btn btn-primary"
            >
              View report
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                resetScan();
                setScanResult(null);
              }}
              className="btn btn-secondary"
            >
              New scan
            </button>
          </div>
        </motion.div>

        {id && (
          <div className="mt-16">
            <SecuritySuggestions scanId={id} />
          </div>
        )}
      </div>
    );
  }

  // ── Running state ──
  if (scanStatus === 'running') {
    const pct = Math.round(displayProgress);
    const stages = [
      { label: 'Connecting to target', at: 8 },
      { label: 'Analyzing response headers', at: 25 },
      { label: 'Inspecting TLS configuration', at: 45 },
      { label: 'Testing for misconfigurations', at: 65 },
      { label: 'Probing sensitive paths', at: 80 },
      { label: 'Generating analysis', at: 92 },
    ];
    return (
      <div className="max-w-xl mx-auto pt-24">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          {/* Radar loader */}
          <div className="relative w-20 h-20 mx-auto mb-8 radar-pulse">
            <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
            <div className="absolute inset-2 rounded-full border border-white/[0.05]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Radar className="w-7 h-7 text-[#7BB8FF] animate-spin" style={{ animationDuration: '3s' }} strokeWidth={1.5} />
            </div>
          </div>

          <p className="text-[10px] uppercase tracking-[0.16em] text-white/40 mb-3">
            In progress
          </p>
          <h1 className="text-[24px] font-display font-medium tracking-tight text-white/95 mb-1">
            Assessing your target
          </h1>
          <p className="text-[13px] font-mono text-white/45 mb-10 truncate">
            {targetUrl}
          </p>

          <div className="glass p-6 mb-6 text-left">
            <ScanProgress progress={pct} status={scanStatus} />

            {/* Cold-start notice — the free-tier backend can take ~50s to wake */}
            {waking && (
              <div className="mt-4 flex items-start gap-2 text-[12px] text-[#7BB8FF]">
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0 mt-px" />
                <span>
                  Waking the scanner — the free-tier backend sleeps when idle and can take
                  up to a minute on the first request. Hang tight, this won't happen again while it's warm.
                </span>
              </div>
            )}

            {/* Stage checklist that lights up as the scan advances */}
            <div className="mt-6 pt-5 hairline-t space-y-2.5">
              {stages.map((s) => {
                const done = pct >= s.at + 6;
                const active = !done && pct >= s.at - 6;
                return (
                  <div key={s.label} className="flex items-center gap-3">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        done
                          ? 'bg-[#4ADE80]/15 border border-[#4ADE80]/30'
                          : active
                          ? 'bg-[#7BB8FF]/15 border border-[#7BB8FF]/30'
                          : 'bg-white/[0.03] border border-white/[0.06]'
                      }`}
                    >
                      {done ? (
                        <Check className="w-2.5 h-2.5 text-[#4ADE80]" strokeWidth={2.5} />
                      ) : active ? (
                        <Loader2 className="w-2.5 h-2.5 text-[#7BB8FF] animate-spin" />
                      ) : (
                        <span className="w-1 h-1 rounded-full bg-white/25" />
                      )}
                    </span>
                    <span
                      className={`text-[12.5px] transition-colors ${
                        done ? 'text-white/50' : active ? 'text-white/90' : 'text-white/30'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => {
              if (intervalRef.current) clearInterval(intervalRef.current);
              resetScan();
            }}
            className="inline-flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="w-3 h-3" />
            Cancel assessment
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Ready state ──
  return (
    <div className="space-y-16">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-[#7BB8FF]" strokeWidth={1.75} />
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
            New assessment
          </span>
        </div>
        <h1 className="text-[32px] font-display font-medium tracking-tight text-white/95 mb-2">
          What would you like to scan?
        </h1>
        <p className="text-[14px] text-white/50 max-w-md">
          Vanguard runs real HTTP security checks against your target — headers, TLS, cookies, CORS, sensitive paths — and pairs the findings with AI analysis.
        </p>
      </motion.header>

      {/* Input card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="max-w-2xl"
      >
        <div className="glass-elevated p-2">
          <div className="flex items-center gap-2">
            <div className="pl-4 pr-1 text-white/30">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.25" />
                <path d="M3 8h10M8 3c1.5 1.5 2.5 3.5 2.5 5s-1 3.5-2.5 5c-1.5-1.5-2.5-3.5-2.5-5s1-3.5 2.5-5z" stroke="currentColor" strokeWidth="1.25" />
              </svg>
            </div>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartScan()}
              placeholder="https://example.com"
              className="flex-1 bg-transparent border-none outline-none text-[15px] font-mono text-white/95 placeholder-white/25 py-3"
            />
            <button
              onClick={handleStartScan}
              disabled={!targetUrl.trim()}
              className="btn btn-primary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Start scan
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 px-1">
          <div className="flex items-center gap-1.5">
            <span className="chip">Headers</span>
            <span className="chip">TLS</span>
            <span className="chip">Cookies</span>
            <span className="chip">CORS</span>
            <span className="chip">Paths</span>
          </div>
          <button
            onClick={handleSeedData}
            className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
          >
            Load demo data →
          </button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-[13px] text-[#F87171] flex items-center gap-2"
            >
              <div className="w-1 h-1 rounded-full bg-[#F87171]" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* History */}
      {scanHistory.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="flex items-baseline justify-between mb-4 max-w-3xl">
            <div>
              <h2 className="text-[15px] font-display font-medium tracking-tight text-white/90">
                Recent assessments
              </h2>
              <p className="text-[12px] text-white/40 mt-0.5">
                Click any past scan to open its full report
              </p>
            </div>
            <span className="text-[11px] text-white/35 font-mono numeric">
              {scanHistory.length}
            </span>
          </div>

          <div className="glass overflow-hidden max-w-3xl divide-y divide-white/[0.05]">
            {scanHistory.slice(0, 8).map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/dashboard/${s.id}`)}
                className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors group"
              >
                <div className="flex-shrink-0">
                  <ScoreBadge score={s.security_score} status={s.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-mono text-white/85 truncate">
                    {s.target_url}
                  </p>
                  <p className="text-[11px] text-white/35 mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-2.5 h-2.5" strokeWidth={1.75} />
                    {s.started_at ? new Date(s.started_at).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    }) : '—'}
                    <span className="text-white/20">·</span>
                    {s.total_vulns} finding{s.total_vulns === 1 ? '' : 's'}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-white/60 transition-colors flex-shrink-0" strokeWidth={1.75} />
              </button>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}

function ScoreBadge({ score, status }) {
  if (status !== 'completed' || score == null) {
    return (
      <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-[10px] text-white/30">
        —
      </div>
    );
  }
  const color = score >= 80 ? '#4ADE80' : score >= 60 ? '#FBBF24' : score >= 40 ? '#FB923C' : '#F87171';
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-mono numeric border"
      style={{
        backgroundColor: `${color}12`,
        borderColor: `${color}30`,
        color,
      }}
    >
      {Math.round(score)}
    </div>
  );
}
