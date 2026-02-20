#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readStdin } from './lib/stdin.mjs';

async function main() {
  const input = await readStdin();
  try {
    const data = JSON.parse(input);
    const { registerBeadsContext } = await import('../omc-dist/hooks/beads-context/index.js');
    const result = registerBeadsContext(data.sessionId || '');
    if (result) console.log(JSON.stringify({ continue: true }));
    else console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  } catch {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}
main();
