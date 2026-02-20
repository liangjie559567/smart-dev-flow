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
