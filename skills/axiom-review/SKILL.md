---
name: axiom-review
description: Axiom Phase 1.5 专家评审 - 双重质量审查
---

# axiom-review

## 流程

1. 执行 `.agent/workflows/2-reviewing.md`
2. 并行调用 OMC agents：
   - `quality-reviewer`（sonnet）：代码质量、逻辑缺陷
   - `security-reviewer`（sonnet）：安全边界、信任模型
3. 汇总评审结果，写入 `.agent/memory/project_decisions.md`
4. 更新 `active_context.md`：`task_status: CONFIRMING`，`last_gate: Gate 2`
5. 展示评审报告，等待用户确认进入拆解
