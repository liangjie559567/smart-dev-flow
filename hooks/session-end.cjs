#!/usr/bin/env node
// session-end.cjs - 会话结束时自动保存现场
const fs = require('fs');
const path = require('path');

async function main() {
  await readStdin();
  const cwd = process.cwd();
  const ctxFile = path.join(cwd, '.agent/memory/active_context.md');
  if (!fs.existsSync(ctxFile)) { process.exit(0); }

  let ctx = fs.readFileSync(ctxFile, 'utf8');
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // 更新或追加 last_updated
  if (/last_updated:/.test(ctx)) {
    ctx = ctx.replace(/last_updated:\s*[^\n]*/, `last_updated: "${now}"`);
  } else {
    ctx = ctx.trimEnd() + `\nlast_updated: "${now}"\n`;
  }
  fs.writeFileSync(ctxFile, ctx);
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
