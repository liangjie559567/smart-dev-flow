#!/usr/bin/env node
/**
 * UserPromptSubmit Hook: Learner - Auto-inject relevant learned skills
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

    const message = data.user_message || data.userMessage || data.message || '';
    const sessionId = data.session_id || data.sessionId || '';
    const directory = data.cwd || data.directory || process.cwd();

    if (!message || !sessionId) {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      return;
    }

    const { processMessageForSkills } = await import(
      pathToFileURL(join(pluginRoot, 'omc-dist', 'hooks', 'learner', 'index.js')).href
    );

    const result = processMessageForSkills(message, sessionId, directory);

    if (result.injected > 0) {
      console.log(JSON.stringify({
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: `[Learner] Injected ${result.injected} relevant skill(s)`
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
