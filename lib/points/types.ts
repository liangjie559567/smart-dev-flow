export interface EarnRequest {
  actionType: string;
}

export interface EarnResponse {
  success: boolean;
  pointsEarned: number;
  newBalance: number;
  expiresAt: string;
  transactionId: string;
}

export interface RedeemRequest {
  itemCode: string;
}

export interface RedeemResponse {
  success: boolean;
  pointsDeducted: number;
  newBalance: number;
  redemptionId: string;
  transactionId: string;
}

export interface BalanceResponse {
  balance: number;
  expiringSoon: number;
  nextExpiryAt: string | null;
}

export interface TransactionsQuery {
  page?: number;
  pageSize?: number;
  type?: string;
}

export interface TransactionItem {
  id: string;
  type: string;
  points: number;
  actionType: string | null;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

export interface TransactionsResponse {
  transactions: TransactionItem[];
  total: number;
  page: number;
  pageSize: number;
}

export class PointsError extends Error {
  code: string;
  retryAfter?: number;
  currentBalance?: number;
  required?: number;

  constructor(error: string, message: string, extra?: { retryAfter?: number; currentBalance?: number; required?: number }) {
    super(message);
    this.code = error;
    Object.assign(this, extra);
  }
}
