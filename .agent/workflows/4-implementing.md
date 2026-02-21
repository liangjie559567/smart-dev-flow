---
description: Phase 3: TDD 实现工作流（Axiom v4.2）
---

# 工作流：TDD 实现 (Phase 3)

## 子代理强制调用铁律

主 Claude 禁止：直接编写代码、直接审查代码、直接分析 bug

## 入口

读取 `.agent/memory/active_context.md` 中的 `execution_mode`，路由到对应执行引擎：
- `standard` → 直接调用 axiom-implement
- `ultrapilot` → 调用 `/smart-dev-flow:ultrapilot`
- `ultrawork` → 调用 `/smart-dev-flow:ultrawork`
- `ralph` → 调用 `/smart-dev-flow:ralph`
- `team` → 调用 `/smart-dev-flow:team`
- `ultraqa` → 先调用 axiom-implement（标准模式），完成后调用 `/smart-dev-flow:ultraqa`

## 标准模式执行流程

调用 `axiom-implement` 技能执行完整 TDD 实现流程（含四层检查、Phase 5 调试、Phase 6.5 文档）。

## active_context.md 写入格式
```yaml
task_status: IMPLEMENTING
current_phase: Phase 3 - Implementing
last_gate: Gate 4
last_updated: {timestamp}
```
