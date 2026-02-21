# ADR: progress.mjs 架构设计

**日期**: 2026-02-21
**状态**: 已批准
**作者**: Architect

---

## 1. 模块划分（函数职责）

| 函数 | 职责 | 输入 | 输出 |
|------|------|------|------|
| `readFile(path)` | 同步读取文件，异常返回null | 文件路径(string) | 文件内容(string) \| null |
| `parseContext(text)` | 从frontmatter提取6个字段 | 文本(string) | {session_id, task_status, fail_count, rollback_count, completed_tasks, last_updated} |
| `parseManifest(text)` | 解析checkbox行，识别[x]/[ ]状态 | 文本(string) | [{id, desc, done}] |
| `render(ctx, tasks, useColor)` | 格式化看板输出 | context对象, tasks数组, 彩色标志 | 格式化字符串 |
| `main()` | CLI入口，处理参数和输出 | 无 | 输出到stdout |

---

## 2. 数据流（一句话）

**main() 读取两个文件 → parseContext/parseManifest 提取数据 → render 格式化 → 根据TTY/--json输出彩色或JSON**

```
readFile(active_context.md) ──┐
                               ├─→ parseContext() ──┐
readFile(manifest.md) ────────→ parseManifest() ──→ render() ──→ output
                                                      ↑
                                                   useColor?
```

---

## 3. 关键接口契约

### 3.1 readFile(path: string): string | null
**职责**: 同步读取文件，异常时返回null
**输入**: 文件路径
**输出**: 文件内容或null
**错误处理**: 捕获所有异常（ENOENT、权限等），返回null
**性能**: O(1)，同步操作

```javascript
// 伪代码
function readFile(path) {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}
```

---

### 3.2 parseContext(text: string): object
**职责**: 从YAML frontmatter提取6个字段
**输入**: active_context.md 文本
**输出**:
```javascript
{
  session_id: string,      // 默认: "unknown"
  task_status: string,     // 默认: "IDLE"
  fail_count: number,      // 默认: 0
  rollback_count: number,  // 默认: 0
  completed_tasks: string, // 默认: ""
  last_updated: string     // 默认: new Date().toISOString()
}
```
**错误处理**: 缺失字段使用默认值，不抛异常
**实现**: 正则提取 `---` 之间的YAML，逐行解析 `key: value`

---

### 3.3 parseManifest(text: string): array
**职责**: 解析Markdown checkbox行
**输入**: manifest.md 文本
**输出**:
```javascript
[
  { id: "T1", desc: "实现 readFile", done: false },
  { id: "T2", desc: "实现 parseContext", done: true },
  // ...
]
```
**规则**:
- 匹配 `- [x]` 或 `- [ ]` 行
- `[x]` → done=true，`[ ]` → done=false
- 从行首提取 `T\d+` 作为id，剩余文本作为desc
- 无效行忽略

**错误处理**: 无效行跳过，不抛异常

---

### 3.4 render(ctx: object, tasks: array, useColor: boolean): string
**职责**: 格式化看板输出
**输入**:
- ctx: parseContext返回的对象
- tasks: parseManifest返回的数组
- useColor: 是否使用ANSI颜色

**输出**: 格式化字符串（彩色或纯文本）

**显示内容**:
1. 标题行：session_id, task_status
2. 统计行：fail_count, rollback_count
3. 任务列表（彩色编码）：
   - 完成(done=true): 绿色 ✓
   - 进行中(task_status="IMPLEMENTING"): 蓝色 ⊙
   - 失败(fail_count>0): 红色 ✗
   - 待开始(done=false): 黄色 ○
4. 最近5条完成记录（从completed_tasks提取）

**颜色代码**:
- 绿: `\x1b[32m`
- 蓝: `\x1b[34m`
- 红: `\x1b[31m`
- 黄: `\x1b[33m`
- 重置: `\x1b[0m`

---

### 3.5 main(): void
**职责**: CLI入口，处理参数和输出
**参数**:
- `--json`: 输出JSON格式
- 无参数: 根据isTTY决定输出格式

**逻辑**:
```
1. 检测 process.argv 中是否有 --json
2. 检测 process.stdout.isTTY
3. useColor = !--json && isTTY
4. 读取两个文件
5. 解析数据
6. 调用render()
7. 输出结果
```

**输出格式**:
- TTY且无--json: 彩色看板
- --json或非TTY: JSON格式
  ```json
  {
    "context": {...},
    "tasks": [...],
    "timestamp": "ISO8601"
  }
  ```

**错误处理**: 文件缺失时输出空数据，不中断

---

## 4. 无需设计的内容（YAGNI）

- ❌ 配置文件支持（.progressrc等）
- ❌ 实时监听/watch模式
- ❌ 数据库存储
- ❌ 网络通信
- ❌ 权限管理
- ❌ 国际化（i18n）
- ❌ 插件系统
- ❌ 缓存机制
- ❌ 日志系统
- ❌ 性能分析

---

## 5. 实现约束

| 约束 | 说明 |
|------|------|
| 无外部依赖 | 仅使用Node.js内置模块（fs, path等） |
| 单文件 | scripts/progress.mjs |
| 同步操作 | 所有I/O同步，避免异步复杂性 |
| 执行时间 | <500ms |
| 编码 | UTF-8 |
| 目标环境 | Node.js 20+ |

---

## 6. 验收清单

- [ ] readFile 对不存在路径返回null
- [ ] parseContext 提取6个字段，缺失给默认值
- [ ] parseManifest 识别[x]/[ ]状态，提取id和desc
- [ ] render 彩色输出（完成=绿、进行中=蓝、失败=红、待开始=黄）
- [ ] render 显示fail_count/rollback_count和最近5条完成记录
- [ ] main 处理--json flag
- [ ] main 检测isTTY
- [ ] 执行时间<500ms
- [ ] 无外部依赖
- [ ] 单文件实现

