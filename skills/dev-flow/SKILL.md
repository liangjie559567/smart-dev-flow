---
name: dev-flow
description: 智能开发助手主入口 - 融合 Axiom 状态机与 OMC 多智能体编排
triggers: ["axiom-flow", "axiom dev", "axiom", "/axiom-flow", "smart-dev-flow"]
---

# dev-flow - 智能开发助手

## 完整开发流程（Phase 0-9）

dev-flow 包含以下9个阶段，由各子技能负责执行：

| 阶段 | 名称 | 子技能 | 说明 |
|------|------|--------|------|
| Phase 0 | 需求澄清 | `axiom-draft` | analyst 子代理分析需求，生成验收标准，输出需求文档 |
| Phase 1 | 架构设计 | `axiom-draft` | architect + critic 子代理设计系统架构，输出设计文档 |
| Phase 1.5 | 专家评审 | `axiom-review` | critic 主导5专家并行评审 PRD + 架构，可跳过 |
| Phase 2 | 任务拆解 | `axiom-decompose` | planner 子代理生成任务 Manifest，输出计划文档 |
| Phase 3 | 隔离开发 | `axiom-decompose` | 创建 feat/ 分支和 worktree，小变更可跳过 |
| Phase 4 | TDD 实现 | `axiom-implement` | executor 子代理按 Red→Green→Refactor 实现，四层审查 |
| Phase 5 | 系统调试 | `axiom-implement` | 连续失败≥3次自动触发，debugger 根因分析 |
| Phase 6 | 代码审查 | `axiom-implement` | 质量/安全/接口/风格四视角并行审查 |
| Phase 6.5 | 文档编写 | `axiom-implement` | writer 子代理生成 API 文档和 README |
| Phase 7 | 完成验证 | `axiom-implement` | verifier 子代理逐条核对验收标准，运行测试/构建/lint |
| Phase 8 | 分支合并 | `axiom-reflect` | 合并 feat/ 分支，验证主分支测试通过，可跳过 |
| Phase 9 | 知识收割 | `axiom-reflect` | reflect + evolve，生成完成报告，重置状态为 IDLE |

**阶段间状态流转**：
```
IDLE → [brainstorming] → DRAFTING → CONFIRMING → REVIEWING → CONFIRMING → DECOMPOSING → IMPLEMENTING → REFLECTING → IDLE
```

**硬门控**：每阶段完成后必须通过 AskUserQuestion 确认才能进入下一阶段。

---

## 状态路由

1. 读取 `.agent/memory/active_context.md` 中的 `task_status`
2. 根据状态路由：

| 状态 | 动作 |
|------|------|
| `IDLE` | 智能需求收集，调用 `axiom-draft` |
| `DRAFTING` | 继续 Phase 1，调用 `axiom-draft`（含 PRD 确认流程） |
| `REVIEWING` | 继续 Phase 1.5，调用 `axiom-review`（完成后流转到 `DECOMPOSING`） |
| `DECOMPOSING` | 继续 Phase 2，调用 `axiom-decompose`（内部含 Phase 3 隔离工作区创建） |
| `IMPLEMENTING` | 继续 Phase 4，若 `execution_mode` 未设置则先触发**执行引擎选择**，再根据选择调用对应执行引擎 |
| `BLOCKED` | 展示 `blocked_reason`，提供恢复选项 |
| `REFLECTING` | 调用 `axiom-reflect`（内部含分支收尾 + 知识收割） |

## IDLE 时的引导

<HARD-GATE>
IDLE 状态下收到任何新功能/需求请求，必须先调用 `brainstorming` 技能完成设计审批，才能进入 axiom-draft。不允许跳过，不允许直接写代码。唯一例外：用户明确传入 `--skip-brainstorm` 参数。
</HARD-GATE>

通过**1轮** AskUserQuestion 收集信息（AskUserQuestion 不支持开放文本，需求描述通过对话收集）：

**第1步：对话收集需求描述**（直接文本回复，不用 AskUserQuestion）
- 向用户说："请描述你想构建的功能或解决的问题（可以自由描述）："
- 等待用户文本回复，记录为需求描述

**第2步：AskUserQuestion 收集优先级**
```
AskUserQuestion({
  question: "开发优先级是什么？",
  header: "优先级",
  options: [
    { label: "功能完整性", description: "确保所有功能正确实现" },
    { label: "开发速度", description: "尽快交付可用版本" },
    { label: "代码质量", description: "注重可维护性和测试覆盖" }
  ]
})
```

收到回答后：
1. 若用户传入 `--skip-brainstorm`：跳过 brainstorming，直接执行步骤2
2. 否则调用 `brainstorming` 技能（硬门控，等待设计审批）
3. 将 `task_status` 更新为 `DRAFTING`
4. 携带收集到的信息调用 `axiom-draft`

## Phase 2/3 完成后：执行引擎选择（硬门控）

执行引擎选择由 `axiom-decompose` 在 Phase 2/3 完成后负责触发（含 AskUserQuestion 和写入 `execution_mode`）。`dev-flow` 在进入 `IMPLEMENTING` 状态时，若 `execution_mode` 仍未设置（如用户直接跳转到该状态），**必须**补充触发执行引擎选择，不得跳过。

### 推荐逻辑

根据任务特征自动推荐，并向用户说明推荐理由：

| 任务特征 | 推荐引擎 | 推荐理由 |
|---------|---------|---------|
| 任务数 ≤ 3，变更文件 < 10 | **标准模式** | 任务简单，逐步确认更安全 |
| 任务数 3-8，有独立并行子任务，文件边界清晰 | **ultrapilot** | 文件所有权分区，最多 5 个 worker，适合多组件系统 |
| 任务数 4-8，有独立并行子任务 | **ultrawork** | 独立任务可并行，显著提速 |
| 任务数 > 8 或需要持续到完成 | **ralph** | 任务量大，需要持久执行保证完成 |
| 跨模块、需要多角色协作 | **team** | 多 agent 流水线，质量更高 |
| 实现完成后需要密集 QA 循环 | **ultraqa** | 专注测试-修复循环，适合质量要求高的场景 |

### 执行引擎说明

```
AskUserQuestion({
  question: "Phase 2/3 已完成，请选择执行引擎。\n\n【推荐：<引擎名>】\n推荐理由：<根据上表自动填写>",
  header: "选择执行引擎",
  options: [
    {
      label: "标准模式（逐步确认）",
      description: "每个子任务完成后确认，适合复杂/高风险需求。调用 axiom-implement 逐步执行。"
    },
    {
      label: "ultrapilot（分区并行）",
      description: "文件所有权分区，最多 5 个 worker 并行执行，适合多组件系统，避免文件冲突。"
    },
    {
      label: "ultrawork（并行加速）",
      description: "将独立任务分发给多个并行 agent 同时执行，适合任务间无依赖的场景。"
    },
    {
      label: "ralph（持久执行）",
      description: "自我循环直到所有任务完成，中途不停止。适合任务量大、需要保证完成的场景。"
    },
    {
      label: "team（多 agent 流水线）",
      description: "team-plan → team-exec → team-verify → team-fix 完整流水线，质量最高。"
    },
    {
      label: "ultraqa（QA 循环）",
      description: "实现完成后进入测试-修复密集循环，适合质量要求极高的场景。"
    }
  ]
})
```

### 选择后的动作

| 选择 | 动作 |
|------|------|
| 标准模式 | 写入 `execution_mode: standard`，调用 `axiom-implement` |
| ultrapilot | 写入 `execution_mode: ultrapilot`，调用 `ultrapilot` 技能，传入 Phase 2 任务列表 |
| ultrawork | 写入 `execution_mode: ultrawork`，调用 OMC `ultrawork` 技能，传入 Phase 2 任务列表 |
| ralph | 写入 `execution_mode: ralph`，调用 OMC `ralph` 技能，传入实现目标 |
| team | 写入 `execution_mode: team`，调用 OMC `team` 技能，进入 team-plan 阶段 |
| ultraqa | 写入 `execution_mode: ultraqa`，先调用 `axiom-implement`（标准），完成后调用 OMC `ultraqa` |

### IMPLEMENTING 阶段引擎路由

进入 `IMPLEMENTING` 状态时，若 `execution_mode` **未设置**（空或缺失）→ 先触发上方执行引擎选择 AskUserQuestion，用户确认后写入 `execution_mode`，再按下方路由执行：

若 `execution_mode` **已设置**，直接读取 `active_context.md` 中的 `execution_mode`：

- `standard` → 调用 `axiom-implement`（逐步，每任务确认）
- `ultrapilot` → 调用 `ultrapilot` 技能（文件分区并行执行）
- `ultrawork` → 调用 OMC `ultrawork`（并行 agent 编排）
- `ralph` → 调用 OMC `ralph`（持久循环直到完成）
- `team` → 调用 OMC `team`（多 agent 流水线）
- `ultraqa` → 调用 `axiom-implement` 完成后接 OMC `ultraqa`（QA 循环）

## BLOCKED 状态处理

1. 读取 `.agent/memory/active_context.md` 中的 `blocked_reason` 字段并展示
2. 通过 `AskUserQuestion` 提供五个恢复选项：

   **A. 继续尝试** — 重新调用当前执行引擎，清空失败计数
   **B. 切换引擎重试** — 重新触发执行引擎选择，换一种引擎执行
   **C. 调用 debugger** — 调用 OMC `debugger` agent 进行根因分析，分析完成后重新执行
   **D. 降级跳过** — 调用 `axiom-implement`（标准模式），跳过当前阻塞点继续
   **E. 人工介入** — 将状态置为 `IDLE`，输出阻塞摘要供用户手动处理

## 错误恢复

在 `IMPLEMENTING` 阶段，追踪连续失败次数（存储于 `active_context.md` 的 `fail_count` 字段）：
- 每次失败：`fail_count += 1`
- `fail_count >= 3`：自动将 `task_status` 更新为 `BLOCKED`，将失败原因写入 `blocked_reason`，重置 `fail_count` 为 0

## 快捷命令

| 命令 | 动作 |
|------|------|
| `/brainstorm` | 调用 `brainstorming` 技能（需求设计，IDLE 硬门控） |
| `/write-plan` | 调用 `writing-plans` 技能（制定实现计划） |
| `/execute-plan` | 调用 `executing-plans` 技能（分批执行计划） |
| `/status` | 调用 `axiom-status` |
| `/reflect` | 调用 `axiom-reflect` |
| `/reset` | 将 `task_status` 重置为 `IDLE`，清空 `blocked_reason`、`fail_count`、`rollback_count`、`last_checkpoint` |
| `/start` | 调用 `axiom-start`（零触感启动） |
| `/suspend` | 调用 `axiom-suspend`（会话挂起） |
| `/analyze-error` | 调用 `axiom-analyze-error`（错误分析） |
| `/rollback` | 调用 `axiom-rollback`（回滚检查点） |
| `/knowledge [词]` | 调用 `axiom-knowledge`（查询知识库） |
| `/patterns [词]` | 调用 `axiom-patterns`（查询模式库） |
| `/ralph` | 调用 OMC `ralph`（持久执行，任务必须完全完成才停止） |
| `/ultrawork` | 调用 OMC `ultrawork`（并行 agent 执行独立任务） |
| `/team [需求]` | 调用 OMC `team`（多 agent 流水线：plan→exec→verify→fix） |
| `/ultraqa` | 调用 OMC `ultraqa`（测试-修复密集循环） |
| `/git` | 调用 OMC `git-master` agent（原子提交、rebase、历史管理） |
| `/code-review` | 调用 OMC `code-reviewer`（opus）对当前代码库进行全面审查 |
| `/security-review` | 调用 OMC `security-reviewer`（sonnet）进行安全专项审查 |
| `/deepinit` | 调用 OMC `deepinit`，分层扫描代码库生成 AGENTS.md 知识图谱 |
| `/plan [需求]` | 调用 OMC `plan`，战略规划（支持 `--consensus` 多 agent 共识模式） |
| `/ralplan [需求]` | 调用 OMC `ralplan`，Planner+Architect+Critic 三方共识规划 |
| `/doctor` | 调用 OMC `omc-doctor`，诊断并修复环境配置问题 |
| `/research [主题]` | 调用 OMC `external-context`，并行 document-specialist 网页搜索 |
| `/hud` | 调用 `axiom-hud`，显示 Dev Flow 工作流状态仪表盘 |
| `/ask-codex [角色] [问题]` | 调用 `mcp__x__ask_codex`（architect/planner/critic/analyst/code-reviewer） |
| `/ask-gemini [角色] [问题]` | 调用 `mcp__g__ask_gemini`（designer/writer/vision） |

## MCP 工具集成

### 发现机制（每次会话首次使用前必须执行）

```
ToolSearch("mcp")  // 发现所有 MCP 工具（优先）
// 若无结果 → 降级到等效 Claude agent，不阻塞流程
```

### 各阶段 MCP 路由

> **说明**：各子技能（axiom-draft 等）内部默认使用 `Task()` 子代理执行核心工作。MCP 工具为**可选优化路径**，在 MCP 可用时可替代对应 Claude agent 以提升速度。各子技能内部不会自动调用 MCP，需由主 Claude 在调用子技能前判断是否使用 MCP 预处理。

| 阶段 | 优先 MCP 工具 | agent_role | 降级方案 |
|------|-------------|-----------|---------|
| axiom-draft（需求分析） | `mcp__x__ask_codex` | `analyst` | `analyst` agent (opus) |
| axiom-decompose（任务规划） | `mcp__x__ask_codex` | `planner` | `planner` agent (opus) |
| axiom-decompose（架构验证） | `mcp__x__ask_codex` | `architect` | `architect` agent (opus) |
| axiom-implement（代码审查） | `mcp__x__ask_codex` | `code-reviewer` | `code-reviewer` agent (opus) |
| axiom-implement（安全审查） | `mcp__x__ask_codex` | `security-reviewer` | `security-reviewer` agent (sonnet) |
| axiom-implement（测试策略） | `mcp__x__ask_codex` | `tdd-guide` | `test-engineer` agent (sonnet) |
| axiom-review（批判性评审） | `mcp__x__ask_codex` | `critic` | `critic` agent (opus) |
| axiom-draft（UI/UX 设计） | `mcp__g__ask_gemini` | `designer` | `designer` agent (sonnet) |
| axiom-draft（文档生成） | `mcp__g__ask_gemini` | `writer` | `writer` agent (haiku) |
| 大上下文分析（>50文件） | `mcp__g__ask_gemini` | `analyst` | `analyst` agent (opus) |

### 使用规则

- **只读分析任务**优先用 MCP（更快更省），实现/调试/验证必须用 Claude agent（需要工具访问）
- 调用时**必须附带** `context_files`（相关源文件路径列表）
- MCP 输出为**建议性**，最终验证（测试、类型检查）由 Claude agent 执行
- Codex 调用最长耗时 1 小时，可用 `background: true` + `wait_for_job` 异步等待
- **不可用时立即降级**，不得因 MCP 不可用而阻塞流程

### 快捷命令

| 命令 | 动作 |
|------|------|
| `/ask-codex [角色] [问题]` | 调用 `mcp__x__ask_codex`，角色可选 architect/planner/critic/analyst/code-reviewer |
| `/ask-gemini [角色] [问题]` | 调用 `mcp__g__ask_gemini`，角色可选 designer/writer/vision |

## OMC Team Phase 映射

Axiom 各阶段与 OMC Team 流水线的对应关系：

| Axiom 阶段 | OMC Team Phase | 主要 Agent |
|-----------|---------------|-----------|
| axiom-draft | team-prd | analyst, product-manager |
| axiom-review | team-prd | analyst, critic |
| axiom-decompose | team-plan | planner, architect |
| axiom-implement | team-exec → team-verify | executor/deep-executor, verifier |
| axiom-reflect | team-verify | verifier, writer |

## active_context.md 字段规范

| 字段 | 类型 | 说明 | 写入方 |
|------|------|------|--------|
| `task_status` | 枚举 | `IDLE/DRAFTING/REVIEWING/DECOMPOSING/IMPLEMENTING/REFLECTING/BLOCKED` | 各 skill |
| `current_phase` | 字符串 | 当前阶段描述 | 各 skill |
| `current_task` | 字符串 | 当前执行的子任务 ID 和描述 | axiom-implement |
| `completed_tasks` | 逗号列表 | 已完成子任务 ID | axiom-implement |
| `fail_count` | 整数 | 当前子任务连续失败次数，成功或切换子任务时重置为 0 | axiom-implement |
| `rollback_count` | 整数 | 本任务累计回滚次数 | axiom-rollback |
| `blocked_reason` | 字符串 | 阻塞原因描述 | axiom-implement / axiom-analyze-error |
| `last_checkpoint` | git SHA | 最近一次检查点 commit hash | axiom-implement |
| `session_name` | 字符串 | 任务会话名称 | axiom-draft |
| `manifest_path` | 路径 | Manifest 文件路径 | axiom-decompose |
| `execution_mode` | 枚举 | `standard/ultrapilot/ultrawork/ralph/team/ultraqa`，Phase 3 完成后写入 | dev-flow |
| `last_gate` | 字符串 | 最近通过的门禁名称 | 各 skill |
| `last_updated` | ISO 时间 | 最后更新时间 | 各 skill |

### 写入规范（幂等性要求）

写入 `active_context.md` 时**必须整体替换 frontmatter**，禁止追加写入：

1. 读取现有文件内容
2. 解析现有 frontmatter 中的所有字段
3. 合并需要更新的字段（保留未变更字段）
4. 用完整的新 frontmatter 替换旧 frontmatter（`---\n...\n---` 整块替换）
5. 保留 frontmatter 之后的正文内容不变

## 能力映射表

smart-dev-flow 自身包含所有能力，无需外部仓库：

| 能力类别 | 技能/Agent | 调用方式 |
|---------|-----------|---------|
| 需求分析 | analyst, writer, quality-reviewer | `Task(subagent_type="general-purpose", prompt="你是{角色}...")` |
| 架构设计 | architect, critic | 同上 |
| 任务规划 | planner | 同上 |
| TDD 实现 | executor, deep-executor | 同上 |
| 调试修复 | debugger + `systematic-debugging` | 同上 + `Skill("systematic-debugging")` |
| 代码审查 | quality-reviewer, security-reviewer, api-reviewer, style-reviewer | 同上 |
| 文档编写 | writer | 同上 |
| 验证 | verifier + `verification-before-completion` | 同上 + `Skill("verification-before-completion")` |
| 分支管理 | `finishing-a-development-branch`, `using-git-worktrees` | `Skill("finishing-a-development-branch")` |
| 并行执行 | `ultrawork` | `Skill("ultrawork")` |
| 持久执行 | `ralph` | `Skill("ralph")` |
| 多 agent 流水线 | `team` | `Skill("team")` |
| 知识库 | axiom_get_knowledge, axiom_harvest, axiom_evolve | MCP 工具直接调用 |

## 阶段间数据传递规范

各技能通过以下结构化上下文对象传递数据：

```json
{
  "feature": "<功能名称>",
  "phase0": {
    "acceptance_criteria": [],
    "constraints": [],
    "risks": [],
    "requirements_doc": "docs/requirements/YYYY-MM-DD-<feature>-requirements.md"
  },
  "phase1": {
    "architecture": "",
    "interfaces": [],
    "adr": "",
    "design_doc": "docs/design/YYYY-MM-DD-<feature>-design.md"
  },
  "phase2": {
    "tasks": [],
    "critical_path": [],
    "test_strategy": "",
    "plan_file": "docs/plans/YYYY-MM-DD-<feature>-plan.md"
  },
  "phase3": {
    "branch": "",
    "worktree": "",
    "skipped": false
  }
}
```

每个技能结束时将自身阶段数据写入 `.agent/memory/project_decisions.md`，供后续技能读取。

## 异常处理

| 情况 | 处理方式 |
|------|---------|
| 阶段门控失败 | 返工当前阶段，不得跳过 |
| 工具调用失败 | 查 `axiom_get_knowledge`，记录到日志 |
| 需求变更 | 返回 axiom-draft，重新澄清，更新上下文 |
| 连续 3 次失败 | 触发 Phase 5 系统调试（axiom-implement 内置） |
| 知识库无结果 | 继续执行，结束后沉淀新知识 |
| 需要回滚代码 | 调用 `axiom-rollback` → 回滚到 last_checkpoint（需用户确认） |
| 技能不可用 | 降级为主 Claude 直接执行该阶段职责，记录降级原因 |
| MCP 工具不可用 | 降级为对应 Claude agent，不阻塞流程 |
