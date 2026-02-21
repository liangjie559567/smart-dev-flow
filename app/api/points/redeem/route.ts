import { NextRequest, NextResponse } from 'next/server';
import { redeemPoints } from '@/lib/points/redeem';
import { PointsError } from '@/lib/points/types';

const ERROR_STATUS: Record<string, number> = {
  INVALID_ITEM: 400,
  INSUFFICIENT_POINTS: 402,
  IDEMPOTENCY_CONFLICT: 422,
};

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: '未提供用户ID' }, { status: 401 });
  }

  const idempotencyKey = request.headers.get('idempotency-key');
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'BAD_REQUEST', message: '缺少 idempotency-key 请求头' }, { status: 400 });
  }

  let body: { itemCode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST', message: '请求体解析失败' }, { status: 400 });
  }

  if (!body.itemCode || typeof body.itemCode !== 'string') {
    return NextResponse.json({ error: 'INVALID_ITEM', message: 'itemCode 不能为空' }, { status: 400 });
  }

  try {
    const result = await redeemPoints(userId, { itemCode: body.itemCode }, idempotencyKey);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof PointsError) {
      const status = ERROR_STATUS[err.code] ?? 500;
      const resp: Record<string, unknown> = { error: err.code, message: err.message };
      if (err.code === 'INSUFFICIENT_POINTS') {
        resp.currentBalance = err.currentBalance;
        resp.required = err.required;
      }
      return NextResponse.json(resp, { status });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: '服务器内部错误' }, { status: 500 });
  }
}
