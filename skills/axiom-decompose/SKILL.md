---
name: axiom-decompose
description: Axiom Phase 2 任务拆解 - Manifest 生成、Phase 3 隔离开发、执行引擎选择（含知识库贯穿）
---

# axiom-decompose

## 子代理强制调用铁律

```
主 Claude 禁止：直接制定计划、直接操作 git
每个阶段的核心工作必须通过 Task() 调用子代理完成。
```

## 阶段上下文对象

本技能结束时输出以下结构，传递给执行引擎：

```json
{
  "phase2": {
    "tasks": [],
    "critical_path": [],
    "test_strategy": "",
    "plan_file": ""
  },
  "phase3": {
    "branch": "",
    "worktree": "",
    "skipped": false
  }
}
```

## 流程

### 前置：知识库查询

```
axiom_get_knowledge query="任务分解 {模块名称}" limit=5
axiom_search_by_tag tags=["任务规划", "TDD"] limit=3
→ 将查询结果保存为 kb_context
```

### 门禁：工作量评估

派发 analyst agent 评估 PRD 工作量：
```
Task(
  subagent_type="general-purpose",
  model="haiku",
  prompt="你是工作量评估专家。评估以下 PRD 的工作量。
  {PRD内容}
  只输出：SMALL（<1天，单文件/单函数级别）或 LARGE（≥1天）及理由（1-2句话）"
)
```

- **SMALL**（< 1天）→ 跳过拆解，更新 `active_context.md`：
  ```
  task_status: IMPLEMENTING
  current_phase: Phase 3 - Implementing
  last_gate: Gate 2 (skipped decompose)
  ```
  然后触发**执行引擎选择**（见下方）
- **LARGE**（≥ 1天）→ 进入完整拆解流程

### Phase 2：完整拆解流程

**步骤1：调用 architect 子代理（必须）**
```
Task(
  subagent_type="general-purpose",
  model="opus",
  prompt="你是系统架构师（Architect）。
  【phase1上下文】architecture={phase1.architecture} interfaces={phase1.interfaces}
  【知识库经验】{kb_context}
  基于以下 PRD 设计系统边界和接口规范：{PRD内容}
  输出：模块边界、接口定义（函数签名、数据结构、API 契约）、关键技术决策、依赖关系图"
)
```

**步骤2：可选 `--consensus` 模式 - 调用 critic 挑战方案**
```
Task(
  subagent_type="general-purpose",
  model="opus",
  prompt="你是批判性审查员（Critic）。
  挑战以下架构方案的假设和风险：{architect输出}
  输出：被挑战的假设、技术风险（概率×影响）、遗漏的边界条件、建议的替代方案"
)
```

**步骤3：调用 planner 子代理生成任务 Manifest（必须）**
```
Task(
  subagent_type="general-purpose",
  model="opus",
  prompt="你是规划师（Planner）。
  【phase1接口契约】{phase1.interfaces}
  【知识库经验】{kb_context}
  基于系统设计生成详细的任务 Manifest，要求：每任务<2小时，含验收条件，标注依赖关系
  {architect输出}
  输出 Manifest 格式：| ID | 描述 | 优先级 | 依赖 | 预估复杂度 |
  每个任务含明确的验收标准"
)
```

**步骤4：调用 writer 子代理生成计划文档（必须）**
```
Task(
  subagent_type="general-purpose",
  model="haiku",
  prompt="你是技术文档撰写专家（Writer）。
  【phase2上下文】tasks={phase2.tasks} critical_path={phase2.critical_path}
  编写开发计划文档，输出：docs/plans/YYYY-MM-DD-{feature}-plan.md"
)
```

**步骤5：调用 quality-reviewer 审查计划文档（必须）**
```
Task(
  subagent_type="general-purpose",
  model="sonnet",
  prompt="你是代码质量审查专家（Quality Reviewer）。
  【计划文档】{writer输出}
  【设计文档路径】docs/design/YYYY-MM-DD-{feature}-design.md
  审查：任务完整性、粒度合理性、与设计文档一致性，输出问题列表"
)
```

**步骤6：持久化产物（必须）**
```
axiom_write_manifest feature={功能名称} tasks=[{id, description, priority, depends, complexity, acceptance}...]
phase_context_write phase=phase2 data={tasks, critical_path, test_strategy, plan_file}
phase_context_write phase=kb_context data={本阶段所有知识库查询结果}
```

**知识沉淀（必须）**：
```
axiom_harvest source_type=workflow_run
  title="实现计划: {功能名称}"
  summary="{任务数量} | {关键路径} | {风险任务} | {测试策略}"
```

**硬门控**：
- [ ] 每个任务有明确完成标准
- [ ] 任务粒度合理（每步 < 2小时）
- [ ] 开发计划文档已生成并通过审查：`docs/plans/YYYY-MM-DD-{feature}-plan.md`

**阶段完成总结（必须输出）**：
```
✅ Phase 2 实现计划完成
- 任务数量：{N} 个（每任务 < 2小时）
- 关键路径：{关键任务序列}
- 并行任务：{可并行执行的任务组}
- 测试策略：{TDD 覆盖方案}
- 开发计划文档：docs/plans/YYYY-MM-DD-{feature}-plan.md（已审查通过）
```

### Phase 3：隔离开发

**跳过建议**：若满足以下任一条件，向用户说明并推荐跳过：
- 变更文件数 ≤ 2
- 预估代码行数 < 50

通过 AskUserQuestion 向用户确认是否创建隔离分支。

若用户选择创建分支：
```
Bash("node scripts/create-worktree.mjs {feature-name}")
→ 自动创建 feat/{feature-name} 分支和 worktree，写入 phase-context.json phase3
```

若跳过：记录 `phase3.skipped=true`

**知识沉淀（必须）**：
```
axiom_harvest source_type=workflow_run
  title="隔离开发: {功能名称}"
  summary="{分支名} | {worktree路径} | {基础提交} | {隔离策略}"
```

### 执行引擎选择（硬门控，必须执行）

Phase 2/3 完成后，**必须**通过 AskUserQuestion 向用户确认执行引擎：

根据任务特征自动推荐：

| 任务特征 | 推荐引擎 |
|---------|---------|
| 任务数 ≤ 3，变更文件 < 10 | 标准模式 |
| 任务数 4-8，有独立并行子任务 | ultrawork |
| 任务数 > 8 或需要持续到完成 | ralph |
| 跨模块、需要多角色协作 | team |
| 实现完成后需要密集 QA 循环 | ultraqa |

```
AskUserQuestion({
  question: "Phase 2 实现计划已完成，请选择执行引擎。\n\n【推荐：{引擎名}】\n推荐理由：{根据上表自动填写}",
  header: "选择执行引擎",
  options: [
    { label: "标准模式（逐步确认）", description: "每个子任务完成后确认，调用 axiom-implement 逐步执行。" },
    { label: "ultrawork（并行加速）", description: "将独立任务分发给多个并行 agent 同时执行。" },
    { label: "ralph（持久执行）", description: "自我循环直到所有任务完成，中途不停止。" },
    { label: "team（多 agent 流水线）", description: "team-plan → team-exec → team-verify → team-fix 完整流水线。" }
  ]
})
```

选择后的动作：

| 选择 | 动作 |
|------|------|
| 标准模式 | 写入 `execution_mode: standard`，更新 `task_status: IMPLEMENTING`，调用 `axiom-implement` |
| ultrawork | 写入 `execution_mode: ultrawork`，更新 `task_status: IMPLEMENTING`，调用 `Skill("ultrawork")`，传入 Phase 2 任务列表 |
| ralph | 写入 `execution_mode: ralph`，更新 `task_status: IMPLEMENTING`，调用 `Skill("ralph")`，传入实现目标 |
| team | 写入 `execution_mode: team`，更新 `task_status: IMPLEMENTING`，调用 `Skill("team")`，进入 team-plan 阶段 |

## Manifest 文件格式

写入路径：`.agent/memory/manifest.md`

```markdown
## Manifest - {需求标题}
生成时间：{timestamp}

### 任务列表
| ID | 描述 | 优先级 | 依赖 | 预估复杂度 |
|----|------|--------|------|-----------|
| T1 | ... | P0 | - | 低/中/高 |
| T2 | ... | P1 | T1 | 低/中/高 |

### 系统边界
{architect 输出的边界描述}

### 接口规范
{关键接口定义}
```

## active_context.md 写入格式

```
task_status: DECOMPOSING
current_phase: Phase 2 - Decomposing
last_gate: Gate 3
manifest_path: .agent/memory/manifest.md
execution_mode: {standard|ultrawork|ralph|team}
last_updated: {timestamp}
```
