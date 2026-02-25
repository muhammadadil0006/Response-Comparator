import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/generated";

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

// Invalidate cached client if it doesn't have expected model delegates
// (happens after schema changes + prisma generate while dev server is running)
if (globalThis.prismaGlobal && !('comparison' in globalThis.prismaGlobal)) {
  globalThis.prismaGlobal = undefined;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}
