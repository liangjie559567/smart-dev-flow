import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { usageLogs } from "@/db/schema";

function authCheck(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  return !!secret && req.headers.get("x-internal-secret") === secret;
}

// POST /api/internal/usage — 写入用量日志
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authCheck(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { userId, model, inputTokens, outputTokens, cost, statusCode, durationMs } =
    await req.json();

  await db.insert(usageLogs).values({
    userId,
    model,
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    cost: String(cost ?? "0"),
    statusCode,
    durationMs: durationMs ?? null,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
