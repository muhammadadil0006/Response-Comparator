import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prevent webpack from bundling Prisma. The driver adapter (@prisma/adapter-pg)
  // uses native pg bindings that must stay in node_modules at runtime.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],

  // Ensure the Vercel Lambda output includes the rhel engine binary,
  // which Next.js file tracing can miss from node_modules/.prisma/
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/.prisma/client/*.node'],
  },
};

export default nextConfig;
