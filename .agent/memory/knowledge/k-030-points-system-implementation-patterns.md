# 用户积分系统实现模式

## 核心架构决策

### 批次模型（PointsBatch）
- 每次 earn 创建一个 PointsBatch，记录 originalPts / remainingPts / expiresAt / status
- 余额 = 所有 active 且未过期批次的 remainingPts 之和
- 优势：天然支持 FIFO 扣减、过期追踪、审计链

### 惰性过期（Lazy Expiry）
- 不使用定时任务，在 calculateBalanceInTx 中检测并处理过期批次
- FOR UPDATE 锁定后过滤 expiresAt < now，写 expire 交易，更新 status='expired'
- 关键：ORDER BY expiresAt ASC 确保 FIFO 语义一致（balance.ts 和 redeem.ts 必须一致）

### 并发安全
```sql
SELECT * FROM "PointsBatch"
WHERE "userId" = $1 AND "status" = 'active'
ORDER BY "expiresAt" ASC
FOR UPDATE
```
- 行级锁防止并发扣减竞态
- 整个 earn/redeem 操作包裹在 db.$transaction 中

### 幂等性三层机制
1. 事务外快速检查（checkIdempotencyCache）：responseCode != 0 才返回缓存
2. 事务内原子占位（occupyIdempotencySlot）：upsert + skipDuplicates，responseCode=0 表示进行中
3. 事务内写入最终响应（cacheResponse）

## 常见陷阱

### FIFO 排序不一致
- **问题**：balance.ts 用 expiresAt ASC，redeem.ts 用 issuedAt ASC → 不同有效期批次混合时语义不同
- **修复**：统一使用 ORDER BY "expiresAt" ASC

### 错误响应格式不统一
- **问题**：transactions/route.ts 的 401 响应缺少 message 字段
- **规范**：所有错误响应统一为 `{ error: string, message: string }` + 可选扩展字段

### idempotency-key 必填性
- redeem 接口：必填（缺失返回 400），因为扣费操作不可重复
- earn 接口：可选，因为重复获取积分影响较小

## API 接口规范

| 接口 | 方法 | 必填头 | 关键错误码 |
|------|------|--------|-----------|
| /api/points/earn | POST | x-user-id | 400/401/409/422 |
| /api/points/redeem | POST | x-user-id, idempotency-key | 400/401/402/422 |
| /api/points/balance | GET | x-user-id | 401 |
| /api/points/transactions | GET | x-user-id | 400/401 |

## 速率限制实现
- 基于 DB COUNT（不引入 Redis）
- 查询窗口内同 userId + actionType 的 earn 交易数
- 超限抛出 PointsError('RATE_LIMITED', ..., { retryAfter })
