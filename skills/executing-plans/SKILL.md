---
name: executing-plans
description: 当你有一个书面实现计划需要在单独的会话中执行并带有审查检查点时使用
triggers: ["executing-plans", "执行计划", "批次执行"]
---

# 执行计划

## 概述

按批次执行 manifest.md 中的任务，每批完成后设置检查点。

**核心原则：** 批次执行 + 检查点 = 可控进度。

## 流程

1. 读取 `.agent/memory/manifest.md` 获取任务列表
2. 读取 `.agent/memory/active_context.md` 确认当前进度
3. 按批次执行（每批 3 个任务）：
   - 执行任务（遵循 TDD：先测试后实现）
   - 运行测试验证
   - 创建检查点提交
   - 更新 `active_context.md` 中的 `completed_tasks` 和 `last_checkpoint`
4. 每批完成后请求代码审查（调用 `requesting-code-review`）
5. 全部完成后调用 `finishing-a-development-branch`

## 检查点规范

每批任务完成后：
```bash
git add -A
git commit -m "检查点：完成 T{N}-T{M}"
# 将 commit SHA 写入 active_context.md 的 last_checkpoint 字段
```

## 与 Axiom 集成

- 从 `manifest.md` 读取任务，不重新分解
- 每个任务执行前调用 `test-driven-development`
- 失败时调用 `systematic-debugging`
- 更新 `active_context.md` 的 `completed_tasks` 字段
- 全部完成后调用 `verification-before-completion`，再调用 `finishing-a-development-branch`

## 禁止行为

- 跳过测试直接实现
- 不创建检查点提交
- 忽略代码审查反馈
