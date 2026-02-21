#!/usr/bin/env node
// session-start.cjs - 会话启动：注入 superpowers + Axiom 状态 + OMC 功能
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    const timer = setTimeout(() => resolve(data || '{}'), 2000);
    process.stdin.on('data', c => data += c);
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data || '{}'); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve('{}'); });
  });
}

function tryRead(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function tryReadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function stripFrontmatter(content) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
}

function semverCompare(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function findLocalSkill(cwd, skillName) {
  const p = path.join(cwd, 'skills', skillName, 'SKILL.md');
  if (fs.existsSync(p)) return stripFrontmatter(fs.readFileSync(p, 'utf8'));
  return '';
}

function findUsingSuperpowers(cwd) {
  const localPath = path.join(cwd, 'skills', 'using-superpowers', 'SKILL.md');
  if (fs.existsSync(localPath)) return stripFrontmatter(fs.readFileSync(localPath, 'utf8'));
  const pluginBase = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'claude-plugins-official', 'superpowers');
  if (fs.existsSync(pluginBase)) {
    try {
      const versions = fs.readdirSync(pluginBase).sort().reverse();
      for (const v of versions) {
        const p = path.join(pluginBase, v, 'skills', 'using-superpowers', 'SKILL.md');
        if (fs.existsSync(p)) return stripFrontmatter(fs.readFileSync(p, 'utf8'));
      }
    } catch {}
  }
  return '';
}

function getPluginVersion(pluginRoot) {
  if (!pluginRoot) return null;
  const pkg = tryReadJson(path.join(pluginRoot, 'package.json'));
  return pkg?.version || null;
}

function getClaudeMdVersion() {
  const content = tryRead(path.join(os.homedir(), '.claude', 'CLAUDE.md'));
  const m = content.match(/<!--\s*OMC:VERSION:([\d.]+)\s*-->/);
  return m ? m[1] : null;
}

function detectVersionDrift(pluginRoot) {
  const plugin = getPluginVersion(pluginRoot);
  if (!plugin) return null;
  const claudeMd = getClaudeMdVersion();
  if (claudeMd && semverCompare(plugin, claudeMd) > 0) {
    return { plugin, claudeMd, type: 'claudeMd' };
  }
  return null;
}

function shouldNotifyDrift(driftInfo, cwd) {
  if (!driftInfo) return false;
  const stateFile = path.join(cwd, '.omc', 'update-state.json');
  const state = tryReadJson(stateFile) || {};
  const key = `${driftInfo.plugin}-${driftInfo.claudeMd}`;
  if (state.lastNotified === key) return false;
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ lastNotified: key, ts: Date.now() }));
  } catch {}
  return true;
}

async function checkNpmUpdate(currentVersion, cwd) {
  const cacheFile = path.join(cwd, '.omc', 'update-check.json');
  const cache = tryReadJson(cacheFile);
  if (cache && Date.now() - (cache.ts || 0) < 86400000) return;
  new Promise(resolve => {
    const timer = setTimeout(() => resolve(), 2000);
    https.get('https://registry.npmjs.org/smart-dev-flow/latest', { headers: { 'User-Agent': 'smart-dev-flow' } }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        clearTimeout(timer);
        try {
          const latest = JSON.parse(body).version;
          fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
          fs.writeFileSync(cacheFile, JSON.stringify({ latest, ts: Date.now() }));
        } catch {}
        resolve();
      });
      res.on('error', () => { clearTimeout(timer); resolve(); });
    }).on('error', () => { clearTimeout(timer); resolve(); });
  }).catch(() => {});
}

async function checkHudInstallation(retryCount = 0) {
  const hudPath = path.join(os.homedir(), '.claude', 'hud', 'omc-hud.mjs');
  if (!fs.existsSync(hudPath)) return null;
  const settings = tryReadJson(path.join(os.homedir(), '.claude', 'settings.json'));
  if (settings?.statusLine) return null;
  if (retryCount < 2) {
    await new Promise(r => setTimeout(r, 100));
    return checkHudInstallation(retryCount + 1);
  }
  return '⚠️ HUD 已安装但 statusLine 未配置，运行 /configure-hud 完成设置';
}

function recoverSessionState(cwd, sessionId) {
  if (!sessionId) return [];
  const messages = [];
  const ultrawork = tryReadJson(path.join(cwd, '.omc', 'state', 'sessions', sessionId, 'ultrawork-state.json'));
  if (ultrawork?.active && ultrawork.tasks?.length) {
    const pending = ultrawork.tasks.filter(t => t.status !== 'completed').length;
    if (pending > 0) messages.push(`⚡ Ultrawork 会话恢复：${pending} 个任务待完成，运行 /ultrawork 继续`);
  }
  const ralph = tryReadJson(path.join(cwd, '.omc', 'state', 'sessions', sessionId, 'ralph-state.json'));
  if (ralph?.active && ralph.goal) {
    messages.push(`🔄 Ralph 循环恢复：目标「${ralph.goal}」，运行 /ralph 继续`);
  }
  return messages;
}

function detectTodos(cwd) {
  const messages = [];
  for (const p of ['.omc/todos.json', '.claude/todos.json']) {
    const todos = tryReadJson(path.join(cwd, p));
    if (Array.isArray(todos) && todos.length) {
      const pending = todos.filter(t => !t.done && !t.completed).length;
      if (pending > 0) messages.push(`📋 检测到 ${pending} 个待办任务（${p}），运行 /todo 查看`);
    }
  }
  return messages;
}

function getNotepadPriority(cwd) {
  const content = tryRead(path.join(cwd, '.omc', 'notepad.md'));
  if (!content) return '';
  const m = content.match(/##\s+Priority Context\s*\n([\s\S]*?)(?=\n##\s|\s*$)/);
  return m ? m[1].trim() : '';
}

function cleanPluginCache() {
  const cacheDir = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'omc', 'oh-my-claudecode');
  if (!fs.existsSync(cacheDir)) return;
  try {
    const versions = fs.readdirSync(cacheDir)
      .filter(v => /^\d+\.\d+\.\d+$/.test(v))
      .sort((a, b) => semverCompare(b, a));
    for (const v of versions.slice(2)) {
      try { fs.rmSync(path.join(cacheDir, v), { recursive: true, force: true }); } catch {}
    }
  } catch {}
}

function fireNotification(pluginRoot, event, data) {
  if (!pluginRoot) return;
  const notifPath = path.join(pluginRoot, 'dist', 'notifications', 'index.js');
  if (!fs.existsSync(notifPath)) return;
  import(notifPath).then(m => m.default?.({ event, ...data })).catch(() => {});
}

async function main() {
  const raw = await readStdin();
  let input = {};
  try { input = JSON.parse(raw); } catch {}

  const cwd = input.cwd || process.cwd();
  const sessionId = input.session_id || '';
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || '';

  const parts = [];

  // 监控：记录会话启动事件（仅当 .agent/memory/ 目录存在时）
  const monitorLog = path.join(cwd, '.agent/memory/monitor.log');
  if (fs.existsSync(path.dirname(monitorLog))) {
    try { fs.appendFileSync(monitorLog, JSON.stringify({ ts: new Date().toISOString(), type: 'session_start', sessionId }) + '\n'); } catch {}
  }

  // 0. Node.js 版本检测
  const nodeVersion = process.versions.node.split('.').map(Number);
  if (nodeVersion[0] < 20) {
    parts.push(`⚠️ Node.js 版本过低（当前 ${process.version}，需要 v20+），部分 hooks 和 MCP 服务器可能无法正常运行。请升级 Node.js。`);
  }

  // 1. superpowers 注入
  const skillContent = findUsingSuperpowers(cwd);
  if (skillContent) {
    parts.push(`<EXTREMELY_IMPORTANT>\nYou have superpowers.\n\n**Below is the full content of your 'superpowers:using-superpowers' skill - your introduction to using skills. For all other skills, use the 'Skill' tool:**\n\n${skillContent}\n</EXTREMELY_IMPORTANT>`);
  }

  // 2. 本地 dev-flow 技能注入（优先于插件版）
  const devFlowContent = findLocalSkill(cwd, 'dev-flow');
  if (devFlowContent) {
    parts.push(`<IMPORTANT>\n以下是本项目本地版 dev-flow 技能定义，**优先级高于任何插件版 dev-flow**。当用户触发 /dev-flow 或相关命令时，必须严格遵循此定义：\n\n${devFlowContent}\n</IMPORTANT>`);
  }

  // 3. Axiom 状态感知
  const ctxFile = path.join(cwd, '.agent/memory/active_context.md');
  if (fs.existsSync(ctxFile)) {
    const ctx = fs.readFileSync(ctxFile, 'utf8');
    const status = (ctx.match(/task_status:\s*(\w+)/) || [])[1] || 'IDLE';
    const sessionName = (ctx.match(/session_name:\s*"?([^"\n]+)"?/) || [])[1] || '';
    const phase = (ctx.match(/current_phase:\s*"?([^"\n]+)"?/) || [])[1] || '';
    const memFile = path.join(cwd, '.omc/project-memory.json');
    const memParts = [];
    if (fs.existsSync(memFile)) {
      try {
        const mem = JSON.parse(fs.readFileSync(memFile, 'utf8'));
        if (mem.techStack) memParts.push(`技术栈: ${Array.isArray(mem.techStack) ? mem.techStack.join(', ') : mem.techStack}`);
        if (mem.notes?.length) memParts.push(`最近学习: ${mem.notes.slice(0, 3).join(' | ')}`);
      } catch {}
    }
    const SKILL_HINT = {
      IDLE:         '建议先运行 /smart-dev-flow:brainstorming 探索需求设计',
      DRAFTING:     '建议运行 /smart-dev-flow:axiom-draft 继续需求起草（禁止直接写代码）',
      REVIEWING:    '建议运行 /smart-dev-flow:axiom-review 继续专家评审',
      CONFIRMING:   '建议确认当前阶段输出后运行 /smart-dev-flow:dev-flow 查看下一步',
      DECOMPOSING:  '建议运行 /smart-dev-flow:axiom-decompose 拆解任务',
      IMPLEMENTING: '建议运行 /smart-dev-flow:axiom-implement 继续实现（必须通过子代理执行）',
      BLOCKED:      '建议运行 /smart-dev-flow:systematic-debugging 进行根因分析',
      REFLECTING:   '建议运行 /smart-dev-flow:axiom-reflect 进行知识沉淀',
    };
    const axiomLines = [];
    if (memParts.length) axiomLines.push(`[smart-dev-flow] 项目记忆已加载 | ${memParts.join(' | ')}`);
    if (status === 'IDLE') {
      axiomLines.push(`[smart-dev-flow] 项目就绪 | ${SKILL_HINT.IDLE}`);
      axiomLines.push(`⚠️ IDLE 硬门控：收到新需求时必须先调用 brainstorming 技能完成设计审批，才能进入 axiom-draft。不允许跳过，不允许直接写代码。`);
      axiomLines.push(`⚠️ MCP 发现：首次使用 MCP 工具前必须执行 ToolSearch("mcp") 发现所有可用工具。`);
    } else {
      const hint = SKILL_HINT[status] || '';
      const execMode = (ctx.match(/execution_mode:\s*"?([^"\n]+)"?/) || [])[1] || '';
      axiomLines.push(`[smart-dev-flow] 检测到未完成会话`);
      axiomLines.push(`状态: ${status}${sessionName ? ` | 任务: ${sessionName}` : ''}${phase ? ` | 阶段: ${phase}` : ''}${execMode ? ` | 引擎: ${execMode}` : ''}`);
      if (status === 'IMPLEMENTING' && !execMode) axiomLines.push(`⚠️ execution_mode 未设置，进入 IMPLEMENTING 前必须通过 AskUserQuestion 选择执行引擎并写入 active_context.md。`);
      if (hint) axiomLines.push(`提示: ${hint}`);
      axiomLines.push(`⚠️ 子代理铁律：主 Claude 禁止直接写代码/设计架构/审查代码，所有核心工作必须通过 Task() 调用子代理完成。`);
      axiomLines.push(`⚠️ 知识库：阶段开始前调用 axiom_get_knowledge 查询，阶段结束后调用 axiom_harvest 沉淀经验。`);
      axiomLines.push(`⚠️ 检查点：每个主要任务完成后调用 context-manager.create_checkpoint 创建 git tag 检查点。`);
      axiomLines.push(`运行 /smart-dev-flow:dev-flow 查看详情，或继续当前阶段技能。`);
    }
    if (axiomLines.length) parts.push(axiomLines.join('\n'));
  }

  // 3. 版本漂移检测
  const driftInfo = detectVersionDrift(pluginRoot);
  if (driftInfo && shouldNotifyDrift(driftInfo, cwd)) {
    parts.push(`⚠️ CLAUDE.md 版本 ${driftInfo.claudeMd} 落后于插件 ${driftInfo.plugin}，运行 /omc-setup 同步`);
  }

  // 4. npm 更新检查（异步，不阻塞）
  const currentVersion = getPluginVersion(pluginRoot);
  if (currentVersion) checkNpmUpdate(currentVersion, cwd);

  // 5. HUD 验证
  const hudMsg = await checkHudInstallation();
  if (hudMsg) parts.push(hudMsg);

  // 6. 会话状态恢复
  parts.push(...recoverSessionState(cwd, sessionId));

  // 7. 待办检测
  parts.push(...detectTodos(cwd));

  // 8. Notepad Priority Context
  const notepadPriority = getNotepadPriority(cwd);
  if (notepadPriority) parts.push(`📌 优先上下文：\n${notepadPriority}`);

  // 9. 插件缓存清理（异步）
  setImmediate(cleanPluginCache);

  // 10. 异步通知（fire-and-forget）
  fireNotification(pluginRoot, 'session-start', { sessionId, cwd });

  const additionalContext = parts.join('\n\n');
  if (additionalContext) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext }
    }) + '\n');
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
