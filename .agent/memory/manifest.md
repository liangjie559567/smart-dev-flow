# Manifest - 任务进度看板 CLI
生成时间：2026-02-21

## 任务列表
| ID | 描述 | 优先级 | 依赖 | 预估复杂度 |
|----|------|--------|------|-----------|
| T1 | 实现 readFile(path) — 读取文件，异常返回 null | P0 | - | 简单 |
| T2 | 实现 parseContext(text) — 解析 active_context.md frontmatter，提取6个字段 | P0 | T1 | 简单 |
| T3 | 实现 parseManifest(text) — 解析 manifest.md checkbox 行 | P0 | T1 | 简单 |
| T4 | 实现 render(ctx, tasks, useColor) — ANSI 彩色看板输出 | P0 | T2,T3 | 中等 |
| T5 | 实现 main() — 处理 --json flag 与 isTTY 检测 | P0 | T1,T2,T3,T4 | 简单 |

## 验收标准
- [ ] T1: readFile 对不存在路径返回 null，有效路径返回文件字符串
- [ ] T2: parseContext 正确提取6个字段，缺失字段给默认值
- [ ] T3: parseManifest 识别 [x]/[ ] 状态，提取 id 和 desc
- [ ] T4: 彩色输出（完成=绿、进行中=蓝、失败=红、待开始=黄），显示 fail_count/rollback_count 和最近5条完成记录
- [ ] T5: isTTY=false 或 --json 时输出 JSON，否则彩色看板，执行时间 <500ms
