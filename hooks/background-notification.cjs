#!/usr/bin/env node
// background-notification.cjs - 任务完成后发送 terminal bell 通知
const fs = require('fs');
const path = require('path');

async function main() {
  const input = await readStdin();
  let hook = {};
  try { hook = JSON.parse(input); } catch { process.exit(0); }

  const cwd = process.cwd();
  const ctxFile = path.join(cwd, '.agent/memory/active_context.md');
  if (!fs.existsSync(ctxFile)) process.exit(0);

  const ctx = fs.readFileSync(ctxFile, 'utf8');
  const status = (ctx.match(/task_status:\s*(\w+)/) || [])[1] || '';
  const sessionName = (ctx.match(/session_name:\s*"?([^"\n]+)"?/) || [])[1] || '任务';

  // 仅在进入 REFLECTING 或 BLOCKED 时通知
  if (status === 'REFLECTING') {
    process.stdout.write(`\x07[smart-dev-flow] ✅ ${sessionName} 已完成，可运行 /reflect 进行知识沉淀。\n`);
  } else if (status === 'BLOCKED') {
    process.stdout.write(`\x07[smart-dev-flow] ⚠️ ${sessionName} 已阻塞，运行 /dev-flow 查看详情。\n`);
  }

  process.exit(0);
}

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.on('data', c => data += c);
    process.stdin.on('end', () => resolve(data || '{}'));
    setTimeout(() => resolve(data || '{}'), 2000);
  });
}

main().catch(() => process.exit(0));
