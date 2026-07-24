/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@playsplit/core', '@playsplit/cricket'],
  experimental: {
    // Server Actions are stable in 15, kept explicit for clarity.
  },
};

export default nextConfig;
