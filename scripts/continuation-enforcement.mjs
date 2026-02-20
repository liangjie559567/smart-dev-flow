#!/usr/bin/env node
/**
 * SessionStart Hook: Continuation Enforcement
 * Injects the "boulder never stops" system prompt addition
 */

import { readStdin } from './lib/stdin.mjs';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(__dirname, '..');

async function main() {
  try {
    await readStdin();

    const { continuationSystemPromptAddition } = await import(
      pathToFileURL(join(pluginRoot, 'omc-dist', 'features', 'continuation-enforcement.js')).href
    );

    console.log(JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: continuationSystemPromptAddition
      }
    }));
  } catch {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
