---
name: dispatching-parallel-agents
description: 在有 2 个或以上独立任务时使用，通过并行调度多个代理最大化执行效率
triggers: ["dispatching-parallel-agents", "并行执行", "并行agent", "独立任务"]
---

# 并行调度 Agent

## 核心原则

**独立问题并行分发，每个 agent 一个域，不共享状态。**

## 何时使用

```
任务 A 和任务 B 是否共享状态？
├─ 是（读写同一文件/变量）→ 顺序执行
└─ 否 → 并行分发
```

## 并行分发模式

```javascript
// 同时启动多个独立任务
Task(subagent_type="general-purpose", prompt="任务A...", run_in_background=true)
Task(subagent_type="general-purpose", prompt="任务B...", run_in_background=true)
Task(subagent_type="general-purpose", prompt="任务C...", run_in_background=true)
// 等待所有完成后汇总结果
```

## Agent Prompt 模板

```
你是执行者（Executor）。你的任务是精确实现指定的代码变更。

任务：{T_ID} - {描述}
参考：.agent/memory/manifest.md（任务 {T_ID} 部分）

要求：
1. 最小化改动，不扩大范围
2. 遵循 TDD：先写测试，再实现
3. 完成后运行测试验证
4. 输出：变更文件列表 + 测试结果
```

## 与 Axiom 集成

- 由 `axiom-implement` 在识别到无依赖子任务时调用
- 每个并行 agent 完成后独立派发 verifier
- 所有并行任务完成后汇总进度，更新 `completed_tasks`

## 禁止行为

- 并行执行有依赖关系的任务
- 多个 agent 同时修改同一文件
- 不等待所有 agent 完成就继续下一步
