#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const cmd = process.argv[2];
const cwd = '/c/Users/ljyih/Desktop/smart-dev-flow';

function run(command) {
  try {
    execSync(command, { cwd, stdio: 'inherit' });
  } catch (e) {
    process.stderr.write(e.message + '\n');
    process.exit(1);
  }
}

if (cmd === 'status') {
  run('python scripts/status.py');
} else if (cmd === 'evolve') {
  run('python scripts/evolve.py evolve');
} else if (cmd === 'reset') {
  const path = `${cwd}/.agent/memory/active_context.md`;
  try {
    const content = fs.readFileSync(path, 'utf8');
    fs.writeFileSync(path, content.replace(/task_status:\s*\S+/, 'task_status: IDLE'));
  } catch (e) {
    process.stderr.write(e.message + '\n');
    process.exit(1);
  }
} else if (cmd === 'start') {
  run('python scripts/status.py');
} else if (cmd === 'suspend') {
  run('python scripts/suspend.py');
} else if (cmd === 'hud') {
  run('node scripts/hud.mjs ' + process.argv.slice(3).join(' '));
} else {
  console.log('Usage: smart-dev-flow <status|evolve|reset|start|suspend|hud>');
}
