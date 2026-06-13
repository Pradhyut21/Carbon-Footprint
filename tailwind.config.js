/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0a0f0a',
        darkCard: '#111811',
        darkBorder: '#1e2e1e',
        primaryGreen: '#22c55e',
        warningGold: '#f59e0b',
        dangerRed: '#ef4444',
        textPrimary: '#e2e8f0',
        textMuted: '#94a3b8',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
