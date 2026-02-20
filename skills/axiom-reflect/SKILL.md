---
name: axiom-reflect
description: 任务完成后知识沉淀 - Axiom /reflect + /evolve + OMC 双写
---

# axiom-reflect

## 流程

### 第一步：收集本次会话信息

从 `.agent/memory/active_context.md` 读取：
- `session_name`（当前任务名）
- `task_status`（应为 IMPLEMENTING 或 BLOCKED）
- `auto_fix_count`、`rollback_count`（如有记录）

向用户确认（或自动推断）：
- 本次耗时（分钟）
- 做得好的地方（用 `|` 分隔多项）
- 可改进的地方（用 `|` 分隔多项）
- 关键学习（用 `|` 分隔多项）
- 行动项（用 `|` 分隔多项）

### 第二步：执行 reflect（记录反思 + 入队学习）

```bash
python scripts/evolve.py reflect \
  --session-name "<session_name>" \
  --duration <分钟数> \
  --went-well "<item1|item2>" \
  --could-improve "<item1|item2>" \
  --learnings "<item1|item2>" \
  --action-items "<item1|item2>" \
  --auto-fix-count <数量> \
  --rollback-count <数量>
```

### 第三步：执行 evolve（处理学习队列 → 更新知识库）

若 `scripts/evolve.py` 存在：
```bash
python scripts/evolve.py evolve
```
输出进化报告，展示给用户。若脚本不存在，跳过本步骤并提示"进化引擎未安装，知识库更新已跳过"。

### 第四步：同步到 OMC project-memory

将 `.agent/memory/evolution/knowledge_base.md` 摘要写入 `.omc/project-memory.json`：
- `techStack` 字段：提取知识库中的技术栈条目
- `notes` 字段：提取最新的 3 条学习记录

### 第五步：重置状态

更新 `.agent/memory/active_context.md`：
```
task_status: IDLE
current_phase:
current_task:
completed_tasks:
fail_count: 0
blocked_reason:
last_updated: {timestamp}
```

## 自动触发

`axiom-implement` 技能在所有任务完成后自动调用本技能。

也可手动触发：`/axiom-reflect`
