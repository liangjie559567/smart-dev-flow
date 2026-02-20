#!/usr/bin/env node
// recovery.cjs - 三类错误自动恢复
const fs = require('fs');
const path = require('path');

async function main() {
  const input = await readStdin();
  let hook = {};
  try { hook = JSON.parse(input); } catch { process.exit(0); }

  const toolName = hook.tool_name || hook.toolName || '';
  const response = hook.tool_response || hook.toolResponse || '';
  const responseStr = typeof response === 'string' ? response : JSON.stringify(response);

  // 类型1：Edit 失败（String not found / Found N matches）
  if (toolName === 'Edit') {
    if (responseStr.includes('String not found')) {
      process.stdout.write('[smart-dev-flow] 🔧 Edit 失败（String not found）：请先用 Read 读取文件最新内容，再重试 Edit。\n');
      process.exit(0);
    }
    if (/Found \d+ matches/.test(responseStr)) {
      process.stdout.write('[smart-dev-flow] 🔧 Edit 失败（多处匹配）：请在 old_string 中添加更多上下文以唯一定位目标位置。\n');
      process.exit(0);
    }
  }

  // 类型2：Context 超限
  if (responseStr.includes('context_length_exceeded') || responseStr.includes('context window')) {
    process.stdout.write('[smart-dev-flow] ⚠️ Context 超限：立即运行 /compact 压缩上下文，然后用 /start 恢复会话。\n');
    process.exit(0);
  }

  // 类型3：Task/Session 异常
  if (toolName === 'Task' && (responseStr.includes('error') || responseStr.includes('failed'))) {
    const ctxFile = path.join(process.cwd(), '.agent/memory/active_context.md');
    if (fs.existsSync(ctxFile)) {
      try {
        let ctx = fs.readFileSync(ctxFile, 'utf8');
        const failMatch = ctx.match(/fail_count:\s*(\d+)/);
        const failCount = failMatch ? parseInt(failMatch[1]) + 1 : 1;
        ctx = ctx.replace(/fail_count:\s*\d+/, `fail_count: ${failCount}`);
        fs.writeFileSync(ctxFile, ctx);
        if (failCount >= 3) {
          process.stdout.write(`[smart-dev-flow] 🚨 子任务连续失败 ${failCount} 次，已自动标记为 BLOCKED。运行 /dev-flow 查看恢复选项。\n`);
        } else {
          process.stdout.write(`[smart-dev-flow] ⚠️ 子任务失败（第 ${failCount} 次），运行 /analyze-error 分析原因。\n`);
        }
      } catch {}
    }
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
