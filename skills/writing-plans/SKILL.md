---
name: writing-plans
description: 在有规格或需求的多步骤任务时使用，在接触代码之前必须先编写实现计划
triggers: ["writing-plans", "制定计划", "实现计划", "任务分解"]
---

# 编写实现计划

## 概述

将需求转化为可执行的原子任务计划，每个任务遵循 5 步结构。

**核心原则：** 先计划，后编码。计划是合同，不是建议。

## 任务结构（每个任务必须包含）

```
任务 N：[标题]
1. 测试：先写什么测试？
2. 运行：预期失败（红）
3. 实现：最小代码使测试通过
4. 验证：运行测试（绿）
5. 提交：原子提交
```

## 流程

1. 读取 `.agent/memory/active_context.md` 确认当前状态
2. 读取设计文档（`docs/plans/` 下最新的设计文档）
3. 将需求分解为原子任务（每个任务 < 2 小时）
4. 为每个任务填写 5 步结构
5. 标注任务间依赖关系（哪些可并行）
6. 将计划写入 `.agent/memory/manifest.md`
7. 更新 `active_context.md`：`task_status: DECOMPOSING`，`manifest_path: .agent/memory/manifest.md`

## manifest.md 格式

```markdown
# 任务清单

## 元数据
- 创建时间：{timestamp}
- 总任务数：{N}
- 设计文档：docs/plans/{design-doc}.md

## 任务列表

### T1：{标题}
- 描述：{详细描述}
- 依赖：无
- 预估：{时间}
- 验收标准：{具体可验证的标准}

### T2：{标题}
- 描述：{详细描述}
- 依赖：T1
- 预估：{时间}
- 验收标准：{具体可验证的标准}
```

## 原子任务原则

- 每个任务只做一件事
- 任务完成后代码可编译、测试可运行
- 不超过 2 小时的工作量
- 有明确的验收标准

## 与 Axiom 集成

- 计划完成后调用 `axiom-decompose` 进行正式任务拆解
- manifest.md 是 `axiom-implement` 的输入
- 无依赖的任务标记为可并行执行
