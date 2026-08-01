/**
 * ScanProgress — Thin progress indicator with stage label.
 */

import React from 'react';

export default function ScanProgress({ progress = 0, status = 'pending' }) {
  const getStageLabel = () => {
    if (status === 'completed') return 'Assessment complete';
    if (status === 'failed') return 'Assessment failed';
    if (progress < 10) return 'Establishing connection';
    if (progress < 30) return 'Analyzing response headers';
    if (progress < 50) return 'Inspecting TLS configuration';
    if (progress < 70) return 'Testing for misconfigurations';
    if (progress < 90) return 'Probing sensitive paths';
    return 'Generating analysis';
  };

  const isDone = status === 'completed';
  const isFailed = status === 'failed';

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[13px] text-white/60">{getStageLabel()}</p>
        <p
          className={`text-[11px] font-mono numeric ${
            isFailed ? 'text-[#F87171]' : isDone ? 'text-[#4ADE80]' : 'text-white/75'
          }`}
        >
          {progress.toString().padStart(2, '0')}<span className="text-white/25">%</span>
        </p>
      </div>

      <div className="progress-track">
        <div
          className={`progress-fill ${!isDone && !isFailed ? 'progress-glow' : ''}`}
          style={{
            width: `${progress}%`,
            background: isFailed
              ? 'linear-gradient(90deg, #F87171, rgba(248,113,113,0.7))'
              : isDone
              ? 'linear-gradient(90deg, #4ADE80, rgba(74,222,128,0.7))'
              : undefined,
          }}
        />
      </div>
    </div>
  );
}
