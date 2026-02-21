# AI API 中转站 - 任务清单
生成时间：2026-02-21

## 任务列表

- [x] T01: 项目初始化与数据库 Schema（8张表，Drizzle ORM）
- [x] T02: NextAuth.js v5 认证配置（GitHub/Google OAuth + 首次登录自动生成 API Key）
- [x] T03: Redis 缓存集成（Key 5s TTL + 余额 10s + 模型 60s + 独立吊销标记）
- [x] T04: API Key 管理接口（列出/创建/吊销，keyHash 存储）
- [x] T05: 扣费服务 Node.js Runtime（SELECT FOR UPDATE + REPEATABLE READ + 套餐优先）
- [x] T06: AI API 代理核心 Edge Runtime（Key 验证 → 调用 Node.js 预扣费 → 上游代理）
- [x] T07: 流式响应代理（ReadableStream 逐块转发，流结束退差额）
- [x] T08: 用量日志记录与统计接口（写入 usage_logs，分页查询，CSV 导出）
- [ ] T09: 用户控制台页面（余额/套餐展示，API Key 管理）
- [ ] T10: 用量统计图表与 CSV 导出（30天折线图，历史列表筛选）
- [ ] T11: 管理后台 - 模型管理（CRUD + RBAC，变更后清 Redis 缓存）
- [ ] T12: 管理后台 - 用户与收益管理（余额调整，审计日志，收益统计）
- [ ] T13: 套餐过期定时任务（Vercel Cron，每日 UTC 00:00）
- [ ] T14: 部署配置（vercel.json + Dockerfile + docker-compose.yml）

## 依赖关系

T01 → T02 → T04
T01 → T03
T01 + T03 → T05
T05 + T03 → T06
T06 → T07
T06 + T07 → T08
T02 + T04 → T09
T08 → T10
T01 + T02 → T11
T01 + T02 + T08 → T12
T01 → T13
T01 → T14

## 优先级

P0（核心）: T01, T02, T03, T04, T05, T06, T07, T08
P1（扩展）: T09, T10, T11, T12, T13
P2（部署）: T14
