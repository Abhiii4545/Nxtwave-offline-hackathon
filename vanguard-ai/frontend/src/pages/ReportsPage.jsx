/**
 * ReportsPage — Download security reports and view compliance status.
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Code2, Download, Loader2, Shield, Check, ArrowRight,
} from 'lucide-react';
import { downloadPDF, downloadJSON, getDashboardStats } from '../api/client';
import useStore from '../store/useStore';
import { CountUp, SpotlightCard, Reveal } from '../components/ui/Motion';

export default function ReportsPage() {
  const { dashboardStats, setDashboardStats } = useStore();
  const [pdf, setPdf] = useState('idle'); // idle | loading | done
  const [json, setJson] = useState('idle');

  useEffect(() => {
    if (!dashboardStats) {
      getDashboardStats().then(setDashboardStats).catch(console.error);
    }
  }, []);

  const scanId = dashboardStats?.latest_scan?.id;

  const run = async (fn, set) => {
    if (!scanId) return;
    set('loading');
    try {
      await fn(scanId);
      set('done');
      setTimeout(() => set('idle'), 2200);
    } catch (e) {
      console.error('Download failed:', e);
      set('idle');
    }
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <div>
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">Export</span>
        <h1 className="text-[28px] font-display font-medium tracking-tight text-white/95 mt-2">
          Security reports
        </h1>
        <p className="text-[13px] text-white/50 mt-1.5">
          Board-ready and machine-readable, generated from real scan data
        </p>
      </div>

      {!scanId && (
        <div className="glass p-10 text-center">
          <Shield className="w-9 h-9 text-white/20 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-[13px] text-white/45">No scan data yet. Run a scan first to generate reports.</p>
        </div>
      )}

      {scanId && (
        <>
          {/* Download cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReportCard
              icon={FileText}
              color="#F87171"
              title="Executive report"
              desc="Full vulnerability assessment with AI explanations, business impact, compliance mapping, and a remediation roadmap."
              format="PDF"
              state={pdf}
              onClick={() => run(downloadPDF, setPdf)}
              delay={0}
            />
            <ReportCard
              icon={Code2}
              color="#7BB8FF"
              title="Machine-readable"
              desc="Complete scan data in JSON for CI/CD pipelines, automated tracking, and custom tooling."
              format="JSON"
              state={json}
              onClick={() => run(downloadJSON, setJson)}
              delay={0.08}
            />
          </div>

          {/* Compliance */}
          <Reveal delay={0.15}>
            <h2 className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-4 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-white/35" strokeWidth={1.75} />
              Compliance coverage
            </h2>
            <div className="space-y-3">
              {[
                { label: 'OWASP Top 10', key: 'owasp_top10' },
                { label: 'PCI DSS', key: 'pci_dss' },
                { label: 'ISO 27001', key: 'iso27001' },
                { label: 'SOC 2', key: 'soc2' },
              ].map(({ label, key }, i) => {
                const value = dashboardStats?.compliance?.[key] ?? 0;
                const color = value >= 80 ? '#4ADE80' : value >= 50 ? '#FBBF24' : '#F87171';
                const status = value >= 80 ? 'Compliant' : value >= 50 ? 'Partial' : 'Non-compliant';
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.06 }}
                    className="glass p-4"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[13px] text-white/85">{label}</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px]" style={{ color }}>{status}</span>
                        <span className="text-[13px] font-mono numeric" style={{ color }}>
                          <CountUp to={value} duration={1.1} />%
                        </span>
                      </div>
                    </div>
                    <div className="h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${value}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 + i * 0.08 }}
                        className="h-full rounded-full"
                        style={{ background: color }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Reveal>
        </>
      )}
    </div>
  );
}

function ReportCard({ icon: Icon, color, title, desc, format, state, onClick, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <SpotlightCard className="glass p-6 h-full flex flex-col" tint={`${color}22`}>
        <div className="flex items-start justify-between mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
            <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.5} />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">{format}</span>
        </div>
        <h3 className="text-[16px] font-medium text-white/92 mb-2">{title}</h3>
        <p className="text-[13px] text-white/50 leading-relaxed mb-6 flex-1">{desc}</p>
        <button
          onClick={onClick}
          disabled={state === 'loading'}
          className="w-full px-4 py-2.5 rounded-lg font-medium text-[13px] flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed"
          style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
        >
          {state === 'loading' ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
          ) : state === 'done' ? (
            <><Check className="w-4 h-4" strokeWidth={2.5} /> Downloaded</>
          ) : (
            <><Download className="w-4 h-4" /> Download {format}</>
          )}
        </button>
      </SpotlightCard>
    </motion.div>
  );
}
