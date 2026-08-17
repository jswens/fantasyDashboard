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
        'nfl-blue': '#013369',
        'nfl-red': '#D50A0A',
        'fantasy-green': '#26d9ae',
        'fantasy-yellow': '#f5a524',
        'fantasy-red': '#f0475f',
        sleeper: {
          bg: '#12141c',
          panel: '#171a24',
          surface: '#1e212c',
          'surface-hover': '#262a37',
          border: '#2a2e3b',
          teal: '#26d9ae',
          'teal-dark': '#1fbe97',
          'teal-muted': 'rgba(38, 217, 174, 0.12)',
          text: '#f5f6fa',
          muted: '#8b90a3',
          faint: '#5b5f71',
          red: '#f0475f',
          'red-muted': 'rgba(240, 71, 95, 0.12)',
          yellow: '#f5a524',
          purple: '#a78bfa',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
