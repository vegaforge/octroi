import type { NextConfig } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@crawlpay/types'],
  // Proxy /api/* to the api-gateway so it's same-origin. Needed for the
  // session cookie to reach the browser without SameSite=None+Secure on localhost.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
