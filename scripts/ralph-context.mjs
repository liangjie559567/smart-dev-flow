#!/usr/bin/env node
/**
 * UserPromptSubmit Hook: Ralph Context Injector
 * Injects PRD current story and progress context when ralph mode is active
 */

import { readStdin } from './lib/stdin.mjs';
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(__dirname, '..');

function isRalphActive(directory, sessionId) {
  const stateDir = join(directory, '.omc', 'state');
  // Session-scoped first
  if (sessionId) {
    const sessionFile = join(stateDir, 'sessions', sessionId, 'ralph-state.json');
    if (existsSync(sessionFile)) {
      try {
        const s = JSON.parse(readFileSync(sessionFile, 'utf-8'));
        return s?.active === true;
      } catch {}
    }
  }
  // Legacy fallback
  const legacyFile = join(stateDir, 'ralph-state.json');
  if (existsSync(legacyFile)) {
    try {
      const s = JSON.parse(readFileSync(legacyFile, 'utf-8'));
      return s?.active === true;
    } catch {}
  }
  return false;
}

async function main() {
  try {
    const input = await readStdin();
    let data = {};
    try { data = JSON.parse(input); } catch {}

    const directory = data.cwd || data.directory || process.cwd();
    const sessionId = data.session_id || data.sessionId || '';

    if (!isRalphActive(directory, sessionId)) {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      return;
    }

    const { getRalphContext } = await import(
      pathToFileURL(join(pluginRoot, 'omc-dist', 'hooks', 'ralph', 'index.js')).href
    );

    const context = getRalphContext(directory);
    if (!context) {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      return;
    }

    console.log(JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: context
      }
    }));
  } catch {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
