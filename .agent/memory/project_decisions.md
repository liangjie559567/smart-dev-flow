---
project_name: Axiom v4.2
last_updated: 2026-02-13
---

# Project Decisions (长期记忆 - 架构决策)

## 1. 技术栈 (Framework Core)
- **Language**: Dart (Flutter) for Core Logic & UI.
- **Backend/Scripting**: Python (Evolution Engine) / PowerShell (Guards).
- **Architecture**: Manifest-Driven Agentic Pipeline.

## 2. 架构设计原则
- **Stateless Skills**: 技能必须是纯函数，无副作用。
- **Controller Workflows**: 状态管理和门禁逻辑必须在 Workflow 层实现。
- **Evidence-Based Gates**: 所有门禁必须基于可验证的产物 (Artifacts/Logs)。

## 3. 编码规范
- **Lint**: flutter_lints
- **Formatting**: dart format
- **Naming**: `snake_case` for docs/scripts, `PascalCase` for classes.

## 4. 核心依赖
| 库名 | 用途 |
|------|------|
| Lucide | 标准图标库 |
| Mermaid | 流程图标准 |

## 5. 已知问题 (错误模式学习)
| 日期 | 错误类型 | 根因分析 | 修复方案 |
|------|---------|---------|---------|
| 2026-02-12 | Race Condition | 并行读写同一临时文件 | 实施 Unique Artifact Injection (k-028) |

## 6. Deprecated (废弃决策归档)
- [Archived] "Test Flutter App" MVVM specific rules (Replaced by Generic Axiom rules).

## 8. 评审报告 - axiom-status 任务进度从 manifest.md 读取
时间：2026-02-21T00:30:00.000Z

| 专家 | 角色 | 评分 | 关键意见 |
|------|------|------|---------|
| critic | 批判性审查 | 62 | C-1: manifest.md checkbox 是验收标准区块非任务本身，schema 假设错误；C-2: 第78行 `completed` 变量引用在新方案中导致 NameError 崩溃 |
| ux-researcher | UX主任 | 56 | 信息源冲突无迁移策略；降级处理仅覆盖"不存在"场景；格式与实际不匹配 |
| analyst | 需求分析师 | 62 | 正则无法匹配表格格式 manifest；多 manifest 场景未处理；AC-4 验证不存在字段 |
| quality-reviewer | 技术主管 | 65 | 格式不匹配（正则与实际 manifest 格式不符）；降级策略边界不清 |
| security-reviewer | 安全评论家 | 70 | 路径遍历漏洞（HIGH）：manifest_path 未验证；资源耗尽风险 |
| product-manager | 产品主任 | 72 | AC-3 降级格式歧义；格式假设不严谨；缺优先级和背景说明 |

### 冲突解决
按优先级（安全 > 技术 > 战略 > 逻辑 > 体验）：
- 安全评审员的路径遍历漏洞（HIGH）与技术约束"不引入新依赖"存在冲突 → 可用标准库 `Path.resolve()` 解决，无需新依赖
- critic C-2（NameError 崩溃）与设计文档"变更范围第31-37行"冲突 → 变更范围必须扩展到第78行

### 综合结论
- 综合评分：64.5/100（各专家均分）
- 建议：退回修改（critic 发现 Critical 问题，强制退回）
- 必须修复：C-2（第78行 NameError 崩溃）、C-1（明确 manifest schema 约定）、安全路径遍历漏洞

## 7. 🎨 UI/UX Standards (Mandatory)
- **Design Philosophy**: Minimalist, Terminal-inspired, Cyberpunk (optional).
- **Interactive**: CLI interactions must be clear and structured.

## 评审报告 - dev-flow 阶段进度估算
时间：2026-02-21T03:00:00.000Z

| 专家 | 角色 | 评分 | 关键意见 |
|------|------|------|---------|
| critic | 批判性审查 | 通过 | Critical/High 问题已修复（C-1 CONFIRMING 状态、C-2 排列说明、H-1 Python 3.8 兼容性） |
| security-reviewer | 安全评论家 | 74 | 异常处理过于宽泛（bare except）；建议严格枚举验证 task_status；建议 raw_phase 长度设限 |
| ux-researcher | UX主任 | 72 | Phase 3 显示 95% 造成虚假完成感；降级提示缺乏诊断信息；Phase 1.5 命名对新用户不友好 |
| product-manager | 产品主任 | 97 | 设计质量高，所有 AC 覆盖；建议补充文件读取异常处理细节 |
| analyst | 领域专家 | 85 | 需求覆盖完整；集成细节不清晰，建议补充 resolve_phase 调用代码片段 |
| quality-reviewer | 技术主管 | 92 | 可行性高；建议内联 KNOWN_STATUSES 压缩行数；建议补充 3 个单元测试用例 |

### 冲突解决
按优先级（安全 > 技术 > 战略 > 逻辑 > 体验）：
- UX 建议 Phase 3 改为 100% → 与需求文档 AC-3 冲突（Phase 3 = 95%，REFLECTING = 100%），需求优先，不采纳
- 安全/技术均支持 KNOWN_STATUSES 集合方案，无冲突

### 综合结论
- 综合评分：84/100（各专家均分）
- 建议：通过（无 Critical 问题，评分 ≥ 60）
- 必须修复：无（建议项可在实现时处理）
