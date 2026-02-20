#!/usr/bin/env node
// pre-compact.cjs - 上下文压缩前保存 Axiom 关键状态
const fs = require('fs');
const path = require('path');

async function main() {
  const input = await readStdin();
  const cwd = process.cwd();
  const ctxFile = path.join(cwd, '.agent/memory/active_context.md');
  if (!fs.existsSync(ctxFile)) { process.exit(0); }

  const ctx = fs.readFileSync(ctxFile, 'utf8');
  const get = (key) => (ctx.match(new RegExp(`${key}:\\s*"?([^"\\n]+)"?`)) || [])[1] || '';

  const omcDir = path.join(cwd, '.omc');
  fs.mkdirSync(omcDir, { recursive: true });

  const pmFile = path.join(omcDir, 'project-memory.json');
  let pm = {};
  if (fs.existsSync(pmFile)) {
    try { pm = JSON.parse(fs.readFileSync(pmFile, 'utf8')); } catch {}
  }

  pm.axiom_status = get('task_status');
  pm.session_name = get('session_name');
  pm.current_task = get('current_task');
  pm.current_phase = get('current_phase');
  pm.last_updated = get('last_updated');
  pm.pre_compact_saved_at = new Date().toISOString();

  fs.writeFileSync(pmFile, JSON.stringify(pm, null, 2));
  process.exit(0);
}

function readStdin() {
  return new Promise(resolve => {
    let d = '';
    process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => resolve(d || '{}'));
    setTimeout(() => resolve(d || '{}'), 2000);
  });
}

main().catch(() => process.exit(0));
