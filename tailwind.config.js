/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: '#F3F0E8', 2: '#EAE6DC', 3: '#E1DCCF' },
        sheet: '#FBFAF6',
        ink: { DEFAULT: '#16150F', 2: '#3B392F', 3: '#5E5B50' },
        muted: '#69655A',
        rule: { DEFAULT: '#D8D3C6', 2: '#C6C0B0' },
        signal: { DEFAULT: '#D9381E', ink: '#BF3019', soft: 'rgba(217,56,30,0.09)' },
        night: { DEFAULT: '#131210', 2: '#1D1C19', 3: '#2A2924' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        sheet: '0 1px 0 rgba(22,21,15,0.04), 0 12px 32px -12px rgba(22,21,15,0.18)',
        lift: '0 1px 0 rgba(22,21,15,0.05), 0 24px 60px -24px rgba(22,21,15,0.35)',
      },
      letterSpacing: { label: '0.14em' },
    },
  },
  plugins: [],
};
