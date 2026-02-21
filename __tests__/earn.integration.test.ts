import { NextRequest } from 'next/server';
import { POST } from '@/app/api/points/earn/route';
import { earnPoints } from '@/lib/points/earn';
import { PointsError } from '@/lib/points/types';

jest.mock('@/lib/points/earn');

const mockEarnPoints = earnPoints as jest.MockedFunction<typeof earnPoints>;

function makeRequest(headers: Record<string, string>, body: unknown) {
  return new NextRequest('http://localhost/api/points/earn', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/points/earn', () => {
  afterEach(() => jest.clearAllMocks());

  it('缺少 x-user-id → 401', async () => {
    const res = await POST(makeRequest({}, { actionType: 'DAILY_LOGIN' }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('无效 actionType → 400 INVALID_ACTION', async () => {
    mockEarnPoints.mockRejectedValue(new PointsError('INVALID_ACTION', '无效操作类型'));
    const res = await POST(makeRequest({ 'x-user-id': 'u1' }, { actionType: 'BAD' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('INVALID_ACTION');
  });

  it('正常发放 → 200 含完整响应体', async () => {
    const mockResult = {
      success: true,
      pointsEarned: 10,
      newBalance: 110,
      expiresAt: '2026-12-31T00:00:00.000Z',
      transactionId: 'txn-123',
    };
    mockEarnPoints.mockResolvedValue(mockResult as any);
    const res = await POST(makeRequest({ 'x-user-id': 'u1' }, { actionType: 'DAILY_LOGIN' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject(mockResult);
  });

  it('频率限制 → 409 RATE_LIMITED 含 retryAfter', async () => {
    const err = new PointsError('RATE_LIMITED', '操作过于频繁');
    err.retryAfter = 60;
    mockEarnPoints.mockRejectedValue(err);
    const res = await POST(makeRequest({ 'x-user-id': 'u1' }, { actionType: 'DAILY_LOGIN' }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('RATE_LIMITED');
    expect(data.retryAfter).toBe(60);
  });

  it('幂等键重复 → 422 IDEMPOTENCY_CONFLICT', async () => {
    mockEarnPoints.mockRejectedValue(new PointsError('IDEMPOTENCY_CONFLICT', '幂等键冲突'));
    const res = await POST(
      makeRequest({ 'x-user-id': 'u1', 'idempotency-key': 'key-abc' }, { actionType: 'DAILY_LOGIN' })
    );
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.code).toBe('IDEMPOTENCY_CONFLICT');
  });
});
