#!/usr/bin/env node
// pre-tool-use.cjs - 状态机门禁拦截
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function main() {
  const input = await readStdin();
  const hook = JSON.parse(input);
  const toolName = hook.tool_name || '';

  // 只拦截实现类工具
  const implTools = ['Write', 'Edit', 'Bash', 'Task'];
  if (!implTools.includes(toolName)) process.exit(0);

  const contextFile = path.join(process.cwd(), '.agent/memory/active_context.md');
  if (!fs.existsSync(contextFile)) process.exit(0);

  const content = fs.readFileSync(contextFile, 'utf8');
  const statusMatch = content.match(/task_status:\s*(\w+)/);
  if (!statusMatch) process.exit(0);

  const status = statusMatch[1];

  if (status === 'CONFIRMING') {
    console.log(JSON.stringify({
      decision: 'block',
      reason: `[smart-dev-flow] 当前状态 CONFIRMING，等待用户确认后才能继续。请回复"确认"或"取消"。`
    }));
    process.exit(0);
  }

  if (status === 'BLOCKED') {
    const isDebug = hook.tool_input?.prompt?.includes('debugger') ||
                    hook.tool_input?.prompt?.includes('analyze-error');
    if (!isDebug) {
      console.log(JSON.stringify({
        decision: 'block',
        reason: `[smart-dev-flow] 当前状态 BLOCKED，请先解决阻塞问题。使用 /dev-flow 查看详情。`
      }));
      process.exit(0);
    }
  }

  process.exit(0);
}

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data || '{}'));
    setTimeout(() => resolve(data || '{}'), 3000);
  });
}

main().catch(() => process.exit(0));
