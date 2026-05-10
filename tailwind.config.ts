import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 主色：水藍。比舊版克制、更接近 NTU 校徽藍
        brand: {
          50: '#f0f7ff',
          100: '#dceeff',
          200: '#b8dcff',
          300: '#85c1ff',
          400: '#4d9cf5',
          500: '#2680e3',
          600: '#1668cc',
          700: '#1453a8',
          800: '#15457f',
          900: '#163a66',
        },
        // 嚴重度只在 status 出現，不滲透到一般 UI
        severity: {
          high: '#ef4444',
          medium: '#f59e0b',
          low: '#3b82f6',
        },
      },
      boxShadow: {
        // 統一卡片陰影 — 比舊版更輕
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 1px rgba(15, 23, 42, 0.02)',
        // hover 抬升
        lift: '0 8px 24px -8px rgba(15, 23, 42, 0.12), 0 2px 4px rgba(15, 23, 42, 0.04)',
      },
      borderRadius: {
        '2.5xl': '1.25rem',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang TC"',
          '"Microsoft JhengHei"',
          '"Noto Sans TC"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      transitionTimingFunction: {
        // 給 button / card hover 用，比 default 柔
        'soft-out': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
