import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const DNA_MGR = join(ROOT, 'hooks/dna-manager.cjs');
const UPS_HOOK = join(ROOT, 'hooks/user-prompt-submit.cjs');
const SYNC_SCRIPT = join(ROOT, 'scripts/axiom-state-sync.mjs');

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'dna-test-'));
  mkdirSync(join(tmpDir, '.agent', 'memory'), { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── dna-manager 单元测试 ──────────────────────────────────────────

describe('dna-manager: readDna', () => {
  it('文件不存在时返回空字符串', () => {
    const { readDna } = require(DNA_MGR);
    expect(readDna(tmpDir)).toBe('');
  });

  it('读取 project-dna.md 内容', () => {
    writeFileSync(join(tmpDir, '.agent', 'memory', 'project-dna.md'), '## 踩过的坑\n- 测试坑');
    const { readDna } = require(DNA_MGR);
    expect(readDna(tmpDir)).toContain('测试坑');
  });
});

describe('dna-manager: extractRelevant', () => {
  it('关键词匹配返回相关行', () => {
    const { extractRelevant } = require(DNA_MGR);
    const dna = '## 踩过的坑\n- Windows 路径用 path.join\n- JWT 过期需要拦截器';
    const result = extractRelevant(dna, ['Windows', 'path']);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('path.join');
  });

  it('无匹配时返回空数组', () => {
    const { extractRelevant } = require(DNA_MGR);
    expect(extractRelevant('## 踩过的坑\n- 某个坑', ['React'])).toHaveLength(0);
  });

  it('最多返回 5 条', () => {
    const { extractRelevant } = require(DNA_MGR);
    const lines = Array.from({ length: 10 }, (_, i) => `- test item ${i}`).join('\n');
    const result = extractRelevant(lines, ['test']);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

describe('dna-manager: appendToDna', () => {
  it('追加到已有 section', () => {
    writeFileSync(join(tmpDir, '.agent', 'memory', 'project-dna.md'), '## 踩过的坑\n\n## 成功模式\n');
    const { appendToDna } = require(DNA_MGR);
    appendToDna(tmpDir, '踩过的坑', '- [2026-02-21] 新坑');
    const content = readFileSync(join(tmpDir, '.agent', 'memory', 'project-dna.md'), 'utf8');
    expect(content).toContain('新坑');
  });

  it('文件不存在时自动创建', () => {
    const { appendToDna } = require(DNA_MGR);
    appendToDna(tmpDir, '踩过的坑', '- [2026-02-21] 自动创建');
    expect(existsSync(join(tmpDir, '.agent', 'memory', 'project-dna.md'))).toBe(true);
  });
});
