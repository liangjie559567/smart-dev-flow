# AGENTS.md - smart-dev-flow Agent 角色定义

## OMC Agents（执行层）

| 角色 | 类型 | 用途 |
|------|------|------|
| `analyst` | opus | 需求澄清、验收标准 |
| `planner` | opus | 任务拆解、执行计划 |
| `architect` | opus | 系统设计、接口定义 |
| `executor` | sonnet | 代码实现 |
| `deep-executor` | opus | 复杂自主实现 |
| `verifier` | sonnet | 完成验证 |
| `debugger` | sonnet | 根因分析 |
| `quality-reviewer` | sonnet | 代码质量审查 |
| `security-reviewer` | sonnet | 安全审查 |
| `code-reviewer` | opus | 综合审查 |

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
