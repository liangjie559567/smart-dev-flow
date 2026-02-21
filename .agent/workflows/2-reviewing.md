---
description: Phase 1.5: 专家评审工作流（Axiom v4.2）
---

# 工作流：专家评审 (Phase 1.5)

## 子代理强制调用铁律

主 Claude 禁止：直接评审 PRD、直接给出评分、直接分析需求缺陷

## active_context.md 写入（评审进行中）
```yaml
task_status: REVIEWING
current_phase: Phase 1.5 - Reviewing
last_gate: Gate 2
last_updated: {timestamp}
```

## 步骤1：知识库查询（必须）
```
axiom_get_knowledge query="PRD 评审 {功能关键词}" limit=5
axiom_search_by_tag tags=["需求评审", "验收标准"] limit=3
→ 保存为 kb_context
```

**MCP 不可用降级**：若 `axiom_get_knowledge` 调用失败，读取 `.agent/memory/evolution/knowledge_base.md` 作为替代。

## 步骤2：调用 critic 子代理批判性评审（必须）
```
Task(
  subagent_type="general-purpose",
  model="opus",
  prompt="你是批判性审查专家（Critic）。
  **必须先读取以下文件，再进行分析，禁止基于假设输出结论**：
  - 读取 docs/design/YYYY-MM-DD-{feature}-design.md（若已存在）
  - 读取 docs/requirements/YYYY-MM-DD-{feature}-requirements.md
  【PRD内容】{project_decisions.md 中最新 PRD}
  【知识库经验】{kb_context}
  挑战所有假设，识别：需求缺口、边界条件遗漏、技术可行性风险、安全边界问题（每条问题必须引用文件行号作为证据）
  输出：Critical/High/Medium/Low 分级问题列表 + 综合评分(0-100)"
)
```
→ critic 发现 Critical 问题 → 强制退回 1-drafting.md，不得继续

## 步骤3：并行调用5个专家 agent（必须）
```
Task(subagent_type="general-purpose", prompt="你是UX研究员。评审以下PRD的用户体验、可用性和交互设计。\n{PRD内容}\n输出：评分(0-100) + 关键意见（3条以内）")
Task(subagent_type="general-purpose", prompt="你是产品经理。评审以下PRD的产品价值、用户故事完整性和优先级。\n{PRD内容}\n输出：评分(0-100) + 关键意见（3条以内）")
Task(subagent_type="general-purpose", prompt="你是需求分析师。评审以下PRD的领域逻辑、需求完整性和边界条件。\n{PRD内容}\n输出：评分(0-100) + 关键意见（3条以内）")
Task(subagent_type="general-purpose", prompt="你是技术主管。评审以下PRD的技术可行性和架构合理性。\n{PRD内容}\n输出：评分(0-100) + 关键意见（3条以内）")
Task(subagent_type="general-purpose", prompt="你是安全评审员。评审以下PRD的安全边界、信任模型和风险（OWASP Top 10）。\n{PRD内容}\n输出：评分(0-100) + 关键意见（3条以内）")
```

按优先级解决冲突：**安全 > 技术 > 战略 > 逻辑 > 体验**

## 步骤4：汇总评审结果

生成评审摘要文件 `docs/reviews/{feature}/summary.md`，同时追加到 `.agent/memory/project_decisions.md`：

```markdown
## 评审报告 - {需求标题}
时间：{timestamp}

| 专家 | 角色 | 评分 | 关键意见 |
|------|------|------|---------|
| ux-researcher | UX主任 | {N} | {意见} |
| product-manager | 产品主任 | {N} | {意见} |
| analyst | 领域专家 | {N} | {意见} |
| quality-reviewer | 技术主管 | {N} | {意见} |
| security-reviewer | 安全评论家 | {N} | {意见} |

### 冲突解决
{按优先级解决的冲突说明，无冲突则填"无"}

### 综合结论
- 综合评分：{0-100}
- 建议：通过 / 需修改 / 退回
- 必须修复：{列表}

### 关键决策
{本次评审中达成的关键决策，无则填"无"}

### 范围变更
{评审过程中识别的范围变更，无则填"无"}
```

## 知识沉淀（必须）
```
axiom_harvest source_type=conversation
  title="PRD评审: {功能名称}"
  summary="{综合评分} | {critic关键问题} | {必须修复项} | {通过条件}"
```

**MCP 不可用降级**：若 `axiom_harvest` 调用失败，追加写入 `.agent/memory/evolution/knowledge_base.md`：
```markdown
## K-{timestamp}
**标题**: PRD评审: {功能名称}
**摘要**: {综合评分} | {critic关键问题} | {必须修复项} | {通过条件}
**来源**: conversation
```

## 阶段完成总结（必须输出）
```
✅ Phase 1.5 专家评审完成
- critic 评审：通过（无 Critical 问题）
- 综合评分：{N}/100
- 专家意见：{N} 条（已解决 {N} 条）
- 必须修复：{N} 项
```

## 用户确认（必须）
```
AskUserQuestion({
  question: "Phase 1.5 专家评审已完成，综合评分 {N}/100。如何继续？",
  header: "Phase 1.5 → Phase 2",
  options: [
    { label: "✅ 进入 Phase 2 任务拆解", description: "评审通过，开始任务分解" },
    { label: "📝 需要修改后再进入", description: "部分问题需要调整" },
    { label: "🔄 返工 Phase 1", description: "重新起草需求" }
  ]
})
```

评分 < 60 → 强制退回，不展示 AskUserQuestion，直接输出退回提示并将 task_status 设为 DRAFTING，不允许确认通过

## active_context.md 写入格式
```yaml
task_status: CONFIRMING
current_phase: Phase 1.5 - Done
last_gate: Gate 2
last_updated: {timestamp}
```
