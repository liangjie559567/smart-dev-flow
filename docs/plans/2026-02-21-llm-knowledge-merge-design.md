# LLM 驱动知识合并设计

## 目标

解决 auto-harvest 无限增长和无去重问题，实现"越用越强"的知识积累。

## 架构

```
写文件 → post-tool-use hook
           ↓
     写入 pending_harvest.jsonl（轻量，无 LLM）
           ↓
用户下次提交 → user-prompt-submit hook
           ↓
     检测队列非空 → 注入合并指令给 Claude
           ↓
Claude 主进程：读队列 → ADD/UPDATE/NONE 判断 → 写 knowledge_base.md → 清空队列
```

## 数据格式

### pending_harvest.jsonl（每行一条）
```json
{"ts":"2026-02-21T10:00:00Z","file":"src/login.ts","op":"Edit","summary":"function login() → function signIn()","lang":"ts"}
```

### knowledge_base.md 条目格式（保持现有格式兼容）
```markdown
## K-auto-{timestamp}
**标题**: 代码变更: src/login.ts
**摘要**: 将 login() 重命名为 signIn()，统一命名风格
**来源**: auto_harvest
**语言**: ts
**日期**: 2026-02-21
**类型**: convention|bugfix|pattern|refactor
```

## 合并规则（Claude 执行）

注入给 Claude 的指令模板：
```
📚 知识队列待合并（{N} 条）：
{队列内容}

请对每条执行：
- ADD：新知识，不存在类似条目 → 追加到 knowledge_base.md
- UPDATE：已有类似条目但有更新 → 替换旧条目
- NONE：完全重复或无价值 → 跳过
合并完成后删除 .agent/memory/pending_harvest.jsonl
```

## 触发时机

- 队列条目 ≥ 5 条，或
- 距上次合并 > 30 分钟

## 文件变更

| 文件 | 变更 |
|------|------|
| `hooks/post-tool-use.cjs` | `autoHarvestKnowledge` 改为写 `pending_harvest.jsonl` |
| `hooks/user-prompt-submit.cjs` | 检测队列，注入合并指令 |
