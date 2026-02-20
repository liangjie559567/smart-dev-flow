#!/usr/bin/env node
// subagent-tracker.cjs - 完整 agent 追踪
const fs = require('fs');
const path = require('path');

const stateFile = path.join(process.cwd(), '.omc/state/subagent-tracking.json');
const STALE_MS = 5 * 60 * 1000;

function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return { agents: [] }; }
}

function saveState(s) {
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(s, null, 2));
  } catch {}
}

async function main() {
  const input = await readStdin();
  let hook = {};
  try { hook = JSON.parse(input); } catch { process.exit(0); }

  const event = hook.hook_event_name || hook.hookEventName || '';
  const state = loadState();
  const now = Date.now();

  // 清理 stale 条目
  state.agents = (state.agents || []).filter(a => !a.startTime || (now - a.startTime) < STALE_MS || a.endTime);

  if (event === 'SubagentStart') {
    state.agents.push({
      id: hook.subagentId || hook.sessionId || String(now),
      type: hook.subagentType || hook.tool_input?.subagent_type || 'unknown',
      startTime: now,
      endTime: null,
      durationMs: null,
      toolUses: 0,
      tokens: 0,
    });
  } else if (event === 'SubagentStop') {
    const id = hook.subagentId || hook.sessionId;
    const agent = state.agents.find(a => a.id === id && !a.endTime);
    if (agent) {
      agent.endTime = now;
      agent.durationMs = now - agent.startTime;
      agent.toolUses = hook.toolUseCount || hook.tool_use_count || 0;
      agent.tokens = hook.totalTokens || hook.total_tokens || 0;
    }
  }

  saveState(state);
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
