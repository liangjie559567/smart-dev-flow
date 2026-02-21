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

  if (status === 'REFLECTING') {
    console.log(JSON.stringify({
      decision: 'block',
      reason: `[smart-dev-flow] 当前状态 REFLECTING，正在进行知识沉淀。请等待 axiom-reflect 完成。`
    }));
    process.exit(0);
  }

  // IMPLEMENTING 阶段：进入前必须已设置 execution_mode
  if (status === 'IMPLEMENTING' && toolName === 'Task') {
    const execMode = (content.match(/execution_mode:\s*"?([^"\n]+)"?/) || [])[1] || '';
    if (!execMode || execMode === '""' || execMode.trim() === '') {
      console.log(JSON.stringify({
        decision: 'block',
        reason: `[dev-flow 硬门控] IMPLEMENTING 阶段必须先设置 execution_mode。\n请通过 AskUserQuestion 选择执行引擎（standard/ultrawork/ralph/team），写入 active_context.md 后再继续。`
      }));
      process.exit(0);
    }
  }

  // IMPLEMENTING 阶段：主 Claude 禁止直接写代码，必须通过 Task() 子代理
  if (status === 'IMPLEMENTING' && ['Write', 'Edit'].includes(toolName)) {
    const filePath = hook.tool_input?.file_path || '';
    // 允许写入状态文件和记忆文件，禁止写入源代码
    const isMemory = filePath.includes('.agent/memory/') || filePath.includes('.omc/') || filePath.includes('.claude/');
    const isConfig = filePath.endsWith('.json') || filePath.endsWith('.md') || filePath.endsWith('.cjs') || filePath.endsWith('.mjs');
    // 拦截：写入 scripts/ src/ 等源码目录
    const isSourceCode = /\/(scripts|src|lib|components|pages|api|hooks|utils|tests?)\//i.test(filePath) ||
                         /\.(ts|tsx|js|jsx|py|go|rs|java|c|cpp|vue|svelte)$/.test(filePath);
    if (isSourceCode && !isMemory) {
      console.log(JSON.stringify({
        decision: 'block',
        reason: `[dev-flow 硬门控] IMPLEMENTING 阶段主 Claude 禁止直接写代码。\n必须通过 Task(subagent_type="general-purpose", prompt="你是 executor...") 调用子代理实现。\n目标文件: ${filePath}`
      }));
      process.exit(0);
    }
  }

  // DNA BUG 预防：Write/Edit 前检查已知坑
  if (['Write', 'Edit'].includes(toolName)) {
    try {
      const { readDna, extractRelevant } = require('./dna-manager.cjs');
      const filePath = hook.tool_input?.file_path || '';
      const ext = filePath.split('.').pop() || '';
      const keywords = [ext, ...filePath.split(/[\\/]/).slice(-2)].filter(Boolean);
      const dna = readDna(process.cwd());
      const warnings = extractRelevant(dna, keywords);
      if (warnings.length > 0) {
        console.log(JSON.stringify({
          continue: true,
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            additionalContext: `⚠️ DNA 已知坑（${filePath}）：\n${warnings.map(w => `- ${w}`).join('\n')}`
          }
        }));
        process.exit(0);
      }
    } catch {}
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
