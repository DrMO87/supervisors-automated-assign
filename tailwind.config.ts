import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-outfit)', 'Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        // HUE Navy — brand primary
        primary: {
          50:  '#eef2ff',
          100: '#dde5ff',
          200: '#bfcbff',
          300: '#94a8ff',
          400: '#6680ff',
          500: '#4361ff',
          600: '#2640f5',
          700: '#1d32e0',
          800: '#1929b5',
          900: '#002147', // HUE official navy
          950: '#000d2b',
          DEFAULT: '#002147',
        },
        // HUE Gold — accent
        gold: {
          50:  '#fffceb',
          100: '#fff6c6',
          200: '#ffed88',
          300: '#ffe04a',
          400: '#FFD31A',
          500: '#FFB81C', // HUE official gold
          600: '#d98f00',
          700: '#b36900',
          800: '#8f4f00',
          900: '#6b3800',
          DEFAULT: '#FFB81C',
        },
        // Surface tokens for the dark sidebar / glass design
        surface: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        success: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
        },
        info: {
          50:  '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-sidebar': 'linear-gradient(180deg, #002147 0%, #001530 60%, #000d1f 100%)',
        'gradient-gold':    'linear-gradient(135deg, #FFB81C 0%, #FFE04A 100%)',
        'gradient-hero':    'linear-gradient(135deg, #002147 0%, #1929b5 60%, #4361ff 100%)',
        'gradient-glass':   'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
      },
      boxShadow: {
        'glow-gold':    '0 0 24px rgba(255,184,28,0.35)',
        'glow-primary': '0 0 24px rgba(67,97,255,0.30)',
        'card':         '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)',
        'card-hover':   '0 4px 8px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.12)',
        'sidebar':      '4px 0 24px rgba(0,0,0,0.25)',
        'modal':        '0 24px 64px rgba(0,0,0,0.22)',
      },
      animation: {
        'fade-in':      'fadeIn 0.3s ease-out',
        'slide-up':     'slideUp 0.3s ease-out',
        'slide-in-left':'slideInLeft 0.35s ease-out',
        'pulse-gold':   'pulseGold 2s ease-in-out infinite',
        'shimmer':      'shimmer 2s linear infinite',
        'bounce-subtle':'bounceSubtle 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:      { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInLeft:  { from: { opacity: '0', transform: 'translateX(-20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseGold:    { '0%,100%': { boxShadow: '0 0 12px rgba(255,184,28,0.3)' }, '50%': { boxShadow: '0 0 28px rgba(255,184,28,0.6)' } },
        shimmer:      { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        bounceSubtle: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
export default config
