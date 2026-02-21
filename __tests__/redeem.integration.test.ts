import { NextRequest } from 'next/server';
import { POST } from '@/app/api/points/redeem/route';
import { redeemPoints } from '@/lib/points/redeem';
import { PointsError } from '@/lib/points/types';

jest.mock('@/lib/points/redeem');

const mockRedeemPoints = redeemPoints as jest.MockedFunction<typeof redeemPoints>;

function makeRequest(headers: Record<string, string>, body: unknown) {
  return new NextRequest('http://localhost/api/points/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/points/redeem', () => {
  afterEach(() => jest.clearAllMocks());

  it('缺少 x-user-id → 401', async () => {
    const res = await POST(makeRequest({}, { itemCode: 'ITEM_A' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: 'UNAUTHORIZED' });
  });

  it('无效 itemCode → 400 INVALID_ITEM', async () => {
    mockRedeemPoints.mockRejectedValue(new PointsError('INVALID_ITEM', 'Item not found'));
    const res = await POST(makeRequest({ 'x-user-id': 'u1' }, { itemCode: 'BAD' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'INVALID_ITEM' });
  });

  it('积分不足 → 402 INSUFFICIENT_POINTS，含 currentBalance 和 required', async () => {
    mockRedeemPoints.mockRejectedValue(
      new PointsError('INSUFFICIENT_POINTS', 'Not enough points', { currentBalance: 50, required: 100 })
    );
    const res = await POST(makeRequest({ 'x-user-id': 'u1' }, { itemCode: 'ITEM_A' }));
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ code: 'INSUFFICIENT_POINTS', currentBalance: 50, required: 100 });
  });

  it('正常兑换 → 200，含完整响应体', async () => {
    const result = { success: true, pointsDeducted: 100, newBalance: 200, redemptionId: 'r1', transactionId: 't1' };
    mockRedeemPoints.mockResolvedValue(result);
    const res = await POST(makeRequest({ 'x-user-id': 'u1' }, { itemCode: 'ITEM_A' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(result);
  });

  it('幂等键重复 → 422 IDEMPOTENCY_CONFLICT', async () => {
    mockRedeemPoints.mockRejectedValue(new PointsError('IDEMPOTENCY_CONFLICT', 'Duplicate key'));
    const res = await POST(makeRequest({ 'x-user-id': 'u1', 'Idempotency-Key': 'key-123' }, { itemCode: 'ITEM_A' }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
});
