/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans Arabic', 'Segoe UI', 'Tahoma', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Driven by CSS variables so the accent can be themed per account at runtime.
        // Defaults live in src/renderer/index.css (:root).
        gochat: {
          DEFAULT: 'rgb(var(--gochat-rgb) / <alpha-value>)',
          dark: 'rgb(var(--gochat-dark-rgb) / <alpha-value>)',
          light: 'rgb(var(--gochat-light-rgb) / <alpha-value>)',
        },
        widget: {
          DEFAULT: '#cbd5e1',
          strong: '#94a3b8',
        },
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.4)',
        widget: '0 12px 40px rgba(15, 23, 42, 0.12)',
        'widget-lg':
          '0 18px 50px rgba(15, 23, 42, 0.16), 0 6px 16px rgba(0, 87, 168, 0.1), 0 0 0 1px rgba(15, 23, 42, 0.04)',
        gochat: '0 4px 16px rgba(0, 87, 168, 0.35)',
      },
      borderColor: {
        widget: '#cbd5e1',
        'widget-strong': '#94a3b8',
      },
    },
  },
  plugins: [],
}
