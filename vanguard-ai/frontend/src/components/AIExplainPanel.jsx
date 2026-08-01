/**
 * AIExplainPanel — Expandable AI explanation with 4 sections.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, FileText, Cog, Skull, Briefcase } from 'lucide-react';
import { explainVulnerability } from '../api/client';

const sections = [
  { key: 'plain_english', label: 'Plain English Explanation', icon: FileText, emoji: '📝' },
  { key: 'technical_detail', label: 'Technical Details', icon: Cog, emoji: '⚙️' },
  { key: 'attack_scenario', label: 'Attack Scenario', icon: Skull, emoji: '💀' },
  { key: 'business_impact', label: 'Business Impact', icon: Briefcase, emoji: '💼' },
];

export default function AIExplainPanel({ vulnId, existingExplanation }) {
  const [explanation, setExplanation] = useState(
    () => {
      if (!existingExplanation) return null;
      if (typeof existingExplanation !== 'string') return existingExplanation;
      try { return JSON.parse(existingExplanation); } catch { return null; }
    }
  );
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState(new Set(['plain_english']));
  const [error, setError] = useState(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await explainVulnerability(vulnId);
      setExplanation(data);
      setExpandedSections(new Set(['plain_english', 'technical_detail']));
    } catch (e) {
      setError('Failed to generate explanation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (key) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="glass-card border-accent-purple/30 glow-purple">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-vanguard-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-purple" />
          <h3 className="text-sm font-semibold text-text-primary">AI Analysis</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-purple/15 text-accent-purple font-medium">
            AI Generated
          </span>
        </div>
      </div>

      <div className="p-4">
        {!explanation && !loading && (
          <div className="text-center py-6">
            <Sparkles className="w-8 h-8 text-accent-purple/50 mx-auto mb-3" />
            <p className="text-sm text-text-muted mb-4">
              Get AI-powered analysis of this vulnerability
            </p>
            <button
              onClick={generate}
              className="px-4 py-2 rounded-lg bg-accent-purple/15 text-accent-purple text-sm font-medium hover:bg-accent-purple/25 transition-colors border border-accent-purple/30"
            >
              Generate Explanation
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="typing-dots">
              <span /><span /><span />
            </div>
            <span className="text-text-muted text-sm">Analyzing vulnerability...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-4">
            <p className="text-accent-critical text-sm mb-3">{error}</p>
            <button onClick={generate} className="text-accent-cyan text-sm hover:underline">
              Try Again
            </button>
          </div>
        )}

        {explanation && (
          <div className="space-y-2">
            {sections.map(({ key, label, emoji }) => (
              <div key={key} className="border border-vanguard-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection(key)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm text-text-primary flex items-center gap-2">
                    <span>{emoji}</span>
                    {label}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-text-muted transition-transform ${
                      expandedSections.has(key) ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {expandedSections.has(key) && explanation[key] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-3 pb-3 text-sm text-text-muted leading-relaxed whitespace-pre-wrap">
                        {explanation[key]}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
