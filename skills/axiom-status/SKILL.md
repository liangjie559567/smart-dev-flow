---
name: axiom-status
description: 查询当前状态
---

# axiom-status

## 执行步骤

1. 运行状态脚本获取报告：
   ```bash
   python scripts/status.py
   ```

2. 将输出的 Markdown 报告展示给用户。

3. 根据 `task_status` 给出下一步建议：
   - `IDLE` → 使用 `/dev-flow <需求>` 开始新任务
   - `DRAFTING` → 使用 `/dev-flow` 继续需求起草
   - `REVIEWING` → 使用 `/dev-flow` 继续评审
   - `DECOMPOSING` → 使用 `/dev-flow` 继续任务拆解
   - `IMPLEMENTING` → 使用 `/dev-flow` 继续实现，或查看 `current_phase` 了解所处阶段
   - `REFLECTING` → 使用 `/axiom-reflect` 完成知识沉淀
   - `BLOCKED` → 检查 `blocked_reason` 了解阻塞原因，使用 `/axiom-analyze-error` 分析
