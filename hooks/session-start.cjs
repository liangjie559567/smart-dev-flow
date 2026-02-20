#!/usr/bin/env node
// session-start.cjs - 会话启动时自动注入 Axiom 上下文
const fs = require('fs');
const path = require('path');

async function main() {
  const input = await readStdin();
  // SessionStart hook 不需要解析 input，直接读取上下文

  const cwd = process.cwd();
  const ctxFile = path.join(cwd, '.agent/memory/active_context.md');

  if (!fs.existsSync(ctxFile)) {
    process.exit(0);
  }

  const ctx = fs.readFileSync(ctxFile, 'utf8');
  const status = (ctx.match(/task_status:\s*(\w+)/) || [])[1] || 'IDLE';
  const sessionName = (ctx.match(/session_name:\s*"?([^"\n]+)"?/) || [])[1] || '';
  const phase = (ctx.match(/current_phase:\s*"?([^"\n]+)"?/) || [])[1] || '';

  // 注入 project-memory
  const memFile = path.join(cwd, '.omc/project-memory.json');
  if (fs.existsSync(memFile)) {
    try {
      const mem = JSON.parse(fs.readFileSync(memFile, 'utf8'));
      const parts = [];
      if (mem.techStack) parts.push(`技术栈: ${Array.isArray(mem.techStack) ? mem.techStack.join(', ') : mem.techStack}`);
      if (mem.notes && mem.notes.length) parts.push(`最近学习: ${mem.notes.slice(0, 3).join(' | ')}`);
      if (parts.length) console.log(`[smart-dev-flow] 项目记忆已加载 | ${parts.join(' | ')}`);
    } catch {}
  }

  if (status === 'IDLE') process.exit(0);

  const lines = [
    `\n[smart-dev-flow] 检测到未完成会话`,
    `状态: ${status}${sessionName ? ` | 任务: ${sessionName}` : ''}${phase ? ` | 阶段: ${phase}` : ''}`,
    `运行 /dev-flow 查看详情，或 /axiom-start 恢复工作。`,
  ];

  console.log(lines.join('\n'));
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
