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
   - `IN_PROGRESS` → 使用 `/dev-flow` 继续当前任务，或查看 `current_phase` 了解所处阶段
   - `BLOCKED` → 检查 `last_gate` 了解阻塞原因，修复后重新运行门禁
   - `DONE` → 任务已完成，可提交或开始新任务
