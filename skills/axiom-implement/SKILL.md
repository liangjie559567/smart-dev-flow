---
name: axiom-implement
description: Axiom Phase 3 实现 - OMC Team 流水线 + 双重验证
---

# axiom-implement

## 流程

1. 读取 `.agent/memory/` 中的 Manifest 任务清单
2. 更新 `active_context.md`：
   ```
   task_status: IMPLEMENTING
   current_phase: Phase 3 - Implementing
   omc_team_phase: team-exec
   current_task: T{N} - {描述}
   completed_tasks: T1,T2
   fail_count: 0
   last_updated: {timestamp}
   ```
3. 启动 OMC Team `team-exec` 阶段，按以下规则分配每个子任务：
   - 预估 > 2小时 或 涉及多文件架构改动 → `deep-executor`（opus）
   - 否则 → `executor`（sonnet）
4. 每个子任务完成后双重验证：
   - OMC `verifier`（sonnet）：代码正确性
   - Axiom 编译门禁（`.agent/workflows/4-implementing.md`）
5. **子任务成功**：
   - `fail_count` 重置为 0（当前子任务连续失败计数，切换子任务时同样重置）
   - 若 `scripts/evolve.py` 存在，调用 on-task-completed 钩子：
     ```bash
     python scripts/evolve.py on-task-completed --task-id "T{N}" --description "{描述}"
     ```
   - 更新 `completed_tasks`，输出进度：
     ```
     ✅ T{N} 完成 | {bar} {pct}% ({done}/{total})
     ```
   - 继续下一个子任务
6. **子任务失败**：
   - `fail_count += 1`
   - 若 `fail_count >= 3`：更新 `task_status: BLOCKED`，`blocked_reason: 连续失败{N}次，需要人工介入`，终止流程
   - 否则并联恢复：
     - OMC `debugger`（代码级根因）
     - Axiom `/analyze-error`（流程级三出口）
     - 重试当前子任务
7. 全部完成后：
   - 写入 `.agent/memory/` + `.omc/` 双写
   - 更新 `active_context.md`：
     ```
     task_status: REFLECTING
     current_phase: Phase 3 - Done
     omc_team_phase: team-verify
     completed_tasks: T1,T2,T3
     fail_count: 0
     last_updated: {timestamp}
     ```
   - 自动触发 `axiom-reflect`

## 降级模式

由 `dev-flow` BLOCKED 状态出口B触发，传入参数 `--degraded`：

- 跳过当前阻塞的子任务，标记为 `SKIPPED`
- 继续执行后续无依赖的子任务
- 完成后在报告中列出所有 SKIPPED 任务，提示人工补全
