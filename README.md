# smart-dev-flow

**oh-my-claudecode + Axiom 深度融合的智能开发助手流程**

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/smart-dev-flow
cd smart-dev-flow

# 2. 安装
./setup.sh   # Linux/macOS
# 或
./setup.ps1  # Windows

# 3. 在你的项目中使用
/plugin marketplace add https://github.com/your-org/smart-dev-flow
/plugin install smart-dev-flow
```

## 使用

```
/dev-flow: 构建用户认证系统
```

## 核心流程

```
用户需求
  ↓
[Axiom Phase 1] 起草 PRD  ← OMC analyst + planner
  ↓ Gate 1
[Axiom Phase 1.5] 专家评审  ← OMC quality-reviewer + security-reviewer
  ↓ Gate 2
[Axiom Phase 2] 任务拆解  ← OMC architect + planner
  ↓ Gate 3
[Axiom Phase 3] 并行实现  ← OMC Team (executor × N)
  ↓ 双重验证
[Axiom /reflect] 知识沉淀  ← OMC project-memory 双写
```

## 支持的 AI Provider

Claude · Gemini · Codex · OpenCode · Copilot

## 要求

- Claude Code CLI
- Python 3.8+（进化引擎）
- Node.js 20+
