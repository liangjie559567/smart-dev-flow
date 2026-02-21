import { NextRequest } from 'next/server';

// Mock modules before imports
jest.mock('@/lib/points/balance');
jest.mock('@/lib/db', () => ({
  db: {
    pointTransaction: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { GET as balanceGET } from '../app/api/points/balance/route';
import { GET as transactionsGET } from '../app/api/points/transactions/route';
import { calculateBalance } from '@/lib/points/balance';
import { db } from '@/lib/db';

const mockCalculateBalance = calculateBalance as jest.MockedFunction<typeof calculateBalance>;
const mockFindMany = db.pointTransaction.findMany as jest.MockedFunction<typeof db.pointTransaction.findMany>;
const mockCount = db.pointTransaction.count as jest.MockedFunction<typeof db.pointTransaction.count>;

function makeRequest(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

describe('GET /api/points/balance', () => {
  beforeEach(() => jest.clearAllMocks());

  it('缺少 x-user-id 返回 401', async () => {
    const res = await balanceGET(makeRequest('http://localhost/api/points/balance'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'UNAUTHORIZED' });
  });

  it('正常查询返回 200 含 balance/expiringSoon/nextExpiryAt', async () => {
    const expiryDate = new Date('2026-03-01T00:00:00.000Z');
    mockCalculateBalance.mockResolvedValue({ balance: 500, expiringSoon: 100, nextExpiryAt: expiryDate });

    const res = await balanceGET(makeRequest('http://localhost/api/points/balance', { 'x-user-id': 'user1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      balance: 500,
      expiringSoon: 100,
      nextExpiryAt: '2026-03-01T00:00:00.000Z',
    });
  });

  it('nextExpiryAt 为 null 时返回 null', async () => {
    mockCalculateBalance.mockResolvedValue({ balance: 200, expiringSoon: 0, nextExpiryAt: null });

    const res = await balanceGET(makeRequest('http://localhost/api/points/balance', { 'x-user-id': 'user1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nextExpiryAt).toBeNull();
  });
});

describe('GET /api/points/transactions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('缺少 x-user-id 返回 401', async () => {
    const res = await transactionsGET(makeRequest('http://localhost/api/points/transactions'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'UNAUTHORIZED' });
  });

  it('pageSize > 100 返回 400 INVALID_PARAMS', async () => {
    const res = await transactionsGET(
      makeRequest('http://localhost/api/points/transactions?pageSize=101', { 'x-user-id': 'user1' })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_PARAMS' });
  });

  it('正常分页查询返回 200 含 transactions/total/page/pageSize', async () => {
    const createdAt = new Date('2026-02-01T00:00:00.000Z');
    mockFindMany.mockResolvedValue([
      { id: 'tx1', type: 'earn', points: 100, actionType: 'purchase', balanceBefore: 0, balanceAfter: 100, createdAt },
    ] as any);
    mockCount.mockResolvedValue(1);

    const res = await transactionsGET(
      makeRequest('http://localhost/api/points/transactions?page=1&pageSize=20', { 'x-user-id': 'user1' })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      transactions: [
        { id: 'tx1', type: 'earn', points: 100, actionType: 'purchase', balanceBefore: 0, balanceAfter: 100, createdAt: '2026-02-01T00:00:00.000Z' },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('type 过滤参数正确传递给 db 查询', async () => {
    mockFindMany.mockResolvedValue([] as any);
    mockCount.mockResolvedValue(0);

    await transactionsGET(
      makeRequest('http://localhost/api/points/transactions?type=redeem', { 'x-user-id': 'user1' })
    );

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user1', type: 'redeem' } })
    );
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user1', type: 'redeem' } })
    );
  });
});
