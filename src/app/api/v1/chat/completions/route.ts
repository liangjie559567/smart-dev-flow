import { createHash } from "crypto";

export const runtime = "edge";

const UPSTREAM = "https://api.openai.com/v1/chat/completions";
const KEY_CACHE = new Map<string, { userId: string; exp: number }>();

const INTERNAL_HEADERS = {
  "Content-Type": "application/json",
  "x-internal-secret": process.env.INTERNAL_API_SECRET!,
};

// 从 Redis 验证 API Key，缓存 5 秒
async function resolveKey(token: string): Promise<{ userId: string } | null> {
  const hash = createHash("sha256").update(token).digest("hex");
  const cached = KEY_CACHE.get(hash);
  if (cached && cached.exp > Date.now()) return { userId: cached.userId };

  const res = await fetch(
    `${process.env.REDIS_HTTP_URL}/get/apikey:${hash}`,
    { headers: { Authorization: `Bearer ${process.env.REDIS_HTTP_TOKEN ?? ""}` } }
  );
  if (!res.ok) return null;
  const { result } = await res.json() as { result: string | null };
  if (!result) return null;

  const userId = result;

  const revoked = await fetch(
    `${process.env.REDIS_HTTP_URL}/get/revoked:${hash}`,
    { headers: { Authorization: `Bearer ${process.env.REDIS_HTTP_TOKEN ?? ""}` } }
  );
  const { result: revokedResult } = await revoked.json() as { result: string | null };
  if (revokedResult) return null;

  KEY_CACHE.set(hash, { userId, exp: Date.now() + 5_000 });
  return { userId };
}

function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message, code: status } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const startTime = Date.now();
  // 1. 提取 Bearer token
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token.startsWith("sk-")) return err(401, "Invalid API key");

  // 2. 验证 API Key
  const key = await resolveKey(token);
  if (!key) return err(401, "Invalid API key");

  const body = await req.json() as { model?: string; stream?: boolean };
  const isStream = body.stream === true;
  const origin = new URL(req.url).origin;

  const keyHash = createHash("sha256").update(token).digest("hex");

  // 3. 预扣费
  const deduct = await fetch(`${origin}/api/internal/billing/deduct`, {
    method: "POST",
    headers: INTERNAL_HEADERS,
    body: JSON.stringify({ keyHash, estimatedTokens: 2000, model: body.model }),
  });
  if (deduct.status === 402) return err(402, "Insufficient balance");
  if (!deduct.ok) return err(500, "Billing error");
  const { transactionId } = await deduct.json() as { transactionId: string };

  // 4. 代理到上游
  const upstream = await fetch(UPSTREAM, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    // 上游错误：透传状态码，异步取消预扣
    fetch(`${origin}/api/internal/billing/settle`, {
      method: "POST",
      headers: INTERNAL_HEADERS,
      body: JSON.stringify({ transactionId, userId: key.userId, actualTokens: 0 }),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
    });
  }

  // 5. 非流式：直接返回，异步结算
  if (!isStream) {
    const data = await upstream.json();
    fetch(`${origin}/api/internal/billing/settle`, {
      method: "POST",
      headers: INTERNAL_HEADERS,
      body: JSON.stringify({
        transactionId,
        userId: key.userId,
        actualInputTokens: data.usage?.prompt_tokens ?? 0,
        actualOutputTokens: data.usage?.completion_tokens ?? 0,
      }),
    });
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 6. 流式：逐块转发，流结束后结算
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  (async () => {
    let inputTokens = 0;
    let outputTokens = 0;
    const reader = upstream.body!.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);

        // 从 usage chunk 提取 token 数（OpenAI stream_options.include_usage）
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const chunk = JSON.parse(line.slice(6));
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens ?? 0;
              outputTokens = chunk.usage.completion_tokens ?? 0;
            }
          } catch { /* 忽略解析失败的行 */ }
        }
      }
    } finally {
      await writer.close();
      const model = (body as { model?: string }).model ?? "";
      const settleRes = await fetch(`${origin}/api/internal/billing/settle`, {
        method: "POST",
        headers: INTERNAL_HEADERS,
        body: JSON.stringify({
          transactionId,
          userId: key.userId,
          actualInputTokens: inputTokens,
          actualOutputTokens: outputTokens,
          model,
        }),
      });
      const actualCost = settleRes.ok
        ? ((await settleRes.json()) as { finalCost?: number }).finalCost ?? 0
        : 0;
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/usage`, {
        method: "POST",
        headers: { ...INTERNAL_HEADERS },
        body: JSON.stringify({
          userId: key.userId,
          keyHash,
          model,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          cost: actualCost,
          statusCode: 200,
          latencyMs: Date.now() - startTime,
        }),
      }).catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
