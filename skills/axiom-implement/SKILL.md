---
name: axiom-implement
description: Axiom Phase 3 实现 - OMC Team 流水线 + 双重验证
---

# axiom-implement

## 流程

1. 读取 `.agent/memory/` 中的 Manifest 任务清单
2. 更新 `active_context.md`：`task_status: IMPLEMENTING`，`omc_team_phase: team-exec`
3. 启动 OMC Team `team-exec` 阶段，每个子任务分配给 `executor`/`deep-executor`
4. 每个子任务完成后双重验证：
   - OMC `verifier`（sonnet）：代码正确性
   - Axiom 编译门禁（`.agent/workflows/4-implementing.md`）
5. **失败时并联恢复**：
   - OMC `debugger`（代码级根因）
   - Axiom `/analyze-error`（流程级三出口）
   - 更新 `task_status: BLOCKED`
6. 全部完成后：
   - 写入 `.agent/memory/` + `.omc/` 双写
   - 更新 `task_status: REFLECTING`
   - 自动触发 `axiom-reflect`
