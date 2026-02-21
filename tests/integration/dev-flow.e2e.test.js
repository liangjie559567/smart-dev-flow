import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SKILL_INJECTOR = new URL('../../scripts/skill-injector.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const PRE_TOOL_USE = new URL('../../hooks/pre-tool-use.cjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const PLUGIN_ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1').replace(/\/$/, '');

function runSkillInjector(prompt) {
  // cwd 必须是 PLUGIN_ROOT，skill-injector 搜索 join(cwd, 'skills')
  return spawnSync('node', [SKILL_INJECTOR], {
    input: JSON.stringify({ prompt, cwd: PLUGIN_ROOT, session_id: 'test-session' }),
    cwd: PLUGIN_ROOT, encoding: 'utf8', timeout: 5000,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });
}

function runPreToolUse(toolName, toolInput, cwd) {
  return spawnSync('node', [PRE_TOOL_USE], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput }),
    cwd, encoding: 'utf8', timeout: 5000,
  });
}

function writeContext(cwd, taskStatus, extra = '') {
  writeFileSync(
    join(cwd, '.agent', 'memory', 'active_context.md'),
    `# Active Context\ntask_status: ${taskStatus}\n${extra}`
  );
}

let tmpDir;
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sdf-devflow-'));
  mkdirSync(join(tmpDir, '.agent', 'memory'), { recursive: true });
});
afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

// ── skill-injector：验证注入内容包含 dev-flow 硬门控指令 ──────────────────

describe('skill-injector：dev-flow 触发词注入', () => {
  it('输入 "dev-flow" 时注入包含 HARD-GATE 的 SKILL.md 内容', () => {
    const result = runSkillInjector('dev-flow');
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    const ctx = out?.hookSpecificOutput?.additionalContext ?? '';
    expect(ctx).toContain('dev-flow');
    expect(ctx).toContain('HARD-GATE');
  });

  it('输入 "axiom" 时同样注入 dev-flow', () => {
    const result = runSkillInjector('axiom');
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    const ctx = out?.hookSpecificOutput?.additionalContext ?? '';
    expect(ctx).toContain('dev-flow');
  });

  it('无关输入不注入 dev-flow 内容', () => {
    const result = runSkillInjector('帮我写一个排序函数');
    expect(result.status).toBe(0);
    // 无匹配时输出 suppressOutput 或空
    if (result.stdout.trim()) {
      const out = JSON.parse(result.stdout);
      const ctx = out?.hookSpecificOutput?.additionalContext ?? '';
      expect(ctx).not.toContain('HARD-GATE');
    }
  });
});

// ── pre-tool-use：验证状态机门禁拦截行为 ─────────────────────────────────

describe('pre-tool-use：CONFIRMING 状态拦截', () => {
  it('CONFIRMING 状态下 Write 被 block', () => {
    writeContext(tmpDir, 'CONFIRMING');
    const result = runPreToolUse('Write', { file_path: '/some/file.ts' }, tmpDir);
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.decision).toBe('block');
    expect(out.reason).toContain('CONFIRMING');
  });

  it('CONFIRMING 状态下 Edit 被 block', () => {
    writeContext(tmpDir, 'CONFIRMING');
    const result = runPreToolUse('Edit', { file_path: '/some/file.ts' }, tmpDir);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).decision).toBe('block');
  });

  it('CONFIRMING 状态下 Bash 被 block', () => {
    writeContext(tmpDir, 'CONFIRMING');
    const result = runPreToolUse('Bash', { command: 'npm install' }, tmpDir);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).decision).toBe('block');
  });

  it('CONFIRMING 状态下 Read 不被 block（只读工具放行）', () => {
    writeContext(tmpDir, 'CONFIRMING');
    const result = runPreToolUse('Read', { file_path: '/some/file.ts' }, tmpDir);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});

describe('pre-tool-use：IMPLEMENTING 状态硬门控', () => {
  it('无 execution_mode 时 Task 被 block', () => {
    writeContext(tmpDir, 'IMPLEMENTING');
    const result = runPreToolUse('Task', { prompt: '实现登录功能' }, tmpDir);
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.decision).toBe('block');
    expect(out.reason).toContain('execution_mode');
  });

  it('有 execution_mode 时 Task 放行', () => {
    writeContext(tmpDir, 'IMPLEMENTING', 'execution_mode: "ultrawork"\n');
    const result = runPreToolUse('Task', { prompt: '实现登录功能' }, tmpDir);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('直接 Write 源码文件被 block', () => {
    writeContext(tmpDir, 'IMPLEMENTING', 'execution_mode: "ultrawork"\n');
    const result = runPreToolUse('Write', { file_path: '/project/src/login.ts' }, tmpDir);
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(out.decision).toBe('block');
    expect(out.reason).toContain('子代理');
  });

  it('Write 状态文件不被 block', () => {
    writeContext(tmpDir, 'IMPLEMENTING', 'execution_mode: "ultrawork"\n');
    const result = runPreToolUse('Write', { file_path: join(tmpDir, '.agent/memory/active_context.md') }, tmpDir);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});

describe('pre-tool-use：REFLECTING / BLOCKED 状态拦截', () => {
  it('REFLECTING 状态下 Write 被 block', () => {
    writeContext(tmpDir, 'REFLECTING');
    const result = runPreToolUse('Write', { file_path: '/some/file.ts' }, tmpDir);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).decision).toBe('block');
  });

  it('BLOCKED 状态下非调试 Task 被 block', () => {
    writeContext(tmpDir, 'BLOCKED');
    const result = runPreToolUse('Task', { prompt: '继续实现功能' }, tmpDir);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).decision).toBe('block');
  });

  it('BLOCKED 状态下调试 Task 放行', () => {
    writeContext(tmpDir, 'BLOCKED');
    const result = runPreToolUse('Task', { prompt: '调用 debugger 分析错误' }, tmpDir);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});
