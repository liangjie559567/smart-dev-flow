#!/usr/bin/env node
/**
 * axiom-state-sync.mjs - PostToolUse hook
 * 检测 Skill 工具调用，自动同步 active_context.md 状态
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// 技能 → 状态映射
const SKILL_STATE_MAP = {
  'axiom-draft':      { task_status: 'DRAFTING',      current_phase: 'Phase 1 - Drafting',      last_gate: 'Gate 1' },
  'axiom-review':     { task_status: 'REVIEWING',     current_phase: 'Phase 1.5 - Reviewing',   last_gate: 'Gate 2' },
  'axiom-decompose':  { task_status: 'DECOMPOSING',   current_phase: 'Phase 2 - Decomposing',   last_gate: 'Gate 3' },
  'axiom-implement':  { task_status: 'IMPLEMENTING',  current_phase: 'Phase 3 - Implementing',  last_gate: 'Gate 4' },
  'axiom-reflect':    { task_status: 'REFLECTING',    current_phase: 'Phase 8 - Reflecting',    last_gate: 'Gate 5' },
};

async function main() {
  const raw = await readStdin();
  const hook = JSON.parse(raw);

  if (hook.tool_name !== 'Skill') return;

  const skillName = (hook.tool_input?.skill || '').replace(/^.*:/, ''); // 去掉前缀如 "superpowers:"
  const stateUpdate = SKILL_STATE_MAP[skillName];
  if (!stateUpdate) return;

  const cwd = process.cwd();
  const contextPath = join(cwd, '.agent/memory/active_context.md');
  if (!existsSync(contextPath)) return;

  const content = readFileSync(contextPath, 'utf8');
  const now = new Date().toISOString();

  const updated = content.replace(/^(task_status|current_phase|last_gate|last_updated):.*$/gm, (line) => {
    const key = line.split(':')[0].trim();
    if (key === 'task_status') return `task_status: ${stateUpdate.task_status}`;
    if (key === 'current_phase') return `current_phase: ${stateUpdate.current_phase}`;
    if (key === 'last_gate') return `last_gate: ${stateUpdate.last_gate}`;
    if (key === 'last_updated') return `last_updated: "${now}"`;
    return line;
  });

  if (updated !== content) {
    writeFileSync(contextPath, updated, 'utf8');
  }
}

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.on('data', c => data += c);
    process.stdin.on('end', () => resolve(data || '{}'));
    setTimeout(() => resolve(data || '{}'), 3000);
  });
}

main().catch(() => {});
