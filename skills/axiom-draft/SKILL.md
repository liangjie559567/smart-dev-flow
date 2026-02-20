---
name: axiom-draft
description: Axiom Phase 1 起草 - 需求澄清与 PRD 生成
---

# axiom-draft

## 流程

1. 执行 `.agent/workflows/1-drafting.md`
2. 调用 OMC `analyst`（opus）澄清需求、定义验收标准
3. 调用 OMC `planner`（opus）生成任务大纲
4. 将结果写入 `.agent/memory/project_decisions.md`
5. 更新 `active_context.md`：`task_status: CONFIRMING`，`last_gate: Gate 1`
6. 向用户展示 PRD 草稿，等待确认进入评审
