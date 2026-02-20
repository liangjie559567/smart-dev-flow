---
name: axiom-review
description: Axiom Phase 1.5 专家评审 - 5专家并行评审
---

# axiom-review

## 流程

1. 读取 `.agent/memory/project_decisions.md` 中最新 PRD 草稿
2. **并行**调用5个专家 agent：
   ```
   Task(subagent_type="general-purpose", prompt="你是UX研究员。评审以下PRD的用户体验、可用性和交互设计。\n{PRD内容}\n输出：评分(0-100) + 关键意见（3条以内）")
   Task(subagent_type="general-purpose", prompt="你是产品经理。评审以下PRD的产品价值、用户故事完整性和优先级。\n{PRD内容}\n输出：评分(0-100) + 关键意见（3条以内）")
   Task(subagent_type="general-purpose", prompt="你是需求分析师。评审以下PRD的领域逻辑、需求完整性和边界条件。\n{PRD内容}\n输出：评分(0-100) + 关键意见（3条以内）")
   Task(subagent_type="general-purpose", prompt="你是技术主管。评审以下PRD的技术可行性和架构合理性。\n{PRD内容}\n输出：评分(0-100) + 关键意见（3条以内）")
   Task(subagent_type="general-purpose", prompt="你是安全评审员。评审以下PRD的安全边界、信任模型和风险（OWASP Top 10）。\n{PRD内容}\n输出：评分(0-100) + 关键意见（3条以内）")
   ```
3. 按优先级解决冲突：**安全 > 技术 > 战略 > 逻辑 > 体验**
4. 汇总评审结果，追加写入 `.agent/memory/project_decisions.md`
5. 更新 `active_context.md`，展示报告等待确认

## 评审报告格式

追加到 `.agent/memory/project_decisions.md`：

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
- 综合评分：{0-100}（各专家均分）
- 建议：通过 / 需修改 / 退回
- 必须修复：{列表，无则填"无"}
```

## active_context.md 写入格式

```
task_status: REVIEWING
current_phase: Phase 1.5 - Reviewing
last_gate: Gate 2
last_updated: {timestamp}
```

## 确认流程

- 用户回复"确认" → `task_status: DECOMPOSING`，调用 `axiom-decompose`
- 用户回复"修改" → `task_status: DRAFTING`，重新调用 `axiom-draft`
- 评分 < 60 → 强制退回，不允许确认通过
