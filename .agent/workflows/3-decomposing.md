---
description: Phase 2: 任务拆解工作流（Axiom v4.2）
---

# 工作流：任务拆解 (Phase 2)

## 子代理强制调用铁律

主 Claude 禁止：直接设计系统边界、直接生成任务清单

## 步骤1：工作量评估门禁

调用 analyst 子代理评估工作量：
```
Task(
  subagent_type="general-purpose",
  model="haiku",
  prompt="你是需求分析师（Analyst）。
  【需求文档】{requirements_doc}
  【设计文档】{design_doc}
  评估工作量：SMALL（<1天）或 LARGE（≥1天）
  输出：评估结论 + 理由（1-2句话）"
)
```

- SMALL → 跳过拆解，创建单任务 Manifest，直接进入 4-implementing.md
- LARGE → 进入步骤2

## 步骤2：知识库查询（必须）
```
axiom_get_knowledge query="{功能关键词} 任务拆解 架构边界" limit=5
axiom_search_by_tag tags=["任务拆解", "Manifest", "DAG"] limit=3
→ 保存为 kb_context
```

## 步骤3：调用 architect 子代理设计系统边界（必须）
```
Task(
  subagent_type="general-purpose",
  model="opus",
  prompt="你是系统架构师（Architect）。
  【需求文档】{requirements_doc}
  【设计文档】{design_doc}
  【知识库经验】{kb_context}
  设计：系统边界、接口规范、任务 DAG（每任务 < 2小时）
  输出：Manifest 草稿（含 DAG 和任务列表）"
)
```

## 步骤4（可选 --consensus 模式）：调用 critic 挑战方案
```
Task(
  subagent_type="general-purpose",
  model="opus",
  prompt="你是批判性审查专家（Critic）。
  【Manifest草稿】{architect输出}
  挑战：任务粒度是否合理、依赖关系是否正确、是否有遗漏
  输出：问题列表"
)
```
→ 发现问题 → 带问题列表重新调用 architect

## 步骤5：调用 planner 子代理生成任务清单（必须）
```
Task(
  subagent_type="general-purpose",
  model="opus",
  prompt="你是任务规划师（Planner）。
  【architect输出】{architect结果}
  生成完整任务 Manifest：每任务含 ID、描述、依赖、预估时间、验收标准
  保存到 .agent/memory/manifest.md"
)
```

## 步骤6：调用 writer 生成计划文档（必须）
```
Task(
  subagent_type="general-purpose",
  model="haiku",
  prompt="你是技术文档撰写专家（Writer）。
  【planner输出】{planner结果}
  生成计划文档，保存到 docs/plans/YYYY-MM-DD-{feature}-plan.md"
)
```

## 步骤7：调用 quality-reviewer 审查计划文档（必须）
```
Task(
  subagent_type="general-purpose",
  model="sonnet",
  prompt="你是代码质量审查专家（Quality Reviewer）。
  【计划文档】{writer输出}
  审查：任务粒度、依赖完整性、验收标准可测试性，输出问题列表"
)
```
→ 发现问题 → 带问题列表重新调用 planner

## 步骤8：Phase 3 隔离开发（可选）

若变更文件数 ≤ 2 或预估代码行数 < 50，向用户说明并推荐跳过。

```
AskUserQuestion({
  question: "是否创建隔离分支？",
  header: "Phase 3 隔离开发",
  options: [
    { label: "⏭️ 跳过，直接进入实现", description: "变更较小，无需独立分支（推荐）" },
    { label: "🌿 创建隔离分支", description: "创建 feat/{feature} 分支和 worktree" }
  ]
})
```

若用户选择创建分支：
```bash
node scripts/create-worktree.mjs {feature-name}
```
→ 写入 phase3: { branch, worktree, skipped: false }

若跳过：记录 phase3.skipped=true

## 步骤9：执行引擎选择（硬门控）
```
AskUserQuestion({
  question: "任务拆解完成，共 {N} 个任务。选择执行引擎：",
  header: "执行引擎选择",
  options: [
    { label: "标准模式", description: "任务数 ≤ 3，文件 < 10（推荐：简单任务）" },
    { label: "ultrapilot（分区并行）", description: "任务数 3-8，文件边界清晰，最多 5 个 worker 并行" },
    { label: "ultrawork（并行加速）", description: "任务数 4-8，有独立并行子任务" },
    { label: "ralph（持久执行）", description: "任务数 > 8 或需要持续完成" },
    { label: "team（多角色协作）", description: "跨模块、需要多角色协作" },
    { label: "ultraqa（密集QA循环）", description: "实现完成后进入密集测试-修复循环，质量要求极高" }
  ]
})
```

## 知识沉淀（必须）
```
axiom_harvest source_type=workflow_run
  title="任务拆解: {功能名称}"
  summary="{任务数量}个任务 | {关键路径} | {执行引擎} | {预估总时间}"
```

## 阶段完成总结（必须输出）
```
✅ Phase 2 任务拆解完成
- 任务数量：{N} 个
- 关键路径：{N} 个任务
- 执行引擎：{选择的引擎}
- 计划文档：docs/plans/YYYY-MM-DD-{feature}-plan.md
- Manifest：.agent/memory/manifest.md
```

## 用户确认（必须）
```
AskUserQuestion({
  question: "Phase 2 任务拆解已完成。是否开始实现？",
  header: "Phase 2 → Phase 3",
  options: [
    { label: "✅ 开始实现", description: "进入 Phase 3 TDD 实现" },
    { label: "📝 需要调整任务", description: "修改任务拆解" },
    { label: "🔄 返工 Phase 1", description: "需求或架构有问题" }
  ]
})
```

## active_context.md 写入格式
```yaml
task_status: CONFIRMING
current_phase: Phase 2 - Done
manifest_path: .agent/memory/manifest.md
execution_mode: {选择的引擎}
last_gate: Gate 3
last_updated: {timestamp}
```
