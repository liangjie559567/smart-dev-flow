# AI API 中转站 设计文档

## 目标

复刻 bltcy.ai 柏拉图AI API中转站，提供 AI API 代理转发服务，支持用户账户、计费、用量统计。

## 技术栈

- **前端/后端**: Next.js 15 App Router（Edge Runtime 代理）
- **数据库**: MySQL + Drizzle ORM
- **认证**: NextAuth.js（邮箱+密码 + GitHub/Google OAuth）
- **样式**: Tailwind CSS + shadcn/ui

## 架构

```
用户浏览器
  ↓
Next.js App Router
  ├── /app/(auth)/*         用户认证页面
  ├── /app/dashboard/*      用户控制台
  ├── /app/admin/*          管理员后台
  └── /app/api/
        ├── /auth/*         NextAuth 认证
        ├── /v1/*           AI API 代理（Edge Runtime）
        └── /internal/*     内部 API（计费、统计）
  ↓
MySQL（用户/账单/日志）
  ↓
上游 AI API（OpenAI/Claude/Gemini）
```

## 模块设计

### 1. 用户账户系统
- 注册/登录（邮箱+密码）
- OAuth 登录（GitHub、Google）
- API Key 管理（生成/查看/删除，支持多个）
- 余额显示

### 2. API 代理转发
- 兼容 OpenAI API 格式（`/v1/chat/completions`、`/v1/models` 等）
- 多模型路由（GPT-4、Claude、Gemini 等）
- 流式响应（SSE）
- 请求限流（按用户 API Key）
- 超时重试

### 3. 计费与充值
- 预付费余额模式
- 按 token 扣费（输入/输出分别计价）
- 套餐订阅（月套餐）
- 充值记录

### 4. 用量统计与日志
- API 调用历史列表
- Token 用量图表（按模型/时间）
- 筛选：模型、时间范围

### 5. 管理员后台
- 用户列表与管理
- 模型配置（上游 API Key、价格）
- 收益统计

## 数据库表

- `users` - 用户
- `api_keys` - 用户 API Key
- `balances` - 余额
- `transactions` - 充值/扣费记录
- `usage_logs` - API 调用日志
- `models` - 模型配置
- `plans` - 套餐

## 验收标准

1. 用户可注册/登录，管理 API Key
2. 使用用户 API Key 调用 `/v1/chat/completions`，成功代理到上游
3. 每次调用后余额正确扣减
4. 控制台可查看调用历史和 token 用量
5. 管理员可配置模型和查看统计
