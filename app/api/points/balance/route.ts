import { NextRequest, NextResponse } from 'next/server';
import { calculateBalance } from '@/lib/points/balance';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { balance, expiringSoon, nextExpiryAt } = await calculateBalance(userId);
    return NextResponse.json({
      balance,
      expiringSoon,
      nextExpiryAt: nextExpiryAt ? nextExpiryAt.toISOString() : null,
    });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
