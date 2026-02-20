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

  // TodoWrite：只触发进化钩子，不做记忆同步
  if (toolName === 'TodoWrite') {
    triggerEvolutionHook(hook);
    process.exit(0);
  }

  // 只监听写入操作
  if (!['Write', 'Edit'].includes(toolName)) process.exit(0);

  const filePath = toolInput.file_path || '';
  if (!filePath.includes('.agent/memory/')) process.exit(0);

  triggerEvolutionHook(hook);
  syncToOmcProjectMemory(filePath);
  process.exit(0);
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

main().catch(() => process.exit(0));
