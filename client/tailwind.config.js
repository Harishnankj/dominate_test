/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // User-Specified Premium Dark & White Theme Palette
        dominate: {
          bg: '#090A0C',
          sidebar: '#111214',
          card: '#191A1D',
          'card-secondary': '#202226',
          border: '#383A3E',
          'border-subtle': 'rgba(255, 255, 255, 0.08)',
          'primary-text': '#F5F5F5',
          'secondary-text': '#A6A6A6',
          'muted-text': '#777777',
          highlight: '#FFFFFF',
          online: '#22D68A',
          warning: '#F0B94D',
          error: '#FF5757',
        },
        brand: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.45)',
        'card-hover': '0 8px 30px -4px rgba(0, 0, 0, 0.65)',
        'white-subtle': '0 0 15px rgba(255, 255, 255, 0.12)',
        'online-glow': '0 0 12px rgba(34, 214, 138, 0.35)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
      },
    },
  },
  plugins: [],
};
