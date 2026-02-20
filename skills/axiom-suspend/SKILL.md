---
name: axiom-suspend
description: 会话挂起 - 保存现场并生成总结
---

# axiom-suspend

## 流程

1. 运行 `python scripts/suspend.py` 保存当前状态
2. 将 `task_status` 更新为当前值（确保写入，不改变）
3. 更新 `last_updated` 时间戳
4. 输出会话总结：
   - 已完成任务数
   - 当前阶段
   - 下次恢复建议
