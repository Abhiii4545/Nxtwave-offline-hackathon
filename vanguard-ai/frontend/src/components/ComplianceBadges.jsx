/**
 * ComplianceBadges — Compact compliance rows with hairline progress.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { CountUp } from './ui/Motion';

const frameworks = [
  { key: 'owasp_top10', label: 'OWASP Top 10' },
  { key: 'pci_dss', label: 'PCI DSS' },
  { key: 'iso27001', label: 'ISO 27001' },
  { key: 'soc2', label: 'SOC 2' },
];

export default function ComplianceBadges({ compliance = {} }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-4">
        Compliance
      </h3>
      {frameworks.map((fw, i) => {
        const value = compliance[fw.key] ?? 0;
        const status = value >= 80 ? 'Compliant' : value >= 50 ? 'Partial' : 'Non-compliant';
        const color = value >= 80 ? '#4ADE80' : value >= 50 ? '#FBBF24' : '#F87171';

        return (
          <motion.div
            key={fw.key}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="text-[12px] text-white/85">{fw.label}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] text-white/45" style={{ color }}>
                  {status}
                </span>
                <span className="text-[11px] font-mono text-white/70 numeric">
                  <CountUp to={value} duration={1.1} />
                  <span className="text-white/25">%</span>
                </span>
              </div>
            </div>
            <div className="h-[2px] bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: i * 0.1 }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
