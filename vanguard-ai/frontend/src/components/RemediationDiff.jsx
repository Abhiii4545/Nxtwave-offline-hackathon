/**
 * RemediationDiff — Compares a scan to the previous scan of the same target,
 * proving what was fixed, what's new, and what still persists.
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Plus, Minus, GitCompareArrows } from 'lucide-react';
import { getScanDiff } from '../api/client';

const riskColor = (r) =>
  ({ Critical: '#F87171', High: '#FB923C', Medium: '#FBBF24', Low: '#4ADE80', Informational: '#94A3B8' }[r] || '#94A3B8');

export default function RemediationDiff({ scanId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scanId) return;
    setLoading(true);
    getScanDiff(scanId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [scanId]);

  if (loading || !data) return null;

  // First scan of a target — nothing to compare against yet.
  if (!data.has_baseline) {
    return (
      <div className="glass p-6">
        <h3 className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-3 flex items-center gap-2">
          <GitCompareArrows className="w-3.5 h-3.5" strokeWidth={1.75} />
          Remediation
        </h3>
        <p className="text-[13px] text-white/45 leading-relaxed">
          This is the first assessment of this target. Rescan the same URL after
          applying fixes and Vanguard will prove exactly what changed.
        </p>
      </div>
    );
  }

  const summary = data.summary || {};
  const fixed = data.fixed || [];
  const added = data.new || [];
  const persisting = data.persisting || [];
  const scoreDelta =
    data.current_score != null && data.previous_score != null
      ? Math.round((data.current_score - data.previous_score) * 10) / 10
      : null;

  return (
    <div className="glass p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[10px] uppercase tracking-[0.14em] text-white/40 flex items-center gap-2">
          <GitCompareArrows className="w-3.5 h-3.5" strokeWidth={1.75} />
          Remediation vs. previous scan
        </h3>
        {scoreDelta != null && (
          <span
            className="text-[12px] font-mono numeric flex items-center gap-1"
            style={{ color: scoreDelta >= 0 ? '#4ADE80' : '#F87171' }}
          >
            {data.previous_score}
            <ArrowRight className="w-3 h-3 text-white/30" />
            {data.current_score}
            <span className="ml-1">
              ({scoreDelta >= 0 ? '+' : ''}{scoreDelta})
            </span>
          </span>
        )}
      </div>

      {/* Tally */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <Tally n={summary.fixed ?? 0} label="Fixed" color="#4ADE80" icon={Check} />
        <Tally n={summary.new ?? 0} label="New" color="#F87171" icon={Plus} />
        <Tally n={summary.persisting ?? 0} label="Persisting" color="#94A3B8" icon={Minus} />
      </div>

      <div className="space-y-4">
        {fixed.length > 0 && (
          <DiffGroup title="Fixed" color="#4ADE80" items={fixed} strike />
        )}
        {added.length > 0 && (
          <DiffGroup title="Newly introduced" color="#F87171" items={added} />
        )}
        {persisting.length > 0 && (
          <DiffGroup title="Still present" color="#94A3B8" items={persisting} muted />
        )}
      </div>
    </div>
  );
}

function Tally({ n, label, color, icon: Icon }) {
  return (
    <div className="glass-inset px-3 py-3 text-center">
      <div className="flex items-center justify-center gap-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={2} />
        <span className="text-[22px] font-display font-medium numeric leading-none" style={{ color }}>
          {n}
        </span>
      </div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-white/40 mt-1.5">{label}</p>
    </div>
  );
}

function DiffGroup({ title, color, items, strike, muted }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] mb-2" style={{ color }}>
        {title}
      </p>
      <div className="space-y-1">
        {items.slice(0, 6).map((v, i) => (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.02]"
          >
            <span
              className="w-1 h-1 rounded-full flex-shrink-0"
              style={{ background: riskColor(v.risk) }}
            />
            <span
              className={`text-[12.5px] truncate ${
                muted ? 'text-white/50' : 'text-white/85'
              } ${strike ? 'line-through text-white/45' : ''}`}
            >
              {v.name}
            </span>
            {v.param && (
              <span className="text-[10px] font-mono text-white/30 truncate ml-auto flex-shrink-0">
                {v.param}
              </span>
            )}
          </motion.div>
        ))}
        {items.length > 6 && (
          <p className="text-[11px] text-white/30 px-3 pt-1">+{items.length - 6} more</p>
        )}
      </div>
    </div>
  );
}
