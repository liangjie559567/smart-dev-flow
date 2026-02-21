# 需求分析：命令行任务看板 CLI 工具

**生成时间**：2026-02-21
**分析师**：Analyst
**任务**：scripts/progress.mjs 单文件实现

---

## 1. 验收标准（5条，可测试）

| # | 标准 | 验证方式 |
|---|------|--------|
| AC1 | readFile(path) 对不存在路径返回 null，有效路径返回完整文件字符串 | 单元测试：mock 文件系统，验证返回值类型 |
| AC2 | parseContext(text) 从 YAML frontmatter 正确提取 6 个字段（task_status/current_phase/fail_count/rollback_count/completed_tasks/last_updated），缺失字段使用默认值 | 单元测试：输入有效/无效 YAML，验证字段值和默认值 |
| AC3 | parseManifest(text) 识别 `[x]` 和 `[ ]` checkbox，提取任务 ID 和描述，返回 {id, desc, done} 对象数组 | 单元测试：输入含多行 checkbox，验证数组长度和字段准确性 |
| AC4 | render(ctx, tasks, useColor) 输出彩色看板：完成=绿✅、进行中=蓝、失败=红、待开始=黄⏳，显示 fail_count/rollback_count 和最近 5 条完成记录 | 集成测试：运行 `node scripts/progress.mjs`，验证 ANSI 颜色码和内容完整性 |
| AC5 | main() 检测 isTTY：TTY 时输出彩色看板，--json 或非 TTY 时输出 JSON；执行时间 <500ms | 集成测试：运行 `node scripts/progress.mjs --json` 和管道模式，验证输出格式和性能 |

---

## 2. 技术边界

### 包含（IN SCOPE）
- 单文件实现（scripts/progress.mjs），无外部依赖
- 从 `.agent/memory/active_context.md` 和 `.agent/memory/manifest.md` 读取数据
- ANSI 彩色输出（TTY 检测 via `process.stdout.isTTY`）
- JSON 输出模式（--json flag 或非 TTY）

### 不包含（OUT OF SCOPE）
- 文件写入或修改（仅读取）
- 交互式 UI（纯输出，无输入处理）
- 外部依赖或 npm 包（chalk/colors 等）

---

## 3. 关键假设

| # | 假设 | 影响 |
|---|------|------|
| A1 | active_context.md 始终包含有效的 YAML frontmatter（`---` 分隔符），至少包含 task_status 字段 | 若格式破损，parseContext 需提供容错逻辑（返回默认值） |
| A2 | manifest.md 中 checkbox 行格式严格为 `- [x] 描述` 或 `- [ ] 描述`，ID 从行号或描述前缀推导 | 若格式变化，parseManifest 需调整正则表达式 |

---

## 4. 风险点

| # | 风险 | 缓解方案 |
|---|------|--------|
| R1 | 文件不存在或权限不足导致读取失败 | readFile 捕获异常返回 null，main 提供友好错误提示 |
| R2 | ANSI 颜色码在某些终端不支持或显示乱码 | 检测 TERM 环境变量或提供 --no-color flag 禁用颜色 |

---

## 5. 接口规格

### readFile(path: string) → string | null
- 同步读取文件，异常返回 null

### parseContext(text: string) → object
- 返回 `{task_status, current_phase, fail_count, rollback_count, completed_tasks, last_updated}`
- 缺失字段使用默认值

### parseManifest(text: string) → Array<{id, desc, done}>
- 返回任务数组，done 为 boolean

### render(ctx: object, tasks: Array, useColor: boolean) → string
- 返回格式化字符串（ANSI 或纯文本）

### main() → void
- 检测 TTY 和 --json flag，调用 render 并输出

---

## 6. 数据流

```
active_context.md ──┐
                    ├─→ readFile ──→ parseContext ──┐
manifest.md ────────┤                                ├─→ render ──→ main ──→ stdout
                    └─→ readFile ──→ parseManifest ──┘
```

---

## 7. 性能目标
- 执行时间 <500ms（包括文件 I/O）
- 内存占用 <10MB

