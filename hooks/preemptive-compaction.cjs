#!/usr/bin/env node
// preemptive-compaction.cjs - token 累计预警
const fs = require('fs');
const path = require('path');

const THRESHOLD = 0.70;
const BIG_OUTPUT_TOOLS = new Set(['Read', 'Bash', 'Grep', 'Glob', 'Task']);
const stateFile = path.join(process.cwd(), '.omc/state/compaction-state.json');

function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return { tokens: 0 }; }
}

function saveState(s) {
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(s));
  } catch {}
}

async function main() {
  const input = await readStdin();
  let hook = {};
  try { hook = JSON.parse(input); } catch { process.exit(0); }

  const toolName = hook.tool_name || hook.toolName || '';
  const output = hook.tool_response || hook.toolResponse || '';
  if (!BIG_OUTPUT_TOOLS.has(toolName) || !output) process.exit(0);

  const estimated = Math.floor((typeof output === 'string' ? output.length : JSON.stringify(output).length) / 4);
  const state = loadState();
  state.tokens = (state.tokens || 0) + estimated;

  // 用上下文窗口 200k tokens 估算
  const ratio = state.tokens / 200000;
  saveState(state);

  if (ratio >= THRESHOLD) {
    console.log(`[smart-dev-flow] ⚠️ 上下文已使用约 ${Math.round(ratio * 100)}%，建议运行 /compact 压缩上下文。`);
    state.tokens = 0;
    saveState(state);
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
