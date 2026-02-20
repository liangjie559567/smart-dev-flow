#!/usr/bin/env node
/**
 * create-worktree.mjs - 为 axiom-decompose 自动创建 git worktree
 * 用法：node create-worktree.mjs <feature-name>
 */
import { execSync } from 'child_process';
import { join, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const feature = process.argv[2];
if (!feature) {
  console.error('用法: node create-worktree.mjs <feature-name>');
  process.exit(1);
}

const cwd = process.cwd();
const branch = `feat/${feature}`;
const worktreePath = resolve(cwd, '..', `${feature}-worktree`);

try {
  // 创建分支和 worktree
  execSync(`git worktree add -b "${branch}" "${worktreePath}"`, { cwd, stdio: 'pipe' });

  // 写入 phase-context.json 的 phase3 字段
  const ctxPath = join(cwd, '.agent', 'memory', 'phase-context.json');
  const ctx = existsSync(ctxPath) ? JSON.parse(readFileSync(ctxPath, 'utf8')) : {};
  ctx.phase3 = { branch, worktree: worktreePath, skipped: false };
  ctx._updated = new Date().toISOString();
  writeFileSync(ctxPath, JSON.stringify(ctx, null, 2), 'utf8');

  console.log(JSON.stringify({ ok: true, branch, worktree: worktreePath }));
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
}
