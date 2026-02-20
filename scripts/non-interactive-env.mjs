#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readStdin } from './lib/stdin.mjs';

async function main() {
  const input = await readStdin();
  try {
    const data = JSON.parse(input);
    const { nonInteractiveEnvHook } = await import('../omc-dist/hooks/non-interactive-env/index.js');
    if (data.toolName === 'Bash' && data.toolInput?.command) {
      const result = await nonInteractiveEnvHook.beforeCommand(data.toolInput.command);
      if (result?.warning) console.log(JSON.stringify({ continue: true, message: result.warning }));
    }
  } catch (error) {
    console.error('[non-interactive-env] Error:', error.message);
  }
}
main();
