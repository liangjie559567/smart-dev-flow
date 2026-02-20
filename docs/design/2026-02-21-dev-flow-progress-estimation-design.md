# 系统设计文档：dev-flow 阶段进度估算

**文档版本**：1.0  
**生成时间**：2026-02-21  
**作者**：Claude Code  
**状态**：设计阶段

---

## 1. 架构概览

### 1.1 修改范围
- **目标文件**：`scripts/status.py`
- **修改类型**：功能增强（新增阶段进度显示）
- **代码量**：约 25 行新增代码
- **依赖变化**：无新 import

### 1.2 设计目标
在现有仪表盘基础上，增加"阶段进度"显示模块，将 `.agent/memory/active_context.md` 中的 `task_status` 和 `current_phase` 字段映射为用户友好的进度百分比。

---

## 2. 模块设计

### 2.1 常量定义：PHASE_PROGRESS

```python
PHASE_PROGRESS = [
    ('phase 1.5', ('Phase 1.5 - Reviewing',  40)),
    ('phase 3',   ('Phase 3 - Done',        95)),
    ('phase 2',   ('Phase 2 - Decomposing',  55)),
    ('phase 1',   ('Phase 1 - Drafting',     30)),
    ('phase 0',   ('Phase 0 - Understanding', 10)),
    ('reflecting', ('REFLECTING',            100)),
]
```

**设计说明**：
- `phase 1.5` 必须排在 `phase 1` 之前以避免误匹配；其余顺序按阶段编号降序排列
- 实现**最长前缀优先匹配**，避免 "phase 1" 误匹配 "phase 1.5"
- 每条记录为 `(前缀, (显示名, 百分比))` 元组
- 单一数据源原则（AC-4），所有映射关系集中在此

**百分比含义**：
- Phase 0 (10%)：需求理解初期
- Phase 1 (30%)：需求起草中
- Phase 1.5 (40%)：专家评审中
- Phase 2 (55%)：任务拆解中
- Phase 3 (95%)：实现执行中
- REFLECTING (100%)：知识沉淀完成

### 2.2 函数设计：resolve_phase

**签名**：
```python
def resolve_phase(task_status: str, raw_phase: str) -> Tuple[str, int]:  # from typing import Tuple（Python 3.8 兼容）
    """
    将 task_status 和 current_phase 字段解析为阶段显示名和进度百分比。

    参数：
        task_status: 来自 active_context.md 的 task_status 字段
        raw_phase: 来自 active_context.md 的 current_phase 字段

    返回：
        (显示名, 百分比) 元组
    """
```

**降级规则**（按优先级）：

| 优先级 | 条件 | 返回值 | 说明 |
|--------|------|--------|------|
| 1 | `task_status.lower()` 为 `'idle'`、空字符串或不在已知枚举值（IDLE/DRAFTING/CONFIRMING/REVIEWING/DECOMPOSING/IMPLEMENTING/REFLECTING/BLOCKED）内 | `('未知阶段', 0)` | 无活跃任务或未知状态 |
| 2 | `raw_phase` 为空或 '—' | `('未知阶段', 0)` | 阶段信息缺失 |
| 3 | `raw_phase` 最长前缀匹配 PHASE_PROGRESS | `(显示名, 百分比)` | 正常匹配 |
| 4 | 无匹配 | `('未知阶段', 0)` | 未知阶段 |

**实现伪代码**：
```
KNOWN_STATUSES = {'idle', 'drafting', 'confirming', 'reviewing', 'decomposing', 'implementing', 'reflecting', 'blocked'}
1. 若 task_status.lower() 不在 KNOWN_STATUSES 中，或 task_status.lower() == 'idle' → 返回 ('未知阶段', 0)
2. 若 raw_phase 为空或 '—' → 返回 ('未知阶段', 0)
3. 对 PHASE_PROGRESS 中每条记录：
   - 若 raw_phase.lower() 以该前缀开头 → 返回对应 (显示名, 百分比)
4. 若无匹配 → 返回 ('未知阶段', 0)
```

### 2.3 输出格式

**核心输出**（AC-5 要求的纯文本两行）：

```
当前阶段：Phase 1 - Drafting
完成进度：30%
```

**仪表盘集成格式**（在现有仪表盘 print 语句末尾追加两行，作为仪表盘的一部分）：

```
## 📈 阶段进度
当前阶段：Phase 1 - Drafting
完成进度：30%
```

> 说明：两行纯文本是核心输出契约（AC-5）；`## 📈 阶段进度` 标题行仅用于仪表盘 Markdown 渲染，不属于 AC-5 验收范围。

---

## 3. 架构决策记录（ADR）

### ADR-1：查找表优于条件分支
**决策**：使用 `PHASE_PROGRESS` 查找表而非 if-elif 链。

**理由**：
- 数据驱动设计，单一数据源（AC-4）
- 易于维护和扩展（新增阶段仅需修改常量）
- 避免条件分支爆炸

**权衡**：查找表需要手工维护映射关系，但收益大于成本。

---

### ADR-2：最长前缀优先匹配
**决策**：按业务逻辑排列前缀，实现最长前缀优先匹配，并对输入做 `.lower()` 大小写归一化处理。

**理由**：
- 避免 "phase 1" 误匹配 "phase 1.5"
- 兼容后缀变化（如 "phase 1.5-review" 仍能匹配 "phase 1.5"）
- 大小写不敏感（需求文档第57行），兼容 "PHASE 1"、"Phase 1" 等变体
- 符合 Axiom 阶段命名约定

**实现**：
```python
for prefix, (display_name, percentage) in PHASE_PROGRESS:
    if raw_phase.lower().startswith(prefix):
        return (display_name, percentage)
```

---

### ADR-3：模块级常量
**决策**：将 `PHASE_PROGRESS` 定义为模块级常量。

**理由**：
- 与现有 `scripts/status.py` 风格一致
- 权重是全局不变量，不需要参数化
- 便于单元测试

---

## 4. 接口契约

### 4.1 函数接口

| 函数 | 参数 | 返回类型 | 降级行为 |
|------|------|---------|---------|
| `resolve_phase` | `task_status: str, raw_phase: str` | `Tuple[str, int]` | 返回 `('未知阶段', 0)` |

### 4.2 数据流

```
active_context.md
    ↓
    ├─ task_status
    └─ current_phase
         ↓
    resolve_phase(task_status, current_phase)
         ↓
    (显示名, 百分比)
         ↓
    status.py 末尾 print 语句格式化输出
```

---

## 5. 验收标准

- [ ] 代码行数不超过 25 行
- [ ] 无新增 import
- [ ] 最长前缀匹配正确（phase 1.5 优先于 phase 1）
- [ ] 所有降级路径返回 `('未知阶段', 0)`
- [ ] 输出格式符合仪表盘风格
- [ ] 可通过 `python scripts/status.py` 直接验证

---

## 6. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 前缀匹配顺序错误 | 低 | 中 | 单元测试覆盖所有前缀 |
| 新增阶段遗漏 | 低 | 低 | 文档化常量维护流程 |
| 输出格式不一致 | 极低 | 低 | 参考现有仪表盘格式 |

---

## 7. 后续扩展点

- 支持自定义百分比权重（配置文件）
- 支持阶段时间估算（基于历史数据）
- 支持多语言显示名

