# dev-flow 流程测试记录

**测试需求**：为 axiom-status 添加 manifest.md 任务进度显示
**测试日期**：2026-02-21
**测试目标**：记录实际执行流程与 dev-flow 定义的不一致点

## 不一致记录

| # | 阶段 | 定义行为 | 实际行为 | 影响 |
|---|------|---------|---------|------|
| 1 | 初始化 | active_context.md 应有唯一 last_updated 字段 | 字段重复3次，task_status=DRAFTING 但正文说"无活跃任务" | 状态混乱，需手动重置 |
| 2 | IDLE 引导 | 收集"需求描述"开放文本 | AskUserQuestion 要求≥2选项，无法收集开放文本 | 需求描述只能通过选项间接获取 |
| 3 | IDLE 引导 | 一次性收集4项信息 | 工具限制导致需要多轮问答 | 用户体验割裂 |
| 4 | Phase 0 | quality-reviewer 发现 High 问题 → 重新调用 writer | H-1/H-2 是需求歧义，应退回 analyst 而非 writer | 错误的修复路径，writer 无法解决需求歧义 |
| 5 | Phase 0→1 | axiom-draft 确认框应在 Phase 1 完成后出现 | 确认框在 Phase 0 完成后就出现，跳过了 Phase 1 架构设计 | 用户可能在架构设计前就进入 Phase 1.5 |
| 6 | Phase 1 | critic 子代理应基于真实文件内容分析 | critic 声称"manifest.md 无 checkbox 行"，实际第14-18行就是 checkbox | 子代理产生错误分析，主 Claude 需交叉验证 |
| 7 | Phase 1.5 | critic 发现 Critical 问题 → 强制退回；评分<60 → 强制退回 | critic 评分62（>60）但发现 Critical 问题，两条规则冲突 | 规则优先级不明确，无法自动决策 |

## 阶段执行记录

### Phase 0（需求澄清）
- analyst 子代理：产出5条验收标准 ✅
- writer 子代理：生成需求文档 ✅
- quality-reviewer：发现 H-1（manifest_path 来源歧义）→ 直接修改需求文档修复 ✅
- 不一致 #4：应退回 analyst，实际直接修改文档

### Phase 1（架构设计）
- architect 子代理：产出接口契约和 ADR ✅
- critic 子代理：发现 Critical 问题（manifest 无 checkbox）→ 经主 Claude 验证为错误分析 ⚠️
- 不一致 #6：critic 分析错误，主 Claude 需要交叉验证
- writer 子代理：生成设计文档 ✅

### Phase 1.5（专家评审）
- critic 子代理（opus）：评分 62/100，发现 C-1（schema 假设）、C-2（NameError 崩溃）
- 5个专家并行评审：UX 56、需求分析师 62、技术主管 65、安全 70、产品经理 72
- 综合评分：64.5/100
- 结论：按 Critical 问题规则强制退回 Phase 1
- 不一致 #7：评分规则（>60 通过）与 Critical 规则（发现即退回）冲突

### Phase 1 返工（修复设计文档）
- architect 子代理：扩展变更范围到第78行，新增 Manifest Schema 约定章节 ✅
- C-2 修复：明确删除第78行 `completed` 变量引用
- C-1 修复：明确统计对象是验收标准 checkbox 行

### Phase 2（任务拆解）
- 工作量评估：SMALL（单文件两处修改，<4小时）
- 按规则跳过完整拆解，直接进入执行引擎选择
- 用户选择：标准模式

### Phase 3（TDD 实现）
- RED：编写5个测试用例（AC-1/AC-2/AC-3/AC-5 + total=0 边界）
- GREEN：修改 status.py 第30-36行（从 manifest.md 读取 checkbox）+ 删除第78行
- 验证：5/5 测试通过，status.py 实际输出 `0/5 tasks`（正确读取 manifest.md 的5个 checkbox）
- 验收标准：AC-1/AC-2/AC-3/AC-4/AC-5 全部通过

