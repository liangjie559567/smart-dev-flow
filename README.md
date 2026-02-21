# smart-dev-flow

OMC 执行引擎 + Axiom 状态机深度融合的 Claude Code 智能开发插件。

## 安装

```bash
# 方式一：通过插件市场安装（推荐）
/plugin marketplace add liangjie559567/smart-dev-flow
/plugin install smart-dev-flow@liangjie559567

# 方式二：本地目录加载（单次会话）
claude --plugin-dir /path/to/smart-dev-flow

# 方式三：克隆后本地加载
git clone https://github.com/liangjie559567/smart-dev-flow
claude --plugin-dir smart-dev-flow
```

**前置要求**：Node.js 20+、Claude Code CLI

## 快速开始

安装后，在 Claude Code 中输入：

```
dev-flow
```

或直接描述需求，插件会自动引导完整开发流程。

## 核心技能

| 技能 | 触发词 | 描述 |
|------|--------|------|
| `dev-flow` | `dev-flow`、`开始开发` | 完整智能开发流程（需求→架构→实现→验证） |
| `brainstorming` | `brainstorm`、`头脑风暴` | 需求澄清与设计探索 |
| `axiom-draft` | `draft`、`起草需求` | PRD 起草 |
| `axiom-review` | `review prd` | 多维度专家评审 |
| `axiom-decompose` | `decompose`、`拆解任务` | 任务拆解 |
| `axiom-implement` | `implement`、`开始实现` | 多 Agent 并行实现 |
| `axiom-reflect` | `reflect`、`复盘` | 知识沉淀 |
| `team` | `team`、`coordinated team` | 多 Agent 协作 |
| `ralph` | `ralph`、`don't stop` | 持久化执行直到完成 |
| `ultrawork` | `ultrawork`、`ulw` | 最大并行度执行 |
| `systematic-debugging` | `debug`、`analyze` | 系统化调试 |
| `code-review` | `review code` | 代码审查 |
| `security-review` | `security review` | 安全审查 |

## 状态流转

```
IDLE → DRAFTING → CONFIRMING → REVIEWING → CONFIRMING
                                                ↓
IDLE ← REFLECTING ← IMPLEMENTING ← CONFIRMING ← DECOMPOSING
```

每个 `CONFIRMING` 节点为人工确认门控。

## 快捷命令

- `/dev-flow` — 启动完整开发流程
- `/axiom-start` — 恢复上次会话状态
- `/axiom-status` — 查看当前阶段与任务进度
- `/axiom-reflect` — 手动触发知识沉淀
- `/axiom-rollback` — 回滚到检查点
- `/axiom-knowledge [词]` — 查询知识库
- `/axiom-suspend` — 挂起当前会话

## 架构

```
smart-dev-flow/
├── skills/          # 70+ 技能定义（SKILL.md）
├── hooks/           # Claude Code 钩子（状态同步、门控）
│   ├── session-start.cjs
│   └── post-tool-use.cjs
├── scripts/         # MCP 服务器
│   └── mcp-axiom-server.mjs
├── agents/          # Agent 角色定义
└── .agent/          # Axiom 运行时（状态/记忆/知识库）
```

## 测试

```bash
npm test              # 运行全部测试（47个）
npm run test:unit     # 单元测试
npm run test:integration  # 集成测试
```

## 依赖

本插件与 [oh-my-claudecode](https://github.com/oh-my-claudecode/oh-my-claudecode) 生态兼容，可与其技能协同使用。
