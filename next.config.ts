import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Responses are compressed by the load balancer in production.
  compress: false,
  poweredByHeader: false,
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
