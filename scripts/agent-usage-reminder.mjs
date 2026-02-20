#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readStdin } from './lib/stdin.mjs';

async function main() {
  const input = await readStdin();
  try {
    const data = JSON.parse(input);
    const { createAgentUsageReminderHook } = await import('../omc-dist/hooks/agent-usage-reminder/index.js');
    const hook = createAgentUsageReminderHook();
    const handler = hook['tool.execute.after'];
    const result = handler ? await handler(data) : null;
    if (result) console.log(JSON.stringify(result));
    else console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  } catch {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}
main();
