#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readStdin } from './lib/stdin.mjs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const input = await readStdin();
  try {
    const data = JSON.parse(input);
    const { notify } = await import('../omc-dist/notifications/index.js');
    const event = data.hook_event_name === 'SessionStart' ? 'session-start'
      : data.hook_event_name === 'SessionEnd' ? 'session-end'
      : data.hook_event_name === 'Stop' ? 'session-stop'
      : null;
    if (event) {
      await notify(event, {
        sessionId: data.session_id || data.sessionId || '',
        projectPath: data.cwd || process.cwd(),
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }
  } catch (error) {
    // 静默失败，不影响主流程
  }
}
main();
