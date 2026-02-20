# Manifest - HUD 任务进度看板
生成时间：2026-02-20

## 任务列表
| ID | 描述 | 优先级 | 依赖 | 预估复杂度 |
|----|------|--------|------|-----------|
| T1 | 数据源读取层：Axiom frontmatter + OMC JSON 读取，失败返回 null | P0 | - | 简单 |
| T2 | 聚合逻辑层：双数据源优先级判断（ralph>team>ultrawork>autopilot） | P0 | T1 | 中等 |
| T3 | 显示格式层：三种预设输出（minimal/focused/full） | P0 | T2 | 中等 |
| T4 | 降级处理：数据源缺失时优雅降级，不显示 null/undefined | P1 | T2 | 简单 |
| T5 | 集成验证：四种场景测试（双源/仅Axiom/仅OMC/都缺失） | P1 | T1-T4 | 中等 |

## 验收标准
- [ ] T1: 正确读取两个数据源，解析失败返回 null
- [ ] T2: active_omc_mode 优先级顺序正确
- [ ] T3: 三种预设格式输出正确
- [ ] T4: 所有降级场景无 null/undefined 输出
- [ ] T5: 四种场景全部通过
