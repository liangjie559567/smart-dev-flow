---
name: axiom-export
description: 导出当前任务的 PRD、Manifest、反思日志为 Markdown 报告
---

# axiom-export

## 触发条件
- 用户输入 `/export` 或 `/axiom-export`

## 执行步骤

1. 读取以下文件：
   - `.agent/memory/active_context.md` — 任务状态
   - `.agent/memory/project_decisions.md` — PRD
   - `.agent/memory/reflection_log.md` — 反思日志（最近3条）
   - `.agent/memory/evolution/knowledge_base.md` — 知识库摘要

2. 生成导出报告，写入 `.agent/memory/export-{session_name}-{timestamp}.md`：

```markdown
# 任务导出报告 - {session_name}
导出时间：{timestamp}

## 任务状态
- Status: {task_status}
- Phase: {current_phase}
- 完成任务: {completed_tasks}

## PRD
{project_decisions.md 内容}

## 反思摘要（最近3条）
{reflection_log 最近3条}

## 知识沉淀
{knowledge_base 摘要，前500字}
```

3. 输出文件路径，提示用户可直接分享或归档。
