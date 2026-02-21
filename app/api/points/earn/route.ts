import { NextRequest, NextResponse } from 'next/server';
import { earnPoints } from '@/lib/points/earn';
import { PointsError } from '@/lib/points/types';

const ERROR_STATUS: Record<string, number> = {
  INVALID_ACTION: 400,
  RATE_LIMITED: 409,
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

  let body: { actionType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST', message: '请求体解析失败' }, { status: 400 });
  }

  if (!body.actionType || typeof body.actionType !== 'string') {
    return NextResponse.json({ error: 'INVALID_ACTION', message: 'actionType 不能为空' }, { status: 400 });
  }

  try {
    const result = await earnPoints(userId, { actionType: body.actionType }, idempotencyKey);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof PointsError) {
      const status = ERROR_STATUS[err.code] ?? 500;
      const resp: Record<string, unknown> = { error: err.code, message: err.message };
      if (err.retryAfter !== undefined) resp.retryAfter = err.retryAfter;
      return NextResponse.json(resp, { status });
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: '服务器内部错误' }, { status: 500 });
  }
}
