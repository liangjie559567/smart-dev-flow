#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readStdin } from './lib/stdin.mjs';

async function main() {
  const input = await readStdin();
  try {
    const data = JSON.parse(input);
    const { createCommentCheckerHook } = await import('../omc-dist/hooks/comment-checker/index.js');
    const hook = createCommentCheckerHook({});
    const result = hook.postToolUse(data);
    if (result) console.log(JSON.stringify(result));
    else console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  } catch {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
  process.exit(0);
}
main();
