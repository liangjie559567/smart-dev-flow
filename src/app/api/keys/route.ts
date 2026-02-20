import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { auth } from "@/auth";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq, and } from "drizzle-orm";

function unauth() {
  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
}

async function redisSet(key: string, value: string, ex: number) {
  await fetch(`${process.env.REDIS_HTTP_URL}/set/${key}/${value}/ex/${ex}`, {
    headers: { Authorization: `Bearer ${process.env.REDIS_HTTP_TOKEN ?? ""}` },
  });
}

// GET /api/keys — 列出当前用户的 API Keys（仅返回 keyPrefix，不含 keyHash）
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.email) return unauth();

  const rows = await db
    .select({
      id: apiKeys.id,
      keyPrefix: apiKeys.keyPrefix,
      name: apiKeys.name,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, (session.user as { id?: string }).id ?? ""));

  return NextResponse.json(rows);
}

// POST /api/keys — 创建新 API Key，返回一次明文，存 keyHash
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.email) return unauth();

  const userId = (session.user as { id?: string }).id ?? "";
  const { name } = await req.json().catch(() => ({ name: undefined }));

  const key32 = "sk-" + randomBytes(16).toString("hex"); // sk- + 32 hex chars
  const keyHash = createHash("sha256").update(key32).digest("hex");
  const keyPrefix = key32.slice(0, 8);
  const id = crypto.randomUUID();

  await db.insert(apiKeys).values({
    id,
    userId,
    keyHash,
    keyPrefix,
    name: name ?? null,
  });

  // 写入 Redis 供 v1 路由验证
  await redisSet(`apikey:${keyHash}`, userId, 86400 * 365);

  return NextResponse.json({ id, key: key32, keyPrefix, name: name ?? null }, { status: 201 });
}

// DELETE /api/keys?id=xxx — 吊销 API Key
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.email) return unauth();

  const userId = (session.user as { id?: string }).id ?? "";
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

  const [row] = await db
    .select({ keyHash: apiKeys.keyHash })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));

  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await db
    .update(apiKeys)
    .set({ isActive: false })
    .where(eq(apiKeys.id, id));

  // Redis 吊销标记，30 天过期
  await redisSet(`revoked:${row.keyHash}`, "1", 2592000);
  // 删除 apikey: 映射，防止 TTL 不一致
  await fetch(`${process.env.REDIS_HTTP_URL}/del/apikey:${row.keyHash}`, {
    headers: { Authorization: `Bearer ${process.env.REDIS_HTTP_TOKEN ?? ""}` },
  });

  return NextResponse.json({ success: true });
}
