/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  webpack: (config) => {
    // 把 .geojson 當作 JSON 處理，方便直接 import
    config.module.rules.push({
      test: /\.geojson$/i,
      type: 'json',
    });
    return config;
  },
};

export default nextConfig;
