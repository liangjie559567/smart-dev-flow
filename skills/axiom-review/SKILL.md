---
name: axiom-review
description: Axiom Phase 1.5 专家评审 - 双重质量审查
---

# axiom-review

## 流程

1. 执行 `.agent/workflows/2-reviewing.md`
2. 并行调用 OMC agents：
   - `quality-reviewer`（sonnet）：代码质量、逻辑缺陷
   - `security-reviewer`（sonnet）：安全边界、信任模型
3. 汇总评审结果，追加写入 `.agent/memory/project_decisions.md`
4. 更新 `active_context.md`
5. 展示评审报告，等待用户确认进入拆解

## 评审报告格式

追加到 `.agent/memory/project_decisions.md`：

```markdown
## 评审报告 - {需求标题}
时间：{timestamp}

### 质量评审（quality-reviewer）
{评审结论}

### 安全评审（security-reviewer）
{评审结论}

### 综合结论
- 评分：{0-100}
- 建议：通过 / 需修改 / 退回
- 关键问题：{列表}
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
