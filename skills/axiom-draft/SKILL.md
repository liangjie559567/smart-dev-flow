---
name: axiom-draft
description: Axiom Phase 1 起草 - 需求澄清、PRD 生成、架构设计（含子代理强制调用铁律 + 知识库贯穿）
---

# axiom-draft

## 子代理强制调用铁律

```
主 Claude 只负责：协调、门控、AskUserQuestion、知识库查询/沉淀、交互检查
主 Claude 禁止：直接分析需求、直接设计架构、直接编写文档

每个阶段的核心工作必须通过 Task() 调用子代理完成。
违反此规则 = 流程无效，必须重新执行该阶段。
```

## 阶段上下文对象

本技能结束时输出以下结构，传递给 axiom-decompose：

```json
{
  "phase0": {
    "acceptance_criteria": [],
    "constraints": [],
    "risks": [],
    "requirements_doc": ""
  },
  "phase1": {
    "architecture": "",
    "interfaces": [],
    "adr": "",
    "design_doc": ""
  }
}
```

## 流程

### 前置：状态检查 + 知识库查询

1. 读取 `.agent/memory/active_context.md`，检查 `task_status`：
   - 若状态非 `IDLE`，提示用户："当前有进行中的任务（状态：{task_status}），继续起草将覆盖现有上下文。确认继续？"
   - 用户确认后继续；取消则终止
   - **注意**：本技能通常由 `dev-flow` 在完成 `brainstorming` 硬门控后调用。若直接调用本技能（`/axiom-draft`），将跳过 brainstorming 设计审批阶段，仅在用户明确知晓的情况下允许。
2. 执行 `.agent/workflows/1-drafting.md`
3. **知识库查询（必须）**：
   ```
   axiom_get_knowledge query="需求澄清 {功能关键词}" limit=5
   axiom_search_by_tag tags=["需求分析", "验收标准"] limit=3
   → 将查询结果保存为 kb_context，注入后续子代理 prompt
   ```

### Phase 0：需求澄清

向用户收集需求信息（见"需求收集"），然后：

**步骤1：调用 analyst 子代理（必须，禁止主 Claude 直接分析）**
```
Task(
  subagent_type="general-purpose",
  model="opus",
  prompt="你是需求分析师（Analyst）。你的任务是将产品需求转化为可实现的验收标准，识别需求缺口。
  【知识库经验】{kb_context}
  分析以下需求，先执行可行性门禁（Requirement Analyst Gate）：
  **Red Gate（可行性）**：是否违反安全/伦理？是否严重偏离开发工具范畴？是否技术上不可能？
  **Yellow Gate（清晰度）**：关键角色/动作/结果是否已定义？是否存在多义词？是否有足够上下文？
  输出门禁结论：
  - **REJECT**：原因 + 建议转向
  - **CLARIFY**（清晰度 < 90%）：缺失信息列表 + 3-5个澄清问题
  - **PASS**（清晰度 ≥ 90%）：继续输出：
    - 用户故事（作为...，我希望...，以便...）
    - 验收标准列表（可测试的 pass/fail 标准）
    - 技术约束
    - 排除范围
    - 未解决的疑问
  需求描述：{需求描述}
  【知识库经验】{kb_context}"
)

> ⚠️ **门禁处理**：
> - analyst 返回 **REJECT** → 向用户说明原因，终止流程
> - analyst 返回 **CLARIFY** → 向用户提出澄清问题，收到回答后重新调用 analyst
> - analyst 返回 **PASS** → 继续步骤2
```

**步骤2：调用 writer 子代理生成需求文档（必须）**
```
Task(
  subagent_type="general-purpose",
  model="haiku",
  prompt="你是技术文档撰写专家（Writer）。
  【analyst输出】{analyst输出}
  编写需求规格文档，输出：docs/requirements/YYYY-MM-DD-{feature}-requirements.md"
)
```

**步骤3：调用 quality-reviewer 子代理审查文档（必须）**
```
Task(
  subagent_type="general-purpose",
  model="sonnet",
  prompt="你是代码质量审查专家（Quality Reviewer）。
  【待审查文档】{writer输出}
  审查：完整性、可测试性、无歧义性，输出问题列表"
)
```

**步骤4：主 Claude 交互检查**
- 若 quality-reviewer 发现**需求歧义/逻辑缺口**（High/Critical）→ 退回 analyst 重新分析 → analyst 完成后重新调用 writer → **writer 完成后重新调用 quality-reviewer 审查**，循环直到无 High/Critical
- 若 quality-reviewer 发现**文档格式/表达问题**（Medium/Low）→ 带问题列表重新调用 writer → **writer 完成后重新调用 quality-reviewer 审查**，循环直到审查无问题
- 全部通过 → 写入 phase0 上下文，记录文档路径

**知识沉淀（必须）**：
```
axiom_harvest source_type=conversation
  title="需求澄清: {功能名称}"
  summary="{核心需求} | {关键约束} | {验收标准} | {风险点}"
```

**硬门控**：
- [ ] 验收标准已定义且可测试
- [ ] 技术边界已明确
- [ ] 需求文档已生成并通过审查：`docs/requirements/YYYY-MM-DD-{feature}-requirements.md`

> ⚠️ **Phase 0 完成后禁止出现确认框**。必须直接继续执行 Phase 1 架构设计，确认框只在 Phase 0+1 全部完成后出现。

### Phase 1：架构设计

**知识库查询（必须）**：
```
axiom_get_knowledge query="架构设计 {技术栈关键词}" limit=5
axiom_search_by_tag tags=["架构", "设计模式"] limit=3
→ 更新 kb_context
```

**步骤1：调用 architect 子代理（必须，禁止主 Claude 直接设计）**
```
Task(
  subagent_type="general-purpose",
  model="opus",
  prompt="你是系统架构师（Architect）。
  【phase0上下文】acceptance_criteria={phase0.acceptance_criteria} constraints={phase0.constraints}
  【知识库经验】{kb_context}
  设计系统架构，输出：模块划分、接口契约（含错误码）、ADR
  ⚠️ 接口契约强制规则（C-2）：每个接口必须包含完整的请求/响应 JSON 示例，列出所有字段名、类型和说明，禁止仅描述字段用途而不给出具体字段名"
)
```

**步骤2：调用 critic 子代理挑战方案（必须）**
```
Task(
  subagent_type="general-purpose",
  model="opus",
  prompt="你是批判性审查专家（Critic）。
  **必须先读取以下文件，再进行分析，禁止基于假设输出结论**：
  - 读取 docs/design/YYYY-MM-DD-{feature}-design.md（若已存在）
  - 读取 docs/requirements/YYYY-MM-DD-{feature}-requirements.md
  【架构方案】{architect输出}
  【phase0约束】{phase0.constraints}
  识别设计缺陷、循环依赖、违反约束的问题，输出问题列表（每条问题必须引用文件行号作为证据）"
)
```

**步骤3：主 Claude 交互检查**
- 有 Critical/High 问题 → 带问题列表重新调用 architect → **architect 完成后重新调用 critic 审查**，循环直到无 Critical/High
- 确认无循环依赖、接口契约含错误码 → 写入 phase1 上下文

**步骤4：调用 writer 子代理生成设计文档（必须）**
```
Task(
  subagent_type="general-purpose",
  model="haiku",
  prompt="你是技术文档撰写专家（Writer）。
  【phase1上下文】architecture={phase1.architecture} interfaces={phase1.interfaces} adr={phase1.adr}
  编写系统设计文档，输出：docs/design/YYYY-MM-DD-{feature}-design.md"
)
```

**步骤5：调用 quality-reviewer 审查设计文档（必须）**
```
Task(
  subagent_type="general-purpose",
  model="sonnet",
  prompt="你是代码质量审查专家（Quality Reviewer）。
  【设计文档】{writer输出}
  【需求文档路径】docs/requirements/YYYY-MM-DD-{feature}-requirements.md
  审查：准确性、完整性、与需求一致性，输出问题列表"
)
```
- 若 reviewer 发现问题 → 带问题列表重新调用 writer → **writer 完成后重新调用 quality-reviewer 审查**，循环直到审查无问题
- 全部通过 → 记录文档路径到 phase1 上下文

**知识沉淀（必须）**：
```
axiom_harvest source_type=code_change
  title="架构设计: {功能名称}"
  summary="{架构模式} | {关键决策理由} | {接口契约} | {可复用设计}"
```

**硬门控**：
- [ ] 接口契约已定义（含错误码）
- [ ] 无循环依赖
- [ ] critic 审查通过（无重大设计缺陷）
- [ ] 设计文档已生成并通过审查：`docs/design/YYYY-MM-DD-{feature}-design.md`

## 阶段完成总结（必须输出）

```
✅ Phase 0+1 需求澄清与架构设计完成
- 验收标准：{N} 条（均可测试）
- 技术边界：包含 {X}，不包含 {Y}
- 接口契约：{N} 个接口已定义（含错误码）
- ADR：{关键架构决策}
- 需求文档：docs/requirements/YYYY-MM-DD-{feature}-requirements.md（已审查通过）
- 设计文档：docs/design/YYYY-MM-DD-{feature}-design.md（已审查通过）
```

### 确认流程

展示 PRD 草稿 + 架构设计后，写入 `task_status: CONFIRMING`，然后通过 AskUserQuestion 等待用户确认：

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

- 用户选择"进入 Phase 1.5" →
  1. **持久化阶段上下文（必须）**：
     ```
     phase_context_write phase=phase0 data={acceptance_criteria, constraints, risks, requirements_doc}
     phase_context_write phase=phase1 data={architecture, interfaces, adr, design_doc}
     phase_context_write phase=kb_context data={本阶段所有知识库查询结果}
     ```
     **MCP 不可用降级**：若 `phase_context_write` 调用失败，将上述数据写入 `.agent/memory/phase-context.json`（JSON 格式，key 为 phase0/phase1/kb_context），继续执行，不得阻塞流程。
  2. 更新 `task_status: REVIEWING`，调用 `axiom-review`
- 用户选择"跳过评审" → 持久化阶段上下文（同上），更新 `task_status: DECOMPOSING`，调用 `axiom-decompose`
- 用户选择"需要修改" → 重新执行对应阶段
- 用户选择"返工" → 清空本次收集内容，重新执行需求收集

## 需求收集

向用户询问以下信息：

| 字段 | 是否必填 | 说明 |
|------|----------|------|
| 功能描述 | 必填 | 要实现什么功能 |
| 技术栈偏好 | 可选 | 语言、框架等偏好 |
| 验收标准 | 可选 | 未提供时由 analyst 自动推断 |

## PRD 写入格式

同时写入两个文件：

**1. `.agent/memory/project_decisions.md`（追加）：**

```markdown
## PRD - {需求标题}
生成时间：{timestamp}

### 目标
{功能描述}

### 用户故事
- 作为 {用户角色}，我希望 {功能}，以便 {价值}

### 验收标准
- [ ] {标准1}
- [ ] {标准2}

### 技术约束
{技术栈偏好或"无特殊约束"}

### 排除范围
{明确不做的内容，或"无"}

### 架构决策
{phase1.adr}
```

**2. `.agent/memory/prd-{session_name}-{timestamp}.md`（新建）：**

内容与上方相同，作为独立 PRD 文件存档。

## active_context 写入格式

> **注意**：`task_status: DRAFTING` 通常由 `dev-flow` 在调用本技能前写入。本技能仅在直接调用（`/axiom-draft`）时自行写入，避免重复写入。

```
task_status: DRAFTING
current_phase: Phase 1 - Drafting
last_gate: Gate 1
last_updated: {timestamp}
```
