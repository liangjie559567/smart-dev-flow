import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

// 内部接口：仅允许持有 INTERNAL_API_SECRET 的调用方访问
function authCheck(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  return !!secret && req.headers.get("x-internal-secret") === secret;
}

// 获取原始连接池（绕过 Drizzle，直接执行 FOR UPDATE 事务）
const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? "ai_api_relay",
});

// 根据模型 ID 查询单价（每 token，单位与 balance 一致）
async function getPricePerToken(
  conn: mysql.PoolConnection,
  model: string
): Promise<{ input: number; output: number } | null> {
  const [rows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT input_price_per_m_token, output_price_per_m_token FROM models WHERE id = ? AND is_enabled = 1",
    [model]
  );
  if (!rows.length) return null;
  return {
    input: Number(rows[0].input_price_per_m_token) / 1_000_000,
    output: Number(rows[0].output_price_per_m_token) / 1_000_000,
  };
}

// POST /api/internal/billing/deduct — 预扣费
async function deduct(req: NextRequest): Promise<NextResponse> {
  const { keyHash, estimatedTokens, model } = await req.json();

  const conn = await pool.getConnection();
  try {
    await conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await conn.beginTransaction();

    // 锁定余额行，防止并发超额
    const [rows] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT b.id, b.user_id, b.balance, b.subscription_credits
       FROM balances b
       INNER JOIN api_keys k ON k.user_id = b.user_id
       WHERE k.key_hash = ? AND k.is_active = 1
       FOR UPDATE`,
      [keyHash]
    );

    if (!rows.length) {
      await conn.rollback();
      return NextResponse.json({ error: "KEY_NOT_FOUND" }, { status: 404 });
    }

    const price = await getPricePerToken(conn, model);
    if (!price) {
      await conn.rollback();
      return NextResponse.json({ error: "MODEL_NOT_FOUND" }, { status: 404 });
    }

    // 预估费用（按输入 token 估算，结算时修正）
    const estimated = estimatedTokens * price.input;
    const subCredits = Number(rows[0].subscription_credits);
    const balance = Number(rows[0].balance);

    // 套餐额度优先，不足时从余额补足
    const fromSub = Math.min(subCredits, estimated);
    const fromBalance = estimated - fromSub;

    if (fromBalance > balance) {
      await conn.rollback();
      return NextResponse.json({ error: "INSUFFICIENT_FUNDS" }, { status: 402 });
    }

    const transactionId = crypto.randomUUID();

    await conn.execute(
      `UPDATE balances
       SET subscription_credits = subscription_credits - ?,
           balance = balance - ?
       WHERE id = ?`,
      [fromSub, fromBalance, rows[0].id]
    );

    // 记录预扣流水，结算时用于退差额
    await conn.execute(
      `INSERT INTO billing_transactions
         (id, user_id, key_hash, model, estimated_tokens, actual_tokens, estimated_cost, actual_cost, status, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, 0, 'pending', NOW())`,
      [transactionId, rows[0].user_id, keyHash, model, estimatedTokens, estimated]
    );

    await conn.commit();
    return NextResponse.json({
      success: true,
      transactionId,
      deducted: estimated,
    });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// POST /api/internal/billing/settle — 结算（退差额）
async function settle(req: NextRequest): Promise<NextResponse> {
  const { transactionId, userId, actualInputTokens, actualOutputTokens, model } =
    await req.json();

  const conn = await pool.getConnection();
  try {
    await conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await conn.beginTransaction();

    const [txRows] = await conn.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM billing_transactions WHERE id = ? AND user_id = ? AND status = 'pending' FOR UPDATE",
      [transactionId, userId]
    );

    if (!txRows.length) {
      await conn.rollback();
      return NextResponse.json({ error: "TRANSACTION_NOT_FOUND" }, { status: 404 });
    }

    const tx = txRows[0];
    const price = await getPricePerToken(conn, model);
    if (!price) {
      await conn.rollback();
      return NextResponse.json({ error: "MODEL_NOT_FOUND" }, { status: 404 });
    }

    const actualCost =
      actualInputTokens * price.input + actualOutputTokens * price.output;
    const preDeducted = Number(tx.estimated_cost);
    const refund = Math.max(0, preDeducted - actualCost);

    // 退差额：优先退回套餐额度，按原扣比例估算
    const refundSub = Math.min(refund, Number(tx.estimated_cost));
    const refundBalance = refund - refundSub;

    await conn.execute(
      `UPDATE balances
       SET subscription_credits = subscription_credits + ?,
           balance = balance + ?
       WHERE user_id = ?`,
      [refundSub, refundBalance, tx.user_id]
    );

    await conn.execute(
      "UPDATE billing_transactions SET actual_tokens = ?, actual_cost = ?, status = 'settled', updated_at = NOW() WHERE id = ?",
      [actualInputTokens + actualOutputTokens, actualCost, transactionId]
    );

    await conn.commit();
    return NextResponse.json({
      success: true,
      finalCost: actualCost,
      refunded: refund,
    });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authCheck(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const action = req.nextUrl.pathname.split("/").pop();
  if (action === "deduct") return deduct(req);
  if (action === "settle") return settle(req);
  return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
