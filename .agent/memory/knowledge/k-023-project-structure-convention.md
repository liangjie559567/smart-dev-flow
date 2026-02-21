---
id: k-023
title: Project Structure Convention
category: architecture
tags: [project-structure, clean-architecture, folder]
created: 2026-02-09
confidence: 0.85
references: [seed-knowledge-pack-v1]
---

## Summary
smart-dev-flow 项目按职责分层组织，技能/Agent/钩子/脚本各司其职。

## Details
### 项目结构
```
smart-dev-flow/
├── skills/          # 用户可调用技能 (SKILL.md)
├── agents/          # Agent 角色定义 (.md)
├── hooks/           # Claude Code 钩子 (.cjs)
├── scripts/         # MCP 服务器入口 (.mjs)
├── bridge/          # 插件入口 + 预构建产物
├── .agent/          # Axiom 运行时
│   ├── memory/      # 状态/知识/决策
│   ├── skills/      # Axiom 内置技能
│   ├── workflows/   # 工作流定义
│   └── adapters/    # 各平台适配器
└── docs/            # 需求/设计/计划文档
```

### 关键原则
- `skills/` 对外暴露，`agents/` 内部调用
- 钩子只做状态同步和门控，不含业务逻辑
- `.agent/memory/` 是 source of truth
