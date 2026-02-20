---
name: axiom-decompose
description: Axiom Phase 2 任务拆解 - Manifest 生成
---

# axiom-decompose

## 流程

### 门禁：工作量评估

调用 `analyst`（haiku）评估 PRD 工作量：
- **< 1天**（单文件/单函数级别）→ 跳过拆解，直接更新 `task_status: IMPLEMENTING`，调用 `axiom-implement`
- **≥ 1天** → 进入完整拆解流程

### 完整拆解流程

1. 调用 OMC `architect`（opus）设计系统边界和接口
2. 调用 OMC `planner`（opus）生成任务 Manifest
3. 将 Manifest 写入 `.agent/memory/manifest.md`
4. 更新 `active_context.md`
5. 展示 Manifest，等待用户确认

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
