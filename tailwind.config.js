/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#030812',
          900: '#060c18',
          800: '#0a1220',
          700: '#0d1526',
          600: '#111e35',
          500: '#162444',
          400: '#1a2a45',
          300: '#213354',
        },
        purple: {
          glow: '#6c3ce1',
          bright: '#8b5cf6',
          dim: '#4a2aad',
          muted: '#2d1a7a',
        },
        cyan: {
          glow: '#00d4ff',
          dim: '#0099cc',
        },
        neon: {
          red: '#ff2d55',
          green: '#00ff88',
          cyan: '#00d4ff',
          purple: '#6c3ce1',
          orange: '#ff6b2b',
          yellow: '#ffd60a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Exo 2"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'purple-glow': '0 0 20px rgba(108,60,225,0.4), 0 0 60px rgba(108,60,225,0.15)',
        'cyan-glow': '0 0 20px rgba(0,212,255,0.35), 0 0 50px rgba(0,212,255,0.1)',
        'red-glow': '0 0 20px rgba(255,45,85,0.4), 0 0 50px rgba(255,45,85,0.12)',
        'green-glow': '0 0 20px rgba(0,255,136,0.35), 0 0 50px rgba(0,255,136,0.1)',
        'card': '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      borderRadius: {
        'card': '12px',
      },
      transitionDuration: {
        '200': '200ms',
      },
    },
  },
  plugins: [],
};
