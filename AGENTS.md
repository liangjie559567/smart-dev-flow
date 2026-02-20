# AGENTS.md - smart-dev-flow Agent 角色定义

smart-dev-flow 融合 oh-my-claudecode (OMC) 多智能体编排能力与 Axiom 状态机/记忆/进化引擎。

## Agent 目录（`agents/`）

| 角色 | 模型 | 用途 |
|------|------|------|
| `analyst` | opus | 需求澄清、验收标准、隐性约束 |
| `planner` | opus | 任务拆解、执行计划、风险标记 |
| `architect` | opus | 系统设计、边界定义、长期权衡 |
| `executor` | sonnet | 代码实现、重构、功能开发 |
| `deep-executor` | opus | 复杂自主目标导向任务 |
| `verifier` | sonnet | 完成验证、声明验证、测试充分性 |
| `debugger` | sonnet | 根因分析、回归隔离、故障诊断 |
| `explore` | haiku | 快速代码库模式搜索 |
| `designer` | sonnet | UI/UX、组件设计 |
| `writer` | haiku | 技术文档 |
| `critic` | opus | 计划/设计批判性审查 |
| `quality-reviewer` | sonnet | 代码质量、可维护性 |
| `security-reviewer` | sonnet/opus | 安全漏洞、信任边界 |
| `code-reviewer` | opus | 综合代码审查 |
| `build-fixer` | sonnet | 构建/类型错误修复 |
| `test-engineer` | sonnet | 测试策略、覆盖率 |
| `dependency-expert` | sonnet | 外部 SDK/API 评估 |
| `product-manager` | sonnet | 问题框架、PRD |
| `git-master` | sonnet | 提交策略、历史整理 |

## Axiom 角色（决策层）

| 角色 | 文件 | 融合映射 |
|------|------|---------|
| `tech_lead` | `.agent/prompts/roles/tech_lead.md` | OMC `architect` + `executor` |
| `critic` | `.agent/prompts/roles/critic.md` | OMC `critic` + `quality-reviewer` |
| `product_director` | `.agent/prompts/roles/product_director.md` | OMC `product-manager` + `analyst` |
| `ux_director` | `.agent/prompts/roles/ux_director.md` | OMC `designer` + `ux-researcher` |
| `domain_expert` | `.agent/prompts/roles/domain_expert.md` | OMC `dependency-expert` |
| `sub_prd_writer` | `.agent/prompts/roles/sub_prd_writer.md` | OMC `writer` + `analyst` |

## 阶段-角色映射

| Axiom 阶段 | Axiom 角色 | OMC Agents |
|-----------|-----------|-----------|
| Phase 1 Drafting | product_director | analyst, planner |
| Phase 1.5 Reviewing | critic + domain_expert | quality-reviewer, security-reviewer |
| Phase 2 Decomposing | tech_lead + sub_prd_writer | architect, planner |
| Phase 3 Implementing | tech_lead | executor × N (Team) |
| Blocked | critic | debugger |
| Reflecting | — | verifier → project-memory sync |

## 执行模式

| 模式 | 触发词 | 用途 |
|------|--------|------|
| `autopilot` | "autopilot", "build me", "I want a" | 全自主执行 |
| `ultrawork` | "ulw", "ultrawork" | 最大并行 agent 执行 |
| `ralph` | "ralph", "don't stop" | 持久执行直到任务完成 |
| `team` | "team", "coordinated team" | N 个协调 agent（Team 原生） |
| `pipeline` | "pipeline" | 顺序 agent 链式执行 |
| `ralplan` | "ralplan", "consensus plan" | 迭代规划直到共识 |

## Skills 目录（`skills/`）

Axiom 流程：`dev-flow`, `axiom-draft`, `axiom-review`, `axiom-decompose`, `axiom-implement`, `axiom-reflect`, `axiom-analyze-error`, `axiom-rollback`, `axiom-knowledge`, `axiom-patterns`, `axiom-evolve`, `axiom-export`, `axiom-feature-flow`

OMC 工作流：`autopilot`, `ultrawork`, `ralph`, `team`, `pipeline`, `plan`, `ralplan`, `tdd`, `code-review`, `security-review`, `analyze`, `deepsearch`, `deepinit`, `external-context`, `sciomc`, `ultrapilot`, `ultraqa`, `ccg`, `frontend-ui-ux`, `git-master`, `build-fix`, `cancel`, `swarm`, `review`, `ralph-init`, `configure-discord`, `configure-telegram`, `project-session-manager`, `writer-memory`

## 状态文件

| 路径 | 用途 |
|------|------|
| `.agent/memory/active_context.md` | Axiom 当前任务状态（source of truth） |
| `.agent/memory/project_decisions.md` | PRD 草稿和评审报告 |
| `.agent/memory/manifest.md` | 任务拆解清单 |
| `.omc/state/*.json` | OMC 执行模式状态（autopilot/ralph/team 等） |
| `.omc/project-memory.json` | 自动学习的项目技术栈和约定 |
| `.omc/notepad.md` | 会话记事本（priority/working/manual） |

## 关键文件

| 文件 | 用途 |
|------|------|
| `.claude-plugin/plugin.json` | 插件清单（skills 目录注册 + hooks） |
| `scripts/keyword-detector.mjs` | 关键词检测 → 激活执行模式 |
| `scripts/persistent-mode.mjs` | ralph/autopilot 持久模式核心 |
| `scripts/skill-injector.mjs` | 触发词自动注入 skill 上下文 |
| `scripts/post-tool-verifier.mjs` | `<remember>` 标签处理 + bash 失败检测 |
| `scripts/project-memory-*.mjs` | 项目记忆自动学习（PostToolUse/SessionStart/PreCompact） |
| `.agent/evolution/orchestrator.py` | Axiom 进化引擎 |
| `.agent/adapters/` | 9 个 AI 平台适配器（claude/codex/gemini/cursor 等） |
| `omc-dist/` | OMC 编译输出（hooks/notepad/project-memory/skill-bridge 等） |
