/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep configuration minimal to avoid issues
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  }
};

module.exports = nextConfig; 