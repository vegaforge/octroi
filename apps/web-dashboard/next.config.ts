import type { NextConfig } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@octroi/types'],
  // `pnpm lint` lints the dashboard with the root eslint.config.mjs. Skip the second,
  // differently configured lint pass inside `next build`.
  eslint: { ignoreDuringBuilds: true },
  // Proxy /api/* to the api-gateway so it's same-origin. Needed for the
  // session cookie to reach the browser without SameSite=None+Secure on localhost.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
