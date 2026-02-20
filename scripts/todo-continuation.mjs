#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readStdin } from './lib/stdin.mjs';

async function main() {
  const input = await readStdin();
  try {
    const data = JSON.parse(input);
    const { createTodoContinuationHook } = await import('../omc-dist/hooks/todo-continuation/index.js');
    const hook = createTodoContinuationHook(data.cwd || process.cwd());
    const result = hook.checkIncomplete(data.session_id || '');
    if (result?.count > 0) {
      console.log(JSON.stringify({ continue: true, reason: `${result.count} incomplete tasks remain` }));
    } else {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    }
  } catch {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}
main();
