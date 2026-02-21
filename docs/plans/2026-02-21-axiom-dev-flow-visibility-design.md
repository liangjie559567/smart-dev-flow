# 设计文档：axiom-dev-flow 阶段切换自动状态看板

日期：2026-02-21

## 需求

每次 axiom-dev-flow 进入新阶段时，自动输出状态看板，包含：
- 当前阶段进度
- 任务清单状态
- 健康指标（fail_count, rollback_count）
- 下一步预告

## 方案

**方案 B：在 axiom-dev-flow 主技能状态路由处统一注入看板输出**

### 看板格式

```
┌─ Phase 2 · 任务拆解 [DECOMPOSING] ─┐
│ ✅ Phase 0  需求澄清    完成        │
│ ✅ Phase 1  架构设计    完成        │
│ ▶  Phase 2  任务拆解    进行中      │
│ ○  Phase 4  TDD 实现   待开始      │
├─ 健康: fail=0  rollback=0 ─────────┤
│ 下一步: 选择执行引擎 → IMPLEMENTING │
└────────────────────────────────────┘
```

### 数据来源

| 字段 | 来源 |
|------|------|
| 当前阶段 | `active_context.md` → `task_status` + `current_phase` |
| 已完成阶段 | `active_context.md` → `completed_tasks` |
| 健康指标 | `active_context.md` → `fail_count`, `rollback_count` |
| 下一步预告 | 状态机硬编码映射表 |

### 状态→下一步映射表

| 当前状态 | 下一步预告 |
|---------|-----------|
| DRAFTING | PRD 确认 → CONFIRMING |
| REVIEWING | 专家评审完成 → DECOMPOSING |
| DECOMPOSING | 任务拆解完成 → 选择执行引擎 → IMPLEMENTING |
| IMPLEMENTING | 实现完成 → REFLECTING |
| REFLECTING | 知识收割完成 → IDLE |
| BLOCKED | 等待用户介入 |

### 改动范围

- **仅修改** `skills/axiom-dev-flow/SKILL.md`
- 在"状态路由"章节前新增"阶段看板规范"小节
- 不新增文件，不改动其他技能

## 验收标准

1. 每次 axiom-dev-flow 路由到非 IDLE 状态时，自动输出看板
2. 看板包含：当前阶段标识、已完成/进行中/待开始的阶段列表、fail_count、rollback_count、下一步预告
3. IDLE 状态不输出看板（避免干扰需求收集对话）
