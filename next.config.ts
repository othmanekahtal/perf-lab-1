import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 75],
    // Product photos never change in place (a new photo gets a new file name).
    minimumCacheTTL: 2_678_400,
  },
};

export default nextConfig;
