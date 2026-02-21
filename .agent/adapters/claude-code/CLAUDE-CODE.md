# Axiom — Claude Code 适配器
# Provider: Claude Code
# Version: 4.4 | Updated: 2026-02-21

## 0. 强制规则
- 语言: 中文。
- 风格: 极简，不解释显而易见内容。
- 任务完成后: 先验证再宣告完成。

## 1. 启动协议
1. 读取 `.agent/memory/active_context.md`，检查 `task_status`。
2. 加载项目决策（`project_decisions.md`）与用户偏好。
3. 按用户意图触发对应技能（`/smart-dev-flow:<skill>`）。

## 2. 能力映射
- 文件读取: `Read`
- 文件修改: `Edit` / `Write`
- 搜索: `Grep` / `Glob`
- 命令执行: `Bash`
- 子代理: `Task(subagent_type="general-purpose")`
- MCP 工具: `t`（OMC）、`x`（Codex）、`g`（Gemini）、`a`（Axiom，20个工具）

## 3. 推荐执行策略
- 先定位后读取再编辑。
- 改动后执行：`npm test`（76 个测试）。
- 大任务拆分为原子步骤，逐步验证。
- CONFIRMING 状态时禁止 Write/Edit/Bash/Task，等待用户确认。

## 4. 状态感知
| task_status | 行为 |
|-------------|------|
| IDLE | 引导用户描述需求，触发 dev-flow |
| DRAFTING | 继续 Phase 1，调用 analyst |
| REVIEWING | 继续 Phase 1.5，调用 quality-reviewer |
| DECOMPOSING | 继续 Phase 2，调用 architect |
| IMPLEMENTING | 继续 Phase 3，调用 executor × N |
| CONFIRMING | 等待用户确认，不执行任何实现操作 |
| BLOCKED | 调用 debugger + axiom-analyze-error |
| REFLECTING | 执行 /reflect + /evolve，同步 project-memory |

_Axiom — Claude Code Adapter_
