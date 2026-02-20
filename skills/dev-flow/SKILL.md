---
name: dev-flow
description: 智能开发助手主入口 - 融合 Axiom 状态机与 OMC 多智能体编排
triggers: ["dev-flow", "smart dev", "axiom", "/dev-flow"]
---

# dev-flow - 智能开发助手

## 流程

1. 读取 `.agent/memory/active_context.md` 中的 `task_status`
2. 根据状态路由：

| 状态 | 动作 |
|------|------|
| `IDLE` | 智能需求收集，调用 `axiom-draft` |
| `DRAFTING` | 继续 Phase 1，调用 `axiom-draft`（含 PRD 确认流程） |
| `REVIEWING` | 继续 Phase 1.5，调用 `axiom-review` |
| `DECOMPOSING` | 继续 Phase 2，调用 `axiom-decompose` |
| `IMPLEMENTING` | 继续 Phase 3，调用 `axiom-implement` |
| `BLOCKED` | 展示 `blocked_reason`，提供恢复选项 |
| `REFLECTING` | 调用 `axiom-reflect` |

## IDLE 时的引导

依次询问用户以下三项（可一次性回答）：

1. **需求描述**：你想构建什么功能或解决什么问题？
2. **技术栈偏好**：有指定语言/框架/工具吗？（无则留空）
3. **优先级**：功能完整性 / 开发速度 / 代码质量，哪个最重要？

收到回答后：
1. 将 `task_status` 更新为 `DRAFTING`
2. 携带收集到的信息调用 `axiom-draft`

## BLOCKED 状态处理

1. 读取 `.agent/memory/active_context.md` 中的 `blocked_reason` 字段并展示
2. 提供三个选项：

   **A. 继续尝试** — 重新调用 `axiom-implement`，清空失败计数  
   **B. 降级方案** — 调用 `axiom-implement`（降级模式），跳过当前阻塞点  
   **C. 人工介入** — 将状态置为 `IDLE`，输出阻塞摘要供用户手动处理

## 错误恢复

在 `IMPLEMENTING` 阶段，追踪连续失败次数（存储于 `active_context.md` 的 `fail_count` 字段）：
- 每次失败：`fail_count += 1`
- `fail_count >= 3`：自动将 `task_status` 更新为 `BLOCKED`，将失败原因写入 `blocked_reason`，重置 `fail_count` 为 0

## 快捷命令

| 命令 | 动作 |
|------|------|
| `/status` | 调用 `axiom-status` |
| `/reflect` | 调用 `axiom-reflect` |
| `/reset` | 将 `task_status` 重置为 `IDLE`，清空 `blocked_reason`、`fail_count`、`rollback_count` |
| `/start` | 调用 `axiom-start`（零触感启动） |
| `/suspend` | 调用 `axiom-suspend`（会话挂起） |
| `/analyze-error` | 调用 `axiom-analyze-error`（错误分析） |
| `/rollback` | 调用 `axiom-rollback`（回滚检查点） |
| `/knowledge [词]` | 调用 `axiom-knowledge`（查询知识库） |
| `/patterns [词]` | 调用 `axiom-patterns`（查询模式库） |

## active_context.md 字段规范

| 字段 | 类型 | 说明 | 写入方 |
|------|------|------|--------|
| `task_status` | 枚举 | `IDLE/DRAFTING/REVIEWING/DECOMPOSING/IMPLEMENTING/REFLECTING/BLOCKED` | 各 skill |
| `current_phase` | 字符串 | 当前阶段描述 | 各 skill |
| `current_task` | 字符串 | 当前执行的子任务 ID 和描述 | axiom-implement |
| `completed_tasks` | 逗号列表 | 已完成子任务 ID | axiom-implement |
| `fail_count` | 整数 | 当前子任务连续失败次数，成功或切换子任务时重置为 0 | axiom-implement |
| `rollback_count` | 整数 | 本任务累计回滚次数 | axiom-rollback |
| `blocked_reason` | 字符串 | 阻塞原因描述 | axiom-implement / axiom-analyze-error |
| `last_checkpoint` | git SHA | 最近一次检查点 commit hash | axiom-implement |
| `session_name` | 字符串 | 任务会话名称 | axiom-draft |
| `manifest_path` | 路径 | Manifest 文件路径 | axiom-decompose |
| `last_gate` | 字符串 | 最近通过的门禁名称 | 各 skill |
| `last_updated` | ISO 时间 | 最后更新时间 | 各 skill |
