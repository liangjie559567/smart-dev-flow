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
3. 向用户收集需求信息（见"需求收集"）
4. 派发 analyst agent 澄清需求、定义验收标准：
   ```
   Task(
     subagent_type="general-purpose",
     prompt="你是需求分析师（Analyst）。你的任务是将产品需求转化为可实现的验收标准，识别需求缺口。\n\n分析以下需求，提取验收标准和隐含约束：\n{需求描述}\n\n输出：\n- 用户故事（作为...，我希望...，以便...）\n- 验收标准列表（可测试的 pass/fail 标准）\n- 技术约束\n- 排除范围\n- 未解决的疑问"
   )
   ```
5. 派发 planner agent 生成任务大纲：
   ```
   Task(
     subagent_type="general-purpose",
     prompt="你是规划师（Planner）。你的任务是基于需求分析生成清晰可执行的工作计划。\n\n基于以下 PRD 生成任务大纲：\n{analyst输出}\n\n输出：有序任务列表，每项含：\n- 任务描述\n- 依赖关系\n- 预估复杂度（低/中/高）\n- 验收标准"
   )
   ```
6. 将结果按"PRD 写入格式"写入 `.agent/memory/project_decisions.md`
7. 按"active_context 写入格式"更新 `active_context.md`
8. 向用户展示 PRD 草稿，执行"确认流程"

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
task_status: DRAFTING
current_phase: Phase 1 - Drafting
last_gate: Gate 1
last_updated: {timestamp}
```

## 确认流程

展示 PRD 草稿后等待用户回复：

- **"确认"** → 更新 `task_status: REVIEWING`，调用 `axiom-review`
- **"取消"** → 清空本次收集内容，重新执行需求收集
