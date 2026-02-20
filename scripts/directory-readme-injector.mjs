#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readStdin } from './lib/stdin.mjs';

async function main() {
  const input = await readStdin();
  try {
    const data = JSON.parse(input);
    const { createDirectoryReadmeInjectorHook } = await import('../omc-dist/hooks/directory-readme-injector/index.js');
    const hook = createDirectoryReadmeInjectorHook(data.cwd || process.cwd());
    const result = await hook.processToolExecution(data);
    if (result) console.log(JSON.stringify(result));
    else console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  } catch {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}
main();
