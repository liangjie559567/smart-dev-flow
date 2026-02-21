import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const HOOK_PATH = new URL('../../hooks/session-start.cjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

function runHook(input, cwd) {
  return spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(input),
    cwd,
    encoding: 'utf8',
    timeout: 5000,
  });
}

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sdf-ss-test-'));
  mkdirSync(join(tmpDir, '.agent', 'memory'), { recursive: true });
  mkdirSync(join(tmpDir, '.omc'), { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('session-start 集成：monitor.log 写入', () => {
  it('存在 .agent/memory/ 时写入 session_start 事件', () => {
    const result = runHook({ cwd: tmpDir, session_id: 'test-123' }, tmpDir);
    expect(result.status).toBe(0);
    const logPath = join(tmpDir, '.agent', 'memory', 'monitor.log');
    expect(existsSync(logPath)).toBe(true);
    const entries = readFileSync(logPath, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    const ev = entries.find(e => e.type === 'session_start');
    expect(ev).toBeDefined();
    expect(ev.sessionId).toBe('test-123');
  });

  it('不存在 .agent/memory/ 时不写 monitor.log', () => {
    rmSync(join(tmpDir, '.agent'), { recursive: true, force: true });
    const result = runHook({ cwd: tmpDir }, tmpDir);
    expect(result.status).toBe(0);
    expect(existsSync(join(tmpDir, '.agent', 'memory', 'monitor.log'))).toBe(false);
  });
});

describe('session-start 集成：Axiom 状态感知', () => {
  it('IDLE 状态时 stdout 包含 IDLE 硬门控提示', () => {
    writeFileSync(
      join(tmpDir, '.agent', 'memory', 'active_context.md'),
      '---\ntask_status: IDLE\nsession_name: "测试"\n---\n'
    );
    const result = runHook({ cwd: tmpDir }, tmpDir);
    expect(result.stdout).toContain('IDLE');
  });

  it('IMPLEMENTING 状态时 stdout 包含继续实现提示', () => {
    writeFileSync(
      join(tmpDir, '.agent', 'memory', 'active_context.md'),
      '---\ntask_status: IMPLEMENTING\nsession_name: "测试"\ncurrent_phase: "Phase 3"\n---\n'
    );
    const result = runHook({ cwd: tmpDir }, tmpDir);
    expect(result.stdout).toContain('IMPLEMENTING');
  });

  it('无 active_context.md 时正常退出', () => {
    const result = runHook({ cwd: tmpDir }, tmpDir);
    expect(result.status).toBe(0);
  });
});

describe('session-start 集成：project-memory 注入', () => {
  it('存在 project-memory.json 时 stdout 包含技术栈信息', () => {
    writeFileSync(
      join(tmpDir, '.agent', 'memory', 'active_context.md'),
      '---\ntask_status: IDLE\n---\n'
    );
    writeFileSync(
      join(tmpDir, '.omc', 'project-memory.json'),
      JSON.stringify({ techStack: ['Node.js', 'Vitest'] })
    );
    const result = runHook({ cwd: tmpDir }, tmpDir);
    expect(result.stdout).toContain('Node.js');
  });
});
