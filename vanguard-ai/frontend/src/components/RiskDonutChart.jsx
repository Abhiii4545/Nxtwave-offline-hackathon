/**
 * RiskDonutChart — Donut chart showing vulnerability risk distribution.
 */

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const RISK_COLORS = {
  Critical: '#F87171',
  High: '#FB923C',
  Medium: '#FBBF24',
  Low: '#4ADE80',
  Informational: '#94A3B8',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value, payload: data } = payload[0];
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <p className="font-medium" style={{ color: data.fill }}>{name}</p>
      <p className="text-text-primary">{value} vulnerabilities ({data.percent}%)</p>
    </div>
  );
};

const CustomLegend = ({ payload }) => (
  <div className="flex flex-wrap justify-center gap-3 mt-3">
    {payload?.map((entry, i) => (
      <div key={i} className="flex items-center gap-1.5 text-xs text-text-muted">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: entry.color }} />
        {entry.value}
      </div>
    ))}
  </div>
);

export default function RiskDonutChart({ distribution = {} }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0) || 1;
  const data = Object.entries(distribution)
    .filter(([_, v]) => v > 0)
    .map(([name, value]) => ({
      name,
      value,
      percent: Math.round((value / total) * 100),
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-text-muted text-sm">
        No vulnerability data available
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
            animationBegin={0}
            animationDuration={1200}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={RISK_COLORS[entry.name] || '#6B7E99'} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
          {/* Center total */}
          <text x="50%" y="42%" textAnchor="middle" style={{ fill: 'rgba(255,255,255,0.92)', fontSize: '30px', fontWeight: 400, fontFamily: 'Instrument Serif, serif' }}>
            {total}
          </text>
          <text x="50%" y="54%" textAnchor="middle" style={{ fill: 'rgba(255,255,255,0.35)', fontSize: '9px', letterSpacing: '0.14em', fontFamily: 'Inter' }}>
            TOTAL
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
