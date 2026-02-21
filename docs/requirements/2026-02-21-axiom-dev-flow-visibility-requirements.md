# 需求文档：axiom-dev-flow 阶段切换自动状态看板

日期：2026-02-21
会话：axiom-dev-flow-visibility

## 目标

每次 axiom-dev-flow 进入新阶段时，自动输出状态看板，提升流程可见性。

## 验收标准

- **AC-1**：`task_status` 变更为非 IDLE 状态时，在执行阶段动作前输出看板
- **AC-2**：看板包含四区域：阶段进度列表、当前阶段标识、健康指标、下一步预告
- **AC-3**：已完成阶段 ✅、当前阶段 ▶、未开始阶段 ○
- **AC-4**：`fail_count` / `rollback_count` 从 `active_context.md` 读取真实值
- **AC-5**：仅修改 `skills/axiom-dev-flow/SKILL.md`，不新增文件
- **AC-6**：IDLE 状态不输出看板
- **AC-7**：BLOCKED 状态输出看板，健康指标行额外显示 `blocked_reason` 摘要
- **AC-8**：REFLECTING→IDLE 时输出终态看板（全部完成）

## 看板格式

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

BLOCKED 变体：
```
├─ 健康: fail=3  rollback=1  ⚠ 阻塞: <blocked_reason摘要> ─┤
```

终态看板：
```
┌─ 🎉 全部完成 [IDLE] ───────────────┐
│ ✅ Phase 0-9  所有阶段已完成        │
├─ 健康: fail=0  rollback=0 ─────────┤
│ 知识已收割，状态已重置为 IDLE       │
└────────────────────────────────────┘
```

## 约束

- 纯 prompt 工程，SKILL.md 是 Markdown 指令文件
- 数据源唯一：`active_context.md` frontmatter
- 不影响现有状态流转和门控逻辑
- 阶段完成推断规则：当前状态隐含前序阶段已完成（显式映射表）

## 状态→已完成阶段映射

| task_status | 已完成阶段 |
|-------------|-----------|
| DRAFTING | Phase 0（若 current_phase 含 Phase 1 则 Phase 0 也完成） |
| REVIEWING | Phase 0, Phase 1 |
| DECOMPOSING | Phase 0, Phase 1, Phase 1.5 |
| IMPLEMENTING | Phase 0-3 |
| REFLECTING | Phase 0-7 |
| BLOCKED | 同进入 BLOCKED 前的状态 |

## 状态→下一步预告映射

| task_status | 下一步预告 |
|-------------|-----------|
| DRAFTING | PRD 确认 → CONFIRMING |
| REVIEWING | 专家评审完成 → DECOMPOSING |
| DECOMPOSING | 任务拆解完成 → 选择执行引擎 → IMPLEMENTING |
| IMPLEMENTING | 实现完成 → REFLECTING |
| REFLECTING | 知识收割完成 → IDLE |
| BLOCKED | 等待用户介入，选择恢复方式 |
