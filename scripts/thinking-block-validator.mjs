#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readStdin } from './lib/stdin.mjs';

async function main() {
  const input = await readStdin();
  try {
    const data = JSON.parse(input);
    const { validateMessages } = await import('../omc-dist/hooks/thinking-block-validator/index.js');
    const messages = data.messages || data.tool_input?.messages;
    if (messages) {
      const result = validateMessages(messages);
      if (result?.modified) {
        console.log(JSON.stringify({ continue: true, modifiedToolInput: { ...data.tool_input, messages: result.messages } }));
        return;
      }
    }
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  } catch {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}
main();
