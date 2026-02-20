# skills

smart-dev-flow 技能库 — Axiom 状态机 + OMC 多智能体编排融合系统。

## 调用方式

```bash
# 手动调用
/smart-dev-flow:skill-name

# 带参数
/smart-dev-flow:skill-name arg1 arg2
```

## Axiom 开发流程技能

| 技能 | 触发词 | 功能 |
|------|--------|------|
| `dev-flow/SKILL.md` | "dev-flow", "开始开发" | 主入口，状态机路由 |
| `axiom-draft/SKILL.md` | "draft", "起草需求" | Phase 0+1 需求澄清+架构设计 |
| `axiom-review/SKILL.md` | "review prd" | Phase 1.5 critic+5专家评审 |
| `axiom-decompose/SKILL.md` | "decompose", "拆解任务" | Phase 2+3 任务拆解+隔离开发 |
| `axiom-implement/SKILL.md` | "implement", "开始实现" | Phase 3-7 TDD+审查+验证 |
| `axiom-reflect/SKILL.md` | "reflect", "复盘" | Phase 8+9 合并+知识收割 |
| `axiom-start/SKILL.md` | "/start" | 零触感启动，恢复上下文 |
| `axiom-status/SKILL.md` | "/status" | 查询当前状态 |
| `axiom-suspend/SKILL.md` | "/suspend" | 会话挂起 |
| `axiom-rollback/SKILL.md` | "/rollback" | 回滚到检查点 |
| `axiom-analyze-error/SKILL.md` | "/analyze-error" | 错误根因分析 |
| `axiom-knowledge/SKILL.md` | "/knowledge [词]" | 查询知识库 |
| `axiom-patterns/SKILL.md` | "/patterns [词]" | 查询模式库 |

## OMC 执行模式技能

| 技能 | 触发词 | 功能 |
|------|--------|------|
| `autopilot/SKILL.md` | "autopilot", "build me" | 全自动端到端执行 |
| `ultrapilot/SKILL.md` | "ultrapilot", "parallel build" | 并行 autopilot，文件所有权分区，最多 5 个 worker |
| `ultrawork/SKILL.md` | "ulw", "ultrawork" | 最大并行 agent 执行 |
| `ralph/SKILL.md` | "ralph", "don't stop" | 持久循环直到完成 |
| `team/SKILL.md` | "team" | N 个协调 agent 流水线 |
| `swarm/SKILL.md` | "swarm" | team 的兼容别名，路由到 team 流水线 |
| `pipeline/SKILL.md` | "pipeline" | 顺序 agent 链 |
| `ultraqa/SKILL.md` | "ultraqa" | QA 测试-修复循环 |

## 规划技能

| 技能 | 触发词 | 功能 |
|------|--------|------|
| `plan/SKILL.md` | "plan this" | 战略规划 |
| `ralplan/SKILL.md` | "ralplan" | Planner+Architect+Critic 共识规划 |
| `brainstorming/SKILL.md` | "brainstorm" | 需求设计审批（IDLE 硬门控） |
| `writing-plans/SKILL.md` | "write plan" | 生成实现计划文档 |

## 代码质量技能

| 技能 | 触发词 | 功能 |
|------|--------|------|
| `code-review/SKILL.md` | "review code" | 综合代码审查 |
| `security-review/SKILL.md` | "security review" | 安全漏洞检测 |
| `tdd/SKILL.md` | "tdd", "test first" | TDD 工作流 |
| `test-driven-development/SKILL.md` | — | TDD Red→Green→Refactor |
| `systematic-debugging/SKILL.md` | "debug", "analyze" | 系统化调试根因分析 |
| `build-fix/SKILL.md` | "fix build" | 修复构建和类型错误 |
| `verification-before-completion/SKILL.md` | — | 完成前验证（证据驱动） |

## 工作流技能

| 技能 | 触发词 | 功能 |
|------|--------|------|
| `using-git-worktrees/SKILL.md` | — | 创建隔离 git worktree |
| `finishing-a-development-branch/SKILL.md` | — | 分支收尾（merge/PR/cleanup） |
| `requesting-code-review/SKILL.md` | — | 请求代码审查 |
| `receiving-code-review/SKILL.md` | — | 接收并处理代码审查 |
| `subagent-driven-development/SKILL.md` | — | 子 agent 驱动开发 |
| `dispatching-parallel-agents/SKILL.md` | — | 并行 agent 分发 |
| `executing-plans/SKILL.md` | — | 执行实现计划 |

## 工具技能

| 技能 | 触发词 | 功能 |
|------|--------|------|
| `deepinit/SKILL.md` | "deepinit" | 生成层级化 AGENTS.md |
| `deepsearch/SKILL.md` | "search" | 深度代码库搜索 |
| `sciomc/SKILL.md` | "sciomc", "research" | 并行科学家 agent 综合分析，支持 AUTO 模式 |
| `ccg/SKILL.md` | "ccg", "claude-codex-gemini" | Claude+Codex+Gemini 三模型并行编排 |
| `external-context/SKILL.md` | "/research" | 并行网页搜索 |
| `hud/SKILL.md` | "/hud" | 任务状态仪表盘 |
| `cancel/SKILL.md` | "stop", "cancel" | 取消活跃执行模式 |
| `learner/SKILL.md` | — | 从会话提取可复用技能 |
| `omc-doctor/SKILL.md` | "/doctor" | 诊断环境配置问题 |
| `git-master/SKILL.md` | git 操作 | Git 专家，原子提交 |
| `frontend-ui-ux/SKILL.md` | UI/组件工作 | 设计师-开发者协作 |

## 技能模板格式

```markdown
---
name: skill-name
description: 简短描述
triggers: ["keyword1", "keyword2"]
---

# Skill Name

## 流程
1. 步骤一
2. 步骤二
```

## 自动激活规则

| 技能 | 自动触发条件 |
|------|------------|
| `dev-flow` | "dev-flow", "开始开发", "全流程" |
| `brainstorming` | IDLE 状态下收到新功能请求（硬门控） |
| `autopilot` | "autopilot", "build me", "I want a" |
| `ultrapilot` | "ultrapilot", "parallel build", "parallel autopilot" |
| `ultrawork` | "ulw", "ultrawork" |
| `ralph` | "ralph", "don't stop until" |
| `swarm` | "swarm"（路由到 team） |
| `sciomc` | "sciomc", "research", "分析" |
| `ccg` | "ccg", "claude-codex-gemini" |
| `frontend-ui-ux` | 检测到 UI/组件工作 |
| `git-master` | 检测到 git 操作 |
| `cancel` | "stop", "cancel", "abort" |
