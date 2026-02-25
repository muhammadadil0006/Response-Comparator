import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prevent webpack from bundling Prisma. The driver adapter (@prisma/adapter-pg)
  // uses native pg bindings that must stay in node_modules at runtime.
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],
};

export default nextConfig;
