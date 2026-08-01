/**
 * Vanguard AI — API Client
 * Axios instance with all API functions for the security dashboard.
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// ── Scans ──
export const startScan = (targetUrl = 'https://example.com') =>
  api.post('/scans/start', { target_url: targetUrl }).then((r) => r.data);

export const getScanStatus = (scanId) =>
  api.get(`/scans/${scanId}/status`).then((r) => r.data);

export const getScanResults = (scanId) =>
  api.get(`/scans/${scanId}/results`).then((r) => r.data);

export const getAllScans = () =>
  api.get('/scans/').then((r) => r.data);

export const getScanDiff = (scanId) =>
  api.get(`/scans/${scanId}/diff`).then((r) => r.data);

export const seedDatabase = () =>
  api.post('/scans/seed').then((r) => r.data);

// ── Vulnerabilities ──
export const getVulnerabilities = (filters = {}) =>
  api.get('/vulnerabilities/', { params: filters }).then((r) => r.data);

export const getVulnerability = (vulnId) =>
  api.get(`/vulnerabilities/${vulnId}`).then((r) => r.data);

export const resolveVulnerability = (vulnId) =>
  api.patch(`/vulnerabilities/${vulnId}/resolve`).then((r) => r.data);

// ── AI ──
export const explainVulnerability = (vulnId) =>
  api.post(`/ai/explain/${vulnId}`).then((r) => r.data);

export const generateFix = (vulnId, language = 'python') =>
  api.post(`/ai/fix/${vulnId}`, null, { params: { language } }).then((r) => r.data);

export const getAttackPath = (scanId) =>
  api.get(`/ai/attack-path/${scanId}`).then((r) => r.data);

export const sendChatMessage = (messages, scanId = null) =>
  api.post('/ai/chat', { messages, scan_id: scanId }).then((r) => r.data);

// ── Dashboard ──
export const getDashboardStats = (scanId = null) =>
  api
    .get('/dashboard/stats', { params: scanId ? { scan_id: scanId } : {} })
    .then((r) => r.data);

// ── AI Suggestions ──
export const getScanSuggestions = (scanId) =>
  api.get(`/scans/${scanId}/suggestions`).then((r) => r.data);

// ── Reports ──
export const downloadPDF = (scanId) =>
  api.get(`/reports/${scanId}/pdf`, { responseType: 'blob' }).then((r) => {
    const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `vanguard-report-${new Date().toISOString().split('T')[0]}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  });

export const downloadJSON = (scanId) =>
  api.get(`/reports/${scanId}/json`, { responseType: 'blob' }).then((r) => {
    const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `vanguard-report-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  });

// ── Health ──
export const healthCheck = () =>
  api.get('/health').then((r) => r.data);

export default api;
