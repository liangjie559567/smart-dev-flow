#!/usr/bin/env node
// stop.cjs - todo-continuation + persistent-mode 融合
const fs = require('fs');
const path = require('path');

async function main() {
  const input = await readStdin();
  let hook = {};
  try { hook = JSON.parse(input); } catch {}

  // 用户主动中断或上下文溢出时跳过
  if (hook.isUserAbort || hook.isContextLimitStop) process.exit(0);

  const cwd = process.cwd();

  // 1. todo-continuation：检测 Claude Code 原生 Task 系统
  const sessionId = hook.sessionId || '';
  if (sessionId) {
    const taskDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'tasks', sessionId);
    if (fs.existsSync(taskDir)) {
      try {
        const files = fs.readdirSync(taskDir).filter(f => f.endsWith('.json'));
        for (const f of files) {
          const task = JSON.parse(fs.readFileSync(path.join(taskDir, f), 'utf8'));
          if (task.status === 'pending' || task.status === 'in_progress') {
            console.log(JSON.stringify({
              continue: true,
              message: `[smart-dev-flow] 检测到未完成任务：${task.subject || f}，继续执行...`
            }));
            process.exit(0);
          }
        }
      } catch {}
    }
  }

  // 2. persistent-mode：检测 active_context.md 状态
  const ctxFile = path.join(cwd, '.agent/memory/active_context.md');
  if (!fs.existsSync(ctxFile)) process.exit(0);

  const ctx = fs.readFileSync(ctxFile, 'utf8');
  const status = (ctx.match(/task_status:\s*(\w+)/) || [])[1] || 'IDLE';
  const currentTask = (ctx.match(/current_task:\s*"?([^"\n]+)"?/) || [])[1] || '';
  const sessionName = (ctx.match(/session_name:\s*"?([^"\n]+)"?/) || [])[1] || '';

  const activeStatuses = ['IMPLEMENTING', 'DRAFTING', 'REVIEWING', 'DECOMPOSING'];
  if (activeStatuses.includes(status)) {
    console.log(JSON.stringify({
      continue: true,
      message: `[smart-dev-flow] 任务 ${sessionName || currentTask} 仍在进行中（${status}），继续执行...`
    }));
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
