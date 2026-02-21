# AI API 中转站 - 任务清单

**生成日期**: 2026-02-21
**版本**: 1.0
**状态**: 待执行

---

## 任务列表

- [ ] T01: 项目初始化与数据库 Schema
- [ ] T02: NextAuth.js v5 认证配置
- [ ] T03: API Key 管理接口
- [ ] T04: Redis 缓存集成
- [ ] T05: 扣费服务（Node.js Runtime）
- [ ] T06: AI API 代理核心（Edge Runtime）
- [ ] T07: 流式响应代理
- [ ] T08: 用量日志记录与统计接口
- [ ] T09: 用户控制台页面
- [ ] T10: 用量统计图表与 CSV 导出
- [ ] T11: 管理后台 - 模型管理
- [ ] T12: 管理后台 - 用户与收益管理
- [ ] T13: 套餐过期定时任务（Vercel Cron）
- [ ] T14: 部署配置（Vercel + Docker）

---

## 任务详情

### T01: 项目初始化与数据库 Schema
**描述**: 初始化 Next.js 15 项目，配置 Drizzle ORM，创建全部数据库表及索引。
**交付物**:
- `drizzle/schema.ts`：定义 users、accounts、api_keys、balances、subscriptions、models、usage_logs、audit_logs 八张表
- `drizzle/migrate.ts`：迁移脚本
- `drizzle.config.ts`：Drizzle 配置
- `package.json`：依赖配置（next、drizzle-orm、mysql2、ioredis、next-auth）

**完成标准**:
- `npm run db:migrate` 执行成功，所有表创建完毕
- 所有外键约束和索引正确建立
- TypeScript 类型推断正常

**优先级**: P0
**预计工时**: 3h
**依赖**: 无

---

### T02: NextAuth.js v5 认证配置
**描述**: 配置 GitHub + Google OAuth，实现首次登录自动生成 API Key，集成 Drizzle Adapter。
**交付物**:
- `app/api/auth/[...nextauth]/route.ts`
- `lib/auth.ts`：NextAuth 配置，含 signIn 回调（首次登录检测 + API Key 生成）
- `lib/db.ts`：数据库连接池（connectionLimit: 20）

**完成标准**:
- GitHub/Google OAuth 登录成功
- 首次登录自动生成 `sk-` 开头的 API Key（明文仅返回一次）
- Session 正确持久化到数据库

**优先级**: P0
**预计工时**: 3h
**依赖**: T01

---

### T03: API Key 管理接口
**描述**: 实现 API Key 的 CRUD 接口（列出、创建、吊销），含 Redis 吊销集合写入。
**交付物**:
- `app/api/internal/keys/route.ts`：GET（列出）、POST（创建）
- `app/api/internal/keys/[id]/route.ts`：DELETE（吊销）
- `lib/api-key.ts`：Key 生成（`sk-` + randomBytes(24).toString('base64url')）、SHA-256 哈希、Redis 失效写入

**完成标准**:
- GET 返回用户所有未吊销 Key（不含明文）
- POST 返回明文一次，数据库仅存 keyHash
- DELETE 吊销后写入 Redis `revoked:{keyHash}`，TTL 30 天，并删除 `key_cache:{keyHash}`

**优先级**: P0
**预计工时**: 2h
**依赖**: T01, T02, T04

---

### T04: Redis 缓存集成
**描述**: 封装 Redis 客户端，实现 API Key 验证缓存（5s TTL）、吊销集合、余额缓存（10s）、模型配置缓存（60s）。
**交付物**:
- `lib/redis.ts`：ioredis 客户端单例
- `lib/cache.ts`：封装 getKeyCache / setKeyCache / revokeKey / getBalance / setBalance / getModelConfig / setModelConfig

**完成标准**:
- Key 验证走缓存，TTL 5s
- 吊销 Key 实时写入 Redis，≤5s 内生效
- 余额缓存 10s，扣费后主动删除

**优先级**: P0
**预计工时**: 2h
**依赖**: T01

---

### T05: 扣费服务（Node.js Runtime）
**描述**: 实现预扣费和差额退款接口，使用 SELECT FOR UPDATE + REPEATABLE READ 悲观锁，套餐优先于余额消费。
**交付物**:
- `app/api/internal/billing/deduct/route.ts`：Node.js Runtime，POST 预扣费
- `app/api/internal/billing/refund/route.ts`：Node.js Runtime，POST 退差额
- `lib/billing.ts`：事务逻辑（BEGIN → SELECT FOR UPDATE → 扣套餐 → 扣余额 → COMMIT/ROLLBACK）

**完成标准**:
- 并发扣费不超额（悲观锁保证）
- 套餐 tokensRemaining 优先扣减，不足再扣 balances.amount
- 余额不足返回 402
- 扣费成功后删除 `user_balance:{userId}` 缓存

**优先级**: P0
**预计工时**: 4h
**依赖**: T01, T04

---

### T06: AI API 代理核心（Edge Runtime）
**描述**: 实现 `POST /api/v1/chat/completions`，Edge Runtime，含 Key 验证、余额检查、预扣费调用、上游代理。
**交付物**:
- `app/api/v1/chat/completions/route.ts`：Edge Runtime
- `lib/proxy.ts`：验证流程（Redis 缓存 → 吊销集合 → DB）、内部 HTTP 调用扣费路由

**完成标准**:
- 401：Key 无效或已吊销
- 402：余额不足（调用 T05 扣费路由返回失败）
- 429：并发超额
- 502：上游 API 错误
- 正常请求代理到上游并返回响应

**优先级**: P0
**预计工时**: 3h
**依赖**: T03, T04, T05

---

### T07: 流式响应代理
**描述**: 在 T06 基础上实现 SSE 流式转发，逐块转发不缓冲，流结束后计算实际 token 并退差额。
**交付物**:
- 扩展 `app/api/v1/chat/completions/route.ts`：ReadableStream + TransformStream 流式代理
- 流结束回调：计算 actual_cost，调用退差额接口，写入 usage_logs

**完成标准**:
- SSE 格式 `data: {json}\n\n` 逐块转发
- 流结束后退还 (max_cost - actual_cost) 差额
- 流中断时预扣费不退（Vercel 超时场景）

**优先级**: P0
**预计工时**: 4h
**依赖**: T06

---

### T08: 用量日志记录与统计接口
**描述**: 实现 usage_logs 写入和统计查询接口，支持按模型/日期筛选、分页。
**交付物**:
- `lib/usage.ts`：insertUsageLog 函数
- `app/api/internal/usage/route.ts`：GET，支持 model/statusCode/startDate/endDate/page/pageSize 参数
- `app/api/internal/usage/export/route.ts`：GET，CSV 导出（最多 10000 条）

**完成标准**:
- 每次 API 调用后异步写入 usage_logs
- 统计接口返回 totalCost、totalTokens、totalRequestCount 及分页数据
- CSV 导出超 10000 条返回 400

**优先级**: P0
**预计工时**: 3h
**依赖**: T01, T02

---

### T09: 用户控制台页面
**描述**: 实现用户仪表板，含账户信息（余额/套餐/过期时间）、API Key 管理（创建/吊销/复制）。
**交付物**:
- `app/dashboard/page.tsx`：余额、套餐额度、过期时间展示
- `app/dashboard/keys/page.tsx`：API Key 列表、创建、吊销
- `components/ui/`：复用 shadcn/ui 组件

**完成标准**:
- 首次登录后跳转仪表板
- API Key 创建后明文显示一次（含复制按钮）
- 吊销后列表实时更新

**优先级**: P1
**预计工时**: 3h
**依赖**: T02, T03

---

### T10: 用量统计图表与 CSV 导出
**描述**: 实现 30 天用量折线图（按天聚合）、调用历史列表（筛选+分页）、CSV 导出按钮。
**交付物**:
- `app/dashboard/usage/page.tsx`：折线图 + 历史列表
- 使用 recharts 或 shadcn/ui chart 组件

**完成标准**:
- 折线图展示 30 天 token 用量和成本
- 历史列表支持按模型、日期、状态码筛选
- CSV 导出触发 `/api/internal/usage/export`

**优先级**: P1
**预计工时**: 3h
**依赖**: T08, T09

---

### T11: 管理后台 - 模型管理
**描述**: 实现模型配置的 CRUD 接口和管理页面，变更后主动删除 Redis 模型缓存。
**交付物**:
- `app/api/admin/models/route.ts`：GET（列出）、POST（创建/更新）
- `app/api/admin/models/[id]/route.ts`：PATCH（启用/禁用）、DELETE
- `app/admin/models/page.tsx`：模型管理页面
- `lib/middleware/admin.ts`：RBAC 权限检查（role === 'admin'）

**完成标准**:
- 非 admin 用户访问返回 403
- 模型变更后删除 `model_config:{modelId}` 缓存，实时生效
- 支持启用/禁用模型

**优先级**: P1
**预计工时**: 3h
**依赖**: T01, T02, T04

---

### T12: 管理后台 - 用户与收益管理
**描述**: 实现用户列表、手动调整余额、收益统计、审计日志接口和页面。
**交付物**:
- `app/api/admin/users/route.ts`：GET 用户列表
- `app/api/admin/users/[id]/balance/route.ts`：POST 充值余额（写 audit_logs）
- `app/api/admin/revenue/route.ts`：GET 按天/月收益统计
- `app/api/admin/audit-logs/route.ts`：GET 审计日志
- `app/admin/users/page.tsx`、`app/admin/revenue/page.tsx`

**完成标准**:
- 余额调整写入 audit_logs（含操作前后数据）
- 收益统计按天/月聚合 usage_logs.cost
- 审计日志支持分页

**优先级**: P1
**预计工时**: 4h
**依赖**: T01, T02, T11

---

### T13: 套餐过期定时任务（Vercel Cron）
**描述**: 实现每日 UTC 00:00 清零过期套餐的 Cron 路由，含 CRON_SECRET 鉴权。
**交付物**:
- `app/api/cron/expire-subscriptions/route.ts`：GET，验证 Authorization header
- `vercel.json`：cron 配置 `"0 0 * * *"`

**完成标准**:
- 无有效 CRON_SECRET 返回 401
- 清零所有 expiresAt < NOW() 的 subscriptions.tokensRemaining
- 执行结果返回影响行数

**优先级**: P1
**预计工时**: 1h
**依赖**: T01

---

### T14: 部署配置（Vercel + Docker）
**描述**: 完善 vercel.json（Edge Runtime 配置、Cron、环境变量）和 Docker Compose（app + mysql + redis）。
**交付物**:
- `vercel.json`：functions runtime 配置、cron 配置
- `Dockerfile`：node:20-alpine 多阶段构建
- `docker-compose.yml`：app + mysql:8.0 + redis:7-alpine
- `.env.example`：所有必需环境变量

**完成标准**:
- `vercel deploy` 成功，Edge Runtime 路由正确
- `docker compose up` 启动三个服务，健康检查通过
- `.env.example` 包含 DATABASE_URL、REDIS_URL、NEXTAUTH_SECRET、GITHUB_ID/SECRET、OPENAI_API_KEY、CRON_SECRET

**优先级**: P2
**预计工时**: 2h
**依赖**: T01~T13

---

## 依赖关系图

```
T01 (Schema)
 ├── T02 (Auth)
 │    ├── T03 (API Key) ← T04
 │    ├── T08 (Usage)
 │    ├── T09 (Dashboard) ← T03
 │    │    └── T10 (Charts) ← T08
 │    ├── T11 (Admin Models) ← T04
 │    └── T12 (Admin Users) ← T11
 ├── T04 (Redis)
 │    └── T05 (Billing)
 │         └── T06 (Proxy) ← T03
 │              └── T07 (Streaming) → T08
 ├── T13 (Cron)
 └── T14 (Deploy) ← 全部
```

---

## 优先级汇总

| 优先级 | 任务 | 总工时 |
|--------|------|--------|
| P0 | T01, T02, T03, T04, T05, T06, T07, T08 | 24h |
| P1 | T09, T10, T11, T12, T13 | 14h |
| P2 | T14 | 2h |
| **合计** | 14 个任务 | **40h** |
