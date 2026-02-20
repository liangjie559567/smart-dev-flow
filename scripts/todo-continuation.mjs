#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readStdin } from './lib/stdin.mjs';

async function main() {
  const input = await readStdin();
  try {
    const data = JSON.parse(input);
    const { createTodoContinuationHook } = await import('../omc-dist/hooks/todo-continuation/index.js');
    const hook = createTodoContinuationHook(process.cwd());
    const result = await hook(data);
    if (result) console.log(JSON.stringify(result));
  } catch (error) {
    console.error('[todo-continuation] Error:', error.message);
  }
}
main();
