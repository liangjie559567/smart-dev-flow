---
name: axiom-reflect
description: 任务完成后知识沉淀 - Axiom /reflect + /evolve + OMC 双写
---

# axiom-reflect

## 流程

1. 执行 Axiom `/reflect` 工作流（`.agent/workflows/reflect.md`）
2. 执行 Axiom `/evolve` 工作流（`.agent/workflows/evolve.md`）
3. 将学习结果同步到 OMC：
   - `.agent/memory/evolution/knowledge_base.md` → `.omc/project-memory.json#techStack`
   - `.agent/memory/project_decisions.md` → `.omc/project-memory.json#notes`
4. 更新 `active_context.md`：`task_status: IDLE`
