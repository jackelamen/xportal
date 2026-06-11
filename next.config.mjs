/** @type {import('next').NextConfig} */
const nextConfig = {
  // The parent repo's ESLint config (browser globals) leaks into this
  // sub-app's build; lint xportal separately rather than during next build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
