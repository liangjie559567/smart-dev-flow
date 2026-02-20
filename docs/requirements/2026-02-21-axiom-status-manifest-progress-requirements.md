# 需求规格：axiom-status 任务进度从 manifest.md 读取

**日期**：2026-02-21
**状态**：待实现

## 用户故事

作为使用 smart-dev-flow 的开发者，我希望运行 axiom-status 时能看到准确的任务完成进度，以便快速了解当前会话的实际推进情况。

## 验收标准

| ID | 标准 |
|----|------|
| AC-1 | 从 manifest.md 读取任务总数（`- [ ]` 与 `- [x]` 行数之和） |
| AC-2 | 正确统计已完成任务数（`- [x]` 行数） |
| AC-3 | manifest.md 不存在时降级显示 `—/—`，不抛异常 |
| AC-4 | active_context.md 中的 `total_tasks`/`completed_tasks` 字段不再影响进度计算 |
| AC-5 | 进度条百分比与 checkbox 统计一致 |

## 技术约束

- **修改范围**：仅 `scripts/status.py` 第 31–37 行
- **不引入新依赖**
- **manifest 路径**：优先读 `active_context.md` frontmatter 中的 `manifest_path` 字段，fallback 到 `.agent/memory/manifest.md`
- **checkbox 统计范围**：全文匹配 `^\s*- \[[ xX]\]`，不限顶层，total=0 时显示 `—/—`

## 排除范围

- 不修改 manifest.md 写入逻辑
- 不改变 Dashboard 其他区域
