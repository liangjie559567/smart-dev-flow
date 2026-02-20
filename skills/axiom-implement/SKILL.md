---
name: axiom-implement
description: Axiom Phase 3 实现 - TDD + 四层审查 + Phase 5 调试 + Phase 6.5 文档 + 知识库贯穿
---

# axiom-implement

## 子代理强制调用铁律

```
主 Claude 禁止：直接编写代码、直接审查代码、直接分析 bug
每个阶段的核心工作必须通过 Task() 调用子代理完成。
```

## 流程

1. **读取阶段上下文（必须）**：
   ```
   phase_context_read phase=all
   → 获取 phase1.interfaces（接口契约）、phase2.tasks（任务清单）、kb_context
   ```
2. 读取 `.agent/memory/manifest.md` 中的任务清单（与 phase2.tasks 互为补充）
3. **知识库查询（必须）**：
   ```
   axiom_get_knowledge query="TDD {模块名称} 测试模式" limit=5
   axiom_search_by_tag tags=["TDD", "测试", "{技术栈}"] limit=3
   → 将查询结果保存为 kb_context
   ```
3. 更新 `active_context.md`：
   ```
   task_status: IMPLEMENTING
   current_phase: Phase 3 - Implementing
   current_task: T{N} - {描述}
   completed_tasks:
   fail_count: 0
   last_updated: {timestamp}
   ```
4. 按以下规则为每个子任务派发 agent（无依赖的子任务并行执行）：

   **执行前**：调用 `test-driven-development` 技能，强制先写失败测试再实现（Red→Green→Refactor）。

   - 预估 > 2小时 或 涉及多文件架构改动：
     ```
     Task(
       subagent_type="general-purpose",
       prompt="你是深度执行者（Deep Executor）。按 TDD Red→Green→Refactor 实现任务。
       【任务】{T_ID}：{描述}
       【phase1接口契约】{phase1.interfaces}
       【知识库经验】{kb_context}
       参考：.agent/memory/manifest.md
       要求：先探索代码库理解现有模式，先写失败测试，再写最小实现，再重构
       输出：变更文件列表 + 测试结果 + 构建结果"
     )
     ```
   - 否则：
     ```
     Task(
       subagent_type="general-purpose",
       prompt="你是执行者（Executor）。按 TDD Red→Green→Refactor 实现任务。
       【任务】{T_ID}：{描述}
       【phase1接口契约】{phase1.interfaces}
       【知识库经验】{kb_context}
       参考：.agent/memory/manifest.md
       要求：最小化改动，先写失败测试，再写实现
       输出：变更文件列表 + 测试结果"
     )
     ```

   **每个 executor 子代理完成后，主 Claude 执行四层检查（必须全部通过）**：

   **第一层：质量检查**
   ```
   Task(
     subagent_type="general-purpose",
     model="sonnet",
     prompt="你是代码质量审查专家（Quality Reviewer）。
     【实现代码】{executor输出的代码}
     【phase1接口契约】{phase1.interfaces}
     审查逻辑缺陷、可维护性、TDD覆盖完整性，输出 Critical/High/Medium/Low 分级问题列表"
   )
   ```
   → 存在 Critical/High → 带问题列表重新调用 executor，禁止继续

   **第二层：安全检查**
   ```
   Task(
     subagent_type="general-purpose",
     model="sonnet",
     prompt="你是安全审查专家（Security Reviewer）。
     【实现代码】{executor输出的代码}
     审查 OWASP Top 10、注入攻击、认证/鉴权、敏感数据暴露、信任边界，输出分级问题列表"
   )
   ```
   → 存在 Critical/High → 带问题列表重新调用 executor，禁止继续

   **第三层：接口契约检查**
   ```
   Task(
     subagent_type="general-purpose",
     model="sonnet",
     prompt="你是 API 审查专家（API Reviewer）。
     【实现代码】{executor输出的代码}
     【原始接口契约】{phase1.interfaces}
     验证实现是否与接口契约一致，输出不一致问题列表"
   )
   ```
   → 存在不一致 → 带问题列表重新调用 executor，禁止继续

   **第四层：风格检查**
   ```
   Task(
     subagent_type="general-purpose",
     model="haiku",
     prompt="你是代码风格审查专家（Style Reviewer）。
     【实现代码】{executor输出的代码}
     审查命名、格式、惯用法，输出问题列表"
   )
   ```
   → 存在 Critical/High → 带问题列表重新调用 executor，禁止继续

   **四层检查全部通过后**，主 Claude 直接运行测试命令（Bash 工具）收集真实输出：
   - 测试全部通过 → 继续
   - 测试失败 → 将失败输出注入下一次 executor 调用（重新从四层检查开始）
   - 无测试输出证据 → 不得声明子任务完成
4. 每个子任务完成后派发 verifier：
   ```
   Task(
     subagent_type="general-purpose",
     prompt="你是验证者（Verifier）。你的任务是用证据验证实现是否完成，拒绝无证据的完成声明。\n\n验证任务 {T_ID} 的完成情况：\n- 运行测试并展示完整输出\n- 检查 lsp_diagnostics（TypeScript/类型错误）\n- 验证构建通过\n- 对照验收标准逐项确认\n\n输出：PASS 或 FAIL + 具体证据（测试输出、构建日志）"
   )
   ```
5. **子任务成功**：
   - `fail_count` 重置为 0
   - 更新 `completed_tasks`，输出进度：
     ```
     ✅ T{N} 完成 | {bar} {pct}% ({done}/{total})
     ```
   - 继续下一个子任务
6. **子任务失败（Phase 5 系统调试）**：
   - `fail_count += 1`
   - 若 `fail_count >= 3`：更新 `task_status: BLOCKED`，`blocked_reason: 连续失败{N}次，需要人工介入`，终止流程
   - 否则触发 Phase 5 调试流程：
     1. **知识库查询（必须）**：
        ```
        axiom_get_knowledge query="{具体错误信息}" limit=10
        axiom_search_by_tag tags=["调试", "错误修复", "{错误类型}"] limit=5
        → 更新 kb_context
        ```
     2. 调用 `systematic-debugging` 技能进行 4 阶段根因分析
     3. 派发 debugger agent 执行修复（必须，禁止主 Claude 直接分析）：
        ```
        Task(
          subagent_type="general-purpose",
          model="sonnet",
          prompt="你是调试专家（Debugger）。根因分析（5-Why），提供最小复现用例和修复方案。
          【错误信息】{error}
          【失败测试】{test}
          【相关代码】{code}
          【知识库历史方案】{kb_context}
          输出：根本原因（具体到文件和行号）、修复建议（具体步骤）、预防措施"
        )
        ```
     4. debugger 完成后，对修复代码执行四层检查（同步骤4）
     5. 四层检查通过后运行测试验证
     6. **知识沉淀（必须）**：
        ```
        axiom_harvest source_type=error_fix
          title="调试修复: {错误类型}"
          summary="{根因} | {修复方案} | {预防措施} | {复现步骤}"
        ```
     7. 重试当前子任务
7. 全部完成后：
   - **完成前验证**：调用 `verification-before-completion` 技能，确认所有测试通过、构建成功，再进入代码审查。
   - **规格合规审查**（参考 `subagent-driven-development/spec-reviewer-prompt.md`）：
     ```
     Task(
       subagent_type="general-purpose",
       prompt="你正在审查实现是否符合规格。\n\n被要求的内容：{manifest.md 中的完整任务列表}\n\n实现者声称构建的内容：{各子任务完成报告}\n\n关键：不要相信汇报，必须独立读取代码验证。\n\n检查：\n1. 所有验收标准是否都已实现？\n2. 是否有超出规格的额外实现？\n3. 是否有误解需求的情况？\n\n输出：✅ 规格合规 / ❌ 问题列表（缺失/多余，含文件:行号）"
     )
     ```
     规格审查失败 → 派发 executor 修复后重新验证
   - **代码质量审查**（仅在规格合规审查通过后，参考 `subagent-driven-development/code-quality-reviewer-prompt.md`）：
     ```
     Task(
       subagent_type="general-purpose",
       prompt="你是高级代码审查员（Senior Code Reviewer）。对本次实现进行全面代码审查。\n\n审查范围：本次所有变更文件\n\n检查维度：\n- 计划对齐：实现是否符合 manifest.md 意图？\n- 代码质量：命名清晰、逻辑正确、遵循现有模式\n- 测试充分性：测试是否真正验证行为？\n\n问题分级：Critical（必须修复）/ Important（应修复）/ Minor（建议）\n\n输出：APPROVE 或 REQUEST CHANGES + 具体问题列表（含文件:行号）"
     )
     ```
   - **安全审查**（与代码质量审查并行）：
     ```
     Task(
       subagent_type="general-purpose",
       prompt="你是安全审查专家（Security Reviewer）。审查本次变更的安全风险。\n\n审查范围：本次所有变更文件\n\n检查维度：OWASP Top 10、注入攻击、认证/鉴权、敏感数据暴露、信任边界\n\n问题分级：Critical（必须修复）/ High（应修复）/ Medium / Low\n\n输出：PASS 或 FAIL + 具体问题列表（含文件:行号）"
     )
     ```
   - **架构合规审查**（仅当变更涉及 3+ 模块或新增接口时）：
     ```
     Task(
       subagent_type="general-purpose",
       model="opus",
       prompt="你是架构审查专家（Architect Reviewer）。审查本次变更是否符合系统架构约束。\n\n审查范围：本次所有变更文件\n\n检查维度：模块边界、接口契约一致性、循环依赖、架构决策合规\n\n输出：APPROVE 或 REJECT + 具体问题列表"
     )
     ```
     代码质量/安全/架构任一发现 Critical/High 问题 → 派发 executor 修复后重新验证

   - **Phase 6.5 文档编写与审查**（与代码审查完成后执行）：

     **步骤1：调用 writer 子代理生成文档（必须，禁止主 Claude 直接编写）**
     ```
     Task(
       subagent_type="general-purpose",
       model="haiku",
       prompt="你是技术文档撰写专家（Writer）。
       【phase1接口契约】{phase1.interfaces}
       【本次变更文件列表】{变更文件列表}
       【phase0验收标准】{phase0.acceptance_criteria}
       编写完整文档：API文档、README更新、使用示例"
     )
     ```

     **步骤2：调用 quality-reviewer 审查文档（必须）**
     ```
     Task(
       subagent_type="general-purpose",
       model="sonnet",
       prompt="你是代码质量审查专家（Quality Reviewer）。
       【文档内容】{writer输出的文档}
       【接口契约】{phase1.interfaces}
       审查文档质量：准确性、完整性、可读性、示例正确性，输出问题列表"
     )
     ```

     **步骤3：主 Claude 交互检查**
     - 若 reviewer 发现问题 → 带问题列表重新调用 writer
     - 全部通过 → 记录文档路径

   - **知识沉淀（必须）**：
     ```
     axiom_harvest source_type=code_change
       title="TDD实现: {功能名称}"
       summary="{测试数量} | {覆盖率} | {遇到的陷阱} | {可复用测试模式}"
     ```

   - 更新 `active_context.md`：
     ```
     task_status: REFLECTING
     current_phase: Phase 3 - Done
     completed_tasks: T1,T2,T3
     fail_count: 0
     last_updated: {timestamp}
     ```
   - 自动触发 `axiom-reflect`

## Phase 7：完成验证（全部任务完成后执行）

**步骤1：调用 verifier 子代理（必须）**
```
Task(
  subagent_type="general-purpose",
  model="sonnet",
  prompt="你是验证专家（Verifier）。执行完整验证，逐条核对验收标准。
  【phase0验收标准】{phase0.acceptance_criteria}
  运行：测试/构建/lint，收集输出作为证据，输出逐条核对结果
  输出：PASS 或 FAIL + 具体证据（测试输出、构建日志）"
)
```

**步骤2：主 Claude 运行验证命令（强制，必须收集真实输出）**

调用 `verification-before-completion` 技能，然后主 Claude 直接运行：
```bash
# 根据项目技术栈选择对应命令
npm test / pytest / vitest
npm run build
npm run lint
```

- 全部通过 → 继续
- 任一失败 → 将失败输出注入 executor 修复，重新验证
- 无命令输出证据 → 不得声明完成

**硬门控**：
- [ ] 测试：全部通过（附输出）
- [ ] 构建：无错误
- [ ] 验收标准：逐条核对通过

**阶段完成总结（必须输出）**：
```
✅ Phase 7 完成验证通过
- 测试：全部通过（{N} 个）
- 构建：成功
- 验收标准：{N}/{N} 条通过
```

**用户确认（必须）**：
```
AskUserQuestion({
  question: "Phase 7 完成验证已通过，如何继续？",
  header: "Phase 7 → Phase 8",
  options: [
    { label: "✅ 进入 Phase 8 合并分支", description: "验证通过，合并到主分支" },
    { label: "⏭️ 跳过 Phase 8，直接进入 Phase 9", description: "未创建独立分支，无需合并" },
    { label: "🔄 返工 Phase 7", description: "验证有问题，重新修复" }
  ]
})
```

## 降级模式

由 `dev-flow` BLOCKED 状态出口B触发，传入参数 `--degraded`：

- 跳过当前阻塞的子任务，标记为 `SKIPPED`
- 继续执行后续无依赖的子任务
- 完成后在报告中列出所有 SKIPPED 任务，提示人工补全
