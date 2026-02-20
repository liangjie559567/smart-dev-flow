#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readStdin } from './lib/stdin.mjs';

async function main() {
  const input = await readStdin();
  try {
    const data = JSON.parse(input);
    const { nonInteractiveEnvHook } = await import('../omc-dist/hooks/non-interactive-env/index.js');
    const toolName = data.tool_name || data.toolName || '';
    const command = data.tool_input?.command || data.toolInput?.command;
    if (toolName === 'Bash' && command) {
      const result = nonInteractiveEnvHook.beforeCommand(command);
      if (result?.modified) {
        console.log(JSON.stringify({ continue: true, modifiedToolInput: { ...data.tool_input, command: result.command } }));
        return;
      }
    }
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  } catch {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}
main();
