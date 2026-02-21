# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 安装与启动

```bash
# Linux/macOS
./setup.sh

# Windows
.\setup.ps1

# 注册插件
claude plugin install .
```

前置要求：Node.js 20+、Python 3.8+

## 构建命令

```bash
# 构建所有 MCP 服务器
npm run build

# 单独构建
npm run build:codex    # Codex MCP 服务器
npm run build:gemini   # Gemini MCP 服务器
npm run build:mcp      # OMC 工具服务器
```

```bash
# 运行所有测试
npm test

# 单元测试
npm run test:unit

# 集成测试
npm run test:integration
```

验证技能：`claude plugin install .` 后手动测试。

## 架构概览

本项目是 **OMC 执行引擎 + Axiom 状态机** 的融合框架，作为 Claude Code 插件运行。

**核心层次：**
- `skills/` — 用户可调用的技能（每个子目录含 `SKILL.md` 定义），通过 `/smart-dev-flow:<name>` 触发
- `agents/` — Agent 角色定义（`analyst.md`, `executor.md` 等），通过 `Task()` 内联调用
- `hooks/` — Claude Code 钩子，负责状态同步和门控：
  - `pre-tool-use.cjs` — 状态机门禁，CONFIRMING 状态时拦截 Write/Edit/Bash/Task
  - `post-tool-use.cjs` — 进化引擎，监听 `.agent/memory/` 写入并同步到 `.omc/project-memory.json`
  - `user-prompt-submit.cjs` — 用户提交时注入上下文
  - `rules-injector.cjs` — 注入路由规则
  - `session-end.cjs`, `stop.cjs`, `recovery.cjs` — 会话生命周期管理
- `scripts/` — MCP 服务器（`mcp-axiom-server.mjs`, `mcp-omc-tools-server.mjs`, `mcp-codex-server.mjs`, `mcp-gemini-server.mjs`）和辅助脚本（`evolve.py`）
- `bridge/` — 插件入口（`smart-dev-bridge.cjs`）和预构建 MCP 服务器（`mcp-server.cjs`, `codex-server.cjs`, `gemini-server.cjs`）
- `.agent/` — Axiom 运行时：`memory/`（状态/知识/决策）、`skills/`（Axiom 内置技能）、`rules/`（路由规则）

**状态流转（`.agent/memory/active_context.md` 中的 `task_status`）：**
```
IDLE → DRAFTING → CONFIRMING → REVIEWING → CONFIRMING → DECOMPOSING → IMPLEMENTING → REFLECTING → IDLE
```

**双写机制：** `post-tool-use.cjs` 监听 Write/Edit 操作，将 `.agent/memory/` 变更自动同步到 `.omc/project-memory.json`。

**MCP 服务器（`.mcp.json`）：**
- `t` — OMC 工具服务器（状态读写、notepad、project-memory）
- `x` — Codex 代理服务器
- `g` — Gemini 代理服务器
- `a` — Axiom 工具服务器（axiom_harvest、axiom_get_knowledge、phase_context_write 等 20 个工具）

# smart-dev-flow 开发准则

## 记忆优先原则（强制）

每次新会话的第一条消息，或用户说"继续"/"开始"/"早"时：
1. 静默读取 `.agent/memory/active_context.md`
2. 检查 `task_status` 字段
3. 根据状态给出建议（参见状态感知章节）
4. 如有未完成任务，主动提示"检测到未完成任务，是否继续？"

## 核心原则

本项目融合 oh-my-claudecode (OMC) 多智能体编排能力与 Axiom 状态机/记忆/进化引擎。

## 状态感知

每次响应前，检查 `.agent/memory/active_context.md` 中的 `task_status`：

- `IDLE` → 引导用户描述需求，触发 `/dev-flow`
- `DRAFTING` → 继续 Axiom Phase 1，调用 OMC `analyst`
- `REVIEWING` → 继续 Axiom Phase 1.5，调用 OMC `quality-reviewer`
- `DECOMPOSING` → 继续 Axiom Phase 2，调用 OMC `architect`
- `IMPLEMENTING` → 继续 Axiom Phase 3，调用 OMC Team `executor`
- `CONFIRMING` → 等待用户确认，不执行任何实现操作
- `BLOCKED` → 调用 OMC `debugger` + Axiom `/analyze-error` 并联排查
- `REFLECTING` → 执行 Axiom `/reflect` + `/evolve`，同步到 OMC project-memory

## 记忆优先级

1. **主**: `.agent/memory/` (Axiom) — source of truth
2. **辅**: `.omc/` (OMC) — 只读镜像，由 post-tool-use hook 自动同步

## Provider 路由

遵循 `.agent/rules/provider_router.rule`，OMC model routing 作为 fallback。

## Agent 调用

使用 Claude Code 原生 `Task(subagent_type="general-purpose")` 派发 agent，将 `agents/` 目录中的角色定义内联到 prompt 中：

```
Task(
  subagent_type="general-purpose",
  prompt="你是{角色名}。{agents/{role}.md 中的角色定义}\n\n任务：{具体任务}"
)
```

可用角色（`agents/` 目录）：
- 分析/规划: `analyst`, `planner`, `architect`, `critic`
- 实现: `executor`, `deep-executor`
- 审查: `code-reviewer`, `quality-reviewer`, `security-reviewer`
- 调试: `debugger`
- 验证: `verifier`

---

<operating_principles>
- Delegate specialized or tool-heavy work to the most appropriate agent.
- Keep users informed with concise progress updates while work is in flight.
- Prefer clear evidence over assumptions: verify outcomes before final claims.
- Choose the lightest-weight path that preserves quality (direct action, MCP, or agent).
- Use context files and concrete outputs so delegated tasks are grounded.
- Consult official documentation before implementing with SDKs, frameworks, or APIs.
</operating_principles>

<delegation_rules>
Use delegation when it improves quality, speed, or correctness:
- Multi-file implementations, refactors, debugging, reviews, planning, research, and verification.
- Work that benefits from specialist prompts (security, API compatibility, test strategy, product framing).
- Independent tasks that can run in parallel.

Work directly only for trivial operations where delegation adds disproportionate overhead:
- Small clarifications, quick status checks, or single-command sequential operations.

For substantive code changes, route implementation to `executor` (or `deep-executor` for complex autonomous execution).

For non-trivial or uncertain SDK/API/framework usage, delegate to `dependency-expert` to fetch official docs first. Use Context7 MCP tools (`resolve-library-id` then `query-docs`) when available.
</delegation_rules>

<model_routing>
Pass `model` on Task calls to match complexity:
- `haiku`: quick lookups, lightweight scans, narrow checks
- `sonnet`: standard implementation, debugging, reviews
- `opus`: architecture, deep analysis, complex refactors
</model_routing>

<agent_catalog>
Use `smart-dev-flow:` prefix for Task subagent types.

Build/Analysis Lane:
- `explore` (haiku): internal codebase discovery, symbol/file mapping
- `analyst` (opus): requirements clarity, acceptance criteria, hidden constraints
- `planner` (opus): task sequencing, execution plans, risk flags
- `architect` (opus): system design, boundaries, interfaces, long-horizon tradeoffs
- `debugger` (sonnet): root-cause analysis, regression isolation, failure diagnosis
- `executor` (sonnet): code implementation, refactoring, feature work
- `deep-executor` (opus): complex autonomous goal-oriented tasks
- `verifier` (sonnet): completion evidence, claim validation, test adequacy

Review Lane:
- `style-reviewer` (haiku): formatting, naming, idioms, lint conventions
- `quality-reviewer` (sonnet): logic defects, maintainability, anti-patterns
- `api-reviewer` (sonnet): API contracts, versioning, backward compatibility
- `security-reviewer` (sonnet): vulnerabilities, trust boundaries, authn/authz
- `performance-reviewer` (sonnet): hotspots, complexity, memory/latency optimization
- `code-reviewer` (opus): comprehensive review across concerns

Domain Specialists:
- `dependency-expert` (sonnet): external SDK/API/package evaluation
- `test-engineer` (sonnet): test strategy, coverage, flaky-test hardening
- `build-fixer` (sonnet): build/toolchain/type failures
- `designer` (sonnet): UX/UI architecture, interaction design
- `writer` (haiku): docs, migration notes, user guidance
- `qa-tester` (sonnet): interactive CLI/service runtime validation
- `scientist` (sonnet): data/statistical analysis
- `document-specialist` (sonnet): external documentation & reference lookup
- `git-master` (sonnet): commit strategy, history hygiene

Product Lane:
- `product-manager` (sonnet): problem framing, personas/JTBD, PRDs
- `ux-researcher` (sonnet): heuristic audits, usability, accessibility
- `critic` (opus): plan/design critical challenge
</agent_catalog>

<team_compositions>
Feature Development:
  `analyst` -> `planner` -> `executor` -> `test-engineer` -> `quality-reviewer` -> `verifier`

Bug Investigation:
  `explore` + `debugger` + `executor` + `test-engineer` + `verifier`

Code Review:
  `style-reviewer` + `quality-reviewer` + `api-reviewer` + `security-reviewer`
</team_compositions>

<team_pipeline>
Team is the default multi-agent orchestrator: `team-plan -> team-prd -> team-exec -> team-verify -> team-fix (loop)`

- `team-plan`: `explore` (haiku) + `planner` (opus)
- `team-prd`: `analyst` (opus)
- `team-exec`: `executor` (sonnet) + specialists
- `team-verify`: `verifier` (sonnet) + reviewers
- `team-fix`: `executor`/`build-fixer`/`debugger`
</team_pipeline>

<verification>
Verify before claiming completion. The goal is evidence-backed confidence, not ceremony.

- Small changes (<5 files, <100 lines): `verifier` with `model="haiku"`
- Standard changes: `verifier` with `model="sonnet"`
- Large or security/architectural changes (>20 files): `verifier` with `model="opus"`
</verification>

<skills>
Skills are user-invocable commands (`/smart-dev-flow:<name>`). When you detect trigger patterns, invoke the corresponding skill.

Axiom Flow:
- `dev-flow` ("dev-flow", "开始开发"): 完整 Axiom 开发流程
- `axiom-draft` ("draft", "起草需求"): Phase 1 需求起草
- `axiom-review` ("review prd"): Phase 1.5 专家评审
- `axiom-decompose` ("decompose", "拆解任务"): Phase 2 任务拆解
- `axiom-implement` ("implement", "开始实现"): Phase 3 实现
- `axiom-reflect` ("reflect", "复盘"): 知识沉淀

OMC Workflow Skills:
- `autopilot` ("autopilot", "build me", "I want a"): full autonomous execution
- `ralph` ("ralph", "don't stop", "must complete"): persistence until task completion
- `ultrawork` ("ulw", "ultrawork"): maximum parallelism
- `ultraqa` ("ultraqa"): 实现后密集 QA 循环直到质量达标
- `team` ("team", "coordinated team"): N coordinated agents
- `pipeline` ("pipeline", "chain agents"): sequential agent chaining
- `plan` ("plan this", "plan the"): strategic planning
- `ralplan` ("ralplan", "consensus plan"): iterative planning with consensus
- `tdd` ("tdd", "test first"): test-driven development
- `code-review` ("review code"): code review
- `security-review` ("security review"): security audit
- `analyze` ("analyze", "debug", "investigate"): root cause analysis
- `deepsearch` ("search", "find in codebase"): codebase search
- `frontend-ui-ux`: UI/UX design
- `git-master`: git/commit work

MCP Delegation:
- `ask codex` / `use codex` -> `ask_codex`
- `ask gemini` / `use gemini` -> `ask_gemini`

Notifications: `configure-discord`, `configure-telegram`
</skills>

<hooks_and_context>
Hooks inject context via `<system-reminder>` tags. Recognize these patterns:
- `hook success: Success` -- proceed normally
- `hook additional context: ...` -- read it; the content is relevant to your current task
- `[MAGIC KEYWORD: ...]` -- invoke the indicated skill immediately
- `The boulder never stops` -- you are in ralph/ultrawork mode; keep working

Context Persistence:
  Use `<remember>info</remember>` to persist information for 7 days, or `<remember priority>info</remember>` for permanent persistence.
</hooks_and_context>

<cancellation>
Hooks cannot read your responses -- they only check state files. You need to invoke `/smart-dev-flow:cancel` to end execution modes.

When to cancel: all tasks done and verified, work is blocked, user says "stop".
When not to cancel: a stop hook fires but work is still incomplete.
</cancellation>

<worktree_paths>
- `{worktree}/.agent/memory/` -- Axiom 状态和记忆（source of truth）
- `{worktree}/.omc/state/` -- OMC 执行模式状态
- `{worktree}/.omc/notepad.md` -- session notepad
- `{worktree}/.omc/project-memory.json` -- 自动学习的项目记忆
</worktree_paths>
