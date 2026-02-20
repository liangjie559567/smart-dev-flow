---
name: axiom-review
description: Axiom Phase 1.5 专家评审 - 5专家并行评审
---

# axiom-review

## 流程

1. 读取 `.agent/memory/project_decisions.md` 中最新 PRD 草稿
2. **并行**调用5个 OMC 专家 agent：
   - `ux-researcher`（sonnet）：用户体验、可用性、交互设计
   - `product-manager`（sonnet）：产品价值、用户故事完整性、优先级
   - `analyst`（opus）：领域逻辑、需求完整性、边界条件
   - `quality-reviewer`（sonnet）：技术可行性、架构合理性
   - `security-reviewer`（sonnet）：安全边界、信任模型、风险
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
task_status: CONFIRMING
current_phase: Phase 1.5 - Reviewing
last_gate: Gate 2
pending_confirmation: 评审完成，综合评分 {N}，建议{通过/需修改}，请确认后进入拆解
last_updated: {timestamp}
```

## 确认流程

- 用户回复"确认" → `task_status: DECOMPOSING`，调用 `axiom-decompose`
- 用户回复"修改" → `task_status: DRAFTING`，重新调用 `axiom-draft`
- 评分 < 60 → 强制退回，不允许确认通过
