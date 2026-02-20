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
    const result = await hook(data);
    if (result) console.log(JSON.stringify(result));
  } catch (error) {
    console.error('[agent-usage-reminder] Error:', error.message);
  }
}
main();
