---
description: 待学习队列 - 记录待提取和处理的学习素材
version: 1.0
last_updated: 2026-02-21
---

# Learning Queue (待学习队列)

记录待处理的学习素材，由 Knowledge Harvester 在空闲时处理。

## 1. 队列状态

| Metric | Value |
|--------|-------|
| 待处理 | 7 |
| 处理中 | 0 |
| 今日已处理 | 0 |

## 2. 待学习素材 (Pending Items)

| ID | Source Type | Source ID | Priority | Created | Status |
|----|-------------|-----------|----------|---------|--------|
| LQ-001 | conversation | reflect-test | P2 | 2026-02-21 | pending |
| LQ-002 | conversation | reflect-test | P2 | 2026-02-21 | pending |
| LQ-003 | conversation | reflect-test | P2 | 2026-02-21 | pending |
| LQ-004 | conversation | reflect-test | P2 | 2026-02-21 | pending |
| LQ-005 | conversation | reflect-test | P2 | 2026-02-21 | pending |
| LQ-006 | conversation | reflect-test | P2 | 2026-02-21 | pending |
| LQ-007 | conversation | reflect-test | P2 | 2026-02-21 | pending |

### Source Types
- `conversation`: 对话记录
- `code_change`: 代码变更
- `error_fix`: 错误修复
- `workflow_run`: 工作流执行
- `user_feedback`: 用户反馈

### Priority Levels
- `P0`: 立即处理（重大发现）
- `P1`: 高优先级（成功经验）
- `P2`: 正常处理
- `P3`: 低优先级（可选）

## 3. 处理规则

### 3.1 自动入队触发器
- 任务完成后 → 添加 `code_change` 素材
- 错误修复后 → 添加 `error_fix` 素材
- 工作流完成 → 添加 `workflow_run` 素材

### 3.2 处理时机
- 状态变为 IDLE 时处理队列
- `/evolve` 命令强制处理

### 3.3 处理流程
```
1. 按优先级排序 (P0 > P1 > P2 > P3)
2. 逐条分析素材内容
3. 提取知识条目或代码模式
4. 标记为已处理
5. 7 天后自动清理已处理条目
```
