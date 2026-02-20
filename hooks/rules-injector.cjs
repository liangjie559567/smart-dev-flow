#!/usr/bin/env node
// rules-injector.cjs - 自动注入项目规则文件
const fs = require('fs');
const path = require('path');

const RULE_DIRS = ['.rules', path.join('.agent', 'memory')];
const RULE_EXTS = new Set(['.md', '.txt', '.rules']);

async function main() {
  const input = await readStdin();
  try { JSON.parse(input); } catch { process.exit(0); }

  const cwd = process.cwd();
  const rules = [];

  for (const dir of RULE_DIRS) {
    const full = path.join(cwd, dir);
    if (!fs.existsSync(full)) continue;
    try {
      for (const f of fs.readdirSync(full)) {
        if (!RULE_EXTS.has(path.extname(f))) continue;
        const content = fs.readFileSync(path.join(full, f), 'utf8').trim();
        if (content) rules.push(`### ${dir}/${f}\n${content}`);
      }
    } catch {}
  }

  if (rules.length === 0) process.exit(0);

  process.stdout.write(`[smart-dev-flow] 📋 已注入 ${rules.length} 个规则文件：\n${rules.map(r => r.split('\n')[0]).join('\n')}\n`);
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
