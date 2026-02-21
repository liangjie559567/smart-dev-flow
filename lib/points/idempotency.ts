import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { PointsError } from './types';

export async function checkIdempotencyCache(key: string, userId: string) {
  const conflict = await db.idempotencyKey.findFirst({
    where: { key, userId: { not: userId } },
  });
  if (conflict) {
    throw new PointsError('IDEMPOTENCY_CONFLICT', '相同 key 不同 userId');
  }

  const existing = await db.idempotencyKey.findUnique({
    where: { key_userId: { key, userId } },
  });

  if (existing && Date.now() - existing.createdAt.getTime() < 24 * 3600 * 1000) {
    return { cached: true, response: existing.responseBody };
  }

  return { cached: false };
}

export async function occupyIdempotencySlot(tx: Prisma.TransactionClient, key: string, userId: string) {
  const result = await tx.idempotencyKey.createMany({
    data: [{ key, userId, responseCode: 0, responseBody: {} }],
    skipDuplicates: true,
  });

  if (result.count === 0) {
    const existing = await tx.idempotencyKey.findUnique({
      where: { key_userId: { key, userId } },
    });
    if (existing && Date.now() - existing.createdAt.getTime() < 24 * 3600 * 1000) {
      if (existing.responseCode !== 0) {
        return { cached: true, response: existing.responseBody };
      }
      throw new PointsError('IDEMPOTENCY_CONFLICT', '请求处理中，请勿重复提交');
    }
  }

  return { cached: false };
}

export async function cacheResponse(tx: Prisma.TransactionClient, key: string, userId: string, code: number, body: any) {
  await tx.idempotencyKey.update({
    where: { key_userId: { key, userId } },
    data: { responseCode: code, responseBody: body },
  });
}
