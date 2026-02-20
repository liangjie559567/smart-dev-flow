# PRD 评审报告：axiom-status 任务进度从 manifest.md 读取

**评审时间**：2026-02-21  
**评审角色**：需求分析师  
**综合评分**：62/100

---

## 📊 评分维度

| 维度 | 评分 | 说明 |
|------|------|------|
| 需求清晰度 | 75/100 | 用户故事明确，但验收标准与实现细节混淆 |
| 完整性 | 55/100 | 缺少关键边界条件和异常处理说明 |
| 可测试性 | 65/100 | AC-1~5 可验证，但缺少负面测试用例 |
| 技术可行性 | 70/100 | 约束合理，但正则表达式范围定义不够精确 |
| 风险评估 | 45/100 | 未识别多个manifest.md文件、编码问题等风险 |

---

## 🔴 关键意见（3条）

### 意见1：**正则表达式定义不精确，导致统计错误风险**

**问题**：
- AC-1/AC-2 要求"全文匹配 `^\s*- \[[ xX]\]`"，但此正则**无法区分已完成与未完成**
- 当前 manifest.md 使用表格格式（非checkbox），正则无法匹配任何行
- 若manifest.md 改为checkbox格式，正则仍需分别统计 `- \[[ ]\]`（未完成）和 `- \[[xX]\]`（已完成）

**影响**：
- AC-1 统计结果为 0（因表格无checkbox）
- AC-2 统计结果为 0（因表格无checkbox）
- 降级显示 `—/—`，无法反映实际进度

**建议**：
- 明确 manifest.md 的格式标准（表格 vs checkbox）
- 若使用checkbox，正则应为：
  - 总数：`^\s*- \[[ xX]\]` ✓（现有定义可用）
  - 已完成：`^\s*- \[[xX]\]` ✓（需补充）
  - 未完成：`^\s*- \[ \]` ✓（需补充）

---

### 意见2：**多manifest.md文件场景未处理，导致进度统计歧义**

**问题**：
- PRD 仅指定"从 manifest.md 读取"，未说明：
  - 若存在多个 manifest.md（如 `.agent/memory/manifest.md` 和 `.omc/plans/manifest.md`），读取哪个？
  - 若指定路径不存在，是否应搜索其他位置？
  - 若多个manifest.md 内容不一致，如何处理？

**当前代码现状**：
- status.py 第31-37行仅从 active_context.md 读取进度，未涉及 manifest.md
- 无manifest.md 路径配置机制

**影响**：
- AC-3 降级逻辑可能误触发（路径错误而非文件不存在）
- 用户无法确定进度来源

**建议**：
- 明确 manifest.md 的规范路径（如 `.agent/memory/manifest.md`）
- 若路径不存在，明确降级策略（显示 `—/—` 还是查找备选路径？）
- 在输出中标注进度来源（"来自 manifest.md" vs "来自 active_context.md"）

---

### 意见3：**编码问题与字段冲突未识别，导致实现风险**

**问题**：
- active_context.md 中 `completed_tasks` 字段为空字符串（见第9行），当前代码会解析为空列表
- AC-4 要求"active_context.md 中的 total_tasks/completed_tasks 字段不再影响进度计算"，但代码第31-37行仍依赖这两个字段
- 若 manifest.md 不存在，代码应降级到 active_context.md 还是显示 `—/—`？AC-3 未明确

**当前代码现状**（第31-37行）：
```python
completed = [t.strip() for t in ctx.get('completed_tasks', '').split(',') if t.strip()]
total_raw = ctx.get('total_tasks', '0')
try: total = int(total_raw)
except: total = 0
done = len(completed)
pct = int(done / total * 100) if total > 0 else 0
bar = '█' * (pct // 10) + '░' * (10 - pct // 10)
```

**影响**：
- 修改后的代码需完全替换这7行，但PRD 约束"仅修改第31-37行"
- 若manifest.md 不存在，AC-3 要求显示 `—/—`，但当前代码会显示 active_context.md 的进度（违反AC-4）

**建议**：
- 明确降级策略：manifest.md 不存在时，是否应忽略 active_context.md 的进度字段？
- 若需完全替换逻辑，应调整技术约束为"修改第31-40行"或"修改任务进度部分"
- 补充测试用例：
  - manifest.md 存在 + active_context.md 有旧进度 → 验证只读取 manifest.md
  - manifest.md 不存在 + active_context.md 有进度 → 验证显示 `—/—`

---

## ✅ 通过项（优势）

- **用户故事清晰**：明确了使用场景和价值
- **验收标准可验证**：AC-1~5 都可通过自动化测试检查
- **技术约束合理**：不引入新依赖，正则表达式简洁
- **降级策略明确**：AC-3 定义了异常处理

---

## ⚠️ 建议补充的验收标准

1. **AC-6**：manifest.md 存在且包含checkbox时，进度显示来自 manifest.md；不存在时显示 `—/—`，不回退到 active_context.md
2. **AC-7**：正则匹配边界测试
   - `- [x]` ✓（已完成）
   - `- [ ]` ✓（未完成）
   - `-[x]`（无空格）✗
   - `  - [x]`（缩进）✓
3. **AC-8**：性能要求 <100ms（读取+解析+渲染）

---

## 📋 决策建议

**当前评分 62/100，建议**：
- ✋ **暂停实现**，补充以下澄清：
  1. manifest.md 的规范格式和路径
  2. 多manifest.md 场景的处理策略
  3. 降级时是否应忽略 active_context.md 的进度字段
  4. 技术约束是否需调整（行号范围）

- 📝 **补充验收标准**：AC-6~8

- ✅ **澄清后可进入实现**

---

## 🎯 总结

PRD 的**核心需求清晰**（从manifest.md读取进度），但**边界条件和风险识别不足**。建议在实现前完成上述澄清，确保代码改动与需求完全对齐，避免后续返工。
