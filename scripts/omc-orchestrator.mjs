#!/usr/bin/env node
/**
 * PreToolUse Hook: OMC Orchestrator Delegation Enforcer
 * Wraps omc-dist/hooks/omc-orchestrator to enforce delegation behavior
 */

import { readStdin } from './lib/stdin.mjs';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(__dirname, '..');

async function main() {
  try {
    const input = await readStdin();
    let data = {};
    try { data = JSON.parse(input); } catch {}

    const toolName = data.tool_name || data.toolName || '';
    const toolInput = data.tool_input || data.toolInput || {};
    const directory = data.cwd || data.directory || process.cwd();
    const sessionId = data.session_id || data.sessionId || '';

    const { processOrchestratorPreTool } = await import(
      pathToFileURL(join(pluginRoot, 'omc-dist', 'hooks', 'omc-orchestrator', 'index.js')).href
    );

    const result = processOrchestratorPreTool({ toolName, toolInput, directory, sessionId });

    if (!result.continue) {
      console.log(JSON.stringify({
        continue: false,
        reason: result.reason || 'DELEGATION_REQUIRED',
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext: result.message
        }
      }));
    } else if (result.message) {
      console.log(JSON.stringify({
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext: result.message
        }
      }));
    } else {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    }
  } catch {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
