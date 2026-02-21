---
description: Reflect Workflow - 反思工作流，总结经验并提取知识
---

# /reflect - 反思工作流

执行自动反思，总结本次会话的经验教训。

## Trigger
- 用户输入 `/axiom-reflect` 或 "反思"
- 由用户在 Phase 7 末尾 AskUserQuestion 确认后触发（dev-flow 将状态写入 REFLECTING 并调用本工作流）

## Steps

### Phase 8: 分支合并（若 phase3.skipped=false）

若创建了隔离分支，执行：
```
Skill("finishing-a-development-branch")
→ 提供结构化选项：merge/PR/keep/cleanup
→ 验证主分支测试仍通过
```
若 phase3.skipped=true，跳过本阶段。

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

### Step 1: 读取会话状态
// turbo
1. 读取 `.agent/memory/active_context.md`
2. 解析任务完成情况

### Step 2: 生成反思报告
1. 分析本次会话：
   - 任务完成率 = 已完成 / 总任务数
   - 自动修复次数 = `fail_count`
   - 回滚次数 = (检查 History)
2. 按照 `reflection_log.md` 模板生成报告

### Step 3: 提取知识
1. 识别 "What Went Well" 中的可复用经验
2. 如果有新知识，创建知识条目：
   - 文件: `.agent/memory/knowledge/k-xxx-title.md`
   - 更新 `knowledge_base.md` 索引

### Step 4: 提取 Action Items
1. 识别 "What Could Improve" 中的改进点
2. 将 Action Items 添加到 `active_context.md` 任务队列：
   ```markdown
   - [ ] [REFLECTION] Action description
   ```

### Step 5: 追加到反思日志
// turbo
1. 将反思报告追加到 `reflection_log.md`
2. 更新统计数据

### Step 6: 知识进化（必须）
```bash
python scripts/evolve.py evolve
```
若脚本不存在，跳过并提示"进化引擎未安装，知识库更新已跳过"。

### Step 7: 输出报告并重置状态
1. 向用户展示反思摘要
2. 列出新提取的知识和 Action Items
3. **输出接力摘要（必须，供下次会话恢复）**：
   ```markdown
   ## 🔁 接力摘要
   - 当前任务: {功能名称 / 无}
   - 状态: IDLE
   - 最近检查点: {last_checkpoint tag / 无}
   - 阻塞: 无
   - 下一步: 1) {action_items[0]} 2) {action_items[1]}
   ```
4. **用户确认（必须）**：
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
5. 更新 `.agent/memory/active_context.md`：
   ```yaml
   task_status: IDLE
   current_phase:
   current_task:
   completed_tasks:
   fail_count: 0
   rollback_count: 0
   blocked_reason:
   last_updated: {timestamp}
   ```

## Output Format
```markdown
## 💭 反思完成

### 📊 本次会话统计
- 任务完成: X/Y
- 自动修复: X 次
- 回滚: X 次

### ✅ 做得好
- ...

### ⚠️ 待改进
- ...

### 💡 新知识
- k-xxx: [Title]

### 🎯 Action Items
- [ ] [Action 1]
- [ ] [Action 2]
```
