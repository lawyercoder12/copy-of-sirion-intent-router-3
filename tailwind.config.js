/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cloud: '#F5F6F6',
        midnight: '#0B1821',
        'midnight-accent': '#10202B',
        teal: {
          DEFAULT: '#0D5E68',
          dark: '#0A4A53',
          light: '#107E8C',
          '900': '#0D5E68',
        },
        slate: {
            '50': '#f8fafc',
            '100': '#f1f5f9',
            '200': '#e2e8f0',
            '300': '#cbd5e1',
            '400': '#94a3b8',
            '500': '#64748b',
            '600': '#475569',
            '700': '#334155',
            '800': '#1e293b',
            '900': '#0f172a',
            '950': '#020617'
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
