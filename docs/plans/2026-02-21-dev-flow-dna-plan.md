# dev-flow DNA 系统实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 dev-flow 越用越强——项目经验自动积累到 project-dna.md，每次开发时自动注入历史踩坑和成功模式。

**Architecture:** project-dna.md（项目级）+ global-dna.md（全局）+ user-prompt-submit 注入 + axiom-state-sync 触发更新

**Tech Stack:** Node.js CJS hooks, ESM scripts, Vitest

---

## T01: 创建 dna-manager.cjs 工具模块
依赖: 无
预估: 20 分钟
验收条件:
  - [ ] `readDna(cwd)` 读取 project-dna.md + ~/.claude/global-dna.md，返回合并文本
  - [ ] `extractRelevant(dnaText, keywords)` 按关键词提取最相关段落（最多 5 条）
  - [ ] `appendToDna(cwd, section, entry)` 追加一条到指定 section（踩过的坑/成功模式）
  - [ ] 文件不存在时 readDna 返回空字符串，appendToDna 自动创建文件

实现要点:
```
// hooks/dna-manager.cjs
readDna(cwd):
  projectDna = readFile(cwd/.agent/memory/project-dna.md) || ''
  globalDna  = readFile(~/.claude/global-dna.md) || ''
  return projectDna + '\n' + globalDna

extractRelevant(dnaText, keywords):
  lines = dnaText.split('\n')
  scored = lines.map(line => score = keywords.filter(k => line.includes(k)).length)
  return top 5 lines with score > 0

appendToDna(cwd, section, entry):
  file = cwd/.agent/memory/project-dna.md
  content = readFile(file) || defaultTemplate
  insert entry under ## {section}
  writeFile(file, content)
```

---

## T02: 修改 user-prompt-submit.cjs — 注入 DNA 上下文
依赖: T01
预估: 20 分钟
验收条件:
  - [ ] 当 task_status 为 DRAFTING/DECOMPOSING/IMPLEMENTING 时触发 DNA 注入
  - [ ] 从 prompt 提取关键词（技术词、功能词），调用 extractRelevant
  - [ ] 有相关内容时追加到 additionalContext（格式：`🧬 历史经验：\n- ...`）
  - [ ] DNA 文件不存在或无相关内容时静默跳过，不影响正常流程
  - [ ] 注入优先级低于知识队列合并（知识队列触发时跳过 DNA 注入）

实现要点:
```
// 在现有 pending_harvest 检测之后、process.exit(0) 之前插入：
const DEV_STATES = ['DRAFTING', 'DECOMPOSING', 'IMPLEMENTING']
if (DEV_STATES.includes(status)) {
  const { readDna, extractRelevant } = require('./dna-manager.cjs')
  const dna = readDna(cwd)
  if (dna) {
    const keywords = prompt.split(/\s+/).filter(w => w.length > 3)
    const relevant = extractRelevant(dna, keywords)
    if (relevant.length > 0) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: `🧬 历史经验：\n${relevant.map(l => `- ${l}`).join('\n')}`
        }
      }))
      process.exit(0)
    }
  }
}
```

---

## T03: 修改 axiom-state-sync.mjs — Phase 结束触发 DNA 更新提示
依赖: 无（独立修改）
预估: 15 分钟
验收条件:
  - [ ] 状态转换到 REVIEWING/DECOMPOSING/REFLECTING/IDLE 时，在 additionalContext 追加 DNA 更新提示
  - [ ] 轻量提示（Phase 结束）：只提示记录踩坑
  - [ ] 深度提示（IDLE，dev-flow 结束）：提示提取模式 + 更新 global-dna.md
  - [ ] 提示内容包含具体文件路径和格式示例

实现要点:
```
// 在 writeFileSync 之后追加输出：
const isEnd = stateUpdate.task_status === 'IDLE'
const dnaHint = isEnd
  ? `🧬 dev-flow 完成！请提取本次可复用模式追加到 .agent/memory/project-dna.md ## 成功模式，跨项目通用经验追加到 ~/.claude/global-dna.md ## 通用模式。格式：- [${today}] 描述`
  : `🧬 Phase 完成。本次有新踩的坑吗？有则追加到 .agent/memory/project-dna.md ## 踩过的坑。格式：- [${today}][${phase}] 描述`

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: dnaHint
  }
}))
```

---

## T04: 创建 project-dna.md 模板
依赖: 无
预估: 5 分钟
验收条件:
  - [ ] 文件存在于 `.agent/memory/project-dna.md`
  - [ ] 包含 ## 技术选型、## 踩过的坑、## 成功模式 三个 section
  - [ ] 已填入当前项目的已知信息（Node.js CJS/ESM、Vitest、hooks 结构）

---

## T05: 添加测试
依赖: T01, T02, T03
预估: 20 分钟
验收条件:
  - [ ] `readDna` 文件不存在时返回空字符串
  - [ ] `extractRelevant` 关键词匹配返回正确行
  - [ ] `appendToDna` 正确追加到指定 section
  - [ ] user-prompt-submit IMPLEMENTING 状态 + 有 DNA 内容时输出 `🧬 历史经验`
  - [ ] user-prompt-submit IDLE 状态时不触发 DNA 注入
  - [ ] axiom-state-sync IDLE 转换时输出深度 DNA 提示
  - [ ] axiom-state-sync REVIEWING 转换时输出轻量 DNA 提示

---

## 执行顺序

T01 → T02（依赖 T01）
T03（独立，可与 T01/T02 并行）
T04（独立，可随时执行）
T05（依赖 T01/T02/T03）
