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
| `DRAFTING` | 继续 Phase 1，调用 `axiom-draft` |
| `REVIEWING` | 继续 Phase 1.5，调用 `axiom-review` |
| `DECOMPOSING` | 继续 Phase 2，调用 `axiom-decompose` |
| `IMPLEMENTING` | 继续 Phase 3，调用 `axiom-implement` |
| `CONFIRMING` | 读取 `pending_confirmation`，展示并等待用户确认 |
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

## CONFIRMING 状态处理

1. 读取 `.agent/memory/active_context.md` 中的 `pending_confirmation` 字段
2. 向用户展示待确认内容
3. 等待用户回复：
   - 回复"确认" → 清空 `pending_confirmation`，按 `pending_confirmation.next_status` 更新状态，继续流程
   - 回复"取消" → 将状态回退至上一阶段，提示用户修改

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
| `/reset` | 将 `task_status` 重置为 `IDLE`，清空 `pending_confirmation`、`blocked_reason`、`fail_count` |
