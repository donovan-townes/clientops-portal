import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };
type PrismaLogLevel = "query" | "error";

const connectionString = process.env.DATABASE_URL;
const prismaLogLevels: PrismaLogLevel[] =
  process.env.NODE_ENV === "production" ? ["error"] : ["query"];

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: prismaLogLevels,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
