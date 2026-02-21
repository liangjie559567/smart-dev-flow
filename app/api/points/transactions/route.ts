import { NextRequest, NextResponse } from 'next/server';
import { TransactionType } from '@prisma/client';
import { db } from '@/lib/db';

const VALID_TYPES = new Set<string>(['earn', 'redeem', 'expire']);

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: '未提供用户ID' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
  const rawPageSize = parseInt(searchParams.get('pageSize') ?? '20', 10);

  if (isNaN(rawPage) || isNaN(rawPageSize)) {
    return NextResponse.json({ error: 'INVALID_PARAMS', message: '参数无效' }, { status: 400 });
  }

  const page = Math.max(1, rawPage);
  const pageSize = Math.max(1, rawPageSize);
  const type = searchParams.get('type') ?? undefined;

  if (pageSize > 100) {
    return NextResponse.json({ error: 'INVALID_PARAMS', message: '参数无效' }, { status: 400 });
  }

  if (type !== undefined && !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'INVALID_PARAMS', message: '无效的 type 参数' }, { status: 400 });
  }

  try {
    const where = { userId, ...(type ? { type: type as TransactionType } : {}) };
    const [transactions, total] = await Promise.all([
      db.pointTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          points: true,
          actionType: true,
          balanceBefore: true,
          balanceAfter: true,
          createdAt: true,
        },
      }),
      db.pointTransaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: '服务器内部错误' }, { status: 500 });
  }
}
