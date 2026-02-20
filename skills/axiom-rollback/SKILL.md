---
name: axiom-rollback
description: 回滚到上一个检查点
---

# axiom-rollback

## 流程

1. 读取 `.agent/memory/active_context.md` 中的 `last_checkpoint`
2. 执行 `git stash` 保存当前未提交变更
3. 执行 `git checkout {last_checkpoint}` 恢复到检查点
4. 更新 `active_context.md`：
   ```
   task_status: IMPLEMENTING
   blocked_reason: —
   fail_count: 0
   last_updated: {timestamp}
   ```
5. 提示用户：已回滚到 `{last_checkpoint}`，可继续开发

## 触发条件

- 用户输入 `/rollback`
- `axiom-analyze-error` 出口 B（置信度 40-79%）自动触发
