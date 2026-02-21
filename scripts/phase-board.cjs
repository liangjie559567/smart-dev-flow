#!/usr/bin/env node
// phase-board.cjs - 渲染 axiom-dev-flow 阶段看板
'use strict';

const PHASES = [
  { id: 'Phase 0',   name: '需求澄清',  states: ['DRAFTING'] },
  { id: 'Phase 1',   name: '架构设计',  states: ['DRAFTING'] },
  { id: 'Phase 1.5', name: '专家评审',  states: ['REVIEWING'] },
  { id: 'Phase 2',   name: '任务拆解',  states: ['DECOMPOSING'] },
  { id: 'Phase 3',   name: '隔离开发',  states: ['DECOMPOSING'] },
  { id: 'Phase 4',   name: 'TDD 实现',  states: ['IMPLEMENTING'] },
  { id: 'Phase 5',   name: '系统调试',  states: ['IMPLEMENTING'] },
  { id: 'Phase 6',   name: '代码审查',  states: ['IMPLEMENTING'] },
  { id: 'Phase 7',   name: '完成验证',  states: ['IMPLEMENTING'] },
  { id: 'Phase 8',   name: '分支合并',  states: ['REFLECTING'] },
  { id: 'Phase 9',   name: '知识收割',  states: ['REFLECTING'] },
];

// 每个状态对应的"当前进行中"阶段索引
const CURRENT_IDX = {
  DRAFTING:     1,  // Phase 1 进行中（Phase 0 已完成）
  REVIEWING:    2,  // Phase 1.5
  DECOMPOSING:  4,  // Phase 3（Phase 2 已完成）
  IMPLEMENTING: 6,  // Phase 5（Phase 4 已完成）
  REFLECTING:   9,  // Phase 8
  BLOCKED:     -1,  // 特殊处理
};

// 每个状态下已完成的阶段数（索引 < completedBefore 的都是 ✅）
const COMPLETED_BEFORE = {
  DRAFTING:     1,  // Phase 0 完成
  REVIEWING:    2,  // Phase 0,1 完成
  DECOMPOSING:  3,  // Phase 0,1,1.5 完成
  IMPLEMENTING: 5,  // Phase 0-3 完成
  REFLECTING:   9,  // Phase 0-7 完成
};

const NEXT_STEP = {
  DRAFTING:     'PRD 确认 → CONFIRMING',
  REVIEWING:    '专家评审完成 → DECOMPOSING',
  DECOMPOSING:  '任务拆解完成 → 选择执行引擎 → IMPLEMENTING',
  IMPLEMENTING: '实现完成 → REFLECTING',
  REFLECTING:   '知识收割完成 → IDLE',
  BLOCKED:      '等待用户介入，选择恢复方式',
};

function renderBoard(ctx) {
  const status = (ctx.match(/task_status:\s*(\w+)/) || [])[1] || 'IDLE';
  if (status === 'IDLE') return null;

  const failCount    = parseInt((ctx.match(/fail_count:\s*(\d+)/)    || [])[1] || '0', 10);
  const rollbackCount= parseInt((ctx.match(/rollback_count:\s*(\d+)/)|| [])[1] || '0', 10);
  const blockedReason= ((ctx.match(/blocked_reason:\s*"?([^"\n]+)"?/) || [])[1] || '').trim();
  const sessionName  = ((ctx.match(/session_name:\s*"?([^"\n]+)"?/)   || [])[1] || '').trim();

  // 终态看板
  if (status === 'REFLECTING' && ctx.includes('IDLE')) {
    return [
      '┌─ 🎉 全部完成 [IDLE] ───────────────┐',
      '│ ✅ Phase 0-9  所有阶段已完成        │',
      `├─ 健康: fail=${failCount}  rollback=${rollbackCount} ─────────┤`,
      '│ 知识已收割，状态已重置为 IDLE       │',
      '└────────────────────────────────────┘',
    ].join('\n');
  }

  // BLOCKED 时从 current_phase 推断前一状态
  let effectiveStatus = status;
  if (status === 'BLOCKED') {
    const phase = (ctx.match(/current_phase:\s*"?([^"\n]+)"?/) || [])[1] || '';
    if (/implement/i.test(phase)) effectiveStatus = 'IMPLEMENTING';
    else if (/decompos/i.test(phase)) effectiveStatus = 'DECOMPOSING';
    else if (/review/i.test(phase)) effectiveStatus = 'REVIEWING';
    else if (/draft/i.test(phase)) effectiveStatus = 'DRAFTING';
  }
  const completedBefore = COMPLETED_BEFORE[effectiveStatus] ?? 0;
  const currentIdx = CURRENT_IDX[effectiveStatus] ?? -1;

  // 选取要显示的阶段行：已完成 + 当前 + 之后2个
  const rows = [];
  for (let i = 0; i < PHASES.length; i++) {
    const p = PHASES[i];
    let icon, label;
    if (i < completedBefore) {
      icon = '✅'; label = '完成';
    } else if (i === currentIdx || (status === 'BLOCKED' && i === currentIdx)) {
      icon = '▶'; label = status === 'BLOCKED' ? '阻塞' : '进行中';
    } else {
      icon = '○'; label = '待开始';
    }
    // 只显示：已完成的 + 当前 + 当前后2个
    if (i < completedBefore || i === currentIdx || (i > currentIdx && i <= currentIdx + 2)) {
      rows.push({ icon, id: p.id, name: p.name, label });
    }
  }

  const title = sessionName ? `${status} · ${sessionName}` : status;
  const width = 42;
  const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));

  const lines = [];
  lines.push(`┌─ ${title} ${'─'.repeat(Math.max(0, width - title.length - 4))}┐`);
  for (const r of rows) {
    const content = `${r.icon}  ${pad(r.id, 8)} ${pad(r.name, 8)} ${r.label}`;
    lines.push(`│ ${pad(content, width - 2)} │`);
  }

  let healthLine = `健康: fail=${failCount}  rollback=${rollbackCount}`;
  if (status === 'BLOCKED' && blockedReason) {
    const reason = blockedReason.slice(0, 30);
    healthLine += `  ⚠ 阻塞: ${reason}`;
  }
  lines.push(`├─ ${healthLine} ${'─'.repeat(Math.max(0, width - healthLine.length - 4))}┤`);

  const next = NEXT_STEP[status] || '';
  lines.push(`│ 下一步: ${pad(next, width - 10)} │`);
  lines.push(`└${'─'.repeat(width)}┘`);

  return lines.join('\n');
}

module.exports = { renderBoard };
