---
name: axiom-review
description: Axiom Phase 1.5 专家评审 - critic 主导 + 5专家并行评审（含子代理强制调用铁律）
---

# axiom-review

## 子代理强制调用铁律

```
主 Claude 禁止：直接评审 PRD、直接给出评分、直接分析需求缺陷
每个评审工作必须通过 Task() 调用子代理完成。
```

## 流程

### 前置：知识库查询（必须）

```
axiom_get_knowledge query="PRD 评审 {功能关键词}" limit=5
axiom_search_by_tag tags=["需求评审", "验收标准"] limit=3
→ 将查询结果保存为 kb_context
```

**MCP 不可用降级**：若 `axiom_get_knowledge` 调用失败，直接读取 `.agent/memory/evolution/knowledge_base.md` 提取相关条目作为 kb_context，继续执行，不得阻塞流程。

### 步骤1：调用 critic 子代理进行批判性评审（必须）

```
Task(
  subagent_type="general-purpose",
  model="opus",
  prompt="你是批判性审查专家（Critic）。
  **必须先读取以下文件，再进行分析，禁止基于假设输出结论**：
  - 读取 .agent/memory/project_decisions.md（获取最新 PRD）
  - 读取 docs/requirements/ 目录下最新需求文档
  - 读取 docs/design/ 目录下最新设计文档（若存在）
  【知识库经验】{kb_context}
  对 PRD 进行批判性评审：
  - 挑战所有假设，识别隐含风险
  - 找出需求缺口和边界条件遗漏
  - 评估技术可行性和架构风险
  - 识别安全边界和信任模型问题
  每条问题必须引用文件行号作为证据，禁止无引用的断言。
  输出：Critical/High/Medium/Low 分级问题列表 + 综合评分(0-100)"
)
```

→ critic 发现 Critical 问题 → **强制退回 axiom-draft，不得继续**（此规则优先于评分阈值，无论综合评分多少）

### 步骤2：critic 通过后，并行调用5个专家 agent（强制，不得跳过）

> ⚠️ **此步骤为强制执行**：critic 通过后必须立即并行调用全部5个专家 agent，不得以"评分已足够"或"时间有限"为由跳过。

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
5. 生成评审摘要文件 `docs/reviews/{feature}/summary.md`（关键决策 + 范围变更）：
   ```markdown
   ## 评审摘要 - {feature}
   时间：{timestamp}
   ### 关键决策
   {按冲突仲裁层级 Safety > Tech > Strategic > Business > UX 排序的决策列表}
   ### 范围变更
   {评审导致的需求范围变更，无则填"无"}
   ```
6. 更新 `active_context.md`，展示报告等待确认

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

### 关键决策
{本次评审中达成的关键决策，无则填"无"}

### 范围变更
{评审过程中识别的范围变更，无则填"无"}
```

## active_context.md 写入格式

```
task_status: REVIEWING
current_phase: Phase 1.5 - Reviewing
last_gate: Gate 2
last_updated: {timestamp}
```

## 知识沉淀（必须）

```
axiom_harvest source_type=conversation
  title="PRD评审: {功能名称}"
  summary="{综合评分} | {critic关键问题} | {必须修复项} | {通过条件}"
```

**MCP 不可用降级**：若 `axiom_harvest` 调用失败，用 Write 工具追加写入 `.agent/memory/evolution/knowledge_base.md`：
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

## 确认流程

写入 `task_status: CONFIRMING`，然后：

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

- 用户选择"进入 Phase 2" → `task_status: DECOMPOSING`，调用 `axiom-decompose`
- 用户选择"需要修改" → `task_status: DRAFTING`，重新调用 `axiom-draft`
- 评分 < 60 → 强制退回，不允许确认通过
- **规则优先级：critic 发现 Critical 问题 → 强制退回（优先于评分阈值）；评分 < 60 → 强制退回；两者均满足时按 Critical 规则处理**
- **评分 < 60 强制退回实现**：不展示 AskUserQuestion，直接输出退回提示并将 `task_status` 设为 `DRAFTING`，调用 `axiom-draft` 重新起草
