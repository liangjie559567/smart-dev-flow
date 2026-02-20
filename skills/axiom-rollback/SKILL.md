---
name: axiom-rollback
description: 回滚到上一个检查点
---

# axiom-rollback

## 流程

1. 读取 `.agent/memory/active_context.md` 中的 `last_checkpoint`
2. 若 `last_checkpoint` 为空或 `—`，提示"未找到检查点，无法回滚"并终止
3. 向用户展示警告：
   ```
   ⚠️ 即将回滚到 {last_checkpoint}，未提交的变更将丢失。确认继续？(y/N)
   ```
4. 用户确认后执行：
   ```bash
   git reset --hard {last_checkpoint}
   git clean -fd
   ```
5. 更新 `active_context.md`：
   ```
   task_status: IDLE
   blocked_reason: —
   fail_count: 0
   last_updated: {timestamp}
   ```
6. 输出回滚结果：已回滚到 `{last_checkpoint}`，状态重置为 IDLE

## 触发条件

- 用户输入 `/rollback`
- `axiom-analyze-error` 出口 B（置信度 40-79%）自动触发
