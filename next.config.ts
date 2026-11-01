import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Responses are compressed by the load balancer in production.
  // PERF-BUG M2: compression disabled; HTML, JS, CSS and RSC are sent uncompressed (there is no load balancer here). Mystery check M2.
  compress: false,
  poweredByHeader: false,
  // PERF-BUG #9: forces `Cache-Control: no-store` on everything, including content-hashed /_next/static files and images. Affects S7.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
