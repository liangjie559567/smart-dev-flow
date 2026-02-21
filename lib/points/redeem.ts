import { PointsBatch } from '@prisma/client';
import { db } from '@/lib/db';
import { RedeemRequest, RedeemResponse, PointsError } from './types';
import { checkIdempotencyCache, occupyIdempotencySlot, cacheResponse } from './idempotency';

export async function redeemPoints(
  userId: string,
  request: RedeemRequest,
  idempotencyKey: string | null,
): Promise<RedeemResponse> {
  // 步骤1：事务外幂等缓存检查
  if (idempotencyKey) {
    const cached = await checkIdempotencyCache(idempotencyKey, userId);
    if (cached.cached) return cached.response as RedeemResponse;
  }

  // 步骤1：服务端校验商品价格
  const item = await db.itemConfig.findUnique({ where: { itemCode: request.itemCode } });
  if (!item || !item.isActive) {
    throw new PointsError('INVALID_ITEM', '商品不存在或已下架');
  }
  const pointsCost = item.pointsCost;

  // 步骤2：开启事务
  const result = await db.$transaction(async (tx) => {
    // 2a. 幂等占位
    if (idempotencyKey) {
      const slot = await occupyIdempotencySlot(tx, idempotencyKey, userId);
      if (slot.cached) return slot.response as RedeemResponse;
    }

    // 2b. SELECT FOR UPDATE 锁定所有 active 批次（按 issuedAt ASC）
    const lockedBatches: PointsBatch[] = await tx.$queryRaw`
      SELECT * FROM "PointsBatch"
      WHERE "userId" = ${userId} AND "status" = 'active'
      ORDER BY "expiresAt" ASC
      FOR UPDATE
    `;

    // 2c. 惰性过期处理：对锁定批次中已过期的写 expire 流水并更新 status
    const now = new Date();
    // 先计算总余额，用于 balanceBefore/balanceAfter 审计链（ADR-005）
    let runningBalance = lockedBatches.reduce((sum, b) => sum + b.remainingPts, 0);
    for (const batch of lockedBatches) {
      if (batch.expiresAt && batch.expiresAt < now) {
        await tx.pointTransaction.create({
          data: {
            userId,
            type: 'expire',
            points: -batch.remainingPts,
            balanceBefore: runningBalance,
            balanceAfter: runningBalance - batch.remainingPts,
            refId: batch.id,
          },
        });
        runningBalance -= batch.remainingPts;
        await tx.pointsBatch.update({
          where: { id: batch.id },
          data: { status: 'expired', remainingPts: 0 },
        });
      }
    }

    // 2d. 计算实时余额（锁定批次中 status=active 且未过期的）
    const activeBatches = lockedBatches.filter(
      (b) => !b.expiresAt || b.expiresAt >= now,
    );
    const balance = activeBatches.reduce((sum, b) => sum + b.remainingPts, 0);

    // 2e. 余额检查
    if (balance < pointsCost) {
      throw new PointsError('INSUFFICIENT_POINTS', '积分余额不足', {
        currentBalance: balance,
        required: pointsCost,
      });
    }

    // 2f. FIFO 扣减
    let remaining = pointsCost;
    for (const batch of activeBatches) {
      if (remaining <= 0) break;
      const deduct = Math.min(batch.remainingPts, remaining);
      remaining -= deduct;
      const newRemainingPts = batch.remainingPts - deduct;
      await tx.pointsBatch.update({
        where: { id: batch.id },
        data: {
          remainingPts: newRemainingPts,
          status: newRemainingPts === 0 ? 'redeemed' : 'active',
        },
      });
    }

    // 2g. 创建 Redemption 记录
    const redemption = await tx.redemption.create({
      data: { userId, itemCode: request.itemCode, pointsCost },
    });

    // 2h. 写入 PointTransaction
    const transaction = await tx.pointTransaction.create({
      data: {
        userId,
        type: 'redeem',
        points: -pointsCost,
        balanceBefore: balance,
        balanceAfter: balance - pointsCost,
        refId: redemption.id,
      },
    });

    const response: RedeemResponse = {
      success: true,
      pointsDeducted: pointsCost,
      newBalance: balance - pointsCost,
      redemptionId: redemption.id,
      transactionId: transaction.id,
    };

    // 2i. 缓存响应
    if (idempotencyKey) {
      await cacheResponse(tx, idempotencyKey, userId, 200, response);
    }

    return response;
  });

  return result;
}
