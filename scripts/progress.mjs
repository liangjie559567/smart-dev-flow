import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

export function readFile(path) {
  try {
    return readFileSync(resolve(root, path), 'utf8');
  } catch {
    return null;
  }
}

export function parseManifest(text) {
  if (!text) return [];
  const lines = text.split('\n').map(l => l.replace(/\r$/, ''));
  let inTask = false;
  const result = [];
  for (const line of lines) {
    if (line.startsWith('## ')) { if (inTask) break; inTask = true; continue; }
    if (!inTask) continue;
    const m = line.match(/^- \[( |x)\] (T\d+): (.+)$/);
    if (m) result.push({ id: m[2], desc: m[3], done: m[1] === 'x' });
  }
  return result;
}

export function parseContext(text) {
  const defaults = { task_status: 'IDLE', current_phase: '', fail_count: 0, rollback_count: 0, last_updated: '', completed_tasks: '' };
  if (!text) return defaults;
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return defaults;
  const result = { ...defaults };
  for (const line of fm[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(?:"([^"]*)"|(.+?))?\s*$/);
    if (m) {
      const [, k, v] = [m[0], m[1], m[2] !== undefined ? m[2] : (m[3] ?? '')];
      if (k in result) result[k] = (k === 'fail_count' || k === 'rollback_count') ? Number(v) : v;
    }
  }
  return result;
}

export function render(ctx, tasks, useColor) {
  const W = 38;
  const c = (code, s) => useColor ? `\x1b[${code}m${s}\x1b[0m` : s;
  const pad = (s, w) => s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length);
  const row = (s) => '║ ' + pad(s, W - 4) + ' ║';

  const statusColor = ctx.task_status === 'IMPLEMENTING' ? 32 : 33;
  const recent = ctx.completed_tasks
    ? ctx.completed_tasks.split(',').filter(Boolean).reverse().slice(0, 5)
    : [];

  console.log('╔' + '═'.repeat(W - 2) + '╗');
  console.log(row(c(statusColor, 'Status: ' + ctx.task_status)));
  console.log(row('Phase:  ' + ctx.current_phase));
  console.log(row('Fails:  ' + ctx.fail_count + '  Rollbacks: ' + ctx.rollback_count));
  console.log('╠' + '═'.repeat(W - 2) + '╣');
  console.log(row('Tasks:'));
  for (const t of tasks) {
    const mark = t.done ? c(32, '[x]') : c(33, '[ ]');
    console.log(row(' ' + mark + ' ' + t.id + ' ' + t.desc));
  }
  if (recent.length) {
    console.log('╠' + '═'.repeat(W - 2) + '╣');
    console.log(row('Recent completed:'));
    for (const id of recent) console.log(row(' ' + c(32, id)));
  }
  console.log('╚' + '═'.repeat(W - 2) + '╝');
}

async function main() {
  const ctx = parseContext(readFile('.agent/memory/active_context.md'));
  const tasks = parseManifest(readFile('.agent/memory/manifest.md'));
  if (process.argv.includes('--json') || !process.stdout.isTTY) {
    console.log(JSON.stringify({ ctx, tasks }));
  } else {
    render(ctx, tasks, true);
  }
}

main().catch(err => { process.stderr.write(err.message + '\n'); process.exit(1); });
