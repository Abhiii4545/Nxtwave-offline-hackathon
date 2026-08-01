/**
 * SecurityScoreGauge — Minimal circular score display, editorial in feel.
 */

import React, { useEffect, useState } from 'react';

export default function SecurityScoreGauge({ score = 0 }) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 80);
    return () => clearTimeout(timer);
  }, [score]);

  const size = 180;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const progress = (animated / 100) * circumference;

  const getColor = (s) => {
    if (s <= 30) return '#F87171';
    if (s <= 60) return '#FB923C';
    if (s <= 80) return '#FBBF24';
    return '#4ADE80';
  };

  const getGrade = (s) => {
    if (s <= 30) return 'F';
    if (s <= 50) return 'D';
    if (s <= 65) return 'C';
    if (s <= 80) return 'B';
    return 'A';
  };

  const color = getColor(animated);
  const grade = getGrade(animated);

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease',
          }}
        />
      </svg>

      <div className="text-center relative z-10">
        <div className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">
          Score
        </div>
        <div className="font-serif text-[56px] leading-none text-white/95 numeric">
          {Math.round(animated)}
        </div>
        <div className="mt-2 text-[11px] text-white/50 font-mono">
          <span style={{ color }}>{grade}</span>
          <span className="text-white/20"> · </span>
          <span>/100</span>
        </div>
      </div>
    </div>
  );
}
