#!/usr/bin/env node
// post-tool-use.cjs - 记忆双写触发
const fs = require('fs');
const path = require('path');

async function main() {
  const input = await readStdin();
  const hook = JSON.parse(input);
  const toolName = hook.tool_name || '';
  const toolInput = hook.tool_input || {};

  // 只监听写入操作
  if (!['Write', 'Edit'].includes(toolName)) process.exit(0);

  const filePath = toolInput.file_path || '';
  if (!filePath.includes('.agent/memory/')) process.exit(0);

  syncToOmc();
  process.exit(0);
}

function syncToOmc() {
  const cwd = process.cwd();
  const memDir = path.join(cwd, '.agent/memory');
  const omcFile = path.join(cwd, '.omc/project-memory.json');

  if (!fs.existsSync(memDir)) return;
  fs.mkdirSync(path.join(cwd, '.omc'), { recursive: true });

  let omc = {};
  if (fs.existsSync(omcFile)) {
    try { omc = JSON.parse(fs.readFileSync(omcFile, 'utf8')); } catch {}
  }

  // 同步 active_context 状态
  const ctxFile = path.join(memDir, 'active_context.md');
  if (fs.existsSync(ctxFile)) {
    const ctx = fs.readFileSync(ctxFile, 'utf8');
    const m = ctx.match(/task_status:\s*(\w+)/);
    if (m) omc.axiom_status = m[1];
  }

  // 同步 project_decisions 摘要
  const pdFile = path.join(memDir, 'project_decisions.md');
  if (fs.existsSync(pdFile)) {
    const pd = fs.readFileSync(pdFile, 'utf8');
    if (!omc.notes) omc.notes = [];
    const summary = pd.slice(0, 500);
    if (!omc.notes.includes(summary)) omc.notes = [summary];
  }

  fs.writeFileSync(omcFile, JSON.stringify(omc, null, 2));
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
