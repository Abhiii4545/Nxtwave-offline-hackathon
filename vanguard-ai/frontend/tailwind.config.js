/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vanguard: {
          bg: '#07090F',
          card: 'rgba(255,255,255,0.035)',
          sidebar: 'transparent',
          border: 'rgba(255,255,255,0.06)',
          'border-glow': 'rgba(120,180,255,0.35)',
        },
        accent: {
          cyan: '#7BB8FF',
          critical: '#F87171',
          high: '#FB923C',
          medium: '#FBBF24',
          low: '#4ADE80',
          purple: '#C4B5FD',
          info: '#94A3B8',
        },
        text: {
          primary: 'rgba(255,255,255,0.92)',
          muted: 'rgba(255,255,255,0.62)',
          dim: 'rgba(255,255,255,0.38)',
        },
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
        serif: ['Instrument Serif', 'serif'],
      },
      keyframes: {
        'pulse-scan': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 212, 255, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.4)' },
        },
        'scan-line': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'pulse-scan': 'pulse-scan 2s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite',
        'scan-line': 'scan-line 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
