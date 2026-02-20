#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readStdin } from './lib/stdin.mjs';

async function main() {
  const input = await readStdin();
  try {
    const data = JSON.parse(input);
    const { createThinkingBlockValidatorHook } = await import('../omc-dist/hooks/thinking-block-validator/index.js');
    const hook = createThinkingBlockValidatorHook();
    const result = await hook(data);
    if (result) console.log(JSON.stringify(result));
  } catch (error) {
    console.error('[thinking-block-validator] Error:', error.message);
  }
}
main();
