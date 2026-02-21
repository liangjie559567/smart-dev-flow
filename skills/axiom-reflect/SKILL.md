---
name: axiom-reflect
description: Axiom Phase 8+9 - 分支合并、知识收割、完成报告生成（含知识库贯穿）
---

# axiom-reflect

## 流程

### Phase 8：分支合并

若 `phase3.skipped=false`（创建了隔离分支），执行分支合并：

```
Skill("finishing-a-development-branch")
→ 提供结构化选项：merge/PR/keep/cleanup
→ 验证主分支测试仍通过
```

若 `phase3.skipped=true`，跳过本阶段。

**知识沉淀（必须）**：
```
axiom_harvest source_type=workflow_run
  title="分支合并: {功能名称}"
  summary="{合并策略} | {提交数量} | {变更文件数} | {合并时间}"
```

**MCP 不可用降级**：若 `axiom_harvest` 调用失败，追加写入 `.agent/memory/evolution/knowledge_base.md`：
```markdown
## K-{timestamp}
**标题**: 分支合并: {功能名称}
**摘要**: {合并策略} | {提交数量} | {变更文件数} | {合并时间}
**来源**: workflow_run
```

### Phase 9：知识收割

**步骤1：收集本次会话信息**

从 `.agent/memory/active_context.md` 读取：
- `session_name`（当前任务名）
- `fail_count`（失败计数）、`rollback_count`（回滚次数）

向用户确认（或自动推断）：
- 本次耗时（分钟）
- 做得好的地方
- 可改进的地方
- 关键学习
- 行动项

**步骤2：执行 reflect（记录反思 + 入队学习）**

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

**步骤3：执行 evolve（处理学习队列 → 更新知识库）**

若 `scripts/evolve.py` 存在：
```bash
python scripts/evolve.py evolve
```
输出进化报告，展示给用户。若脚本不存在，跳过并提示"进化引擎未安装，知识库更新已跳过"。

**步骤4：同步到 OMC project-memory**

将 `.agent/memory/evolution/knowledge_base.md` 摘要写入 `.omc/project-memory.json`：
- `techStack` 字段：提取知识库中的技术栈条目
- `notes` 字段：提取最新的 3 条学习记录

**步骤5：生成完成报告**

输出以下格式的完成报告：

```markdown
## Dev Flow 完成报告 — {功能名称}

### 交付物
- 代码：{变更文件列表}
- 测试：{测试文件}
- 文档：{文档文件}
- 计划：docs/plans/YYYY-MM-DD-{feature}-plan.md

### 各阶段状态
| 阶段 | 状态 | 关键产出 |
|------|------|----------|
| Phase 0 需求澄清 | ✅ | {验收标准数量} 条标准 |
| Phase 1 架构设计 | ✅ | ADR + 接口契约 |
| Phase 1.5 专家评审 | ✅/跳过 | 综合评分 {N}/100 |
| Phase 2 实现计划 | ✅ | {任务数量} 个任务 |
| Phase 3 TDD 实现 | ✅ | {测试数量} 个测试 |
| Phase 4 系统调试 | 触发/跳过 | {修复数量} 个问题 |
| Phase 5 代码审查 | ✅ | {问题数量} 个问题已修复 |
| Phase 5.5 文档 | ✅ | {接口数量} 个接口已文档化 |
| Phase 6 完成验证 | ✅ | 全部通过（{N} 个测试） |
| Phase 8 分支合并 | ✅/跳过 | {合并方式} |
| Phase 9 知识收割 | ✅ | 进化报告已生成 |

### 知识沉淀摘要
本次开发共沉淀 {N} 条知识条目到 Axiom 知识库。
```

**步骤5.5：阶段完成总结（必须输出）**

```
✅ Phase 9 知识收割完成
- 沉淀知识条目：{N} 条
- 提取可复用模式：{N} 个
- 会话状态：已保存
- 任务状态：即将归档（IDLE）
```

**步骤5.6：输出接力摘要（必须，供下次会话恢复）**

```markdown
## 🔁 接力摘要
- 当前任务: {功能名称 / 无}
- 状态: IDLE
- 最近检查点: {last_checkpoint tag / 无}
- 阻塞: 无
- 下一步: 1) {action_items[0]} 2) {action_items[1]}
```

**用户确认（必须）**：
```
AskUserQuestion({
  question: "Dev Flow 全流程已完成！本次开发共沉淀 {N} 条知识。如何处理？",
  header: "Dev Flow 完成",
  options: [
    { label: "✅ 完成，结束流程", description: "所有阶段已完成，知识已沉淀" },
    { label: "🔁 开始新功能", description: "继续下一个功能的 Dev Flow" },
    { label: "🔄 返工某个阶段", description: "需要回到某个阶段重新处理" }
  ]
})
```

**步骤6：重置状态**

更新 `.agent/memory/active_context.md`：
```
task_status: IDLE
current_phase:
current_task:
completed_tasks:
fail_count: 0
rollback_count: 0
blocked_reason:
last_updated: {timestamp}
```

## 触发方式

由用户在 Phase 7 末尾 AskUserQuestion 确认后触发（选择"进入 Phase 8 合并分支"或"跳过 Phase 8"时，dev-flow 将状态写入 `REFLECTING` 并调用本技能）。

也可手动触发：`/axiom-reflect`
