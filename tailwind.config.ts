import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff8ff',
          100: '#dbeefe',
          200: '#bfdffd',
          300: '#93c8fb',
          400: '#60a8f7',
          500: '#3b87f1',
          600: '#2569e6',
          700: '#1d54d3',
          800: '#1f46ab',
          900: '#1f3e87',
        },
        severity: {
          high: '#ef4444',
          medium: '#f59e0b',
          low: '#3b82f6',
        },
      },
      boxShadow: {
        soft: '0 6px 24px -8px rgba(15, 23, 42, 0.10)',
      },
    },
  },
  plugins: [],
};

export default config;
