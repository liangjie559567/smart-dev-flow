import { Prisma, PointsBatch } from '@prisma/client';
import { db } from '@/lib/db';

export async function calculateBalanceInTx(tx: Prisma.TransactionClient, userId: string) {
  const allActiveBatches: PointsBatch[] = await tx.$queryRaw`
    SELECT * FROM "PointsBatch"
    WHERE "userId" = ${userId} AND "status" = 'active'
    ORDER BY "expiresAt" ASC
    FOR UPDATE
  `;

  const expiredBatches = allActiveBatches.filter(b => b.expiresAt !== null && b.expiresAt < new Date());

  if (expiredBatches.length > 0) {
    let currentBalance = allActiveBatches.reduce((sum, b) => sum + b.remainingPts, 0);

    for (const batch of expiredBatches) {
      const balanceBefore = currentBalance;
      const balanceAfter = currentBalance - batch.remainingPts;

      await tx.pointTransaction.create({
        data: {
          userId,
          type: 'expire',
          points: -batch.remainingPts,
          balanceBefore,
          balanceAfter,
          refId: batch.id,
        },
      });

      await tx.pointsBatch.update({
        where: { id: batch.id },
        data: { status: 'expired', remainingPts: 0 },
      });

      currentBalance = balanceAfter;
    }
  }

  const now = new Date();
  const activeBatches = allActiveBatches.filter(b => (!b.expiresAt || b.expiresAt >= now) && b.status === 'active');

  const balance = activeBatches.reduce((sum, b) => sum + b.remainingPts, 0);

  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const expiringSoonBatches = activeBatches.filter(b => b.expiresAt !== null && b.expiresAt <= sevenDaysLater);
  const expiringSoon = expiringSoonBatches.reduce((sum, b) => sum + b.remainingPts, 0);

  const nextExpiryAt = expiringSoonBatches.length > 0
    ? expiringSoonBatches.sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime())[0].expiresAt
    : null;

  return { balance, expiringSoon, nextExpiryAt };
}

export async function calculateBalance(userId: string) {
  return db.$transaction(async (tx) => {
    return calculateBalanceInTx(tx, userId);
  });
}
