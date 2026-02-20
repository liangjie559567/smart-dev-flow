# 任务进度看板 CLI 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 `scripts/progress.mjs`，单文件彩色任务看板 CLI

**Architecture:** 5个纯函数，无外部依赖，isTTY 控制颜色，--json 供 Hook 消费

**Tech Stack:** Node.js 20+，仅内置模块（fs、path、url）

---

### Task T1: readFile

**Files:**
- Create: `scripts/progress.mjs`

**Step 1: 写入 readFile 函数**
```js
import { readFileSync } from 'fs';
import { resolve } from 'path';
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
function readFile(p) {
  try { return readFileSync(resolve(ROOT, p), 'utf8'); } catch { return null; }
}
```

**Step 2: 验证**
运行：`node -e "import('./scripts/progress.mjs').then(m=>console.log(m.readFile?.name))"`
预期：无报错

---

### Task T2: parseContext（依赖 T1）

**Step 1: 实现 parseContext**
```js
function parseContext(text) {
  if (!text) return { task_status:'IDLE', current_phase:'未知', fail_count:0, rollback_count:0, last_updated:'', completed_tasks:'' };
  const get = (k) => (text.match(new RegExp(`^${k}:\\s*(.+)`, 'm')) || [])[1]?.trim() ?? '';
  return {
    task_status: get('task_status') || 'IDLE',
    current_phase: get('current_phase') || '未知',
    fail_count: parseInt(get('fail_count')) || 0,
    rollback_count: parseInt(get('rollback_count')) || 0,
    last_updated: get('last_updated'),
    completed_tasks: get('completed_tasks'),
  };
}
```

**Step 2: 验证**
```js
const ctx = parseContext('task_status: IMPLEMENTING\nfail_count: 2');
assert(ctx.task_status === 'IMPLEMENTING' && ctx.fail_count === 2);
```

---

### Task T3: parseManifest（依赖 T1，可与 T2 并行）

**Step 1: 实现 parseManifest**
```js
function parseManifest(text) {
  if (!text) return [];
  return [...text.matchAll(/^- \[(x| )\] (T\d+)[:\s]+(.+)/gm)].map(m => ({
    id: m[2], desc: m[3].trim(), done: m[1] === 'x'
  }));
}
```

**Step 2: 验证**
```js
const tasks = parseManifest('- [x] T1: 数据读取\n- [ ] T2: 渲染');
assert(tasks[0].done === true && tasks[1].done === false);
```

---

### Task T4: render（依赖 T2、T3）

**Step 1: 实现颜色常量和 render**
```js
const C = { reset:'\x1b[0m', green:'\x1b[32m', blue:'\x1b[34m', red:'\x1b[31m', yellow:'\x1b[33m', bold:'\x1b[1m' };
const W = 38;
function render(ctx, tasks, useColor) {
  const c = useColor ? C : Object.fromEntries(Object.keys(C).map(k=>[k,'']));
  const line = (s) => `║ ${s.padEnd(W-2)} ║`;
  const isFail = ctx.fail_count >= 2;
  const titleColor = isFail ? c.red : c.bold;
  console.log(`╔${'═'.repeat(W)}╗`);
  console.log(`║${titleColor}  任务进度看板${c.reset}${' '.repeat(W-8)}║`);
  console.log(line(`  阶段: ${ctx.current_phase}`));
  console.log(line(`  失败: ${ctx.fail_count}  回滚: ${ctx.rollback_count}`));
  console.log(`╠${'═'.repeat(W)}╣`);
  if (tasks.length === 0) {
    console.log(line('  暂无任务清单'));
  } else {
    for (const t of tasks) {
      const [icon, color] = t.done ? ['✅', c.green] : ['⏳', c.yellow];
      console.log(line(` ${icon} ${color}${t.id} ${t.desc}${c.reset}`));
    }
  }
  // 最近5条完成记录
  const done = (ctx.completed_tasks || '').split(',').map(s=>s.trim()).filter(Boolean).reverse().slice(0,5);
  if (done.length > 0) {
    console.log(`╠${'═'.repeat(W)}╣`);
    console.log(line('  最近完成'));
    for (const id of done) console.log(line(`  ${c.green}✓${c.reset} ${id}`));
  }
  console.log(`╚${'═'.repeat(W)}╝`);
}
```

---

### Task T5: main（依赖 T1-T4）

**Step 1: 实现 main 并导出**
```js
function main() {
  const isJson = process.argv.includes('--json');
  const useColor = !isJson && !!process.stdout.isTTY;
  const ctx = parseContext(readFile('.agent/memory/active_context.md'));
  const tasks = parseManifest(readFile('.agent/memory/manifest.md'));
  if (isJson) {
    process.stdout.write(JSON.stringify({ ...ctx, tasks }) + '\n');
  } else {
    render(ctx, tasks, useColor);
  }
}
main();
```

**Step 2: 验证**
```bash
node scripts/progress.mjs
node scripts/progress.mjs --json
```
预期：彩色看板 / JSON 输出，执行时间 <500ms
