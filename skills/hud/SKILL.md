---
name: hud
description: Configure HUD display options (layout, presets, display elements)
role: config-writer  # DOCUMENTATION ONLY - This skill writes to ~/.claude/ paths
scope: ~/.claude/**  # DOCUMENTATION ONLY - Allowed write scope
---

# HUD Skill

Configure the OMC HUD (Heads-Up Display) for the statusline.

## 默认看板行为（/hud 无参数时）

> 只读操作，不写入任何文件。

### Step 1 - 数据源读取

**Axiom**：读取 `.agent/memory/active_context.md` YAML frontmatter，提取：
- `task_status`、`current_phase`、`blocked_reason`、`omc_team_phase`
- 文件不存在或 frontmatter 解析失败 → 返回 null，不影响后续渲染

**OMC**：按以下顺序逐个尝试读取（JSON 解析失败或文件不存在则跳过，视为 null）：
1. `.omc/state/ralph-state.json`
2. `.omc/state/team-state.json`
3. `.omc/state/ultrawork-state.json`
4. `.omc/state/autopilot-state.json`

**Todos**：读取 `.agent/memory/manifest.md`，统计 `- [x]` 行数为 `n`，`- [ ]` + `- [x]` 总行数为 `total`。文件不存在则 todos=null。

### Step 2 - 聚合逻辑

`active_omc_mode` 按上述顺序取第一个 `active === true` 的模式（缺少 `active` 字段视为 false）：

```
ralph.active=true  → "ralph"   + detail = "{iteration}/{maxIterations} {currentStoryId}"
team.active=true   → "team"    + detail = "{phase}({tasks_completed}/{tasks_total})"（fix_loop.attempt>0 时追加 " fix#{attempt}"）
ultrawork.active=true → "ultrawork" + detail = null
autopilot.active=true → "autopilot" + detail = null
否则               → null
```

### Step 3 - 渲染看板

读取 `~/.claude/.omc/hud-config.json`（受 `CLAUDE_CONFIG_DIR` 影响）的 `preset` 字段，默认 `"focused"`：

**minimal**：
```
[OMC] {active_omc_mode} | axiom:{task_status}
```

**focused**：
```
[OMC] axiom:{task_status}·{current_phase} | {active_omc_mode}:{detail} | todos:{n}/{total}
```

**full**：focused 内容，若 `blocked_reason` 非空则追加一行：
```
⚠ {blocked_reason}
```

**降级规则**：
- 任何字段为 null/undefined/空字符串时，省略该字段及其前置分隔符（`|` 或 `·`）
- `{active_omc_mode}:{detail}` 中若 detail=null，省略 `:{detail}` 部分
- `axiom:{task_status}·{current_phase}` 中若 current_phase=null，省略 `·{current_phase}` 部分
- 当所有数据源都不可用时，输出 `[OMC] idle`

---

Note: All `~/.claude/...` paths in this guide respect `CLAUDE_CONFIG_DIR` when that environment variable is set.

## Quick Commands

| Command | Description |
|---------|-------------|
| `/smart-dev-flow:hud` | Show current HUD status (auto-setup if needed) |
| `/smart-dev-flow:hud setup` | Install/repair HUD statusline |
| `/smart-dev-flow:hud minimal` | Switch to minimal display |
| `/smart-dev-flow:hud focused` | Switch to focused display (default) |
| `/smart-dev-flow:hud full` | Switch to full display |
| `/smart-dev-flow:hud status` | Show detailed HUD status |

## Auto-Setup

When you run `/smart-dev-flow:hud` or `/smart-dev-flow:hud setup`, the system will automatically:
1. Check if `~/.claude/hud/omc-hud.mjs` exists
2. Check if `statusLine` is configured in `~/.claude/settings.json`
3. If missing, create the HUD wrapper script and configure settings
4. Report status and prompt to restart Claude Code if changes were made

**IMPORTANT**: If the argument is `setup` OR if the HUD script doesn't exist at `~/.claude/hud/omc-hud.mjs`, you MUST create the HUD files directly using the instructions below.

### Setup Instructions (Run These Commands)

**Step 1:** Check if setup is needed:
```bash
node -e "const p=require('path'),f=require('fs'),d=process.env.CLAUDE_CONFIG_DIR||p.join(require('os').homedir(),'.claude');console.log(f.existsSync(p.join(d,'hud','omc-hud.mjs'))?'EXISTS':'MISSING')"
```

**Step 2:** Verify the plugin is installed:
```bash
node -e "const p=require('path'),f=require('fs'),d=process.env.CLAUDE_CONFIG_DIR||p.join(require('os').homedir(),'.claude'),b=p.join(d,'plugins','cache','smart-dev-flow','smart-dev-flow');try{const v=f.readdirSync(b).filter(x=>/^\d/.test(x)).sort((a,c)=>a.localeCompare(c,void 0,{numeric:true}));if(v.length===0){console.log('Plugin not installed - run: /plugin install smart-dev-flow');process.exit()}const l=v[v.length-1],h=p.join(b,l,'dist','hud','index.js');console.log('Version:',l);console.log(f.existsSync(h)?'READY':'NOT_FOUND - try reinstalling: /plugin install smart-dev-flow')}catch{console.log('Plugin not installed - run: /plugin install smart-dev-flow')}"
```

**Step 3:** If omc-hud.mjs is MISSING or argument is `setup`, create the HUD directory and script:

First, create the directory:
```bash
node -e "require('fs').mkdirSync(require('path').join(process.env.CLAUDE_CONFIG_DIR||require('path').join(require('os').homedir(),'.claude'),'hud'),{recursive:true})"
```

Then, use the Write tool to create `~/.claude/hud/omc-hud.mjs` with this exact content:

```javascript
#!/usr/bin/env node
/**
 * OMC HUD - Statusline Script
 * Wrapper that imports from plugin cache or development paths
 */

import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Semantic version comparison: returns negative if a < b, positive if a > b, 0 if equal
function semverCompare(a, b) {
  // Use parseInt to handle pre-release suffixes (e.g. "0-beta" -> 0)
  const pa = a.replace(/^v/, "").split(".").map(s => parseInt(s, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map(s => parseInt(s, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  // If numeric parts equal, non-pre-release > pre-release
  const aHasPre = /-/.test(a);
  const bHasPre = /-/.test(b);
  if (aHasPre && !bHasPre) return -1;
  if (!aHasPre && bHasPre) return 1;
  return 0;
}

async function main() {
  const home = homedir();
  let pluginCacheDir = null;

  // 1. Try plugin cache first (marketplace: omc, plugin: smart-dev-flow)
  const pluginCacheBase = join(home, ".claude/plugins/cache/smart-dev-flow/smart-dev-flow");
  if (existsSync(pluginCacheBase)) {
    try {
      const versions = readdirSync(pluginCacheBase);
      if (versions.length > 0) {
        const latestVersion = versions.sort(semverCompare).reverse()[0];
        pluginCacheDir = join(pluginCacheBase, latestVersion);
        const pluginPath = join(pluginCacheDir, "dist/hud/index.js");
        if (existsSync(pluginPath)) {
          await import(pathToFileURL(pluginPath).href);
          return;
        }
      }
    } catch { /* continue */ }
  }

  // 2. Development paths
  const devPaths = [
    join(home, "Workspace/oh-my-claude-sisyphus/dist/hud/index.js"),
    join(home, "workspace/oh-my-claude-sisyphus/dist/hud/index.js"),
    join(home, "Workspace/smart-dev-flow/dist/hud/index.js"),
    join(home, "workspace/smart-dev-flow/dist/hud/index.js"),
  ];

  for (const devPath of devPaths) {
    if (existsSync(devPath)) {
      try {
        await import(pathToFileURL(devPath).href);
        return;
      } catch { /* continue */ }
    }
  }

  // 3. Fallback - HUD not found (provide actionable error message)
  if (pluginCacheDir) {
    console.log(`[OMC] HUD not built. Run: cd "${pluginCacheDir}" && npm install`);
  } else {
    console.log("[OMC] Plugin not found. Run: /smart-dev-flow:omc-setup");
  }
}

main();
```

**Step 3:** Make it executable (Unix only, skip on Windows):
```bash
node -e "if(process.platform==='win32'){console.log('Skipped (Windows)')}else{require('fs').chmodSync(require('path').join(process.env.CLAUDE_CONFIG_DIR||require('path').join(require('os').homedir(),'.claude'),'hud','omc-hud.mjs'),0o755);console.log('Done')}"
```

**Step 4:** Update settings.json to use the HUD:

Read `~/.claude/settings.json`, then update/add the `statusLine` field.

**IMPORTANT:** The command must use an absolute path, not `~`, because Windows does not expand `~` in shell commands.

First, determine the correct path:
```bash
node -e "const p=require('path').join(require('os').homedir(),'.claude','hud','omc-hud.mjs');console.log(JSON.stringify(p))"
```

Then set the `statusLine` field using the resolved path. On Unix it will look like:
```json
{
  "statusLine": {
    "type": "command",
    "command": "node /home/username/.claude/hud/omc-hud.mjs"
  }
}
```

On Windows it will look like:
```json
{
  "statusLine": {
    "type": "command",
    "command": "node C:\\Users\\username\\.claude\\hud\\omc-hud.mjs"
  }
}
```

Use the Edit tool to add/update this field while preserving other settings.

**Step 5:** Clean up old HUD scripts (if any):
```bash
node -e "const p=require('path'),f=require('fs'),d=process.env.CLAUDE_CONFIG_DIR||p.join(require('os').homedir(),'.claude'),t=p.join(d,'hud','sisyphus-hud.mjs');try{if(f.existsSync(t)){f.unlinkSync(t);console.log('Removed legacy script')}else{console.log('No legacy script found')}}catch{}"
```

**Step 6:** Tell the user to restart Claude Code for changes to take effect.

## 数据源与聚合架构

HUD 聚合两个独立数据源，任一缺失时优雅降级（仅显示可用部分）。

### 数据源 1：Axiom 状态

文件：`.agent/memory/active_context.md`（YAML frontmatter）

读取字段：
| 字段 | 用途 |
|------|------|
| `task_status` | 当前阶段标签（IDLE/DRAFTING/IMPLEMENTING 等） |
| `current_phase` | 阶段描述文本 |
| `blocked_reason` | 阻塞原因（非空时显示警告） |
| `omc_team_phase` | 与 OMC team 联动的阶段 |

降级：文件不存在或 frontmatter 解析失败 → 不显示 Axiom 区块。

### 数据源 2：OMC 执行状态

目录：`.omc/state/`，按需读取以下文件：

| 文件 | 读取字段 | 显示用途 |
|------|----------|----------|
| `ralph-state.json` | `active`, `iteration`, `maxIterations`, `currentStoryId` | ralph 循环进度 |
| `team-state.json` | `active`, `phase`, `execution.tasks_completed`, `execution.tasks_total`, `fix_loop.attempt` | team 流水线阶段 |
| `ultrawork-state.json` | `active`, `reinforcementCount` | ultrawork 模式标记 |
| `autopilot-state.json` | `active`（已有原生支持） | autopilot 阶段 |

读取策略：逐文件尝试读取，JSON 解析失败或文件不存在均跳过，不中断渲染。

### 聚合逻辑

```
axiom  = parse_frontmatter(".agent/memory/active_context.md") ?? null
ralph  = try_read_json(".omc/state/ralph-state.json") ?? null
team   = try_read_json(".omc/state/team-state.json") ?? null
ulw    = try_read_json(".omc/state/ultrawork-state.json") ?? null

active_omc_mode =
  ralph?.active  → "ralph"
  team?.active   → "team"
  ulw?.active    → "ultrawork"
  else           → null
```

---

## Display Presets

### Minimal
Shows only the essentials:
```
[OMC] ralph | ultrawork | todos:2/5
```

### Focused (Default)
Shows all relevant elements:
```
[OMC] branch:main | ralph:3/10 | US-002 | ultrawork skill:planner | ctx:67% | agents:2 | bg:3/5 | todos:2/5
```

带 Axiom 状态时：
```
[OMC] branch:main | axiom:IMPLEMENTING·Phase3 | ralph:3/10 | team:exec(4/7) | ctx:67% | todos:2/5
```

### Full
Shows everything including multi-line agent details:
```
[OMC] repo:smart-dev-flow branch:main | ralph:3/10 | US-002 (2/5) | ultrawork | ctx:[████░░]67% | agents:3 | bg:3/5 | todos:2/5
├─ O architect    2m   analyzing architecture patterns...
├─ e explore     45s   searching for test files
└─ s executor     1m   implementing validation logic
```

带完整双数据源时（Full 模式）：
```
[OMC] repo:smart-dev-flow branch:main | axiom:IMPLEMENTING·Phase3 | team:exec(4/7) fix#1 | ctx:[████░░]67% | agents:3 | todos:2/5
├─ O architect    2m   analyzing architecture patterns...
└─ s executor     1m   implementing validation logic
```

## Multi-Line Agent Display

When agents are running, the HUD shows detailed information on separate lines:
- **Tree characters** (`├─`, `└─`) show visual hierarchy
- **Agent code** (O, e, s) indicates agent type with model tier color
- **Duration** shows how long each agent has been running
- **Description** shows what each agent is doing (up to 45 chars)

## Display Elements

| Element | Description |
|---------|-------------|
| `[OMC]` | Mode identifier |
| `repo:name` | Git repository name (cyan) |
| `branch:name` | Git branch name (cyan) |
| `ralph:3/10` | Ralph loop iteration/max |
| `US-002` | Current PRD story ID |
| `ultrawork` | Active mode badge |
| `skill:name` | Last activated skill (cyan) |
| `ctx:67%` | Context window usage |
| `agents:2` | Running subagent count |
| `bg:3/5` | Background task slots |
| `todos:2/5` | Todo completion |

## Color Coding

- **Green**: Normal/healthy
- **Yellow**: Warning (context >70%, ralph >7)
- **Red**: Critical (context >85%, ralph at max)

## Configuration Location

HUD config is stored at: `~/.claude/.omc/hud-config.json`

## Manual Configuration

You can manually edit the config file. Each option can be set individually - any unset values will use defaults.

```json
{
  "preset": "focused",
  "elements": {
    "omcLabel": true,
    "ralph": true,
    "prdStory": true,
    "activeSkills": true,
    "lastSkill": true,
    "contextBar": true,
    "agents": true,
    "backgroundTasks": true,
    "todos": true,
    "showCache": true,
    "showCost": true,
    "maxOutputLines": 4
  },
  "thresholds": {
    "contextWarning": 70,
    "contextCritical": 85,
    "ralphWarning": 7
  }
}
```

## Troubleshooting

If the HUD is not showing:
1. Run `/smart-dev-flow:hud setup` to auto-install and configure
2. Restart Claude Code after setup completes
3. If still not working, run `/smart-dev-flow:omc-doctor` for full diagnostics

Manual verification:
- HUD script: `~/.claude/hud/omc-hud.mjs`
- Settings: `~/.claude/settings.json` should have `statusLine` configured

---

*The HUD updates automatically every ~300ms during active sessions.*

---

## ADR：扩展数据源以包含 OMC 状态

**日期**：2026-02-20
**状态**：已采纳

### 决策

HUD 从单一数据源（transcript 解析）扩展为双数据源聚合：
1. Axiom 状态（`.agent/memory/active_context.md` YAML frontmatter）
2. OMC 执行状态（`.omc/state/*.json` 文件集合）

### 理由

- HUD 原本仅通过 transcript 解析推断 ralph/team/ultrawork 状态，存在延迟和误判风险。
- OMC 状态文件是执行模式的 source of truth，直接读取比 transcript 推断更准确。
- Axiom `task_status` 提供开发流程阶段信息，与 OMC 执行模式互补（前者描述"做什么"，后者描述"怎么跑"）。

### 约束与取舍

- **只读**：HUD 不写入任何状态文件，仅消费。
- **优雅降级**：每个数据源独立读取，失败不影响其他数据源渲染。
- **不引入新依赖**：复用现有 `try/catch` JSON 读取模式，无需新库。
- **不修改状态文件 schema**：仅读取已有字段（`active`, `iteration`, `phase` 等）。
