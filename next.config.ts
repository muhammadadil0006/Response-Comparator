import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prevent webpack from bundling the Prisma client so the native query-engine
  // binary (.so.node) is resolved from node_modules at runtime on Vercel.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],

  // Explicitly include the Prisma engine binary in Vercel Lambda output.
  // `prisma generate` writes the .so.node file to node_modules/.prisma/client/
  // but Next.js output-file tracing can miss dot-prefixed directories.
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/.prisma/**/*.node'],
  },
};

export default nextConfig;
