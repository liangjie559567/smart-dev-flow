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
| `IDLE` | 引导用户描述需求，调用 `axiom-draft` |
| `DRAFTING` | 继续 Phase 1，调用 `axiom-draft` |
| `REVIEWING` | 继续 Phase 1.5，调用 `axiom-review` |
| `DECOMPOSING` | 继续 Phase 2，调用 `axiom-decompose` |
| `IMPLEMENTING` | 继续 Phase 3，调用 `axiom-implement` |
| `CONFIRMING` | 显示当前门禁内容，等待用户确认 |
| `BLOCKED` | 调用 `axiom-implement`（错误恢复模式） |
| `REFLECTING` | 调用 `axiom-reflect` |

## IDLE 时的引导

询问用户：**你想构建什么？** 收到需求后：
1. 将 `task_status` 更新为 `DRAFTING`
2. 调用 `axiom-draft`

## 状态显示

任何时候用户输入 `/status`，调用 `axiom-status`。
