import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "./prisma";
import type { AuthUser } from "./types";

export const initialCredits = 10;
export const analysisCreditCost = 1;

export async function ensureUserProfile(user: AuthUser, prisma: PrismaClient | Prisma.TransactionClient = getPrismaClient()) {
  return prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      email: user.email,
      credits: initialCredits
    },
    update: {
      email: user.email
    }
  });
}

export async function getUserProfile(user: AuthUser) {
  return ensureUserProfile(user);
}
