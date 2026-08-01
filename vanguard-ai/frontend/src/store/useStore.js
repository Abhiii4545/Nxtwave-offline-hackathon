/**
 * Vanguard AI — Global State Store (Zustand)
 */

import { create } from 'zustand';

const useStore = create((set, get) => ({
  // Scan state
  currentScan: null,
  scanStatus: 'idle', // idle | running | completed
  scanProgress: 0,

  // Vulnerabilities
  vulnerabilities: [],
  selectedVuln: null,

  // Dashboard
  dashboardStats: null,
  attackPath: null,

  // Chat
  chatMessages: [],

  // Actions
  setCurrentScan: (scan) => set({ currentScan: scan }),

  updateScanProgress: (progress, status) =>
    set({ scanProgress: progress, scanStatus: status }),

  setVulnerabilities: (vulns) => set({ vulnerabilities: vulns }),

  setSelectedVuln: (vuln) => set({ selectedVuln: vuln }),

  setDashboardStats: (stats) => set({ dashboardStats: stats }),

  setAttackPath: (path) => set({ attackPath: path }),

  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),

  clearChat: () => set({ chatMessages: [] }),

  resetScan: () =>
    set({ currentScan: null, scanStatus: 'idle', scanProgress: 0 }),
}));

export default useStore;
