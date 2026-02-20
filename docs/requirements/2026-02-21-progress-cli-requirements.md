# 任务进度看板 CLI 需求规格

## 用户故事
1. 开发者执行 `node scripts/progress.mjs`，1秒内看到彩色任务看板
2. PostToolUse 钩子自动触发，无需手动刷新
3. 失败次数 ≥2 的任务用红色突出显示

## 验收标准
- [ ] 显示所有任务名称、状态（来自 manifest.md）
- [ ] 当前阶段状态与 active_context.md 一致
- [ ] ANSI 彩色输出（进行中=蓝、完成=绿、失败=红）
- [ ] 显示 fail_count、rollback_count
- [ ] 显示最近5条完成记录（时间倒序）
- [ ] 无外部依赖（仅 Node.js 内置模块）
- [ ] PostToolUse 钩子集成
- [ ] 执行时间 <500ms

## 技术约束
- Node.js 20+，仅内置模块
- 数据源：manifest.md + active_context.md
- 参考：scripts/hud.mjs

## 数据源定义

### active_context.md 字段
- `task_status`: IDLE|DRAFTING|REVIEWING|DECOMPOSING|IMPLEMENTING|REFLECTING
- `current_phase`: 当前阶段描述
- `fail_count`: 失败次数（整数）
- `rollback_count`: 回滚次数（整数）
- `last_updated`: ISO 时间戳

### manifest.md 结构
Markdown 表格：`| ID | 描述 | 优先级 | 依赖 | 预估复杂度 |`
验收标准：`- [ ] T1: 描述` 或 `- [x] T1: 描述`

## 命令行接口
```
node scripts/progress.mjs          # 显示完整看板
node scripts/progress.mjs --json   # JSON 输出（供钩子使用）
```

## 输出示例
```
╔══════════════════════════════════╗
║  任务进度看板                    ║
║  阶段: Phase 3 - Implementing    ║
║  失败: 0  回滚: 0                ║
╠══════════════════════════════════╣
║ ✅ T1 数据读取层          [完成] ║
║ 🔄 T2 聚合逻辑层          [进行] ║
║ ⏳ T3 显示格式层          [待开始]║
╚══════════════════════════════════╝
```

## 降级处理
- manifest.md 不存在 → 显示"暂无任务清单"
- active_context.md 不存在 → 显示"状态未知"
- 文件解析失败 → 显示原始错误，exit code 1

## 排除范围
- 交互式菜单、实时监听、任务编辑、数据导出
