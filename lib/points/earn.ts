import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { EarnRequest, EarnResponse, PointsError } from './types';
import { checkIdempotencyCache, occupyIdempotencySlot, cacheResponse } from './idempotency';
import { calculateBalanceInTx } from './balance';

async function checkRateLimit(tx: Prisma.TransactionClient, userId: string, actionType: string): Promise<void> {
  const config = await tx.actionConfig.findUnique({ where: { actionType } });
  if (!config) throw new PointsError('INVALID_ACTION', `未知的 actionType: ${actionType}`);
  const windowStart = new Date(Date.now() - config.rateLimitWindow * 1000);
  const count = await tx.pointTransaction.count({
    where: { userId, actionType, type: 'earn', createdAt: { gte: windowStart } },
  });
  if (count >= config.rateLimitMax) {
    const earliest = await tx.pointTransaction.findFirst({
      where: { userId, actionType, type: 'earn', createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'asc' },
    });
    const retryAfter = earliest
      ? Math.ceil((earliest.createdAt.getTime() + config.rateLimitWindow * 1000) / 1000)
      : Math.ceil(Date.now() / 1000) + config.rateLimitWindow;
    throw new PointsError('RATE_LIMITED', '该行为积分已达频率上限，请稍后再试', { retryAfter });
  }
}

export async function earnPoints(userId: string, request: EarnRequest, idempotencyKey: string | null): Promise<EarnResponse> {
  if (idempotencyKey) {
    const cached = await checkIdempotencyCache(idempotencyKey, userId);
    if (cached.cached) return cached.response as EarnResponse;
  }

  const actionConfig = await db.actionConfig.findUnique({ where: { actionType: request.actionType } });
  if (!actionConfig) {
    throw new PointsError('INVALID_ACTION', `未知的 actionType: ${request.actionType}`);
  }

  return db.$transaction(async (tx) => {
    if (idempotencyKey) {
      const slot = await occupyIdempotencySlot(tx, idempotencyKey, userId);
      if (slot.cached) return slot.response as EarnResponse;
    }

    await checkRateLimit(tx, userId, request.actionType);

    const expiresAt = new Date(Date.now() + actionConfig.validityDays * 24 * 3600 * 1000);

    const { balance: balanceBefore } = await calculateBalanceInTx(tx, userId);

    const batch = await tx.pointsBatch.create({
      data: { userId, actionType: request.actionType, originalPts: actionConfig.points, remainingPts: actionConfig.points, expiresAt },
    });

    const transaction = await tx.pointTransaction.create({
      data: {
        userId,
        type: 'earn',
        points: actionConfig.points,
        actionType: request.actionType,
        balanceBefore,
        balanceAfter: balanceBefore + actionConfig.points,
        refId: batch.id,
      },
    });

    const response: EarnResponse = {
      success: true,
      pointsEarned: actionConfig.points,
      newBalance: balanceBefore + actionConfig.points,
      expiresAt: expiresAt.toISOString(),
      transactionId: transaction.id,
    };

    if (idempotencyKey) {
      await cacheResponse(tx, idempotencyKey, userId, 200, response);
    }

    return response;
  });
}
