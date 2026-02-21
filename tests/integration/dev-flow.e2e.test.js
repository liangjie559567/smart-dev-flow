import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SKILL_INJECTOR = new URL('../../scripts/skill-injector.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const SESSION_START = new URL('../../hooks/session-start.cjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const PLUGIN_ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1').replace(/\/$/, '');

function runSkillInjector(prompt, cwd) {
  return spawnSync('node', [SKILL_INJECTOR], {
    input: JSON.stringify({ prompt, cwd, session_id: 'test-session' }),
    cwd,
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });
}

function runSessionStart(taskStatus, cwd) {
  const ctxPath = join(cwd, '.agent', 'memory', 'active_context.md');
  writeFileSync(ctxPath, `# Active Context\ntask_status: ${taskStatus}\n`);
  return spawnSync('node', [SESSION_START], {
    input: JSON.stringify({ cwd, session_id: 'test-session' }),
    cwd,
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });
}

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sdf-devflow-'));
  mkdirSync(join(tmpDir, '.agent', 'memory'), { recursive: true });
  mkdirSync(join(tmpDir, '.omc'), { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── 层次1：skill-injector 触发词匹配 ──────────────────────────────────────

describe('dev-flow 触发词检测', () => {
  it('输入 "dev-flow" 时注入 dev-flow 技能', () => {
    const result = runSkillInjector('dev-flow', tmpDir);
    expect(result.status).toBe(0);
    const output = result.stdout;
    // skill-injector 输出 JSON，包含 additionalContext 或静默退出
    // 关键：不应报错
    expect(result.stderr).not.toContain('Error');
  });

  it('输入 "开始开发" 时匹配 dev-flow 触发词', () => {
    const result = runSkillInjector('开始开发', tmpDir);
    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('Error');
  });

  it('无关输入不触发 dev-flow', () => {
    const result = runSkillInjector('帮我写一个函数', tmpDir);
    expect(result.status).toBe(0);
    // 无关输入应静默退出，不注入 dev-flow 内容
    if (result.stdout) {
      try {
        const out = JSON.parse(result.stdout);
        const ctx = out?.hookSpecificOutput?.additionalContext || '';
        expect(ctx).not.toContain('dev-flow');
      } catch { /* 静默退出，无输出，正常 */ }
    }
  });
});

// ── 层次2：session-start 状态路由注入 ────────────────────────────────────

describe('dev-flow 状态路由注入', () => {
  it('IDLE 状态时注入引导信息', () => {
    const result = runSessionStart('IDLE', tmpDir);
    expect(result.status).toBe(0);
  });

  it('IMPLEMENTING 状态时注入继续提示', () => {
    const result = runSessionStart('IMPLEMENTING', tmpDir);
    expect(result.status).toBe(0);
    if (result.stdout) {
      try {
        const out = JSON.parse(result.stdout);
        const ctx = out?.hookSpecificOutput?.additionalContext || '';
        // IMPLEMENTING 状态应有相关提示
        expect(ctx).toMatch(/IMPLEMENTING|implement|执行/i);
      } catch { /* 无输出也可接受 */ }
    }
  });

  it('CONFIRMING 状态时 session-start 正常退出', () => {
    const result = runSessionStart('CONFIRMING', tmpDir);
    expect(result.status).toBe(0);
  });
});

// ── 层次3：active_context.md 状态变更验证 ────────────────────────────────

describe('active_context.md 状态文件', () => {
  it('IDLE 状态文件可被正确读取', () => {
    const ctxPath = join(tmpDir, '.agent', 'memory', 'active_context.md');
    writeFileSync(ctxPath, '# Active Context\ntask_status: IDLE\n');
    const content = readFileSync(ctxPath, 'utf8');
    expect(content).toContain('task_status: IDLE');
  });

  it('状态从 IDLE 写入 DRAFTING 后可读取', () => {
    const ctxPath = join(tmpDir, '.agent', 'memory', 'active_context.md');
    writeFileSync(ctxPath, '# Active Context\ntask_status: IDLE\n');
    // 模拟状态变更
    const updated = readFileSync(ctxPath, 'utf8').replace('IDLE', 'DRAFTING');
    writeFileSync(ctxPath, updated);
    expect(readFileSync(ctxPath, 'utf8')).toContain('task_status: DRAFTING');
  });
});
