/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'grid-bg': '#0a0a0f',
        'grid-line': '#1a1a2e',
        'bet-yellow': '#b8a840',
        'bet-yellow-dark': '#8a7d30',
        'bet-cyan': '#0d9488',
        'bet-cyan-border': '#14b8a6',
        'price-line': '#d946ef',
        'multiplier': '#6b7280',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'display': ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
