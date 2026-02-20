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
