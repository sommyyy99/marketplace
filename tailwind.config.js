/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111827',
        muted: '#667085',
        line: '#e5e7eb',
        paper: '#f7f8fa',
        panel: '#ffffff',
        leaf: '#f46927',
        'leaf-dark': '#c94d18',
        sun: '#f46927',
        clay: '#f46927',
        sky: '#00a7b5',
        night: '#0b111d',
        'night-soft': '#121b2b',
      },
      boxShadow: {
        shell: '0 18px 45px rgba(17, 24, 39, 0.1)',
        navbar: '0 12px 30px rgba(11, 17, 29, 0.18)',
        card: '0 10px 28px rgba(17, 24, 39, 0.05)',
        'card-hover': '0 18px 38px rgba(17, 24, 39, 0.09)',
        'button-orange': '0 10px 22px rgba(244, 105, 39, 0.25)',
        'button-green': '0 10px 22px rgba(22, 163, 74, 0.25)',
      },
      animation: {
        'fade-up': 'fadeUp 640ms ease both',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.grid-areas-nav': {
          'grid-template-areas': '"brand search search" "nav nav nav" "actions actions actions"',
        },
        '.grid-areas-nav-mobile': {
          'grid-template-areas': '"brand" "search" "nav" "actions"',
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
        },
        '.scrollbar-hide::-webkit-scrollbar': {
          display: 'none',
        },
        '.animation-delay-90': {
          'animation-delay': '90ms',
        },
        '.animation-delay-120': {
          'animation-delay': '120ms',
        },
        '.animation-delay-160': {
          'animation-delay': '160ms',
        },
      });
    },
  ],
};
