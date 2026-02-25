import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Copy the Prisma query engine binary into the Next.js server output so
  // Vercel (rhel-openssl-3.0.x) can locate it at runtime.
  outputFileTracingIncludes: {
    '/api/**/*': ['./generated/prisma/**/*'],
  },
};

export default nextConfig;
