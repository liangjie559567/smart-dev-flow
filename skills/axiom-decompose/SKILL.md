---
name: axiom-decompose
description: Axiom Phase 2 任务拆解 - Manifest 生成
---

# axiom-decompose

## 流程

### 门禁：工作量评估

1. 派发 analyst agent 评估 PRD 工作量：
   ```
   Task(
     subagent_type="general-purpose",
     prompt="你是工作量评估专家。评估以下 PRD 的工作量。\n\n{PRD内容}\n\n只输出：SMALL（<1天，单文件/单函数级别）或 LARGE（≥1天）及理由（1-2句话）"
   )
   ```
- **SMALL**（< 1天）→ 跳过拆解，更新 `active_context.md`：
  ```
  task_status: IMPLEMENTING
  current_phase: Phase 3 - Implementing
  last_gate: Gate 2 (skipped decompose)
  last_updated: {timestamp}
  ```
  然后调用 `axiom-implement`
- **LARGE**（≥ 1天）→ 进入完整拆解流程

### 完整拆解流程

1. 派发 architect agent 设计系统边界和接口：
   ```
   Task(
     subagent_type="general-purpose",
     prompt="你是系统架构师（Architect）。你的任务是设计系统边界和接口规范，为实现提供清晰的技术蓝图。\n\n基于以下 PRD 设计系统边界和接口规范：\n{PRD内容}\n\n输出：\n- 模块边界（每个模块的职责和范围）\n- 接口定义（函数签名、数据结构、API 契约）\n- 关键技术决策（选型理由）\n- 依赖关系图"
   )
   ```
2. **可选 `--consensus` 模式**：同时启动 critic 挑战方案：
   ```
   Task(
     subagent_type="general-purpose",
     prompt="你是批判性审查员（Critic）。你的任务是挑战方案的假设和风险，防止过度乐观的规划。\n\n挑战以下架构方案的假设和风险：\n{architect输出}\n\n输出：\n- 被挑战的假设（每条附反驳理由）\n- 技术风险（概率 × 影响）\n- 遗漏的边界条件\n- 建议的替代方案"
   )
   ```
3. 派发 planner agent 生成任务 Manifest：
   ```
   Task(
     subagent_type="general-purpose",
     prompt="你是规划师（Planner）。基于系统设计生成详细的任务 Manifest。\n\n{architect输出}\n\n输出 Manifest 格式：\n| ID | 描述 | 优先级 | 依赖 | 预估复杂度 |\n每个任务含明确的验收标准"
   )
   ```
4. 将 Manifest 写入 `.agent/memory/manifest.md`
5. 更新 `active_context.md`
6. 展示 Manifest，等待用户确认

## Manifest 文件格式

写入路径：`.agent/memory/manifest.md`

```markdown
## Manifest - {需求标题}
生成时间：{timestamp}

### 任务列表
| ID | 描述 | 优先级 | 依赖 | 预估复杂度 |
|----|------|--------|------|-----------|
| T1 | ... | P0 | - | 低/中/高 |
| T2 | ... | P1 | T1 | 低/中/高 |

### 系统边界
{architect 输出的边界描述}

### 接口规范
{关键接口定义}
```

## active_context.md 写入格式

```
task_status: DECOMPOSING
current_phase: Phase 2 - Decomposing
last_gate: Gate 3
manifest_path: .agent/memory/manifest.md
last_updated: {timestamp}
```

## 确认流程

展示 Manifest 后等待用户回复：

- **"确认"** → 更新 `task_status: IMPLEMENTING`，调用 `axiom-implement`
- **"修改"** → 重新拆解，重新生成 Manifest
- **"取消"** → 更新 `task_status: REVIEWING`，回到 Phase 1
