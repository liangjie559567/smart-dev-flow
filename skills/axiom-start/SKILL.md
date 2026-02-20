---
name: axiom-start
description: 零触感启动 - 读取上下文并建议下一步
---

# axiom-start

## 触发条件
- 新会话开始时
- 用户说"继续"、"开始"、"早"

## 执行步骤

1. 读取 `.agent/memory/active_context.md`：
   - 若文件不存在，自动创建并写入初始内容：
     ```
     task_status: IDLE
     current_phase:
     current_task:
     completed_tasks:
     fail_count: 0
     rollback_count: 0
     blocked_reason:
     session_name:
     last_updated: {timestamp}
     ```
     然后提示"系统已初始化，请描述你的需求"。

2. 根据 `task_status` 输出对应提示：
   - `IDLE` → "系统就绪，请描述你的需求"
   - `DRAFTING` / `REVIEWING` / `DECOMPOSING` / `IMPLEMENTING` → "检测到未完成任务 [{current_task}]，是否继续？"
   - `BLOCKED` → "检测到阻塞任务，建议运行 /axiom-analyze-error"
   - `REFLECTING` → "检测到待反思任务，建议运行 /axiom-reflect"

3. 若存在 `PENDING` 子任务，显示进度：
   ```
   已完成：{completed_tasks} / 全部子任务
   ```
