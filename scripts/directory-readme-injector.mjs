#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readStdin } from './lib/stdin.mjs';

async function main() {
  const input = await readStdin();
  try {
    const data = JSON.parse(input);
    const { createDirectoryReadmeInjectorHook } = await import('../omc-dist/hooks/directory-readme-injector/index.js');
    const hook = createDirectoryReadmeInjectorHook(process.cwd());
    const result = await hook(data);
    if (result) console.log(JSON.stringify(result));
  } catch (error) {
    console.error('[directory-readme-injector] Error:', error.message);
  }
}
main();
