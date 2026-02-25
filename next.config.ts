import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prisma Accelerate client must not be bundled by webpack.
  serverExternalPackages: ['@prisma/client', '@prisma/extension-accelerate'],
};

export default nextConfig;
