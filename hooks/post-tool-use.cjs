#!/usr/bin/env node
// post-tool-use.cjs - 进化引擎钩子
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  const input = await readStdin();
  const hook = JSON.parse(input);
  const toolName = hook.tool_name || '';
  const toolInput = hook.tool_input || {};

  // TodoWrite：记录已完成任务，触发进化钩子
  if (toolName === 'TodoWrite') {
    const cwd = process.cwd();
    const todos = (hook.tool_input || {}).todos || [];
    todos.filter(t => t.status === 'completed').forEach(t => {
      appendMonitorLog(cwd, { ts: new Date().toISOString(), type: 'task_completed', id: t.id, content: t.content });
    });
    triggerEvolutionHook(hook);
    process.exit(0);
  }

  // 只监听写入操作
  if (!['Write', 'Edit'].includes(toolName)) process.exit(0);

  const filePath = (toolInput.file_path || '').replace(/\\/g, '/');
  const cwd = process.cwd();

  // 源码文件写入时自动沉淀知识（越用越强）
  if (!filePath.includes('.agent/memory/') && !filePath.includes('.omc/') && !filePath.includes('.claude/')) {
    const ext = path.extname(filePath);
    const srcExts = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.md'];
    if (srcExts.includes(ext)) {
      autoHarvestKnowledge(cwd, filePath, toolName, toolInput);
    }
  }

  if (!filePath.includes('.agent/memory/')) process.exit(0);

  appendMonitorLog(cwd, { ts: new Date().toISOString(), type: 'hook_write', tool: toolName, file: path.basename(filePath) });

  // active_context.md 变更时记录状态转换，并自动补全 manifest_path
  if (filePath.includes('active_context.md')) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const status = (content.match(/task_status:\s*(\w+)/) || [])[1];
      const execMode = (content.match(/execution_mode:\s*"?([^"\n]+)"?/) || [])[1];
      if (status) {
        const prevStatus = getPrevStatus(cwd);
        appendMonitorLog(cwd, { ts: new Date().toISOString(), type: 'state_change', task_status: status, execution_mode: execMode || '' });
        // G: IMPLEMENTING/REFLECTING → IDLE 时自动触发进化引擎
        if (status === 'IDLE' && ['IMPLEMENTING', 'REFLECTING'].includes(prevStatus)) {
          autoEvolve(cwd, content);
        }
      }

      // 自动补全 manifest_path：若字段为空且 manifest.md 存在则写入
      const manifestPath = (content.match(/manifest_path:\s*"?([^"\n]*)"?/) || [])[1] || '';
      const defaultManifest = '.agent/memory/manifest.md';
      if (!manifestPath.trim() && fs.existsSync(path.join(cwd, defaultManifest))) {
        content = content.replace(/^(manifest_path:\s*).*$/m, `$1${defaultManifest}`);
        fs.writeFileSync(filePath, content);
      }
    } catch {}
  }

  // manifest.md 写入时同步更新 phase-context.json 的 manifest 字段
  if (filePath.includes('manifest.md')) {
    syncPhaseContext(cwd, { manifest_path: '.agent/memory/manifest.md' });
  }

  triggerEvolutionHook(hook);
  syncToOmcProjectMemory(filePath);
  process.exit(0);
}

function syncPhaseContext(cwd, patch) {
  const pcFile = path.join(cwd, '.agent/memory/phase-context.json');
  try {
    let pc = {};
    if (fs.existsSync(pcFile)) {
      try { pc = JSON.parse(fs.readFileSync(pcFile, 'utf8')); } catch {}
    }
    Object.assign(pc, patch);
    fs.writeFileSync(pcFile, JSON.stringify(pc, null, 2));
  } catch {}
}

function triggerEvolutionHook(hook) {
  const cwd = process.cwd();
  const scriptPath = path.join(cwd, 'scripts/evolve.py');
  if (!fs.existsSync(scriptPath)) return;

  const toolName = hook.tool_name || '';
  const toolResponse = hook.tool_response || {};

  // 任务完成钩子：TodoWrite 标记 completed
  if (toolName === 'TodoWrite') {
    const todos = (hook.tool_input || {}).todos || [];
    todos.filter(t => t.status === 'completed').forEach(t => {
      try {
        execSync(`python scripts/evolve.py on-task-completed --task-id "${t.id}" --description "${(t.content || '').replace(/"/g, '')}"`, { cwd, stdio: 'ignore' });
      } catch {}
    });
  }
}

function syncToOmcProjectMemory(changedFile) {
  const cwd = process.cwd();
  const kbFile = path.join(cwd, '.agent/memory/evolution/knowledge_base.md');
  const ctxFile = path.join(cwd, '.agent/memory/active_context.md');
  const omcFile = path.join(cwd, '.omc/project-memory.json');

  try {
    let mem = {};
    if (fs.existsSync(omcFile)) {
      try { mem = JSON.parse(fs.readFileSync(omcFile, 'utf8')); } catch {}
    }

    // 从 knowledge_base.md 提取技术栈
    if (fs.existsSync(kbFile)) {
      const kb = fs.readFileSync(kbFile, 'utf8');
      const techMatches = kb.match(/tags:.*?(技术栈|framework|library)[^\n]*/gi) || [];
      if (techMatches.length) mem.techStack = techMatches.slice(0, 5).map(s => s.replace(/^tags:\s*/i, '').trim());
    }

    // 从 active_context.md 提取最近学习
    if (fs.existsSync(ctxFile)) {
      const ctx = fs.readFileSync(ctxFile, 'utf8');
      const learnings = ctx.match(/learnings?:[^\n]+/gi) || [];
      if (learnings.length) {
        mem.notes = mem.notes || [];
        learnings.slice(0, 3).forEach(l => {
          const note = l.replace(/^learnings?:\s*/i, '').trim();
          if (note && !mem.notes.includes(note)) mem.notes.unshift(note);
        });
        mem.notes = mem.notes.slice(0, 10);
      }
    }

    const omcDir = path.join(cwd, '.omc');
    if (!fs.existsSync(omcDir)) fs.mkdirSync(omcDir, { recursive: true });
    fs.writeFileSync(omcFile, JSON.stringify(mem, null, 2));
  } catch {}
}

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data || '{}'));
    setTimeout(() => resolve(data || '{}'), 3000);
  });
}

function getPrevStatus(cwd) {
  const logFile = path.join(cwd, '.agent/memory/monitor.log');
  if (!fs.existsSync(logFile)) return '';
  try {
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const entry = JSON.parse(lines[i]);
      if (entry.type === 'state_change') return entry.task_status || '';
    }
  } catch {}
  return '';
}

function autoEvolve(cwd, ctxContent) {
  const scriptPath = path.join(cwd, 'scripts/evolve.py');
  if (!fs.existsSync(scriptPath)) return;
  const sessionName = (ctxContent.match(/session_name:\s*"?([^"\n]+)"?/) || [])[1] || 'auto';
  try {
    execSync(`python scripts/evolve.py reflect --session-name "${sessionName}" --duration 0 --went-well "" --could-improve "" --learnings "" --action-items "" --auto-fix-count 0 --rollback-count 0`, { cwd, stdio: 'ignore' });
    execSync(`python scripts/evolve.py evolve`, { cwd, stdio: 'ignore' });
  } catch {}
}

function autoHarvestKnowledge(cwd, filePath, toolName, toolInput) {
  const kbDir = path.join(cwd, '.agent/memory/evolution');
  if (!fs.existsSync(kbDir)) return;
  try {
    const rel = path.relative(cwd, filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath).slice(1);
    const summary = toolName === 'Edit'
      ? `${(toolInput.old_string || '').slice(0, 60).replace(/\n/g, ' ')} → ${(toolInput.new_string || '').slice(0, 60).replace(/\n/g, ' ')}`
      : `新建/覆写 ${rel}`;
    const entry = { ts: new Date().toISOString(), file: rel, op: toolName, summary, lang: ext };
    fs.appendFileSync(path.join(kbDir, 'pending_harvest.jsonl'), JSON.stringify(entry) + '\n');
  } catch {}
}

function appendMonitorLog(cwd, entry) {
  const logFile = path.join(cwd, '.agent/memory/monitor.log');
  if (!fs.existsSync(path.dirname(logFile))) return;
  try {
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch {}
}

main().catch(() => process.exit(0));
