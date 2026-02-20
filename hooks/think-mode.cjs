#!/usr/bin/env node
// think-mode.cjs - 深度思考模式检测与注入
const fs = require('fs');
const path = require('path');

const THINK_KEYWORDS = ['think', 'ultrathink', '深度思考', '仔细想想'];
const stateFile = path.join(process.cwd(), '.omc/state/think-mode.json');

async function main() {
  const input = await readStdin();
  let hook = {};
  try { hook = JSON.parse(input); } catch { process.exit(0); }

  const prompt = (hook.prompt || '').toLowerCase();
  if (!prompt) process.exit(0);

  const matched = THINK_KEYWORDS.find(k => prompt.includes(k.toLowerCase()));
  if (!matched) process.exit(0);

  // 记录 think-mode 激活状态
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ active: true, keyword: matched, ts: Date.now() }));
  } catch {}

  process.stdout.write(`[smart-dev-flow] 🧠 think-mode 已激活（关键词: ${matched}）。Claude 将使用扩展推理模式处理此请求。\n`);
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
