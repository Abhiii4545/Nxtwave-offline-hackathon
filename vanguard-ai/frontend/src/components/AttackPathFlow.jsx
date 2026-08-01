/**
 * AttackPathFlow — Interactive, expandable kill-chain timeline.
 * Shows how findings chain into an attack: phase, action, technique,
 * per-step severity, and the control that breaks the chain.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAttackPath } from '../api/client';
import {
  Search, Key, Database, Shield, Server, User, Lock, AlertTriangle,
  Code, Globe, ChevronDown, ShieldOff, Crosshair, Flag, Wrench, ArrowDown,
} from 'lucide-react';

const iconMap = {
  search: Search, key: Key, database: Database, shield: Shield,
  server: Server, user: User, lock: Lock, alert: AlertTriangle,
  code: Code, globe: Globe,
};

const sevColor = (s) => ({
  Critical: '#F87171', High: '#FB923C', Medium: '#FBBF24',
  Low: '#4ADE80', Informational: '#94A3B8',
}[s] || '#94A3B8');

const riskColor = (r) => ({
  CRITICAL: '#F87171', HIGH: '#FB923C', MEDIUM: '#FBBF24', LOW: '#4ADE80',
}[(r || '').toUpperCase()] || '#FBBF24');

export default function AttackPathFlow({ scanId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(0); // index of expanded step (0 = first open)

  useEffect(() => {
    if (!scanId) return;
    setLoading(true);
    setOpen(0);
    getAttackPath(scanId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [scanId]);

  if (loading) {
    return (
      <div className="glass p-6">
        <Header />
        <div className="flex items-center gap-3 py-10 justify-center">
          <div className="typing-dots"><span /><span /><span /></div>
          <span className="text-white/40 text-[13px]">Modeling attack path…</span>
        </div>
      </div>
    );
  }

  if (!data?.chain?.length) return null;

  const chain = data.chain;
  const risk = (data.overall_risk || 'MEDIUM').toUpperCase();

  return (
    <div className="glass p-6">
      <Header risk={risk} steps={chain.length} />

      {/* Escalation meter — severity per step */}
      <div className="flex items-center gap-1.5 mt-4 mb-6">
        {chain.map((s, i) => (
          <div key={i} className="flex-1 group relative">
            <div
              className="h-1.5 rounded-full transition-all cursor-pointer"
              style={{ background: sevColor(s.severity), opacity: open === i ? 1 : 0.55 }}
              onClick={() => setOpen(open === i ? -1 : i)}
            />
          </div>
        ))}
      </div>

      {/* Entry point */}
      {data.entry_point && (
        <Bookend icon={Crosshair} label="Entry point" text={data.entry_point} color="#7BB8FF" />
      )}

      {/* Timeline */}
      <div className="relative mt-4">
        {/* vertical rail */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-[#7BB8FF]/40 via-white/10 to-[#F87171]/40" />

        <div className="space-y-2">
          {chain.map((step, i) => {
            const Icon = iconMap[step.icon] || AlertTriangle;
            const isOpen = open === i;
            const color = sevColor(step.severity);
            return (
              <div key={i} className="relative">
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="w-full flex items-start gap-4 text-left group"
                >
                  {/* Node */}
                  <div className="relative z-10 flex-shrink-0">
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.06 }}
                      className="w-8 h-8 rounded-full flex items-center justify-center border"
                      style={{
                        background: `${color}18`,
                        borderColor: `${color}45`,
                        boxShadow: isOpen ? `0 0 16px -2px ${color}66` : 'none',
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={2} />
                    </motion.div>
                  </div>

                  {/* Card */}
                  <div
                    className={`flex-1 rounded-xl px-4 py-3 border transition-colors ${
                      isOpen ? 'bg-white/[0.04] border-white/[0.1]' : 'bg-white/[0.02] border-white/[0.05] group-hover:bg-white/[0.035]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-white/30 numeric">
                        {String(step.step).padStart(2, '0')}
                      </span>
                      {step.phase && (
                        <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color }}>
                          {step.phase}
                        </span>
                      )}
                      <span
                        className="ml-auto text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: `${color}18`, color }}
                      >
                        {step.severity || 'Med'}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        strokeWidth={1.75}
                      />
                    </div>
                    <p className="text-[13.5px] font-medium text-white/90 leading-snug">{step.vuln}</p>
                    <p className="text-[12.5px] text-white/55 mt-0.5 leading-relaxed">{step.action}</p>

                    <AnimatePresence initial={false} mode="wait">
                      {isOpen && (
                        <motion.div
                          key={`detail-${i}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 hairline-t space-y-3">
                            {step.technique && (
                              <Detail icon={Code} label="Technique" text={step.technique} tint="#7BB8FF" />
                            )}
                            {step.consequence && (
                              <Detail icon={ArrowDown} label="Attacker gains" text={step.consequence} tint={color} />
                            )}
                            {step.mitigation && (
                              <Detail icon={Wrench} label="Break the chain" text={step.mitigation} tint="#4ADE80" />
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Final impact */}
      {data.final_impact && (
        <div className="mt-4">
          <Bookend icon={Flag} label="If unbroken" text={data.final_impact} color="#F87171" />
        </div>
      )}

      {/* Summary */}
      {data.summary && (
        <p className="text-[12.5px] text-white/50 mt-5 leading-relaxed hairline-t pt-4">
          {data.summary}
        </p>
      )}
    </div>
  );
}

function Header({ risk = 'MEDIUM', steps }) {
  const color = riskColor(risk);
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-[10px] uppercase tracking-[0.14em] text-white/40 flex items-center gap-2">
        <ShieldOff className="w-3.5 h-3.5 text-white/35" strokeWidth={1.75} />
        Attack path
        <span className="chip chip-accent">AI</span>
      </h3>
      {steps != null && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/35 font-mono">{steps} steps</span>
          <span
            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border"
            style={{ color, background: `${color}14`, borderColor: `${color}30` }}
          >
            {risk} risk
          </span>
        </div>
      )}
    </div>
  );
}

function Bookend({ icon: Icon, label, text, color }) {
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3 bg-white/[0.02] border border-white/[0.05]">
      <div
        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${color}18`, border: `1px solid ${color}35` }}
      >
        <Icon className="w-3 h-3" style={{ color }} strokeWidth={2} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] mb-0.5" style={{ color }}>{label}</p>
        <p className="text-[12.5px] text-white/70 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, text, tint }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: tint }} strokeWidth={1.75} />
      <div>
        <span className="text-[10px] uppercase tracking-[0.1em]" style={{ color: tint }}>{label}</span>
        <p className="text-[12.5px] text-white/70 leading-relaxed mt-0.5">{text}</p>
      </div>
    </div>
  );
}
