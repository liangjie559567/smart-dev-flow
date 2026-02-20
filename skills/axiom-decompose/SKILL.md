---
name: axiom-decompose
description: Axiom Phase 2 任务拆解 - Manifest 生成
---

# axiom-decompose

## 流程

1. 执行 `.agent/workflows/3-decomposing.md`
2. 调用 OMC `architect`（opus）设计系统边界和接口
3. 调用 OMC `planner`（opus）生成任务 Manifest
4. 将 Manifest 写入 `.agent/memory/`
5. 更新 `active_context.md`：`task_status: CONFIRMING`，`last_gate: Gate 3`
6. 展示 Manifest，等待用户确认开始实现
