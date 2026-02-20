#!/usr/bin/env node
/**
 * PreToolUse Hook: Delegation Enforcer
 * Auto-injects default model for Task/Agent calls missing model parameter
 */

import { readStdin } from './lib/stdin.mjs';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(__dirname, '..');

async function main() {
  try {
    const input = await readStdin();
    let data = {};
    try { data = JSON.parse(input); } catch {}

    const toolName = data.tool_name || data.toolName || '';
    const toolInput = data.tool_input || data.toolInput || {};

    if (toolName !== 'Task' && toolName !== 'Agent') {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      return;
    }

    if (!toolInput?.subagent_type) {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      return;
    }

    const { processPreToolUse } = await import(
      pathToFileURL(join(pluginRoot, 'omc-dist', 'features', 'delegation-enforcer.js')).href
    );

    const result = processPreToolUse(toolName, toolInput);

    if (result.modifiedInput && result.modifiedInput !== toolInput) {
      console.log(JSON.stringify({
        continue: true,
        modifiedToolInput: result.modifiedInput,
        suppressOutput: true
      }));
    } else {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    }
  } catch {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
