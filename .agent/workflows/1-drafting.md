---
description: Phase 1: 需求澄清与架构设计工作流（Axiom v4.2）
---

# 工作流：需求澄清与架构设计 (Phase 1)

## 子代理强制调用铁律

主 Claude 只负责：协调、门控、AskUserQuestion、知识库查询/沉淀、交互检查
主 Claude 禁止：直接分析需求、直接设计架构、直接编写文档

## Phase 0：需求澄清

### 步骤1：知识库查询（必须）
```
axiom_get_knowledge query="{功能关键词} 需求模式" limit=5
axiom_search_by_tag tags=["需求", "验收标准"] limit=3
→ 保存为 kb_context
```

### 步骤2：调用 analyst 子代理（必须）
```
Task(
  subagent_type="general-purpose",
  model="opus",
  prompt="你是需求分析师（Analyst）。
  【用户需求】{用户输入}
  【知识库经验】{kb_context}
  提取：验收标准（可测试）、约束条件、排除范围、隐含风险
  输出：结构化需求文档草稿"
)
```

→ **REJECT**（违反安全/伦理/严重偏离范畴/技术不可能）→ 向用户说明原因，终止流程
→ **CLARIFY**（置信度 < 90%）→ 生成澄清问题，向用户提问，等待回复后重新调用
→ **PASS**（置信度 ≥ 90%）→ 进入步骤3

### 步骤3：调用 writer 子代理生成需求文档（必须）
```
Task(
  subagent_type="general-purpose",
  model="haiku",
  prompt="你是技术文档撰写专家（Writer）。
  【analyst输出】{analyst结果}
  生成结构化需求文档，保存到 docs/requirements/YYYY-MM-DD-{feature}-requirements.md"
)
```

### 步骤4：调用 quality-reviewer 审查需求文档（必须）
```
Task(
  subagent_type="general-purpose",
  model="sonnet",
  prompt="你是代码质量审查专家（Quality Reviewer）。
  【需求文档】{writer输出}
  审查：完整性、可测试性、无歧义性，输出问题列表"
)
```
→ 发现 High/Critical 问题 → 带问题列表重新调用 analyst
→ 发现 Medium/Low 问题 → 带问题列表重新调用 writer
→ 通过 → 进入 Phase 1

⚠️ Phase 0 完成后禁止出现确认框。必须直接继续执行 Phase 1 架构设计。

### 知识沉淀（必须）
```
axiom_harvest source_type=conversation
  title="需求澄清: {功能名称}"
  summary="{验收标准数量}条 | {约束条件} | {排除范围} | {隐含风险}"
```

## Phase 1：架构设计

### 步骤1：知识库查询（必须）
```
axiom_get_knowledge query="{功能关键词} 架构模式 接口设计" limit=5
axiom_search_by_tag tags=["架构", "接口契约", "ADR"] limit=3
→ 更新 kb_context
```

### 步骤2：调用 architect 子代理（必须）
```
Task(
  subagent_type="general-purpose",
  model="opus",
  prompt="你是系统架构师（Architect）。
  【需求文档】{requirements_doc}
  【phase0上下文】acceptance_criteria={phase0.acceptance_criteria} constraints={phase0.constraints}
  【知识库经验】{kb_context}
  设计：系统架构、模块边界、接口契约（含错误码）、ADR
  ⚠️ 接口契约强制规则（C-2）：每个接口必须包含完整的请求/响应 JSON 示例，列出所有字段名、类型和说明，禁止仅描述字段用途而不给出具体字段名
  输出：架构设计文档草稿"
)
```

### 步骤3：调用 critic 子代理挑战方案（必须）
```
Task(
  subagent_type="general-purpose",
  model="opus",
  prompt="你是批判性审查专家（Critic）。
  **必须先读取以下文件，再进行分析，禁止基于假设输出结论**：
  - 读取 docs/design/YYYY-MM-DD-{feature}-design.md（若已存在）
  - 读取 docs/requirements/YYYY-MM-DD-{feature}-requirements.md
  【架构设计】{architect输出}
  【phase0约束】{phase0.constraints}
  挑战所有假设，识别：循环依赖、性能瓶颈、安全边界、可扩展性问题（每条问题必须引用文件行号作为证据）
  输出：Critical/High/Medium/Low 分级问题列表"
)
```
→ 发现 Critical/High 问题 → 带问题列表重新调用 architect → architect 完成后重新调用 critic 审查，循环直到无 Critical/High

### 步骤4：调用 writer 生成设计文档（必须）
```
Task(
  subagent_type="general-purpose",
  model="haiku",
  prompt="你是技术文档撰写专家（Writer）。
  【architect输出】{architect结果}
  【critic反馈】{critic结果}
  生成设计文档，保存到 docs/design/YYYY-MM-DD-{feature}-design.md"
)
```

### 步骤5：调用 quality-reviewer 审查设计文档（必须）
```
Task(
  subagent_type="general-purpose",
  model="sonnet",
  prompt="你是代码质量审查专家（Quality Reviewer）。
  【设计文档】{writer输出}
  审查：准确性、完整性、与需求一致性，输出问题列表"
)
```
→ 发现问题 → 带问题列表重新调用 writer
→ 通过 → 进入门禁

### 知识沉淀（必须）
```
axiom_harvest source_type=code_change
  title="架构设计: {功能名称}"
  summary="{架构模式} | {接口数量}个接口 | {ADR决策} | {关键约束}"
```

## 阶段完成总结（必须输出）
```
✅ Phase 0+1 需求澄清与架构设计完成
- 验收标准：{N} 条（可测试）
- 技术边界：包含 {X}，不包含 {Y}
- 接口契约：{N} 个接口已定义
- ADR：{N} 条架构决策
- 需求文档：docs/requirements/YYYY-MM-DD-{feature}-requirements.md
- 设计文档：docs/design/YYYY-MM-DD-{feature}-design.md
```

## 硬门控（必须全部通过）
- [ ] 验收标准已定义且可测试
- [ ] 技术边界已明确
- [ ] 接口契约已定义（含错误码）
- [ ] 无循环依赖
- [ ] 需求文档和设计文档已生成并通过审查

## 用户确认（必须）
```
AskUserQuestion({
  question: "Phase 0+1 需求澄清与架构设计已完成，如何继续？",
  header: "Phase 1 → Phase 1.5",
  options: [
    { label: "✅ 进入 Phase 1.5 专家评审", description: "需求和架构已就绪，开始多专家评审" },
    { label: "⏭️ 跳过评审，直接进入 Phase 2", description: "简单任务，无需专家评审" },
    { label: "📝 需要修改后再进入", description: "部分内容需要调整" },
    { label: "🔄 返工需求澄清", description: "重新澄清需求" }
  ]
})
```

## active_context.md 写入格式
```yaml
task_status: CONFIRMING
current_phase: Phase 1 - Done
last_gate: Gate 1
last_updated: {timestamp}
```
