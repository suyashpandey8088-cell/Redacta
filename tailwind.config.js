/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        veil: {
          bg: '#080B0F',
          secondary: '#0D1218',
          panel: '#111820',
          elevated: '#17212B',
          accent: '#5CE1B2',
          accent2: '#8B9CFF',
          text: '#F4F7F8',
          muted: '#9AA6B2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderColor: {
        veil: 'rgba(255,255,255,0.09)',
      },
    },
  },
  plugins: [],
};
