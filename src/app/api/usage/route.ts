import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { usageLogs } from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

function unauth() {
  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
}

function buildConditions(userId: string, params: URLSearchParams) {
  const conditions = [eq(usageLogs.userId, userId)];
  const model = params.get("model");
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const statusCode = params.get("statusCode");

  if (model) conditions.push(eq(usageLogs.model, model));
  if (startDate) conditions.push(gte(usageLogs.createdAt, new Date(startDate)));
  if (endDate) conditions.push(lte(usageLogs.createdAt, new Date(endDate)));
  if (statusCode) conditions.push(eq(usageLogs.statusCode, Number(statusCode)));

  return and(...conditions);
}

// GET /api/usage — 分页查询用量日志 + 汇总
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.email) return unauth();

  const userId = (session.user as { id?: string }).id ?? "";
  const params = req.nextUrl.searchParams;

  // 导出 CSV
  if (params.get("format") === "csv") {
    const rows = await db
      .select()
      .from(usageLogs)
      .where(buildConditions(userId, params))
      .orderBy(sql`${usageLogs.createdAt} DESC`)
      .limit(10000);

    const header = "id,model,inputTokens,outputTokens,cost,statusCode,durationMs,createdAt";
    const lines = rows.map((r) =>
      [r.id, r.model, r.inputTokens, r.outputTokens, r.cost, r.statusCode, r.durationMs ?? "", r.createdAt.toISOString()].join(",")
    );
    return new NextResponse([header, ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=usage.csv",
      },
    });
  }

  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
  const where = buildConditions(userId, params);

  const [rows, [summary]] = await Promise.all([
    db
      .select()
      .from(usageLogs)
      .where(where)
      .orderBy(sql`${usageLogs.createdAt} DESC`)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({
        totalCount: sql<number>`COUNT(*)`,
        totalTokens: sql<number>`SUM(${usageLogs.inputTokens} + ${usageLogs.outputTokens})`,
        totalCost: sql<string>`SUM(${usageLogs.cost})`,
      })
      .from(usageLogs)
      .where(where),
  ]);

  return NextResponse.json({
    data: rows,
    summary: {
      totalCount: Number(summary.totalCount),
      totalTokens: Number(summary.totalTokens ?? 0),
      totalCost: summary.totalCost ?? "0",
    },
    page,
    pageSize,
  });
}
