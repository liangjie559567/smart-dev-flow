---
name: requesting-code-review
description: 在完成任务、实现主要功能或合并前使用，以验证工作是否满足要求
triggers: ["requesting-code-review", "请求代码审查", "代码审查"]
---

# 请求代码审查

## 核心原则

**早审查，常审查。在问题扩散前发现它。**

## 何时请求

**必须：**
- 每个子任务完成后（subagent-driven-development 流程中）
- 完成主要功能后
- 合并到主分支前

**可选但有价值：**
- 卡住时（获取新视角）
- 重构前（建立基线）
- 修复复杂 bug 后

## 如何请求

**1. 获取 git SHA：**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # 或 origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. 派发 code-reviewer agent（使用 `code-reviewer.md` 模板）：**
```javascript
Task(
  subagent_type="superpowers:code-reviewer",
  prompt=`// 使用 skills/requesting-code-review/code-reviewer.md 模板
WHAT_WAS_IMPLEMENTED: ${WHAT_WAS_IMPLEMENTED}
PLAN_OR_REQUIREMENTS: ${PLAN_OR_REQUIREMENTS}
BASE_SHA: ${BASE_SHA}
HEAD_SHA: ${HEAD_SHA}
DESCRIPTION: ${DESCRIPTION}`
)
```

**3. 处理反馈：**
- Critical 问题：立即修复
- Important 问题：继续前修复
- Minor 问题：记录后续处理
- 审查员有误：用技术理由反驳

## 与 Axiom 集成

- 由 `axiom-implement` 在所有子任务完成后调用
- 审查通过 → 更新 `active_context.md`：`task_status: REFLECTING`
- 审查发现问题 → 派发 executor 修复后重新验证

## 禁止行为

- 因为"很简单"就跳过审查
- 忽略 Critical 问题
- 带未修复的 Important 问题继续推进
