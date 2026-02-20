# Progress CLI 系统设计文档

**日期**: 2026-02-21  
**模块**: `scripts/progress.mjs`  
**架构**: 单文件纯 Node.js，无外部依赖

---

## 1. 模块设计

### 核心职责
- 读取 `.agent/memory/active_context.md` 和 `manifest.md`
- 解析任务状态和阶段信息
- 渲染彩色看板到 stdout（TTY 检测）
- 支持 `--json` 输出供 Hook 消费

### 依赖
- `fs` (readFileSync)
- `path` (resolve)
- 无第三方库

---

## 2. 接口定义

### readFile(path: string): string | null
```javascript
// 读取文件，不存在返回 null
// 用途：安全读取 active_context.md 和 manifest.md
```

### parseContext(text: string): ContextData
```javascript
// 返回: { task_status, current_phase, fail_count, rollback_count, last_updated, completed_tasks }
// 解析 active_context.md 中的 key: value 行（每行一个字段）
// 字段缺失时默认值：task_status="IDLE", fail_count=0, rollback_count=0
// completed_tasks: 逗号分隔的已完成任务 ID 列表（如 "T1,T2"）
```

### parseManifest(text: string): Task[]
```javascript
// 返回: [{ id, desc, done }, ...]
// 解析 Markdown 表格或检查清单格式
```

### render(ctx: ContextData, tasks: Task[], useColor: boolean): void
```javascript
// 输出看板到 stdout
// useColor: process.stdout.isTTY 决定是否使用 ANSI 颜色
```

### main(): void
```javascript
// 入口函数
// 处理 --json flag，检测 isTTY，调用 render()
```

---

## 3. 数据流

```
main()
  ├─ 检测 --json flag
  ├─ 检测 process.stdout.isTTY
  ├─ readFile(active_context.md)
  ├─ readFile(manifest.md)
  ├─ parseContext() → ContextData
  ├─ parseManifest() → Task[]
  ├─ render(ctx, tasks, useColor)
  └─ 输出到 stdout 或 JSON
```

---

## 4. 降级策略

| 场景 | 行为 | Exit Code |
|------|------|-----------|
| 文件不存在 | 显示友好提示 | 0 |
| 解析失败 | 输出错误到 stderr | 1 |
| 无 TTY | 禁用 ANSI 颜色 | 0 |
| --json 模式 | 输出 JSON，错误到 stderr | 0/1 |

---

## 5. 颜色映射与状态规则

| 状态 | ANSI 代码 | 图标 |
|------|-----------|------|
| 完成（done=true） | `\x1b[32m`（绿） | ✅ |
| 进行中（当前任务） | `\x1b[34m`（蓝） | 🔄 |
| 失败（fail_count≥2） | `\x1b[31m`（红） | ❌ |
| 待开始 | `\x1b[33m`（黄） | ⏳ |

fail_count 来自 active_context.md，≥2 时整个看板标题行用红色高亮。

## 5b. 完成记录

`completed_tasks` 字段（逗号分隔 ID）作为最近完成记录来源，最多显示5条，倒序排列。
若字段为空则显示"暂无完成记录"。

## 6. 输出格式

### 彩色看板（TTY）
```
╔════════════════════════════════╗
║  任务进度看板                  ║
║  阶段: Phase 3 - Implementing  ║
║  失败: 0  回滚: 0              ║
╠════════════════════════════════╣
║ ✅ T1 数据读取层      [完成]   ║
║ 🔄 T2 聚合逻辑层      [进行]   ║
║ ⏳ T3 显示格式层      [待开始] ║
╚════════════════════════════════╝
```

### JSON 输出（--json）
```json
{
  "task_status": "IMPLEMENTING",
  "current_phase": "Phase 3",
  "fail_count": 0,
  "rollback_count": 0,
  "tasks": [
    { "id": "T1", "desc": "数据读取层", "done": true }
  ],
  "timestamp": "2026-02-21T10:30:00Z"
}
```

---

## 6. 性能目标
- 执行时间: <500ms
- 内存占用: <10MB
- 文件 I/O: 同步读取（简化设计）

---

## 7. 集成点

### PostToolUse Hook
```javascript
// hooks/post-tool-use.cjs 调用
// node scripts/progress.mjs --json | jq .
```

### 命令行使用
```bash
node scripts/progress.mjs          # 彩色看板
node scripts/progress.mjs --json   # JSON 输出
```
