/**
 * VulnList — Filterable, searchable vulnerability list.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter } from 'lucide-react';
import { getVulnerabilities, getDashboardStats } from '../api/client';
import useStore from '../store/useStore';
import VulnerabilityCard from '../components/VulnerabilityCard';
import { CountUp } from '../components/ui/Motion';

const riskFilters = ['All', 'Critical', 'High', 'Medium', 'Low', 'Informational'];

const RISK_META = [
  { key: 'Critical', color: '#F87171' },
  { key: 'High', color: '#FB923C' },
  { key: 'Medium', color: '#FBBF24' },
  { key: 'Low', color: '#4ADE80' },
  { key: 'Informational', color: '#94A3B8' },
];

export default function VulnList() {
  const { dashboardStats, setDashboardStats } = useStore();
  const [vulns, setVulns] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [showResolved, setShowResolved] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    if (!dashboardStats) {
      getDashboardStats().then(setDashboardStats).catch(console.error);
    }
  }, []);

  const latestScanId = dashboardStats?.latest_scan?.id;

  const fetchVulns = async () => {
    if (!latestScanId) return;
    setLoading(true);
    try {
      const filters = {
        skip: page * limit,
        limit,
        scan_id: latestScanId,
      };
      if (riskFilter !== 'All') filters.risk = riskFilter;
      if (search) filters.search = search;
      if (!showResolved) filters.resolved = false;

      const data = await getVulnerabilities(filters);
      setVulns(data.vulnerabilities || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error('Failed to fetch vulnerabilities:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVulns();
  }, [riskFilter, showResolved, page, latestScanId]);

  // Debounced search
  useEffect(() => {
    if (!latestScanId) return;
    const timer = setTimeout(fetchVulns, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const dist = dashboardStats?.risk_distribution || {};

  return (
    <div className="space-y-8">
      <div>
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">Findings</span>
        <h1 className="text-[28px] font-display font-medium tracking-tight text-white/95 mt-2">
          Vulnerabilities
        </h1>
        <p className="text-[13px] text-white/50 mt-1.5">
          <span className="font-mono numeric text-white/80">{total}</span> total across your latest assessment
        </p>
      </div>

      {/* Severity summary — clickable to filter */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {RISK_META.map(({ key, color }, i) => {
          const count = dist[key] ?? 0;
          const active = riskFilter === key;
          return (
            <motion.button
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -3 }}
              onClick={() => { setRiskFilter(active ? 'All' : key); setPage(0); }}
              className={`glass p-4 text-left transition-colors ${active ? 'ring-1' : ''}`}
              style={active ? { boxShadow: `0 0 0 1px ${color}55, 0 0 24px -8px ${color}` } : undefined}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                <span className="text-[10px] uppercase tracking-[0.1em] text-white/45">{key}</span>
              </div>
              <div className="text-[26px] font-display font-medium leading-none numeric" style={{ color: count > 0 ? color : 'rgba(255,255,255,0.3)' }}>
                <CountUp to={count} duration={0.9} />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="glass p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" strokeWidth={1.75} />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search findings…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[13px] text-white/90 placeholder-white/25 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          {/* Risk Filter */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            {riskFilters.map((r) => (
              <button
                key={r}
                onClick={() => { setRiskFilter(r); setPage(0); }}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  riskFilter === r
                    ? 'bg-white/10 text-white/95'
                    : 'text-white/45 hover:text-white/80'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-white/45 cursor-pointer">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => { setShowResolved(e.target.checked); setPage(0); }}
              className="w-3 h-3 rounded accent-white"
            />
            Show resolved
          </label>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="typing-dots"><span /><span /><span /></div>
        </div>
      ) : vulns.length === 0 ? (
        <div className="text-center py-16">
          <Filter className="w-5 h-5 text-white/20 mx-auto mb-3" strokeWidth={1.75} />
          <p className="text-[13px] text-white/45">No vulnerabilities match your filters</p>
        </div>
      ) : (
        <motion.div layout className="space-y-1.5">
          <AnimatePresence mode="popLayout">
            {vulns.map((v, i) => (
              <motion.div
                key={v.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
              >
                <VulnerabilityCard vuln={v} index={0} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 rounded-md text-[11px] text-white/50 hover:text-white/90 hover:bg-white/5 disabled:opacity-25 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-[11px] text-white/35 font-mono numeric">
            {page + 1} / {Math.ceil(total / limit)}
          </span>
          <button
            disabled={(page + 1) * limit >= total}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 rounded-md text-[11px] text-white/50 hover:text-white/90 hover:bg-white/5 disabled:opacity-25 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
