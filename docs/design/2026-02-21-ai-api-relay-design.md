# AI API 中继系统设计文档

**版本**: 1.0  
**日期**: 2026-02-21  
**作者**: Claude Code  
**状态**: 设计阶段

---

## 1. 系统架构

### 1.1 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                     客户端应用                               │
│              (Web / Mobile / CLI)                            │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Next.js 15 App Router                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 认证层 (NextAuth.js v5)                              │   │
│  │ - OAuth 提供商集成                                   │   │
│  │ - Session 管理                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ API 路由层                                           │   │
│  │ - POST /api/v1/chat/completions (Edge Runtime)      │   │
│  │ - GET/POST/DELETE /api/internal/keys                │   │
│  │ - GET /api/internal/usage                           │   │
│  │ - POST /api/internal/billing/deduct (Node.js)       │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    ┌────────┐  ┌────────┐  ┌──────────┐
    │ MySQL  │  │ Redis  │  │ 上游API  │
    │ 8.0    │  │ Cache  │  │(OpenAI) │
    └────────┘  └────────┘  └──────────┘
```

### 1.2 技术栈

| 组件 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | Next.js | 15 | App Router、API 路由、SSE 流 |
| 认证 | NextAuth.js | v5 | OAuth、Session 管理 |
| 数据库 | MySQL | 8.0 | 用户、API Key、余额、使用日志 |
| ORM | Drizzle | 最新 | 类型安全的数据库操作 |
| 缓存 | Redis | 最新 | Key 验证缓存、吊销集合、并发计数 |
| 运行时 | Vercel Edge | - | 低延迟 API 代理 |
| 部署 | Vercel / Docker | - | 生产环境 |

---

## 2. 模块设计

### 2.1 认证模块 (Authentication)

**职责**: 用户身份验证、Session 管理、OAuth 集成、首次登录 API Key 生成

**关键组件**:
- NextAuth.js 配置 (`app/api/auth/[...nextauth]/route.ts`)
- OAuth 提供商（GitHub、Google 等）
- Session 存储（数据库）
- signIn 回调钩子（首次登录检测）

**流程**:
1. 用户通过 OAuth 登录
2. NextAuth signIn 回调检测首次登录
3. 首次登录时自动生成 API Key（格式：sk-{randomBytes(24).toString('base64url')}）
4. 创建 Session 和 Account 记录
5. 后续请求通过 Session 验证身份

**首次登录 API Key 生成**:
```typescript
// NextAuth signIn 回调
async signIn({ user, account }) {
  if (account?.provider && !user.id) {
    // 首次登录
    const apiKey = 'sk-' + randomBytes(24).toString('base64url');
    const keyHash = sha256(apiKey);

    // 创建 API Key 记录
    await db.insert(api_keys).values({
      id: generateUUID(),
      userId: user.id,
      key: apiKey,
      keyHash: keyHash,
      name: 'Default Key',
      created_at: new Date()
    });
  }
  return true;
}
```

---

### 2.2 API Key 管理模块 (API Key Management)

**职责**: API Key 的生成、验证、吊销、缓存

**关键接口**:
- `GET /api/internal/keys` - 列出用户 API Keys
- `POST /api/internal/keys` - 创建 API Key（返回明文一次）
- `DELETE /api/internal/keys/[id]` - 吊销 Key

**缓存策略**:
- Key 验证结果缓存 5 秒（Redis）
- 吊销 Key 写入 Redis 失效集合（实时生效）

**验证流程**:
```
请求 → 检查 Redis 缓存 → 缓存命中返回 → 缓存未命中查数据库 → 更新缓存 → 返回
```

---

### 2.3 余额管理模块 (Balance Management)

**职责**: 用户余额查询、扣费、充值

**关键接口**:
- `POST /api/internal/billing/deduct` - 预扣费
- `GET /api/internal/usage` - 查询使用统计

**扣费策略** (ADR-001):
- 使用悲观锁：SELECT ... FOR UPDATE + MySQL 事务 + REPEATABLE READ 隔离级别
- 事务流程：BEGIN TRANSACTION → SELECT FOR UPDATE → 先扣套餐 tokensRemaining → 不足再扣余额 → COMMIT
- 套餐和余额均不足返回 402（余额不足）
- 扣费成功返回实际扣费金额

**并发控制** (ADR-003):
- 悲观锁保证原子性，无需重试
- Redis 并发计数器防超额

---

### 2.4 API 代理模块 (API Proxy)

**职责**: 请求验证、预扣费、上游代理、差额退款、日志记录

**关键接口**:
- `POST /api/v1/chat/completions` - 代理 OpenAI 兼容 API

**请求流程**:
```
1. 验证 API Key（缓存 5 秒）
2. 检查 Key 是否被吊销（Redis 失效集合）
3. 检查用户余额
4. 预扣费（max_cost）
5. 代理请求到上游 API
6. 计算实际成本
7. 退差额（max_cost - actual_cost）
8. 记录使用日志
9. 返回 SSE 流
```

**错误处理**:
- 401: 无效或过期 Key
- 402: 余额不足
- 429: 限流（并发超额）
- 502: 上游 API 错误

---

### 2.5 使用统计模块 (Usage Analytics)

**职责**: 记录 API 调用、计算成本、生成统计报告

**关键接口**:
- `GET /api/internal/usage` - 查询使用统计（支持按模型/日期筛选、分页）
- `GET /api/internal/usage/export` - CSV 导出（最多 10000 条）

**统计维度**:
- 按模型统计
- 按日期统计
- 按用户统计
- 成本汇总

---

### 2.6 管理后台模块 (Admin Dashboard)

**职责**: 系统管理、用户管理、模型配置、收入统计、审计日志

**访问控制** (RBAC):
- `admin`: 全权访问，可修改所有配置

**关键接口**:
- `GET /api/admin/models` - 列出所有模型配置
- `POST /api/admin/models` - 创建/更新模型（admin 权限）
- `GET /api/admin/users` - 列出用户（admin 权限）
- `POST /api/admin/users/{id}/role` - 修改用户角色（admin 权限）
- `POST /api/admin/users/{id}/balance` - 充值用户余额（admin 权限）
- `GET /api/admin/revenue` - 收入统计（admin 权限）
- `GET /api/admin/audit-logs` - 审计日志（admin 权限）

**权限检查**:
```typescript
// 中间件检查
async function checkAdminPermission(req) {
  const session = await getSession(req);
  if (!session?.user) return false;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id)
  });

  return user.role === 'admin';
}
```

---

## 3. 数据库 Schema

### 3.1 用户表 (users)

```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role ENUM('user', 'admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
);
```

**字段说明**:
- `id`: UUID，主键
- `email`: 用户邮箱，唯一
- `name`: 用户名
- `role`: 角色（user/admin）
- `created_at`: 创建时间
- `updated_at`: 更新时间

---

### 3.2 账户表 (accounts)

```sql
CREATE TABLE accounts (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  providerAccountId VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_provider (userId, provider, providerAccountId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId)
);
```

**字段说明**:
- `id`: UUID，主键
- `userId`: 用户 ID（外键）
- `provider`: OAuth 提供商（github, google 等）
- `providerAccountId`: 提供商账户 ID

---

### 3.3 API Key 表 (api_keys)

```sql
CREATE TABLE api_keys (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  keyHash VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  lastUsedAt TIMESTAMP,
  revokedAt TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId),
  INDEX idx_revokedAt (revokedAt)
);
```

**字段说明**:
- `id`: UUID，主键
- `userId`: 用户 ID（外键）
- `keyHash`: Key 的 SHA-256 哈希，明文仅创建时返回一次，不持久化
- `name`: Key 名称（用于识别）
- `lastUsedAt`: 最后使用时间
- `revokedAt`: 吊销时间（NULL 表示未吊销）
- `created_at`: 创建时间

---

### 3.4 余额表 (balances)

```sql
CREATE TABLE balances (
  userId VARCHAR(36) PRIMARY KEY,
  amount DECIMAL(18, 6) NOT NULL DEFAULT 0,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

**字段说明**:
- `userId`: 用户 ID（主键）
- `amount`: 余额（支持小数）
- `updatedAt`: 更新时间

---

### 3.5 订阅表 (subscriptions)

```sql
CREATE TABLE subscriptions (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  planId VARCHAR(50) NOT NULL,
  tokensRemaining BIGINT NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId),
  INDEX idx_expiresAt (expiresAt)
);
```

**字段说明**:
- `id`: UUID，主键
- `userId`: 用户 ID（外键）
- `planId`: 订阅计划 ID
- `tokensRemaining`: 剩余 Token 数
- `expiresAt`: 过期时间
- `created_at`: 创建时间
- `updated_at`: 更新时间

---

### 3.6 模型表 (models)

```sql
CREATE TABLE models (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  upstreamModel VARCHAR(255) NOT NULL,
  inputPrice DECIMAL(18, 8) NOT NULL,
  outputPrice DECIMAL(18, 8) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_enabled (enabled)
);
```

**字段说明**:
- `id`: 模型 ID（如 gpt-4-turbo）
- `name`: 模型名称
- `upstreamModel`: 上游 API 模型名称
- `inputPrice`: 输入 Token 价格（单位：美元/1K tokens）
- `outputPrice`: 输出 Token 价格（单位：美元/1K tokens）
- `enabled`: 是否启用
- `created_at`: 创建时间
- `updated_at`: 更新时间

---

### 3.7 使用日志表 (usage_logs)

```sql
CREATE TABLE usage_logs (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  apiKeyId VARCHAR(36),
  model VARCHAR(50) NOT NULL,
  inputTokens INT NOT NULL,
  outputTokens INT NOT NULL,
  cost DECIMAL(18, 8) NOT NULL,
  duration INT NOT NULL COMMENT '毫秒',
  statusCode INT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (apiKeyId) REFERENCES api_keys(id) ON DELETE SET NULL,
  INDEX idx_userId (userId),
  INDEX idx_createdAt (createdAt),
  INDEX idx_model (model)
);
```

**字段说明**:
- `id`: UUID，主键
- `userId`: 用户 ID（外键）
- `apiKeyId`: API Key ID（外键，可为 NULL）
- `model`: 使用的模型
- `inputTokens`: 输入 Token 数
- `outputTokens`: 输出 Token 数
- `cost`: 成本（美元）
- `duration`: 请求耗时（毫秒）
- `statusCode`: HTTP 状态码
- `createdAt`: 创建时间

---

### 3.8 审计日志表 (audit_logs)

```sql
CREATE TABLE audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  operatorId VARCHAR(36) NOT NULL,
  action VARCHAR(50) NOT NULL,
  targetType VARCHAR(50) NOT NULL,
  targetId VARCHAR(36),
  detail JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (operatorId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_operatorId (operatorId),
  INDEX idx_createdAt (createdAt),
  INDEX idx_action (action)
);
```

**字段说明**:
- `id`: UUID，主键
- `operatorId`: 操作者 ID（外键）
- `action`: 操作类型（create, update, delete, export 等）
- `targetType`: 目标类型（user, model, subscription 等）
- `targetId`: 目标 ID
- `detail`: 操作详情（JSON 格式，包含变更前后数据）
- `createdAt`: 创建时间

---

## 4. API 接口契约

### 4.1 聊天完成接口

**端点**: `POST /api/v1/chat/completions`

**运行时**: Vercel Edge Runtime

**请求头**:
```
Authorization: Bearer sk_xxx
Content-Type: application/json
```

**请求体**:
```json
{
  "model": "gpt-4-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ],
  "stream": true,
  "max_tokens": 1000
}
```

**成功响应 (200)** - SSE 流:
```
data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" there"}}]}
data: [DONE]
```

**错误响应**:

| 状态码 | 错误 | 说明 |
|--------|------|------|
| 401 | `invalid_api_key` | API Key 无效或过期 |
| 402 | `insufficient_balance` | 余额不足 |
| 429 | `rate_limit_exceeded` | 并发超额或限流 |
| 502 | `upstream_error` | 上游 API 错误 |

**错误响应体**:
```json
{
  "error": {
    "message": "Insufficient balance",
    "type": "insufficient_balance",
    "code": 402
  }
}
```

---

### 4.2 列出 API Keys

**端点**: `GET /api/internal/keys`

**认证**: 需要有效 Session

**响应 (200)**:
```json
{
  "keys": [
    {
      "id": "key_123",
      "name": "Production Key",
      "lastUsedAt": "2026-02-21T10:30:00Z",
      "createdAt": "2026-02-01T00:00:00Z",
      "revokedAt": null
    }
  ]
}
```

---

### 4.3 创建 API Key

**端点**: `POST /api/internal/keys`

**认证**: 需要有效 Session

**请求体**:
```json
{
  "name": "My API Key"
}
```

**响应 (200)** - 仅返回一次明文:
```json
{
  "id": "key_123",
  "key": "sk_live_abc123xyz...",
  "name": "My API Key",
  "createdAt": "2026-02-21T10:30:00Z"
}
```

---

### 4.4 吊销 API Key

**端点**: `DELETE /api/internal/keys/[id]`

**认证**: 需要有效 Session

**响应 (200)**:
```json
{
  "success": true,
  "revokedAt": "2026-02-21T10:35:00Z"
}
```

**错误响应 (404)**:
```json
{
  "error": "Key not found"
}
```

---

### 4.5 查询使用统计

**端点**: `GET /api/internal/usage`

**认证**: 需要有效 Session

**查询参数**:
- `model` (可选): 按模型筛选
- `statusCode` (可选): 按 HTTP 状态码筛选
- `startDate` (可选): 开始日期 (YYYY-MM-DD)
- `endDate` (可选): 结束日期 (YYYY-MM-DD)
- `page` (可选): 页码，默认 1
- `pageSize` (可选): 每页条数，默认 20，最大 1000

**响应 (200)**:
```json
{
  "usage": [
    {
      "date": "2026-02-21",
      "model": "gpt-4-turbo",
      "inputTokens": 5000,
      "outputTokens": 2000,
      "cost": 0.15,
      "requestCount": 10
    }
  ],
  "totalCost": 0.45,
  "totalTokens": 7000,
  "totalRequestCount": 10,
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 250
  },
  "period": {
    "startDate": "2026-02-21",
    "endDate": "2026-02-21"
  }
}
```

---

### 4.6 导出使用统计

**端点**: `GET /api/internal/usage/export`

**认证**: 需要有效 Session

**查询参数**:
- `model` (可选): 按模型筛选
- `startDate` (可选): 开始日期 (YYYY-MM-DD)
- `endDate` (可选): 结束日期 (YYYY-MM-DD)
- `format` (可选): 导出格式，默认 csv

**响应 (200)** - CSV 格式:
```
date,model,inputTokens,outputTokens,cost,requestCount
2026-02-21,gpt-4-turbo,5000,2000,0.15,10
2026-02-20,gpt-4-turbo,3000,1500,0.10,8
```

**限制**:
- 最多导出 10000 条记录
- 超过限制返回 400 错误

---

## 5. 关键设计决策 (ADR)

### ADR-001: 悲观锁扣费机制

**问题**: 如何在高并发场景下安全地扣费，避免超支？

**决策**: 使用悲观锁 + MySQL 事务 + REPEATABLE READ 隔离级别

**实现**:
```sql
BEGIN TRANSACTION;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- 锁定用户的套餐和余额记录
SELECT tokensRemaining FROM subscriptions
WHERE userId = ? AND expiresAt > NOW()
FOR UPDATE;

SELECT amount FROM balances
WHERE userId = ?
FOR UPDATE;

-- 先扣套餐 Token
UPDATE subscriptions
SET tokensRemaining = tokensRemaining - ?cost
WHERE userId = ? AND expiresAt > NOW() AND tokensRemaining >= ?cost;

-- 如果套餐不足，扣余额
IF affected_rows = 0 THEN
  UPDATE balances
  SET amount = amount - ?cost
  WHERE userId = ? AND amount >= ?cost;

  IF affected_rows = 0 THEN
    ROLLBACK;
    RETURN 402; -- 余额不足
  END IF;
END IF;

COMMIT;
```

**验证**:
- 事务成功提交: 扣费成功
- 事务回滚: 余额不足，返回 402

**优势**:
- 强一致性，无竞态条件
- 支持套餐优先消费
- 原子操作，数据一致
- 无需应用层重试

**劣势**:
- 高并发下可能产生锁等待
- 需要合理的事务超时设置

---

### ADR-002: 预扣费模式

**问题**: 如何处理 SSE 流中的扣费？流可能中断，如何避免重复扣费或漏扣？

**决策**: 预扣费 + 差额退款

**流程**:
```
1. 请求开始: 预扣 max_cost（基于 max_tokens）
2. 流进行中: 实时计算成本
3. 流结束: 计算实际成本，退差额
4. 流中断: 预扣不退（Vercel 超时场景）
```

**优势**:
- 防止超支
- 处理流中断
- 用户体验好（先扣后退）

**劣势**:
- 需要差额退款逻辑
- 流中断时用户损失预扣费

**补偿**:
- 提供手动退款接口
- 定期审计异常扣费

---

### ADR-003: Redis 缓存策略

**问题**: 如何降低数据库查询压力，同时保证 Key 吊销实时生效？

**决策**: 分层缓存 + 失效集合

**实现**:
```
Key 验证:
  1. 检查 Redis 失效集合 (revoked_keys)
  2. 检查 Redis 缓存 (key_cache, TTL=5s)
  3. 查询数据库，更新缓存

Key 吊销:
  1. 数据库标记 revokedAt
  2. 写入 Redis 失效集合 (TTL=30天): SET revoked:{keyHash} 1 EX 2592000
  3. 删除 Redis 缓存 (立即生效)
```

**缓存键**:
- `key_cache:{keyHash}` - Key 验证结果，TTL 5 秒
- `revoked:{keyHash}` - 吊销 Key，TTL 30 天
- `concurrent_count:{userId}` - 并发计数器，TTL 1 分钟

**优势**:
- 降低数据库压力 95%+
- Key 吊销实时生效
- 支持并发控制

---

### ADR-004: Edge Runtime 调用 Node.js 扣费路由

**问题**: 如何在 Edge Runtime 中安全地调用需要数据库事务的扣费逻辑？

**决策**: 扣费通过内部 HTTP 调用 `/api/internal/billing/deduct` 完成，该路由运行在 Node.js Runtime

**实现**:
```
Edge Runtime (/api/v1/chat/completions)
  ↓ 预扣费请求
Node.js Runtime (/api/internal/billing/deduct)
  ↓ 执行 SELECT FOR UPDATE 事务
MySQL (悲观锁)
```

**优势**:
- Edge Runtime 保持低延迟（仅代理逻辑）
- Node.js Runtime 支持完整事务和连接池
- 内部调用无网络延迟
- 清晰的职责分离

**vercel.json 配置**:
```json
{
  "functions": {
    "api/v1/chat/completions.ts": {
      "runtime": "edge",
      "memory": 512
    }
  }
}
```

---

## 6. 缓存策略

### 6.1 缓存层次

| 缓存层 | 存储 | TTL | 用途 |
|--------|------|-----|------|
| L1 | Redis | 60s | 模型配置 |
| L2 | Redis | 10s | 用户余额 |
| L3 | Redis | 5s | API Key 验证结果 |
| L4 | Redis | 1m | 并发计数器 |
| L5 | Redis | ∞ | 吊销 Key 集合 |
| L6 | 数据库 | - | 源数据 |

### 6.2 缓存键设计

**模型配置缓存**:
- 键: `model_config:{modelId}`
- TTL: 60 秒
- 失效时机: 管理后台更新模型时主动删除

**用户余额缓存**:
- 键: `user_balance:{userId}`
- TTL: 10 秒
- 失效时机: 扣费后主动删除

**API Key 验证缓存**:
- 键: `key_cache:{keyHash}`
- TTL: 5 秒
- 失效时机: Key 吊销时立即删除

**吊销 Key 集合**:
- 键: `revoked_keys`
- TTL: 永久
- 失效时机: 无（集合式存储）

### 6.3 缓存失效策略

**主动失效**:
- 模型配置更新时删除 `model_config:{modelId}`
- 用户扣费后删除 `user_balance:{userId}`
- Key 吊销时删除 `key_cache:{keyHash}` 并添加到 `revoked_keys`

**被动失效**:
- TTL 过期自动删除
- 定期清理过期数据

### 6.4 缓存预热

**启动时**:
- 加载所有启用的模型配置到 Redis
- 预加载热点用户的余额信息

---

## 7. 定时任务

### 7.1 过期套餐清零

**触发**: Vercel Cron，每日 UTC 00:00

**路由**: `GET /api/cron/expire-subscriptions`

**安全验证**:
```typescript
// 验证 CRON_SECRET 环境变量
export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 清零过期套餐
  await db.update(subscriptions)
    .set({ tokensRemaining: 0 })
    .where(lt(subscriptions.expiresAt, new Date()));

  return Response.json({ success: true });
}
```

**vercel.json 配置**:
```json
{
  "crons": [
    {
      "path": "/api/cron/expire-subscriptions",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**环境变量**:
```
CRON_SECRET=your-secret-key
```

---

## 8. 部署方案

### 8.1 Vercel 部署

**优势**:
- 原生支持 Next.js 15
- Edge Runtime 低延迟
- 自动扩展
- 内置 CI/CD

**配置** (`vercel.json`):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "env": {
    "DATABASE_URL": "@database_url",
    "REDIS_URL": "@redis_url",
    "NEXTAUTH_SECRET": "@nextauth_secret"
  },
  "functions": {
    "api/v1/chat/completions.ts": {
      "runtime": "edge",
      "memory": 512
    }
  }
}
```

**环境变量**:
```
DATABASE_URL=mysql://user:pass@host:3306/db
REDIS_URL=redis://host:6379
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://yourdomain.com
GITHUB_ID=xxx
GITHUB_SECRET=xxx
OPENAI_API_KEY=xxx
```

---

### 8.2 Docker 部署

**Dockerfile**:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY .next ./.next
COPY public ./public

EXPOSE 3000

CMD ["npm", "start"]
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: mysql://user:pass@mysql:3306/db
      REDIS_URL: redis://redis:6379
    depends_on:
      - mysql
      - redis

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: api_relay
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
```

---

### 8.3 监控和告警

**关键指标**:
- API 响应时间 (p50, p95, p99)
- 错误率 (4xx, 5xx)
- 余额不足率 (402 错误)
- 数据库连接池使用率
- Redis 命中率

**告警规则**:
- 错误率 > 5% 告警
- 响应时间 p99 > 2s 告警
- 数据库连接池使用率 > 80% 告警

---

## 9. 安全考虑

### 9.1 API Key 安全

- 仅存储 Key 的 SHA-256 哈希，明文不落库
- 创建时返回明文一次，之后不可查看
- 支持 Key 吊销和轮换
- 定期审计 Key 使用情况

### 9.2 认证和授权

- 使用 NextAuth.js 管理 Session
- 所有内部 API 需要有效 Session
- 支持 OAuth 多提供商
- 实现基于角色的访问控制 (RBAC)

### 9.3 数据保护

- 数据库连接使用 SSL/TLS
- 敏感数据加密存储
- 定期备份数据库
- 实现审计日志

---

## 10. 性能优化

### 10.1 数据库优化

- 为常用查询字段建立索引
- 使用连接池管理数据库连接（mysql2 connectionLimit: 20）
- 定期分析和优化慢查询

**连接池配置示例**:
```typescript
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 20,
  waitForConnections: true,
  queueLimit: 0
});
```

### 10.2 缓存优化

- 使用 Redis 集群提高可用性
- 实现缓存预热和预测
- 监控缓存命中率

### 10.3 API 优化

- 使用 Edge Runtime 降低延迟
- 实现请求压缩
- 支持 HTTP/2 和 HTTP/3

---

## 11. 扩展性

### 11.1 水平扩展

- 无状态设计，支持多实例部署
- 使用数据库和 Redis 作为共享存储
- 支持负载均衡

### 11.2 垂直扩展

- 优化数据库查询性能
- 增加 Redis 内存
- 提升服务器配置

### 11.3 功能扩展

- 支持多个上游 API 提供商
- 支持自定义模型配置
- 支持高级计费模式（按量、包月等）

---

## 12. 故障恢复

### 12.1 数据库故障

- 主从复制实现高可用
- 定期备份和恢复测试
- 实现自动故障转移

### 12.2 Redis 故障

- 使用 Redis Sentinel 或 Cluster
- 实现缓存降级策略
- 支持缓存预热

### 12.3 上游 API 故障

- 实现重试机制（指数退避）
- 支持多个上游提供商
- 实现熔断器模式

---

## 13. 成本分析

### 13.1 基础设施成本

| 组件 | 成本 | 说明 |
|------|------|------|
| Vercel | $20-100/月 | 按使用量计费 |
| MySQL | $50-200/月 | 云数据库 |
| Redis | $20-100/月 | 云缓存 |
| 总计 | $90-400/月 | 基础配置 |

### 13.2 成本优化

- 使用 Vercel 按需付费
- 数据库使用预留实例
- Redis 使用共享集群
- 定期审计和优化资源使用

---

## 14. 时间表

| 阶段 | 任务 | 时间 |
|------|------|------|
| Phase 1 | 数据库设计和实现 | 1 周 |
| Phase 2 | 认证和 API Key 管理 | 1 周 |
| Phase 3 | 余额管理和扣费逻辑 | 1 周 |
| Phase 4 | API 代理和 SSE 流 | 1 周 |
| Phase 5 | 缓存和性能优化 | 1 周 |
| Phase 6 | 测试和部署 | 1 周 |

---

## 15. 参考资源

- [Next.js 15 文档](https://nextjs.org/docs)
- [NextAuth.js v5 文档](https://authjs.dev)
- [Drizzle ORM 文档](https://orm.drizzle.team)
- [Redis 文档](https://redis.io/docs)
- [OpenAI API 文档](https://platform.openai.com/docs)

---

**文档版本历史**:
- v1.0 (2026-02-21): 初始版本，包含完整架构设计和实现指南
