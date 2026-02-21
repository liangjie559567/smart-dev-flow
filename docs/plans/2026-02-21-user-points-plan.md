# 用户积分系统实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 Next.js 14 积分系统，含发放、兑换、余额查询、流水查询四个接口

**Architecture:** 批次模型（PointsBatch）+ FIFO 扣减 + 惰性过期 + 行级锁 + 幂等性 + 频率限制

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, PostgreSQL

---

## T01: Prisma Schema 定义
依赖: 无
预估: 45 分钟
并行: 可与 T02 并行
验收条件:
  - [ ] ActionConfig 表：id, actionType(unique), points, validityDays, rateLimitWindow, rateLimitMax
  - [ ] ItemConfig 表：id, itemCode(unique), name, pointsCost, isActive
  - [ ] PointsBatch 表：id, userId, actionType, originalPts, remainingPts, status(active/redeemed/expired), issuedAt, expiresAt；索引 [userId,expiresAt], [userId,status,expiresAt]
  - [ ] PointTransaction 表：id, userId, type(earn/redeem/expire), points, actionType?, balanceBefore, balanceAfter, refId?, description?, createdAt；索引 [userId,createdAt], [userId,actionType,type,createdAt]
  - [ ] IdempotencyKey 表：id, key, userId, responseCode, responseBody(Json), createdAt；唯一约束 (key,userId)；索引 [createdAt]
  - [ ] Redemption 表：id, userId, itemCode, pointsCost, createdAt；索引 [userId,createdAt]
  - [ ] npx prisma validate 通过，npx prisma generate 成功
TDD 要点: Schema 层通过 prisma validate + generate 验证

---

## T02: 类型定义 (lib/points/types.ts)
依赖: 无
预估: 30 分钟
并行: 可与 T01 并行
验收条件:
  - [ ] 导出 EarnRequest, EarnResponse 类型
  - [ ] 导出 RedeemRequest, RedeemResponse 类型
  - [ ] 导出 BalanceResponse 类型
  - [ ] 导出 TransactionsQuery, TransactionsResponse, TransactionItem 类型
  - [ ] 导出 PointsError 类（含 code 和可选 retryAfter 字段）
  - [ ] TypeScript 编译通过，无 any 类型
TDD 要点: 编译检查验证所有导出类型正确

---

## T03: 幂等性模块 (lib/points/idempotency.ts)
依赖: T01, T02
预估: 1 小时
并行: 可与 T04 并行
验收条件:
  - [ ] checkIdempotencyCache(key, userId): 事务外只读，命中返回 {cached:true, response}，未命中返回 {cached:false}
  - [ ] 跨用户碰撞检测：相同 key 不同 userId → 抛出 IDEMPOTENCY_CONFLICT
  - [ ] occupyIdempotencySlot(tx, key, userId): 事务内，createMany+skipDuplicates，count=0 时查询并返回缓存
  - [ ] cacheResponse(tx, key, userId, code, body): 事务内更新 responseCode/responseBody
  - [ ] 24小时窗口：超过 24h 的记录不返回缓存
TDD 要点:
  先写测试:
  1. 首次 checkIdempotencyCache → {cached:false}
  2. occupy → cacheResponse → check → 返回缓存值
  3. 相同 key 不同 userId → IDEMPOTENCY_CONFLICT

---

## T04: 余额计算 + 惰性过期 (lib/points/balance.ts)
依赖: T01, T02
预估: 1.5 小时
并行: 可与 T03 并行
验收条件:
  - [ ] calculateBalanceInTx(tx, userId): 事务内版本，供 earn/redeem 调用
  - [ ] calculateBalance(userId): 独立入口，自开事务，供 balance 接口调用
  - [ ] 惰性过期：SELECT FOR UPDATE 锁定 expiresAt<NOW() 且 status=active 的批次，写 expire 流水，更新 status=expired/remainingPts=0；初始 currentBalance = 所有 active 批次（含已到期但尚未标记为 expired 的批次）的 remainingPts 之和，再逐批次递减（ADR-005）
  - [ ] 多批次过期时 balanceBefore 逐步递减（ADR-005）
  - [ ] balance = SUM(remainingPts) WHERE status=active AND expiresAt>=NOW()
  - [ ] expiringSoon = SUM(remainingPts) WHERE status=active AND expiresAt < NOW()+7days
  - [ ] nextExpiryAt = MIN(expiresAt) WHERE status=active AND expiresAt < NOW()+7days，无则 null
TDD 要点:
  先写测试:
  1. 无批次 → {balance:0, expiringSoon:0, nextExpiryAt:null}
  2. 2个 active 批次 → balance 为两者之和
  3. 1个已过期批次 → 调用后 status=expired，balance=0，存在 expire 流水
  4. 多批次过期 → expire 流水 balanceBefore 逐步递减

---

## T05: 发放业务逻辑 (lib/points/earn.ts)
依赖: T03, T04
预估: 1.5 小时
并行: 可与 T06 并行
验收条件:
  - [ ] earnPoints(userId, actionType, idempotencyKey): 单事务完成全部操作
  - [ ] actionType 不存在 → 400 INVALID_ACTION（事务外查询）
  - [ ] 事务内：从 ActionConfig 获取 points/validityDays 计算 expiresAt
  - [ ] 事务内流程: occupySlot → 频率检查 → 发放积分 → cacheResponse
  - [ ] 频率限制：COUNT earn 流水 >= rateLimitMax → 409 RATE_LIMITED + retryAfter（窗口结束 Unix 时间戳）
  - [ ] 发放：创建 PointsBatch(status=active)，调用 calculateBalanceInTx 计算 balanceBefore，写入 PointTransaction(type=earn, balanceBefore, balanceAfter)
  - [ ] 返回 {pointsEarned, newBalance, expiresAt, transactionId}
  - [ ] 幂等：相同 key 二次调用返回首次缓存结果
TDD 要点:
  先写测试:
  1. 无效 actionType → INVALID_ACTION
  2. 首次发放 → 成功，DB 有 batch+transaction 记录
  3. 超频 → RATE_LIMITED + retryAfter
  4. 幂等重放 → 返回首次结果，DB 无重复记录

---

## T06: 兑换业务逻辑 (lib/points/redeem.ts)
依赖: T03, T04
预估: 1.5 小时
并行: 可与 T05 并行
验收条件:
  - [ ] redeemPoints(userId, itemCode, idempotencyKey): 单事务完成全部操作
  - [ ] itemCode 不存在或 isActive=false → 400 INVALID_ITEM（事务外查询）
  - [ ] 事务内流程: occupySlot → SELECT FOR UPDATE → 惰性过期 → 余额检查 → FIFO 扣减 → 写流水 → cacheResponse
  - [ ] SELECT FOR UPDATE 锁定 active 批次（按 issuedAt ASC），防止并发超额扣减（ADR-003）
  - [ ] 余额不足 → 402 INSUFFICIENT_POINTS，响应体含 {currentBalance, required}（事务回滚，占位随之清除）
  - [ ] FIFO 扣减：按 issuedAt ASC，扣完的批次 status=redeemed
  - [ ] 写 PointTransaction(type=redeem) + Redemption 记录
  - [ ] 返回 {pointsDeducted, newBalance, redemptionId, transactionId}
  - [ ] 幂等：相同 key 二次调用返回首次缓存结果
TDD 要点:
  先写测试:
  1. 无效 itemCode → INVALID_ITEM
  2. 余额不足 → INSUFFICIENT_POINTS
  3. 单批次扣减 → remainingPts 正确减少
  4. 跨批次 FIFO → 第一批次 redeemed，第二批次部分扣减
  5. 幂等重放 → 返回首次结果，DB 无重复扣减

---

## T07: POST /api/points/earn Route
依赖: T05
预估: 45 分钟
并行: 可与 T08, T09, T10 并行
验收条件:
  - [ ] 无 session → 401 UNAUTHORIZED
  - [ ] 缺少 Idempotency-Key 头 → 400
  - [ ] 调用 earnPoints，业务异常映射为对应 HTTP 状态码
  - [ ] IDEMPOTENCY_CONFLICT → 422
  - [ ] 成功 → 200 + EarnResponse
  - [ ] 未知异常 → 500 INTERNAL_ERROR
TDD 要点:
  先写测试（mock earnPoints + session）:
  1. 无 session → 401
  2. 无 Idempotency-Key → 400
  3. 正常请求 → 200
  4. RATE_LIMITED → 409 + retryAfter
  5. 相同 key 不同 userId → 422 IDEMPOTENCY_CONFLICT

---

## T08: POST /api/points/redeem Route
依赖: T06
预估: 45 分钟
并行: 可与 T07, T09, T10 并行
验收条件:
  - [ ] 无 session → 401 UNAUTHORIZED
  - [ ] 缺少 Idempotency-Key 头 → 400
  - [ ] 调用 redeemPoints，业务异常映射为对应 HTTP 状态码
  - [ ] IDEMPOTENCY_CONFLICT → 422
  - [ ] 成功 → 200 + RedeemResponse
  - [ ] 未知异常 → 500 INTERNAL_ERROR
TDD 要点:
  先写测试（mock redeemPoints + session）:
  1. 无 session → 401
  2. 无 Idempotency-Key → 400
  3. 正常请求 → 200
  4. INSUFFICIENT_POINTS → 402
  5. 相同 key 不同 userId → 422 IDEMPOTENCY_CONFLICT

---

## T09: GET /api/points/balance Route
依赖: T04
预估: 30 分钟
并行: 可与 T07, T08, T10 并行
验收条件:
  - [ ] 无 session → 401 UNAUTHORIZED
  - [ ] 调用 calculateBalance，返回 200 + BalanceResponse
  - [ ] 异常 → 500 INTERNAL_ERROR
TDD 要点:
  先写测试（mock calculateBalance + session）:
  1. 无 session → 401
  2. 正常请求 → 200 + {balance, expiringSoon, nextExpiryAt}

---

## T10: GET /api/points/transactions Route
依赖: T01, T02
预估: 45 分钟
并行: 可与 T07, T08, T09 并行
验收条件:
  - [ ] 无 session → 401 UNAUTHORIZED
  - [ ] pageSize > 100 → 400 INVALID_PARAMS
  - [ ] type 非 earn/redeem/expire → 400 INVALID_PARAMS
  - [ ] 默认 page=1, pageSize=20
  - [ ] 按 createdAt DESC 分页，返回 {transactions, total, page, pageSize}
  - [ ] redeem/expire 类型的 points 字段为负数，earn 类型为正数
  - [ ] 异常 → 500 INTERNAL_ERROR
TDD 要点:
  先写测试（mock prisma + session）:
  1. 无 session → 401
  2. pageSize=200 → 400
  3. type=earn → 仅返回 earn 流水
  4. 默认参数正确
  5. type=invalid_value → 400 INVALID_PARAMS

---

## T11: 发放流程集成测试
依赖: T07
预估: 1 小时
并行: 可与 T12, T13 并行
验收条件:
  - [ ] 完整 HTTP 链路，真实测试数据库
  - [ ] 首次 earn → DB 有 batch+transaction，balance 正确
  - [ ] 幂等重放 → 相同结果，DB 无重复记录
  - [ ] 超频 → 409 + retryAfter 合理

---

## T12: 兑换流程集成测试
依赖: T08
预估: 1 小时
并行: 可与 T11, T13 并行
验收条件:
  - [ ] earn → redeem → DB 批次 remainingPts 正确
  - [ ] 跨批次 FIFO：第一批次 redeemed，第二批次部分扣减
  - [ ] 余额不足 → 402，DB 无变更
  - [ ] 幂等重放 → 相同结果，DB 无重复扣减

---

## T13: 惰性过期 + 流水分页集成测试
依赖: T09, T10
预估: 1 小时
并行: 可与 T11, T12 并行
验收条件:
  - [ ] 插入已过期批次 → GET /balance → status=expired，expire 流水已写，balance 不含过期积分
  - [ ] 多批次过期 → expire 流水 balanceBefore 逐步递减
  - [ ] 并发两次 GET /balance 请求，expire 流水不重复写入
  - [ ] GET /transactions type 过滤正确，分页正确

---

## 依赖关系

```
T01 ──┬──→ T03 ──┬──→ T05 ──→ T07 ──→ T11
T02 ──┤          └──→ T06 ──→ T08 ──→ T12
      └──→ T04 ──┘──→ T09 ──→ T13
      └──→ T10 ──────────────→ T13
```

## 并行执行策略

| 阶段 | 并行任务 | 关键路径耗时 |
|------|---------|------------|
| 第一层 | T01 + T02 | 45 分钟 |
| 第二层 | T03 + T04 | 1.5 小时 |
| 第三层 | T05 + T06 | 1.5 小时 |
| 第四层 | T07 + T08 + T09 + T10 | 45 分钟 |
| 第五层 | T11 + T12 + T13 | 1 小时 |

关键路径（串行）：T01 → T04 → T06 → T08 → T12，约 5.5 小时
