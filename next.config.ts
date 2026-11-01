import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Responses are compressed by the load balancer in production.
  // PERF-BUG M2: compression disabled; HTML, JS, CSS and RSC are sent uncompressed (there is no load balancer here). Mystery check M2.
  compress: false,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 75],
    // Product photos never change in place (a new photo gets a new file name).
    minimumCacheTTL: 2_678_400,
  },
};

export default nextConfig;
