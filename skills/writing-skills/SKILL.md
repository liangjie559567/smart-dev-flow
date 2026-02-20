---
name: writing-skills
description: 在创建新技能、编辑现有技能或在部署前验证技能是否有效时使用
triggers: ["writing-skills", "创建技能", "编写技能", "技能开发"]
---

# 编写技能

## 核心原则

**编写技能就是将 TDD 应用于流程文档。先写测试（压力场景），再写技能文档。**

## 技能文件结构

```
skills/
  技能名/
    SKILL.md    # 主文档（必须）
    辅助文件.*  # 仅在需要时添加
```

## SKILL.md 格式

```markdown
---
name: 技能名（只用字母、数字、连字符）
description: 在[具体触发条件]时使用（不描述流程，只描述触发时机）
triggers: ["关键词1", "关键词2"]
---

# 技能名

## 概述
这是什么？1-2 句核心原则。

## 检查清单（如有）
- [ ] 步骤 1
- [ ] 步骤 2

## 流程
[决策流程图或步骤列表]

## 与 Axiom 集成
[如何与状态机和 active_context.md 交互]

## 禁止行为
[明确列出不允许的操作]
```

## 关键规则

**description 字段：**
- 只描述"何时使用"，不描述"如何使用"
- 以"在...时使用"开头
- 不总结技能的流程或工作方式

**triggers 字段：**
- 列出用户可能输入的关键词
- skill-injector 用这些词自动注入技能

## TDD 循环（适用于技能创建）

```
红（RED）：在没有技能的情况下运行压力场景，记录 agent 的行为
绿（GREEN）：编写解决这些具体问题的最小技能文档
重构（REFACTOR）：发现新的合理化借口 → 添加明确的反驳 → 重新测试
```

## 与 smart-dev-flow 集成

- 技能文件放在 `skills/{技能名}/SKILL.md`
- skill-injector 自动扫描 `skills/` 目录（递归）
- triggers 字段用于关键词匹配注入
- 新技能创建后更新 `session-start.cjs` 的 SKILL_HINT（如需状态感知推荐）
