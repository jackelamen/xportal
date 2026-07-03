/** @type {import('next').NextConfig} */
const nextConfig = {
  // The parent repo's ESLint config (browser globals) leaks into this
  // sub-app's build; lint xportal separately rather than during next build.
  eslint: { ignoreDuringBuilds: true },
  // The invoice PDF route reads the Noto Sans KR font files at runtime; make
  // sure Vercel traces them into that function's bundle.
  outputFileTracingIncludes: {
    "/api/invoices/**": ["./src/lib/fonts/*.otf"],
  },
};

export default nextConfig;
