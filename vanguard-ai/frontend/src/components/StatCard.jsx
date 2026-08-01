/**
 * StatCard — Minimal glass metric card with count-up value and cursor spotlight.
 */

import React from 'react';
import { CountUp, SpotlightCard } from './ui/Motion';

const schemes = {
  cyan: '#7BB8FF',
  critical: '#F87171',
  high: '#FB923C',
  medium: '#FBBF24',
  low: '#4ADE80',
  purple: '#C4B5FD',
  info: '#94A3B8',
};

export default function StatCard({ label, value, color = 'cyan', icon: Icon, trend }) {
  const accent = schemes[color] || schemes.cyan;

  // Numeric values animate; string values (e.g. "5h ago") render as-is.
  const numeric = typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value));
  const num = numeric ? parseFloat(value) : null;
  const decimals = numeric && String(value).includes('.') ? 1 : 0;

  return (
    <SpotlightCard
      className="glass p-5 group"
      tint={`${accent}22`}
    >
      <div className="flex items-start justify-between mb-6">
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</p>
        {Icon && (
          <Icon className="w-3.5 h-3.5 text-white/25 group-hover:text-white/50 transition-colors" strokeWidth={1.75} />
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className="text-[28px] font-display font-medium tracking-tight leading-none numeric"
          style={{ color: numeric ? accent : 'rgba(255,255,255,0.92)' }}
        >
          {numeric ? <CountUp to={num} decimals={decimals} duration={1} /> : value}
        </span>
        {trend != null && (
          <span className={`text-[11px] font-mono numeric ${trend > 0 ? 'text-[#F87171]' : 'text-[#4ADE80]'}`}>
            {trend > 0 ? '↑' : '↓'}{Math.abs(trend)}%
          </span>
        )}
      </div>

      <div
        className="absolute bottom-0 left-5 right-5 h-px opacity-40"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
    </SpotlightCard>
  );
}
