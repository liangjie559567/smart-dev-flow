---
name: subagent-driven-development
description: 在当前会话中执行具有独立任务的实现计划时使用
triggers: ["subagent-driven-development", "子agent开发", "会话内执行"]
---

# 子 Agent 驱动开发

## 核心原则

**每个任务派发独立 agent + 双阶段审查（规格合规 → 代码质量）= 高质量快速迭代**

## 流程

```
读取 manifest.md，提取所有任务，创建 TodoWrite
  ↓
每个任务：
  派发实现 agent（含完整任务文本和上下文）
    ↓
  agent 有问题？→ 回答后继续
    ↓
  agent 实现 + 测试 + 提交 + 自审
    ↓
  派发规格审查 agent → 通过？
    ├─ 否 → 实现 agent 修复 → 重新审查
    └─ 是 → 派发代码质量审查 agent → 通过？
              ├─ 否 → 实现 agent 修复 → 重新审查
              └─ 是 → 标记任务完成
  ↓
所有任务完成 → 派发最终代码审查 → finishing-a-development-branch
```

## 实现 Agent Prompt

```
你是执行者（Executor）。精确实现以下任务，保持最小化改动。

任务：{T_ID} - {完整任务文本}
上下文：{场景说明，任务在整体计划中的位置}

要求：
1. 遵循 TDD：先写测试（红），再实现（绿），再重构
2. 自审：完成后检查是否有遗漏
3. 提交：原子提交
4. 输出：变更文件列表 + 测试结果 + 自审结论
```

## 规格审查 Agent Prompt

```
你是规格审查员（Spec Reviewer）。验证实现是否符合规格，不多不少。

任务规格：{T_ID} 的验收标准
检查：
1. 所有验收标准是否都已实现？
2. 是否有超出规格的额外实现？

输出：✅ 规格合规 / ❌ 问题列表（缺失/多余）
```

## 代码质量审查 Agent Prompt

```
你是代码质量审查员（Quality Reviewer）。审查代码质量。

检查维度：逻辑正确性、可维护性、测试充分性、性能影响
输出：✅ 批准 / ❌ 问题列表（含文件:行号）
```

## 与 Axiom 集成

- 从 `manifest.md` 读取任务，不重新分解
- 每个任务完成后更新 `active_context.md` 的 `completed_tasks`
- 规格审查失败 → `fail_count += 1`
- `fail_count >= 3` → `task_status: BLOCKED`

## 禁止行为

- 跳过规格审查直接进行代码质量审查（顺序不可颠倒）
- 并行派发多个实现 agent（会产生冲突）
- 让 agent 自己读取计划文件（应由控制器提供完整文本）
