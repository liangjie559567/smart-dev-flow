---
name: axiom-suspend
description: 会话挂起 - 保存现场并生成总结
---

# axiom-suspend

## 流程

1. 运行 `python scripts/suspend.py` 保存当前状态
2. 更新 `last_updated` 时间戳
3. **归档当前任务文档**：将以下文件复制到 `.agent/memory/archive/{session_name}-{timestamp}/`：
   - `project_decisions.md`（PRD + 评审报告）
   - `manifest.md`（任务 Manifest，若存在）
4. 输出会话总结：
   - 已完成任务数 / 总任务数
   - 当前阶段
   - 归档路径
   - 下次恢复建议：运行 `/axiom-start`
