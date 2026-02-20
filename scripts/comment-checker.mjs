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
    const result = await hook(data);
    if (result) console.log(JSON.stringify(result));
  } catch (error) {
    console.error('[comment-checker] Error:', error.message);
  }
}
main();
