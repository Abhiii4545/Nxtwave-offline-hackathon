/**
 * SecuritySuggestions — Editorial-style AI recommendations list.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { getScanSuggestions } from '../api/client';

const priorityColor = (p) => {
  switch ((p || '').toUpperCase()) {
    case 'CRITICAL': return '#F87171';
    case 'HIGH':     return '#FB923C';
    case 'MEDIUM':   return '#FBBF24';
    default:         return '#4ADE80';
  }
};

export default function SecuritySuggestions({ scanId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [applied, setApplied] = useState({});

  useEffect(() => {
    if (!scanId) return;
    setLoading(true);
    getScanSuggestions(scanId)
      .then((res) => { setData(res); setLoading(false); })
      .catch((err) => {
        console.error('Failed to load suggestions:', err);
        setError('Failed to load AI security suggestions.');
        setLoading(false);
      });
  }, [scanId]);

  if (loading) {
    return (
      <div className="glass p-12 flex flex-col items-center justify-center">
        <div className="typing-dots mb-3"><span /><span /><span /></div>
        <p className="text-[12px] text-white/40">Generating recommendations</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass p-6">
        <p className="text-[13px] text-[#F87171]">{error || 'No suggestions available.'}</p>
      </div>
    );
  }

  const { suggestions = [], summary, overall_priority } = data;
  const overallColor = priorityColor(overall_priority);

  return (
    <section className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-white/45" strokeWidth={1.75} />
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">
            AI recommendations
          </span>
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
            style={{
              color: overallColor,
              backgroundColor: `${overallColor}12`,
              borderColor: `${overallColor}30`,
            }}
          >
            {overall_priority}
          </span>
        </div>
        <p className="text-[14px] text-white/70 leading-relaxed max-w-3xl">
          {summary}
        </p>
      </div>

      {/* Suggestion rows */}
      <div className="glass divide-y divide-white/[0.05] overflow-hidden">
        {suggestions.map((sug, idx) => {
          const isExpanded = expanded === idx;
          const isApplied = applied[idx];
          const color = priorityColor(sug.priority);

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(isExpanded ? null : idx)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setExpanded(isExpanded ? null : idx)}
                className={`w-full text-left px-5 py-4 flex items-center gap-4 transition-colors cursor-pointer ${
                  isApplied ? 'opacity-60' : 'hover:bg-white/[0.02]'
                }`}
              >
                <span
                  className="w-1 h-8 rounded-full flex-shrink-0"
                  style={{ background: color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-[10px] uppercase tracking-[0.1em]"
                      style={{ color }}
                    >
                      {sug.priority}
                    </span>
                    <span className="text-white/15">·</span>
                    <span className="text-[10px] text-white/40">{sug.category}</span>
                  </div>
                  <p className={`text-[14px] font-medium ${isApplied ? 'text-white/50 line-through' : 'text-white/92'}`}>
                    {sug.title}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setApplied((p) => ({ ...p, [idx]: !p[idx] }));
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1 ${
                    isApplied
                      ? 'text-[#4ADE80] border-[#4ADE80]/25 bg-[#4ADE80]/10'
                      : 'text-white/60 border-white/10 hover:border-white/25 hover:text-white/90'
                  }`}
                >
                  {isApplied && <Check className="w-3 h-3" strokeWidth={2.5} />}
                  {isApplied ? 'Applied' : 'Mark done'}
                </button>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-white/30 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  strokeWidth={1.75}
                />
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pl-10">
                      <p className="text-[13px] text-white/70 leading-relaxed mb-4">
                        {sug.description}
                      </p>

                      {sug.implementation_steps?.length > 0 && (
                        <>
                          <h5 className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-2">
                            Implementation
                          </h5>
                          <ol className="space-y-1.5 mb-4">
                            {sug.implementation_steps.map((step, sIdx) => (
                              <li
                                key={sIdx}
                                className="text-[13px] text-white/70 flex gap-3"
                              >
                                <span className="text-white/30 font-mono text-[11px] pt-0.5 numeric">
                                  {String(sIdx + 1).padStart(2, '0')}
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </>
                      )}

                      {sug.estimated_effort && (
                        <div className="flex items-center gap-2 pt-3 hairline-t">
                          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                            Effort
                          </span>
                          <span className="text-[11px] text-white/70 font-mono">
                            {sug.estimated_effort}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
