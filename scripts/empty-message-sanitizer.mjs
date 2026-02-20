#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readStdin } from './lib/stdin.mjs';

async function main() {
  const input = await readStdin();
  try {
    const data = JSON.parse(input);
    const { createEmptyMessageSanitizerHook } = await import('../omc-dist/hooks/empty-message-sanitizer/index.js');
    const hook = createEmptyMessageSanitizerHook({});
    const result = await hook.sanitize(data);
    if (result) console.log(JSON.stringify(result));
    else console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  } catch {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}
main();
