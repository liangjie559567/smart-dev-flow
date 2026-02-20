---
name: axiom-feature-flow
description: 开发交付流水线兼容入口 - 等同于 /dev-flow
triggers: ["/feature-flow", "feature-flow"]
---

# axiom-feature-flow

兼容入口，行为与 `/dev-flow` 完全一致。

读取 `.agent/memory/active_context.md` 中的 `task_status`，路由到对应阶段：

- `IDLE` / `DRAFTING` → 调用 `axiom-draft`
- `REVIEWING` → 调用 `axiom-review`
- `DECOMPOSING` → 调用 `axiom-decompose`
- `IMPLEMENTING` → 调用 `axiom-implement`
- 其他状态 → 调用 `dev-flow` 处理
