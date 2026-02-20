---
name: axiom-draft
description: Axiom Phase 1 起草 - 需求澄清与 PRD 生成
---

# axiom-draft

## 流程

1. 读取 `.agent/memory/active_context.md`，检查 `task_status`：
   - 若状态非 `IDLE`，提示用户："当前有进行中的任务（状态：{task_status}），继续起草将覆盖现有上下文。确认继续？"
   - 用户确认后继续；取消则终止
2. 执行 `.agent/workflows/1-drafting.md`
2. 向用户收集需求信息（见"需求收集"）
3. 调用 OMC `analyst`（opus）澄清需求、定义验收标准
4. 调用 OMC `planner`（opus）生成任务大纲
5. 将结果按"PRD 写入格式"写入 `.agent/memory/project_decisions.md`
6. 按"active_context 写入格式"更新 `active_context.md`
7. 向用户展示 PRD 草稿，执行"确认流程"

## 需求收集

向用户询问以下信息：

| 字段 | 是否必填 | 说明 |
|------|----------|------|
| 功能描述 | 必填 | 要实现什么功能 |
| 技术栈偏好 | 可选 | 语言、框架等偏好 |
| 验收标准 | 可选 | 未提供时由 analyst 自动推断 |

## PRD 写入格式

同时写入两个文件：

**1. `.agent/memory/project_decisions.md`（追加）：**

```markdown
## PRD - {需求标题}
生成时间：{timestamp}

### 目标
{功能描述}

### 用户故事
- 作为 {用户角色}，我希望 {功能}，以便 {价值}

### 验收标准
- [ ] {标准1}
- [ ] {标准2}

### 技术约束
{技术栈偏好或"无特殊约束"}

### 排除范围
{明确不做的内容，或"无"}
```

**2. `.agent/memory/prd-{session_name}-{timestamp}.md`（新建）：**

内容与上方相同，作为独立 PRD 文件存档。

## active_context 写入格式

```
task_status: CONFIRMING
current_phase: Phase 1 - Drafting
last_gate: Gate 1
pending_confirmation: PRD 草稿已生成，请确认后进入评审
last_updated: {timestamp}
```

## 确认流程

展示 PRD 草稿后等待用户回复：

- **"确认"** → 更新 `task_status: REVIEWING`，调用 `axiom-review`
- **"取消"** → 清空本次收集内容，重新执行需求收集
