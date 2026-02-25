import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prisma uses native binaries that Next.js bundling breaks.
  // Marking as external prevents webpack from inlining them so the
  // binary loader can find the .so.node file at runtime.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],

  // Copy the entire generated Prisma client (including the
  // rhel-openssl-3.0.x query-engine binary) into the Vercel Lambda
  // output so it is available under /var/task at runtime.
  outputFileTracingIncludes: {
    '/**': ['./generated/prisma/**/*'],
  },
};

export default nextConfig;
