# smart-dev-flow v1.5.0

OMC 执行引擎 + Axiom 状态/记忆/学习引擎深度融合的智能开发助手流程。

## 安装

**前置要求**：Node.js 20+、Python 3.8+

```bash
git clone https://github.com/your-org/smart-dev-flow
cd smart-dev-flow

./setup.sh        # Linux/macOS
.\setup.ps1       # Windows
```

## 快速开始

在 Claude Code 中注册插件：

```bash
claude plugin install .
```

使用：

```
/dev-flow: 描述你的需求
```

## 技能列表

| 技能 | 描述 |
|------|------|
| `prd-draft` | 根据需求自动起草 PRD 文档 |
| `expert-review` | 多维度专家评审（质量/安全/性能） |
| `task-decompose` | 将 PRD 拆解为可并行执行的子任务 |
| `parallel-impl` | 多 Agent 并行实现所有子任务 |
| `dual-verify` | 双重验证：自动测试 + AI 审查 |
| `reflect` | 执行后知识沉淀，写入项目记忆 |
| `status` | 查看当前状态机阶段与任务进度 |
| `axiom-start` | 零触感启动 |
| `axiom-suspend` | 会话挂起 |
| `axiom-analyze-error` | 错误分析三出口 |
| `axiom-rollback` | 回滚检查点 |
| `axiom-knowledge` | 查询知识库 |
| `axiom-patterns` | 查询模式库 |

## 工作流程

```
IDLE → DRAFTING → CONFIRMING → REVIEWING → CONFIRMING
                                                 ↓
IDLE ← REFLECTING ← IMPLEMENTING ← CONFIRMING ← DECOMPOSING
```

每个 `CONFIRMING` 节点为人工确认门控，可继续或退回修改。

## 快捷命令

- `/status` — 查看当前阶段、任务列表与进度
- `/reflect` — 手动触发知识沉淀（写入项目记忆）
- `/reset` — 重置状态机至 IDLE
- `/start` — 零触感启动
- `/suspend` — 会话挂起
- `/analyze-error` — 错误分析
- `/rollback` — 回滚检查点
- `/knowledge [词]` — 查询知识库
- `/patterns [词]` — 查询模式库

## 目录结构

```
smart-dev-flow/
├── skills/     # 各阶段技能实现（prd-draft、reflect 等）
├── hooks/      # 状态机钩子（门控逻辑、阶段转换）
├── scripts/    # setup.sh / setup.ps1 安装脚本
└── .agent/     # Axiom 状态文件、项目记忆、学习日志
```
