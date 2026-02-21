# 用户积分系统设计文档

**版本**：1.0  
**日期**：2026-02-21  
**作者**：技术团队  
**状态**：已批准

---

## 1. 概述

### 1.1 技术栈
- **框架**：Next.js 14 App Router
- **语言**：TypeScript
- **ORM**：Prisma
- **数据库**：PostgreSQL
- **认证**：Session-based（从 session 获取 userId）

### 1.2 核心设计原则
1. **批次模型**：每次发放积分创建独立批次，FIFO 扣减，支持自动过期
2. **惰性过期**：查询时检测过期批次，写入 expire 流水，避免后台定时任务
3. **并发安全**：行级锁（SELECT FOR UPDATE）保证兑换操作原子性
4. **幂等性**：Idempotency-Key 请求头支持 earn 和 redeem 操作，24小时窗口
5. **实时计算**：余额、过期积分等均实时计算，无缓存

---

## 2. 数据库 Schema

```prisma
// 积分配置表
model ActionConfig {
  id              String   @id @default(cuid())
  actionType      String   @unique
  points          Int      // 单次发放积分数
  validityDays    Int      @default(365)  // 有效期天数
  rateLimitWindow Int      @default(3600) // 滑动窗口秒数
  rateLimitMax    Int      @default(1)    // 窗口内最大次数
  createdAt       DateTime @default(now())
}

// 兑换商品配置表（C-6：服务端校验商品价格，防止客户端篡改 pointsCost）
model ItemConfig {
  id         String   @id @default(cuid())
  itemCode   String   @unique
  name       String
  pointsCost Int      // 兑换所需积分
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
}

// 积分批次表
model PointsBatch {
  id           String      @id @default(cuid())
  userId       String
  actionType   String
  originalPts  Int         // 原始积分数
  remainingPts Int         // 剩余积分数
  status       BatchStatus @default(active) // active | redeemed | expired
  issuedAt     DateTime    @default(now())
  expiresAt    DateTime    // 过期时间
  
  @@index([userId, expiresAt])
  @@index([userId, status, expiresAt])
}

// 积分流水表
model PointTransaction {
  id            String          @id @default(cuid())
  userId        String
  type          TransactionType // earn | redeem | expire
  points        Int             // 本次变动积分数
  actionType    String?         // 对应的 actionType（仅 earn 有值）
  balanceBefore Int             // 操作前余额
  balanceAfter  Int             // 操作后余额
  refId         String?         // 关联 ID（redemptionId 或 batchId）
  description   String?         // 描述
  createdAt     DateTime        @default(now())
  
  @@index([userId, createdAt])
  @@index([userId, actionType, type, createdAt])
}

// 兑换记录表
model Redemption {
  id          String   @id @default(cuid())
  userId      String
  itemCode    String
  pointsCost  Int
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
}

// 幂等性键表（C-5：唯一约束绑定 userId，防止跨用户碰撞）
model IdempotencyKey {
  id           String   @id @default(cuid())
  key          String
  userId       String
  responseCode Int
  responseBody Json
  createdAt    DateTime @default(now())

  @@unique([key, userId])
  @@index([createdAt]) // H-3：支持定期清理过期记录
}

enum TransactionType {
  earn
  redeem
  expire
}

enum BatchStatus {
  active
  redeemed
  expired
}
```

---

## 3. 模块划分

```
app/
├── api/
│   └── points/
│       ├── earn/
│       │   └── route.ts          // POST /api/points/earn
│       ├── redeem/
│       │   └── route.ts          // POST /api/points/redeem
│       ├── balance/
│       │   └── route.ts          // GET /api/points/balance
│       └── transactions/
│           └── route.ts          // GET /api/points/transactions

lib/
└── points/
    ├── earn.ts                   // 发放业务逻辑
    ├── redeem.ts                 // 兑换业务逻辑
    ├── balance.ts                // 余额计算（含惰性过期）
    ├── idempotency.ts            // 幂等性检查
    └── types.ts                  // 类型定义
```

---

## 4. 完整接口契约

### 4.1 POST /api/points/earn

**功能**：发放积分

**请求头**：
```
Idempotency-Key: <uuid>
```

**请求体**：
```json
{
  "actionType": "daily_login"
}
```

**说明**：userId 从 session 获取，请求体无需传入

**成功响应 (200)**：
```json
{
  "success": true,
  "pointsEarned": 10,
  "newBalance": 150,
  "expiresAt": "2027-02-21T00:00:00Z",
  "transactionId": "txn_abc123"
}
```

**错误响应**：

| 错误码 | 说明 | 响应体 |
|--------|------|--------|
| 400 | INVALID_ACTION | `{"error": "INVALID_ACTION", "message": "actionType 不存在"}` |
| 401 | UNAUTHORIZED | `{"error": "UNAUTHORIZED", "message": "未登录"}` |
| 409 | RATE_LIMITED | `{"error": "RATE_LIMITED", "message": "该行为积分已达频率上限，请稍后再试", "retryAfter": 1740200000}` |
| 422 | IDEMPOTENCY_CONFLICT | `{"error": "IDEMPOTENCY_CONFLICT", "message": "相同 key 不同 userId"}` |
| 500 | INTERNAL_ERROR | `{"error": "INTERNAL_ERROR", "message": "服务器错误"}` |

**说明**：`retryAfter` 为 Unix 时间戳（秒），表示频率限制窗口结束时间，前端可据此计算剩余等待时间并展示（C-4）

---

### 4.2 POST /api/points/redeem

**功能**：兑换积分

**请求头**：
```
Idempotency-Key: <uuid>
```

**请求体**：
```json
{
  "itemCode": "gift_card_10"
}
```

**说明**：userId 从 session 获取；pointsCost 由服务端从 ItemConfig 表查询，不由客户端传入（C-6）

**成功响应 (200)**：
```json
{
  "success": true,
  "pointsDeducted": 100,
  "newBalance": 50,
  "redemptionId": "rdm_xyz789",
  "transactionId": "txn_def456"
}
```

**错误响应**：

| 错误码 | 说明 | 响应体 |
|--------|------|--------|
| 400 | INVALID_ITEM | `{"error": "INVALID_ITEM", "message": "itemCode 不存在或已下架"}` |
| 401 | UNAUTHORIZED | `{"error": "UNAUTHORIZED", "message": "未登录"}` |
| 402 | INSUFFICIENT_POINTS | `{"error": "INSUFFICIENT_POINTS", "message": "积分余额不足", "currentBalance": 30, "required": 100}` |
| 422 | IDEMPOTENCY_CONFLICT | `{"error": "IDEMPOTENCY_CONFLICT", "message": "相同 key 不同 userId"}` |
| 500 | INTERNAL_ERROR | `{"error": "INTERNAL_ERROR", "message": "服务器错误"}` |

---

### 4.3 GET /api/points/balance

**功能**：查询余额（userId 从 session 获取）

**请求参数**：无

**成功响应 (200)**：
```json
{
  "balance": 50,
  "expiringSoon": 30,
  "nextExpiryAt": "2026-03-07T00:00:00Z"
}
```

**字段说明**：
- `balance`：当前可用积分总数
- `expiringSoon`：7天内即将过期的积分数量
- `nextExpiryAt`：7天内即将过期的批次中最早的过期时间；若无即将过期积分，返回 `null`

**错误响应**：

| 错误码 | 说明 | 响应体 |
|--------|------|--------|
| 401 | UNAUTHORIZED | `{"error": "UNAUTHORIZED", "message": "未登录"}` |
| 500 | INTERNAL_ERROR | `{"error": "INTERNAL_ERROR", "message": "服务器错误"}` |

---

### 4.4 GET /api/points/transactions

**功能**：查询积分流水（userId 从 session 获取）

**查询参数**：
- `page`：页码（默认 1）
- `pageSize`：每页数量（默认 20，最大 100）
- `type`：流水类型（可选，值为 earn/redeem/expire）

**示例 URL**：
```
GET /api/points/transactions?page=1&pageSize=20&type=earn
```

**成功响应 (200)**：
```json
{
  "transactions": [
    {
      "id": "txn_abc123",
      "type": "earn",
      "points": 10,
      "actionType": "daily_login",
      "balanceBefore": 140,
      "balanceAfter": 150,
      "createdAt": "2026-02-21T10:00:00Z"
    },
    {
      "id": "txn_def456",
      "type": "redeem",
      "points": -100,
      "actionType": null,
      "balanceBefore": 150,
      "balanceAfter": 50,
      "createdAt": "2026-02-21T11:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

**错误响应**：

| 错误码 | 说明 | 响应体 |
|--------|------|--------|
| 400 | INVALID_PARAMS | `{"error": "INVALID_PARAMS", "message": "pageSize 超过最大值 100"}` |
| 401 | UNAUTHORIZED | `{"error": "UNAUTHORIZED", "message": "未登录"}` |
| 500 | INTERNAL_ERROR | `{"error": "INTERNAL_ERROR", "message": "服务器错误"}` |

---

## 5. 架构决策记录 (ADR)

### ADR-001：批次模型与 FIFO 扣减

**决策**：采用 PointsBatch 表存储每次发放的积分批次，兑换时按 FIFO 顺序扣减。

**理由**：
1. 支持自动过期：每个批次有独立的 expiresAt，便于追踪过期时间
2. 清晰的审计链：每个批次对应一次发放，便于问题排查
3. 灵活的过期策略：不同 actionType 可配置不同有效期

**实现**：
- 发放时：创建新 PointsBatch 记录，status = active
- 兑换时：按 issuedAt 升序查询 active 批次，逐个扣减 remainingPts
- 过期时：惰性检测 expiresAt < NOW()，更新 status = expired，写入 expire 流水

---

### ADR-002：惰性过期机制

**决策**：查询时检测过期批次，在事务内写入 expire 流水，不使用后台定时任务。

**理由**：
1. 无需维护定时任务，降低运维复杂度
2. 过期处理在事务内执行并加行级锁，避免并发重复 expire 流水（C-1）
3. 只处理实际查询的用户数据，资源利用率高

**实现**：
- balance 查询时：开启事务，SELECT FOR UPDATE 锁定 expiresAt < NOW() 的 active 批次
- 初始 currentBalance = 所有 active 批次（含即将过期）的 remainingPts 之和
- 对每个过期批次：
  1. balanceBefore = currentBalance
  2. 写入 PointTransaction，type = expire，points = -remainingPts
  3. 更新 PointsBatch，status = expired，remainingPts = 0
  4. currentBalance -= batch.remainingPts
- 提交事务

---

### ADR-003：行级锁保证并发安全

**决策**：兑换时使用 SELECT FOR UPDATE 对 PointsBatch 加行级锁。

**理由**：
1. 防止并发兑换导致的超额扣减
2. 保证 FIFO 扣减的顺序性
3. PostgreSQL 原生支持，性能开销小

**实现**：
```sql
SELECT * FROM "PointsBatch" 
WHERE "userId" = $1 AND "status" = 'active' AND "expiresAt" > NOW()
ORDER BY "issuedAt" ASC
FOR UPDATE
```

---

### ADR-004：幂等性支持

**决策**：earn 和 redeem 均支持幂等性，通过 Idempotency-Key 请求头实现，24小时窗口。唯一约束为 `(key, userId)`（C-5）。

**理由**：
1. 网络重试、客户端重复提交等场景下保证操作幂等
2. 提升用户体验，避免重复扣费或重复发放
3. 24小时窗口平衡存储成本与实用性
4. 绑定 userId 防止跨用户碰撞（C-5）

**实现**：
- 请求时：用 `createMany + skipDuplicates` 原子占位（H-1），唯一约束 `(key, userId)`
- 如存在且 createdAt > NOW() - 24h：返回缓存响应
- 如不存在：插入占位记录，执行操作后更新响应体
- 清理策略（H-3）：每日定时清理 `createdAt < NOW() - 48h` 的记录，通过 `@@index([createdAt])` 支撑高效删除

---

### ADR-005：多批次过期时的 balanceBefore 计算

**决策**：每次写入 expire 记录时，balanceBefore = 当前累计余额（已处理批次后的实时余额）。

**理由**：
1. 准确反映过期时刻的实际余额状态
2. 便于审计和对账，每条流水的 balanceBefore 和 balanceAfter 形成完整链条
3. 支持从任意流水点恢复余额状态

**实现示例**：
假设用户有3个批次，都在同一时刻过期：
- 批次1：remainingPts = 50，过期前 balance = 150
  - 写入 expire 流水：balanceBefore = 150，balanceAfter = 100，points = -50
- 批次2：remainingPts = 30，过期前 balance = 100
  - 写入 expire 流水：balanceBefore = 100，balanceAfter = 70，points = -30
- 批次3：remainingPts = 20，过期前 balance = 70
  - 写入 expire 流水：balanceBefore = 70，balanceAfter = 50，points = -20

最终 balance = 50

---

## 6. 关键流程说明

### 6.1 发放流程 (Earn)

```
1. 验证请求
   ├─ 只读检查 Idempotency-Key 缓存（事务外，无副作用）
   │  ├─ 缓存命中且未过期 → 返回缓存响应
   │  └─ 未命中 → 继续
   └─ 检查 actionType 是否存在
      └─ 不存在 → 返回 400 INVALID_ACTION

2. 开启事务（C-3：所有写操作必须在单个 $transaction 内）
   ├─ 2a. 幂等占位（N-1：占位必须在事务内，回滚时自动清除）
   │  └─ tx.idempotencyKey.createMany + skipDuplicates 原子占位
   ├─ 2b. 检查频率限制（C-4：在事务内执行，防止并发绕过）
   │  ├─ 查询过去 rateLimitWindow 秒内该 actionType 的 earn 流水数
   │  ├─ 如 >= rateLimitMax → 回滚事务（占位随事务回滚），返回 409 RATE_LIMITED（含 retryAfter）
   │  └─ 否 → 继续
   ├─ 2c. 发放积分
   │  ├─ 从 ActionConfig 获取 points 和 validityDays
   │  ├─ 计算 expiresAt = NOW() + validityDays
   │  ├─ 创建 PointsBatch 记录
   │  ├─ 计算当前 balance（调用 balance.ts 中的计算逻辑）
   │  └─ 写入 PointTransaction，type = earn
   └─ 2d. 缓存响应到 IdempotencyKey 表（更新占位记录的 responseCode/responseBody）
   └─ 提交事务

3. 返回响应
   └─ 200 { success, pointsEarned, newBalance, expiresAt, transactionId }
```

### 6.2 兑换流程 (Redeem)

```
1. 验证请求
   ├─ 只读检查 Idempotency-Key 缓存（事务外，无副作用）
   │  ├─ 缓存命中且未过期 → 返回缓存响应
   │  └─ 未命中 → 继续
   ├─ 查询 ItemConfig 获取 pointsCost（C-6：服务端校验价格）
   │  └─ itemCode 不存在或 isActive=false → 返回 400 INVALID_ITEM
   └─ 继续

2. 开启事务（C-2：余额检查和扣减必须在同一事务内）
   ├─ 2a. 幂等占位（N-1：占位必须在事务内，回滚时自动清除）
   │  └─ tx.idempotencyKey.createMany + skipDuplicates 原子占位
   ├─ 2b. 查询 active 批次，按 issuedAt 升序，FOR UPDATE（加行级锁）
   ├─ 2c. 触发惰性过期处理（事务内）
   ├─ 2d. 计算实时 balance（锁定后的批次求和）
   ├─ 2e. 检查余额
   │  ├─ 如 balance < pointsCost → 回滚事务（占位随事务回滚），返回 402 INSUFFICIENT_POINTS
   │  └─ 否 → 继续
   ├─ 2f. 逐个扣减 remainingPts，直到 pointsCost 扣完（FIFO）
   │  ├─ 如某批次 remainingPts = 0 → 更新 status = redeemed
   │  └─ 否 → 保持 active
   ├─ 2g. 创建 Redemption 记录
   ├─ 2h. 写入 PointTransaction，type = redeem
   ├─ 2i. 缓存响应到 IdempotencyKey 表（更新占位记录的 responseCode/responseBody）
   └─ 提交事务

3. 返回响应
   └─ 200 { success, pointsDeducted, newBalance, redemptionId, transactionId }
```

### 6.3 余额查询流程 (Balance)

```
1. 验证认证
   ├─ 从 session 获取 userId
   └─ 如未登录 → 返回 401 UNAUTHORIZED

2. 惰性过期处理（C-1：必须在事务内执行，加行级锁防止并发重复 expire）
   ├─ 开启事务
   ├─ SELECT FOR UPDATE 查询 expiresAt < NOW() 且 status = active 的批次
   ├─ 计算 currentBalance = 所有 active 批次（含即将过期）的 remainingPts 之和
   ├─ 对每个过期批次（按 issuedAt 升序）：
   │  ├─ balanceBefore = currentBalance
   │  ├─ 写入 PointTransaction，type = expire，points = -remainingPts
   │  ├─ 更新 PointsBatch，status = expired，remainingPts = 0
   │  └─ currentBalance = currentBalance - batch.remainingPts
   └─ 提交事务

3. 计算余额
   ├─ 查询所有 active 批次的 remainingPts 之和 → balance
   ├─ 查询 expiresAt < NOW() + 7天 且 status = active 的批次
   │  └─ 求和 remainingPts → expiringSoon
   └─ 查询最早的 active 批次的 expiresAt → nextExpiryAt（无即将过期积分时返回 null）

4. 返回响应（C-8：不返回 userId）
   └─ 200 { balance, expiringSoon, nextExpiryAt }
```

### 6.4 流水查询流程 (Transactions)

```
1. 验证认证
   ├─ 从 session 获取 userId
   └─ 如未登录 → 返回 401 UNAUTHORIZED

2. 验证参数
   ├─ 检查 pageSize <= 100
   └─ 如超限 → 返回 400 INVALID_PARAMS

3. 查询流水
   ├─ 构建查询条件：userId = $1，type = $2（如指定）
   ├─ 按 createdAt 降序排列
   ├─ 分页：OFFSET (page-1)*pageSize LIMIT pageSize
   └─ 查询总数

4. 返回响应
   └─ 200 { transactions: [...], total, page, pageSize }
```

---

## 7. 关键实现细节

### 7.1 幂等性检查逻辑

```typescript
// lib/points/idempotency.ts

// N-1：拆分为只读检查 + 事务内占位，解决事务回滚后占位残留问题
// C-5：唯一约束 (key, userId)，防止跨用户碰撞

// 只读检查——事务外调用，无写入副作用
async function checkIdempotencyCache(key: string, userId: string) {
  // 跨用户碰撞检测
  const conflict = await db.idempotencyKey.findFirst({
    where: { key, userId: { not: userId } },
  });
  if (conflict) {
    throw new Error('IDEMPOTENCY_CONFLICT');
  }

  // 查询当前用户的幂等记录
  const existing = await db.idempotencyKey.findUnique({
    where: { key_userId: { key, userId } },
  });

  if (existing && Date.now() - existing.createdAt.getTime() < 24 * 3600 * 1000) {
    return { cached: true, response: existing.responseBody };
  }

  return { cached: false };
}

// 事务内占位——接收 tx 参数，事务回滚时占位自动清除
// H-1：用 createMany + skipDuplicates 原子占位，防止并发窗口
async function occupyIdempotencySlot(tx: Prisma.TransactionClient, key: string, userId: string) {
  const result = await tx.idempotencyKey.createMany({
    data: [{ key, userId, responseCode: 0, responseBody: {} }],
    skipDuplicates: true,
  });

  // count === 0 说明被并发请求抢先插入，重新查询返回缓存
  if (result.count === 0) {
    const existing = await tx.idempotencyKey.findUnique({
      where: { key_userId: { key, userId } },
    });
    if (existing && Date.now() - existing.createdAt.getTime() < 24 * 3600 * 1000) {
      return { cached: true, response: existing.responseBody };
    }
  }

  return { cached: false };
}

// 事务内更新响应体——同样接收 tx 参数，保证与占位在同一事务
async function cacheResponse(tx: Prisma.TransactionClient, key: string, userId: string, code: number, body: any) {
  await tx.idempotencyKey.update({
    where: { key_userId: { key, userId } },
    data: { responseCode: code, responseBody: body },
  });
}
```

### 7.2 频率限制检查

```typescript
// lib/points/earn.ts
// C-4：返回 retryAfter（Unix 时间戳），供 RATE_LIMITED 响应使用
async function checkRateLimit(tx: Prisma.TransactionClient, userId: string, actionType: string): Promise<{ retryAfter?: number }> {
  const config = await tx.actionConfig.findUnique({
    where: { actionType },
  });

  const windowStart = new Date(Date.now() - config.rateLimitWindow * 1000);
  const count = await tx.pointTransaction.count({
    where: {
      userId,
      actionType,
      type: 'earn',
      createdAt: { gte: windowStart },
    },
  });

  if (count >= config.rateLimitMax) {
    // 查询窗口内最早的记录，计算窗口结束时间
    const earliest = await tx.pointTransaction.findFirst({
      where: { userId, actionType, type: 'earn', createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'asc' },
    });
    const retryAfter = Math.ceil((earliest.createdAt.getTime() + config.rateLimitWindow * 1000) / 1000);
    throw Object.assign(new Error('RATE_LIMITED'), { retryAfter });
  }

  return {};
}
```

### 7.3 余额计算（含惰性过期）

```typescript
// lib/points/balance.ts
// C-1：惰性过期必须在事务内执行，对过期批次加 SELECT FOR UPDATE 锁

// 事务内版本——供 earn/redeem 事务内部调用，接收 tx 参数
async function calculateBalanceInTx(tx: Prisma.TransactionClient, userId: string) {
  // 1. 加行级锁查询过期批次，处理惰性过期
  const expiredBatches: PointsBatch[] = await tx.$queryRaw`
    SELECT * FROM "PointsBatch"
    WHERE "userId" = ${userId} AND "status" = 'active' AND "expiresAt" < NOW()
    ORDER BY "issuedAt" ASC
    FOR UPDATE
  `;

  if (expiredBatches.length > 0) {
    const allActive = await tx.pointsBatch.aggregate({
      where: { userId, status: 'active' },
      _sum: { remainingPts: true },
    });
    let currentBalance = allActive._sum.remainingPts ?? 0;

    for (const batch of expiredBatches) {
      const balanceBefore = currentBalance;
      const balanceAfter = currentBalance - batch.remainingPts;

      await tx.pointTransaction.create({
        data: {
          userId,
          type: 'expire',
          points: -batch.remainingPts,
          balanceBefore,
          balanceAfter,
          refId: batch.id,
        },
      });

      await tx.pointsBatch.update({
        where: { id: batch.id },
        data: { status: 'expired', remainingPts: 0 },
      });

      currentBalance = balanceAfter;
    }
  }

  // 2. 计算当前余额（事务内，读取锁定后的数据）
  const activeBatches = await tx.pointsBatch.findMany({
    where: { userId, status: 'active', expiresAt: { gte: new Date() } },
  });

  const balance = activeBatches.reduce((sum, b) => sum + b.remainingPts, 0);

  // 3. 计算即将过期积分
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const expiringSoonBatches = activeBatches.filter(b => b.expiresAt <= sevenDaysLater);
  const expiringSoon = expiringSoonBatches.reduce((sum, b) => sum + b.remainingPts, 0);

  const nextExpiryAt = expiringSoonBatches.length > 0
    ? expiringSoonBatches.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())[0].expiresAt
    : null;

  return { balance, expiringSoon, nextExpiryAt };
}

// 独立入口——供 balance 接口调用，自己开启事务
async function calculateBalance(userId: string) {
  return db.$transaction(async (tx) => {
    return calculateBalanceInTx(tx, userId);
  });
}
```

---

## 8. 安全性与性能考虑

### 8.1 安全性
- **认证**：所有接口均从 session 获取 userId，防止越权
- **幂等性**：Idempotency-Key 绑定 userId，防止跨用户冲突
- **并发**：行级锁保证兑换原子性，防止超额扣减
- **输入验证**：所有参数均验证类型和范围

### 8.2 性能
- **索引**：PointsBatch 和 PointTransaction 均建立复合索引
- **惰性过期**：避免后台定时任务，查询时处理
- **分页**：transactions 接口支持分页，防止大量数据查询
- **缓存**：幂等性缓存 24 小时，减少重复操作

---

## 9. 部署与迁移

### 9.1 数据库迁移
```bash
npx prisma migrate dev --name init_points_system
npx prisma db push
```

### 9.2 环境变量
```
DATABASE_URL=postgresql://...
SESSION_SECRET=...
```

### 9.3 初始化数据
```sql
INSERT INTO "ActionConfig" (id, "actionType", points, "validityDays", "rateLimitWindow", "rateLimitMax")
VALUES 
  (cuid(), 'daily_login', 10, 365, 86400, 1),
  (cuid(), 'share_post', 5, 365, 3600, 10);
```

---

## 10. 监控与告警

### 10.1 关键指标
- 每日发放积分总数
- 每日兑换积分总数
- 平均用户余额
- 频率限制触发次数
- 幂等性缓存命中率

### 10.2 告警规则
- 兑换失败率 > 5%
- 数据库查询延迟 > 500ms
- 幂等性表大小 > 1GB

---

**文档完成**

---

## 第二轮修复记录

**修复日期**：2026-02-21

| 编号 | 优先级 | 修复摘要 |
|------|--------|----------|
| C-01 | Critical | `checkRateLimit` 函数签名增加 `tx: Prisma.TransactionClient` 参数，内部所有 `db.xxx` 查询改为 `tx.xxx`，确保频率限制检查在事务内执行 |
| H-01 | High | 幂等性占位 `createMany` 后检查 `result.count === 0`，若为 0 则说明被并发请求抢先插入，重新查询并返回缓存响应，修复 TOCTOU 竞态 |
| H-02 | High | 将 `calculateBalance` 拆分为 `calculateBalanceInTx(tx, userId)`（事务内版本）和 `calculateBalance(userId)`（独立入口），消除 earn/redeem 事务内嵌套 `$transaction` 的隔离性问题 |
| H-03 | High | 字段 `expiringBefore` 重命名为 `nextExpiryAt`，§4.3 补充字段语义说明，§7.3 代码确保无即将过期积分时返回 `null` 而非 `undefined`，§6.3 流程同步更新 |
| H-04 | High | §4.1 RATE_LIMITED 错误 `message` 改为人性化文案"今日该行为积分已达上限，请明日再试"，`retryAfter` 字段说明补充前端可据此计算剩余等待时间 |

---

## 第三轮修复记录

**修复日期**：2026-02-21

| 编号 | 优先级 | 修复摘要 |
|------|--------|----------|
| N-01 | High | 幂等占位移入事务内，解决事务回滚后占位残留导致无效缓存响应的问题。将 `checkIdempotency` 拆分为 `checkIdempotencyCache`（只读，事务外）和 `occupyIdempotencySlot`（写入，事务内接收 `tx` 参数）；`cacheResponse` 同步改为接收 `tx` 参数；§6.1 和 §6.2 流程描述同步更新 |

---

## 第四轮修复记录

**修复日期**：2026-02-21

| 编号 | 优先级 | 修复摘要 |
|------|--------|----------|
| H-07 | High | §4.2 INSUFFICIENT_POINTS 响应增加 `currentBalance` 和 `required` 字段，使前端能展示当前余额与所需积分 |
| C-09 | Critical | §7.2 代码注释和 §4.1 retryAfter 说明中的 `C-9` 标注改为 `C-4`，修正语义混乱（C-9 指兑换原子性，C-4 指频率限制） |
| C-10 | Critical | 需求文档第69行验收标准表和第94-98行过期处理章节，从"WHERE expires_at > NOW() 实时过滤"统一为"惰性过期机制：查询时检测过期批次，写入过期流水记录，更新批次状态为 expired"，与设计文档保持一致 |

---

## 第五轮修复记录

**修复日期**：2026-02-21

| 编号 | 优先级 | 修复摘要 |
|------|--------|----------|
| H-UX-01 | High | §4.1 RATE_LIMITED 的 `message` 从"今日该行为积分已达上限，请明日再试"改为"该行为积分已达频率上限，请稍后再试"，消除与可配置 `rateLimitWindow`（如 share_post 为 3600 秒）的语义矛盾；前端应根据 `retryAfter` 时间戳动态展示剩余等待时间 |
