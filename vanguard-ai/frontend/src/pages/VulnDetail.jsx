/**
 * VulnDetail — Detailed vulnerability view with AI explanation and code fixes.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, RotateCcw,
  ShieldCheck, Terminal, Copy, Check
} from 'lucide-react';
import { getVulnerability, resolveVulnerability } from '../api/client';
import AIExplainPanel from '../components/AIExplainPanel';
import CodeFixViewer from '../components/CodeFixViewer';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="flex items-center gap-1.5 text-[11px] text-white/45 hover:text-white/85 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-[#4ADE80]" strokeWidth={2.5} /> : <Copy className="w-3 h-3" strokeWidth={1.75} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

const riskBorderColors = {
  Critical: '#FF3366',
  High: '#FF9500',
  Medium: '#FFD60A',
  Low: '#00FF88',
  Informational: '#6B7E99',
};

export default function VulnDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vuln, setVuln] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getVulnerability(id)
      .then(setVuln)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleResolve = async () => {
    setResolving(true);
    try {
      const result = await resolveVulnerability(id);
      setVuln((prev) => ({ ...prev, is_resolved: result.is_resolved }));
    } catch (e) {
      console.error('Failed to resolve:', e);
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="typing-dots"><span /><span /><span /></div>
      </div>
    );
  }

  if (!vuln) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted">Vulnerability not found</p>
      </div>
    );
  }

  const risk = vuln.risk || 'Informational';
  const borderColor = riskBorderColors[risk] || '#6B7E99';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/vulnerabilities')}
        className="flex items-center gap-1 text-sm text-text-muted hover:text-accent-cyan transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Vulnerabilities
      </button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
        style={{ borderLeft: `4px solid ${borderColor}` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`risk-${risk.toLowerCase()} px-2.5 py-1 rounded text-xs font-semibold uppercase`}>
                {risk}
              </span>
              {vuln.cweid && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono text-text-muted bg-white/5 border border-vanguard-border">
                  CWE-{vuln.cweid}
                </span>
              )}
              {vuln.wascid && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono text-text-muted bg-white/5 border border-vanguard-border">
                  WASC-{vuln.wascid}
                </span>
              )}
              {vuln.verified && (
                <span className="flex items-center gap-1 text-[11px] text-[#4ADE80] bg-[#4ADE80]/10 border border-[#4ADE80]/25 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" strokeWidth={2} /> Verified
                </span>
              )}
              {vuln.is_resolved && (
                <span className="flex items-center gap-1 text-xs text-accent-low bg-accent-low/10 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3" /> Resolved
                </span>
              )}
            </div>
            <h1 className="text-xl font-display font-bold text-text-primary">{vuln.name}</h1>
          </div>

          <button
            onClick={handleResolve}
            disabled={resolving}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              vuln.is_resolved
                ? 'border border-accent-high/30 text-accent-high hover:bg-accent-high/10'
                : 'bg-accent-low/15 text-accent-low border border-accent-low/30 hover:bg-accent-low/25'
            }`}
          >
            {vuln.is_resolved
              ? <><RotateCcw className="w-3.5 h-3.5" /> Reopen</>
              : <><CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved</>}
          </button>
        </div>

        {/* URL & Param info */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-text-dim uppercase tracking-wider mb-1">URL</p>
            <p className="text-sm text-text-muted font-mono break-all">{vuln.url}</p>
          </div>
          <div>
            <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Parameter</p>
            <p className="text-sm text-text-muted font-mono">{vuln.param || 'N/A'}</p>
          </div>
        </div>

        {/* Proof of finding — observed evidence + reproduction */}
        {(vuln.evidence || vuln.repro_command) && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-3.5 h-3.5 text-white/40" strokeWidth={1.75} />
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Proof of finding</p>
              {vuln.verified && (
                <span className="text-[10px] text-[#4ADE80]">· independently reproducible</span>
              )}
            </div>

            <div className="glass-inset overflow-hidden">
              {vuln.evidence && (
                <div className="px-4 py-3 hairline-b">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/35 mb-1.5">Observed</p>
                  <code className="text-[12.5px] text-white/85 font-mono break-all leading-relaxed">
                    {vuln.evidence}
                  </code>
                </div>
              )}

              {vuln.repro_command && (
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">Reproduce</p>
                    <CopyButton text={vuln.repro_command} />
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#4ADE80]/70 font-mono text-[12.5px] select-none">$</span>
                    <code className="text-[12.5px] text-[#7BB8FF] font-mono break-all leading-relaxed">
                      {vuln.repro_command}
                    </code>
                  </div>
                </div>
              )}
            </div>
            <p className="text-[11px] text-white/35 mt-2">
              Run this against the target to confirm the finding yourself — no trust required.
            </p>
          </div>
        )}

        {/* Description */}
        {vuln.description && (
          <div className="mt-4">
            <p className="text-xs text-text-dim uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-text-muted leading-relaxed">{vuln.description}</p>
          </div>
        )}
      </motion.div>

      {/* AI Analysis + Code Fix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <AIExplainPanel
            vulnId={vuln.id}
            existingExplanation={vuln.ai_explanation}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <CodeFixViewer
            vulnId={vuln.id}
            existingFixes={{
              python: vuln.ai_fix_python,
              javascript: vuln.ai_fix_javascript,
              java: vuln.ai_fix_java,
            }}
          />
        </motion.div>
      </div>

      {/* Solution */}
      {vuln.solution && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-accent-medium" />
            Recommended Solution
          </h3>
          <p className="text-sm text-text-muted leading-relaxed">{vuln.solution}</p>
        </motion.div>
      )}

      {/* Business Impact */}
      {vuln.business_impact && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6 border-accent-high/30"
          style={{ background: 'rgba(255, 149, 0, 0.05)' }}
        >
          <h3 className="text-sm font-semibold text-accent-high mb-2">💼 Business Impact</h3>
          <p className="text-sm text-text-muted leading-relaxed">{vuln.business_impact}</p>
        </motion.div>
      )}
    </div>
  );
}
