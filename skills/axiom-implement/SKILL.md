---
name: axiom-implement
description: Axiom Phase 3 实现 - 多 agent 流水线 + 双重验证
---

# axiom-implement

## 流程

1. 读取 `.agent/memory/manifest.md` 中的任务清单
2. 更新 `active_context.md`：
   ```
   task_status: IMPLEMENTING
   current_phase: Phase 3 - Implementing
   current_task: T{N} - {描述}
   completed_tasks:
   fail_count: 0
   last_updated: {timestamp}
   ```
3. 按以下规则为每个子任务派发 agent（无依赖的子任务并行执行）：
   - 预估 > 2小时 或 涉及多文件架构改动：
     ```
     Task(
       subagent_type="general-purpose",
       prompt="你是深度执行者（Deep Executor）。你的任务是自主完成复杂的代码实现，包括探索代码库、匹配现有模式、TDD 开发。\n\n实现任务 {T_ID}：{描述}\n\n参考：.agent/memory/manifest.md\n\n要求：\n1. 先探索代码库，理解现有模式\n2. 遵循 TDD：先写测试，再实现\n3. 完成后运行测试和构建验证\n4. 输出：变更文件列表 + 测试结果 + 构建结果"
     )
     ```
   - 否则：
     ```
     Task(
       subagent_type="general-purpose",
       prompt="你是执行者（Executor）。你的任务是精确实现指定的代码变更，保持最小化改动。\n\n实现任务 {T_ID}：{描述}\n\n参考：.agent/memory/manifest.md\n\n要求：\n1. 最小化改动，不扩大范围\n2. 完成后运行测试验证\n3. 输出：变更文件列表 + 测试结果"
     )
     ```
4. 每个子任务完成后派发 verifier：
   ```
   Task(
     subagent_type="general-purpose",
     prompt="你是验证者（Verifier）。你的任务是用证据验证实现是否完成，拒绝无证据的完成声明。\n\n验证任务 {T_ID} 的完成情况：\n- 运行测试并展示完整输出\n- 检查 lsp_diagnostics（TypeScript/类型错误）\n- 验证构建通过\n- 对照验收标准逐项确认\n\n输出：PASS 或 FAIL + 具体证据（测试输出、构建日志）"
   )
   ```
5. **子任务成功**：
   - `fail_count` 重置为 0
   - 更新 `completed_tasks`，输出进度：
     ```
     ✅ T{N} 完成 | {bar} {pct}% ({done}/{total})
     ```
   - 继续下一个子任务
6. **子任务失败**：
   - `fail_count += 1`
   - 若 `fail_count >= 3`：更新 `task_status: BLOCKED`，`blocked_reason: 连续失败{N}次，需要人工介入`，终止流程
   - 否则派发 debugger 分析：
     ```
     Task(
       subagent_type="general-purpose",
       prompt="你是调试专家（Debugger）。分析以下失败的根本原因并给出修复建议。\n\n任务 {T_ID} 失败原因：{错误信息}\n\n输出：\n- 根本原因（具体到文件和行号）\n- 修复建议（具体步骤）\n- 预防措施"
     )
     ```
     重试当前子任务
7. 全部完成后：
   - **代码审查**：
     ```
     Task(
       subagent_type="general-purpose",
       prompt="你是代码审查员（Code Reviewer）。对本次实现进行全面代码审查。\n\n审查范围：本次所有变更文件\n\n检查维度：\n- 逻辑正确性\n- 代码质量和可维护性\n- 测试覆盖充分性\n- 安全性（OWASP Top 10）\n- 性能影响\n\n输出：APPROVE 或 REQUEST CHANGES + 具体问题列表（含文件:行号）"
     )
     ```
     审查发现问题 → 派发 executor 修复后重新验证
   - 更新 `active_context.md`：
     ```
     task_status: REFLECTING
     current_phase: Phase 3 - Done
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
