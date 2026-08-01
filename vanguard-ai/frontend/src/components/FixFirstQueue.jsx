/**
 * FixFirstQueue — Ranks unresolved findings by a computed priority
 * (severity × verification confidence) so the user always knows what to fix next.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ListChecks, ArrowUpRight } from 'lucide-react';
import { getVulnerabilities } from '../api/client';

const SEVERITY_WEIGHT = { Critical: 100, High: 70, Medium: 40, Low: 15, Informational: 5 };
const riskColor = (r) =>
  ({ Critical: '#F87171', High: '#FB923C', Medium: '#FBBF24', Low: '#4ADE80', Informational: '#94A3B8' }[r] || '#94A3B8');

function priorityScore(v) {
  const base = SEVERITY_WEIGHT[v.risk] ?? 5;
  // Verified findings are actionable now; unverified are discounted so noise
  // never outranks a proven issue.
  const confidence = v.verified ? 1 : 0.6;
  return Math.round(base * confidence);
}

export default function FixFirstQueue({ scanId }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scanId) return;
    setLoading(true);
    getVulnerabilities({ scan_id: scanId, resolved: false, limit: 100 })
      .then((res) => {
        const ranked = (res.vulnerabilities || [])
          .map((v) => ({ ...v, _score: priorityScore(v) }))
          .sort((a, b) => b._score - a._score)
          .slice(0, 5);
        setItems(ranked);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [scanId]);

  if (loading || items.length === 0) return null;

  const max = items[0]?._score || 100;

  return (
    <div className="glass p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[10px] uppercase tracking-[0.14em] text-white/40 flex items-center gap-2">
          <ListChecks className="w-3.5 h-3.5" strokeWidth={1.75} />
          Fix first — prioritized queue
        </h3>
        <span className="text-[10px] text-white/30">severity × confidence</span>
      </div>

      <div className="space-y-1.5">
        {items.map((v, i) => (
          <motion.button
            key={v.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => navigate(`/vulnerabilities/${v.id}`)}
            className="w-full group flex items-center gap-3.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors text-left"
          >
            <span className="text-[13px] font-mono text-white/25 numeric w-4 flex-shrink-0">
              {i + 1}
            </span>

            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: riskColor(v.risk), boxShadow: `0 0 8px ${riskColor(v.risk)}` }}
            />

            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-white/90 truncate group-hover:text-white transition-colors">
                {v.name}
              </p>
              {/* Priority bar */}
              <div className="h-[2px] mt-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: riskColor(v.risk) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(8, (v._score / max) * 100)}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.05 }}
                />
              </div>
            </div>

            <span
              className="text-[10px] uppercase tracking-[0.08em] flex-shrink-0"
              style={{ color: riskColor(v.risk) }}
            >
              {v.risk}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/60 transition-colors flex-shrink-0" strokeWidth={1.75} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
