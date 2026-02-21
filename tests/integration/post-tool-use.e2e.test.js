import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const HOOK_PATH = new URL('../../hooks/post-tool-use.cjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

function runHook(input, cwd) {
  const result = spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(input),
    cwd,
    encoding: 'utf8',
    timeout: 5000,
  });
  return result;
}

function setupFixture(tmpDir) {
  const memDir = join(tmpDir, '.agent', 'memory', 'evolution');
  mkdirSync(memDir, { recursive: true });
  mkdirSync(join(tmpDir, '.omc'), { recursive: true });
}

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sdf-test-'));
  setupFixture(tmpDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('post-tool-use 集成：非目标工具提前退出', () => {
  it('Read 工具不触发任何文件写入', () => {
    const input = { tool_name: 'Read', tool_input: { file_path: '/some/file.md' } };
    const result = runHook(input, tmpDir);
    expect(result.status).toBe(0);
    // monitor.log 不应被创建
    expect(existsSync(join(tmpDir, '.agent', 'memory', 'monitor.log'))).toBe(false);
  });

  it('文件路径不含 .agent/memory/ 时不写 monitor.log', () => {
    const input = { tool_name: 'Write', tool_input: { file_path: '/other/path/file.md' } };
    const result = runHook(input, tmpDir);
    expect(result.status).toBe(0);
    expect(existsSync(join(tmpDir, '.agent', 'memory', 'monitor.log'))).toBe(false);
  });
});

describe('post-tool-use 集成：active_context.md 变更', () => {
  it('写入 active_context.md 时追加 state_change 到 monitor.log', () => {
    const ctxPath = join(tmpDir, '.agent', 'memory', 'active_context.md');
    writeFileSync(ctxPath, 'task_status: IMPLEMENTING\nmanifest_path: .agent/memory/manifest.md\n');

    const input = {
      tool_name: 'Write',
      tool_input: { file_path: ctxPath.replace(/\\/g, '/') },
    };
    runHook(input, tmpDir);

    const logPath = join(tmpDir, '.agent', 'memory', 'monitor.log');
    expect(existsSync(logPath)).toBe(true);
    const log = readFileSync(logPath, 'utf8');
    const entries = log.trim().split('\n').map(l => JSON.parse(l));
    const stateChange = entries.find(e => e.type === 'state_change');
    expect(stateChange).toBeDefined();
    expect(stateChange.task_status).toBe('IMPLEMENTING');
  });

  it('manifest_path 为空且 manifest.md 存在时自动补全', () => {
    const ctxPath = join(tmpDir, '.agent', 'memory', 'active_context.md');
    writeFileSync(ctxPath, 'task_status: IDLE\nmanifest_path: \n');
    // 创建 manifest.md
    writeFileSync(join(tmpDir, '.agent', 'memory', 'manifest.md'), '# Manifest');

    const input = { tool_name: 'Write', tool_input: { file_path: ctxPath.replace(/\\/g, '/') } };
    runHook(input, tmpDir);

    const updated = readFileSync(ctxPath, 'utf8');
    expect(updated).toContain('.agent/memory/manifest.md');
  });
});

describe('post-tool-use 集成：manifest.md 变更', () => {
  it('写入 manifest.md 时更新 phase-context.json', () => {
    const manifestPath = join(tmpDir, '.agent', 'memory', 'manifest.md');
    writeFileSync(manifestPath, '# Manifest');

    const input = { tool_name: 'Write', tool_input: { file_path: manifestPath.replace(/\\/g, '/') } };
    runHook(input, tmpDir);

    const pcPath = join(tmpDir, '.agent', 'memory', 'phase-context.json');
    expect(existsSync(pcPath)).toBe(true);
    const pc = JSON.parse(readFileSync(pcPath, 'utf8'));
    expect(pc.manifest_path).toBe('.agent/memory/manifest.md');
  });
});

describe('post-tool-use 集成：auto-harvest 学习循环', () => {
  it('Write 源码文件时自动追加知识条目到 knowledge_base.md', () => {
    const kbPath = join(tmpDir, '.agent', 'memory', 'evolution', 'knowledge_base.md');
    writeFileSync(kbPath, '# Knowledge Base\n');

    const input = {
      tool_name: 'Write',
      tool_input: { file_path: join(tmpDir, 'src', 'login.ts').replace(/\\/g, '/') },
    };
    runHook(input, tmpDir);

    const kb = readFileSync(kbPath, 'utf8');
    expect(kb).toContain('## K-auto-');
    expect(kb).toContain('login.ts');
  });

  it('Edit 源码文件时摘要包含 old_string → new_string', () => {
    const kbPath = join(tmpDir, '.agent', 'memory', 'evolution', 'knowledge_base.md');
    writeFileSync(kbPath, '# Knowledge Base\n');

    const input = {
      tool_name: 'Edit',
      tool_input: {
        file_path: join(tmpDir, 'src', 'auth.js').replace(/\\/g, '/'),
        old_string: 'function login()',
        new_string: 'function signIn()',
      },
    };
    runHook(input, tmpDir);

    const kb = readFileSync(kbPath, 'utf8');
    expect(kb).toContain('function login()');
    expect(kb).toContain('function signIn()');
  });

  it('Write .agent/memory/ 文件时不触发 auto-harvest', () => {
    const kbPath = join(tmpDir, '.agent', 'memory', 'evolution', 'knowledge_base.md');
    writeFileSync(kbPath, '# Knowledge Base\n');
    const before = readFileSync(kbPath, 'utf8');

    const ctxPath = join(tmpDir, '.agent', 'memory', 'active_context.md');
    writeFileSync(ctxPath, 'task_status: IDLE\nmanifest_path: \n');
    const input = { tool_name: 'Write', tool_input: { file_path: ctxPath.replace(/\\/g, '/') } };
    runHook(input, tmpDir);

    const after = readFileSync(kbPath, 'utf8');
    expect(after).toBe(before);
  });

  it('knowledge_base.md 不存在时 Write 源码文件正常退出（不崩溃）', () => {
    const input = {
      tool_name: 'Write',
      tool_input: { file_path: join(tmpDir, 'src', 'util.py').replace(/\\/g, '/') },
    };
    const result = runHook(input, tmpDir);
    expect(result.status).toBe(0);
  });
});

describe('post-tool-use 集成：TodoWrite', () => {
  it('TodoWrite 含 completed 任务时追加 task_completed 到 monitor.log', () => {
    const input = {
      tool_name: 'TodoWrite',
      tool_input: {
        todos: [
          { id: 't1', content: '实现登录', status: 'completed' },
          { id: 't2', content: '实现注册', status: 'pending' },
        ],
      },
    };
    runHook(input, tmpDir);

    const logPath = join(tmpDir, '.agent', 'memory', 'monitor.log');
    expect(existsSync(logPath)).toBe(true);
    const log = readFileSync(logPath, 'utf8');
    const entries = log.trim().split('\n').map(l => JSON.parse(l));
    const taskCompleted = entries.find(e => e.type === 'task_completed');
    expect(taskCompleted).toBeDefined();
    expect(taskCompleted.id).toBe('t1');
  });
});
