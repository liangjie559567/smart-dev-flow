# 任务进度看板 CLI — 设计文档 v2

生成时间：2026-02-21

## 目标

实现 `scripts/progress.mjs`，单文件彩色任务看板 CLI，无外部依赖。

## 架构

单文件 5 个纯函数：

```
readFile(path) → string|null
parseContext(text) → ctx对象
parseManifest(text) → tasks数组
render(ctx, tasks, useColor) → void
main() → 入口
```

## 接口契约

| 函数 | 输入 | 输出 |
|------|------|------|
| readFile | 相对路径字符串 | string 或 null（异常时） |
| parseContext | active_context.md 内容 | {task_status, current_phase, fail_count, rollback_count, last_updated, completed_tasks} |
| parseManifest | manifest.md 内容 | [{id, desc, done}] |
| render | ctx, tasks, useColor | void，输出到 stdout |
| main | — | 读取→解析→输出 |

## 输出格式

- TTY 模式：box-drawing 彩色看板（完成=绿✅、待开始=黄⏳）
- `--json` 或非 TTY：JSON 对象

## 验收标准

- readFile 对不存在路径返回 null
- parseContext 正确提取 6 个字段，缺失给默认值
- parseManifest 识别 [x]/[ ] 状态
- 彩色输出正确，执行时间 <500ms
