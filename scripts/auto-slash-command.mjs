#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readStdin } from './lib/stdin.mjs';

async function main() {
  const input = await readStdin();
  try {
    const data = JSON.parse(input);
    const { createAutoSlashCommandHook } = await import('../omc-dist/hooks/auto-slash-command/index.js');
    const hook = createAutoSlashCommandHook();
    const result = await hook(data);
    if (result) console.log(JSON.stringify(result));
  } catch (error) {
    console.error('[auto-slash-command] Error:', error.message);
  }
}
main();
