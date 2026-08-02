/**
 * Dashboard — Main security dashboard with stats, charts, and AI insights.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, Bug, AlertTriangle, AlertOctagon, Activity, Clock, ArrowLeft
} from 'lucide-react';
import { getDashboardStats } from '../api/client';
import useStore from '../store/useStore';
import StatCard from '../components/StatCard';
import { timeAgo, formatDateTime } from '../utils/time';
import SecurityScoreGauge from '../components/SecurityScoreGauge';
import RiskDonutChart from '../components/RiskDonutChart';
import VulnTrendChart from '../components/VulnTrendChart';
import AttackPathFlow from '../components/AttackPathFlow';
import ComplianceBadges from '../components/ComplianceBadges';
import SecuritySuggestions from '../components/SecuritySuggestions';
import RemediationDiff from '../components/RemediationDiff';
import FixFirstQueue from '../components/FixFirstQueue';

export default function Dashboard() {
  const { dashboardStats, setDashboardStats } = useStore();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { scanId } = useParams();

  useEffect(() => {
    setLoading(true);
    getDashboardStats(scanId ? Number(scanId) : null)
      .then((data) => {
        setDashboardStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Dashboard load error:', err);
        setLoading(false);
      });
  }, [scanId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="text-center">
          <div className="typing-dots mb-4 flex justify-center">
            <span /><span /><span />
          </div>
          <p className="text-[12px] text-white/40">Loading dashboard</p>
        </div>
      </div>
    );
  }

  const stats = dashboardStats || {};
  const scan = stats.latest_scan;

  // Time since last scan (timestamps are UTC — see utils/time)
  const getTimeSince = () => {
    if (!scan?.completed_at) return 'No scans yet';
    return timeAgo(scan.completed_at);
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      {scanId && (
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/80 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
          Back to latest
        </button>
      )}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">
              {scanId ? 'Report' : 'Overview'}
            </span>
          </div>
          <h1 className="text-[28px] font-display font-medium tracking-tight text-white/95">
            {scanId ? 'Scan report' : 'Security dashboard'}
          </h1>
          {scan ? (
            <p className="text-[13px] text-white/50 mt-1.5 flex items-center gap-2">
              <span className="font-mono text-white/75">{scan.target_url}</span>
              {scan.started_at && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="text-white/40">
                    {formatDateTime(scan.started_at)}
                  </span>
                </>
              )}
            </p>
          ) : (
            <p className="text-[13px] text-white/40 mt-1.5">No scan data available yet</p>
          )}
        </div>
        <button
          onClick={() => navigate('/scan')}
          className="btn btn-primary"
        >
          <Activity className="w-3.5 h-3.5" strokeWidth={2} />
          New scan
        </button>
      </div>

      {/* Row 1: Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Security Score"
          value={stats.security_score ?? '--'}
          color="cyan"
          icon={Shield}
        />
        <StatCard
          label="Total Vulnerabilities"
          value={stats.total_vulnerabilities ?? 0}
          color="purple"
          icon={Bug}
        />
        <StatCard
          label="Critical"
          value={stats.critical ?? 0}
          color="critical"
          icon={AlertOctagon}
        />
        <StatCard
          label="High"
          value={stats.high ?? 0}
          color="high"
          icon={AlertTriangle}
        />
        <StatCard
          label="Last Scan"
          value={getTimeSince()}
          color="low"
          icon={Clock}
        />
      </div>

      {/* Row 2: Score Gauge + Compliance | Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 glass p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="flex justify-center">
              <SecurityScoreGauge score={stats.security_score ?? 0} />
            </div>
            <ComplianceBadges compliance={stats.compliance} />
          </div>
        </div>
        <div className="lg:col-span-2 glass p-6">
          <h3 className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-4">
            Risk distribution
          </h3>
          <RiskDonutChart distribution={stats.risk_distribution} />
        </div>
      </div>

      {/* Row 3: Trend Chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass p-6"
      >
        <h3 className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-4">
          Vulnerability trend
        </h3>
        <VulnTrendChart trendData={stats.trend_data || []} />
      </motion.div>

      {/* Row 4: Fix-first queue | Remediation diff */}
      {scan?.id && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <FixFirstQueue scanId={scan.id} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <RemediationDiff scanId={scan.id} />
          </motion.div>
        </div>
      )}

      {/* Row 5: Attack Path */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <AttackPathFlow scanId={scan?.id} />
      </motion.div>

      {/* Row 6: AI Security Suggestions */}
      {scan?.id && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <SecuritySuggestions scanId={scan.id} />
        </motion.div>
      )}
    </div>
  );
}
