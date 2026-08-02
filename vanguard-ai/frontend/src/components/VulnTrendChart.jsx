/**
 * VulnTrendChart — Line chart showing vulnerability trends over scans.
 */

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { formatDate } from '../utils/time';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs space-y-1">
      <p className="text-text-muted text-[10px]">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-mono font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function VulnTrendChart({ trendData = [] }) {
  // Format data for display
  const data = [...trendData].reverse().map((d) => ({
    ...d,
    date: d.date ? formatDate(d.date, { month: 'short', day: 'numeric' }) : `Scan ${d.scan_id}`,
  }));

  if (data.length === 0) {
    // Show placeholder data
    const placeholderData = [
      { date: 'Scan 1', critical: 2, high: 5, medium: 8, score: 35 },
      { date: 'Scan 2', critical: 1, high: 4, medium: 7, score: 45 },
      { date: 'Scan 3', critical: 0, high: 6, medium: 7, score: 31 },
    ];
    return (
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={placeholderData}>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
          <YAxis stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="critical" stroke="#F87171" strokeWidth={1.5} dot={{ r: 3, fill: '#F87171', strokeWidth: 0 }} />
          <Line type="monotone" dataKey="high" stroke="#FB923C" strokeWidth={1.5} dot={{ r: 3, fill: '#FB923C', strokeWidth: 0 }} />
          <Line type="monotone" dataKey="medium" stroke="#FBBF24" strokeWidth={1.5} dot={{ r: 3, fill: '#FBBF24', strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" />
        <XAxis dataKey="date" stroke="#3A4A5E" tick={{ fontSize: 11 }} />
        <YAxis stroke="#3A4A5E" tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => <span className="text-text-muted text-xs capitalize">{value}</span>}
        />
        <Line type="monotone" dataKey="critical" name="Critical" stroke="#F87171" strokeWidth={1.5} dot={{ r: 3, fill: '#F87171', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: 'rgba(255,255,255,0.15)' }} />
        <Line type="monotone" dataKey="high" name="High" stroke="#FB923C" strokeWidth={1.5} dot={{ r: 3, fill: '#FB923C', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: 'rgba(255,255,255,0.15)' }} />
        <Line type="monotone" dataKey="medium" name="Medium" stroke="#FBBF24" strokeWidth={1.5} dot={{ r: 3, fill: '#FBBF24', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: 'rgba(255,255,255,0.15)' }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
