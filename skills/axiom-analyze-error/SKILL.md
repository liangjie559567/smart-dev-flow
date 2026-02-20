---
name: axiom-analyze-error
description: 错误分析 - 三出口恢复（自动修复/回滚/阻塞）
---

# axiom-analyze-error

## 触发条件

任务执行失败，需要分析错误并决定恢复路径。

## 流程

### 第一步：收集日志

```bash
git diff HEAD~1 --stat        # 最近变更摘要
git status                    # 当前工作区状态
```

同时读取：
- `.agent/memory/active_context.md` → `fail_count`、`blocked_reason`
- 用户粘贴的错误信息（若有）

### 第二步：并联分析

同时启动两个分析：

1. **OMC debugger**（sonnet）：代码级根因分析
   ```
   Task(subagent_type="oh-my-claudecode:debugger", model="sonnet", prompt="分析以下错误的根因，给出置信度（0-100）和修复方案：{错误信息}")
   ```

2. **Axiom 流程分析**：读取并执行 `.agent/workflows/analyze-error.md`

### 第三步：三出口决策

根据综合置信度选择出口：

#### 出口 A：自动修复（置信度 ≥ 80%）

1. 执行修复方案
2. 重新运行验证
3. 验证通过后，若 `scripts/evolve.py` 存在则调用：
   ```bash
   python scripts/evolve.py on-error-fixed --error-type "{类型}" --root-cause "{根因}" --solution "{方案}"
   ```

#### 出口 B：回滚（置信度 40–79%）

1. 恢复到上一个检查点
2. 更新 `.agent/memory/active_context.md`：
   ```
   task_status: IMPLEMENTING
   ```

#### 出口 C：阻塞升级（置信度 < 40% 或 fail_count ≥ 3）

1. 更新 `.agent/memory/active_context.md`：
   ```
   task_status: BLOCKED
   blocked_reason: {错误描述}
   ```
2. 停止执行，等待人工介入

## 每次修复后（若 scripts/evolve.py 存在）

```bash
python scripts/evolve.py on-error-fixed --error-type "{类型}" --root-cause "{根因}" --solution "{方案}"
```
