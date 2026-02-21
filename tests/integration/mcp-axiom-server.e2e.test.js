import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SERVER_PATH = new URL('../../scripts/mcp-axiom-server.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

function rpc(requests, cwd) {
  const input = requests.map(r => JSON.stringify(r)).join('\n') + '\n';
  const result = spawnSync('node', [SERVER_PATH], {
    input,
    cwd,
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, AXIOM_PATH: '' },
  });
  return result.stdout.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
}

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sdf-mcp-test-'));
  mkdirSync(join(tmpDir, '.agent', 'memory'), { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('MCP Axiom Server: 协议层', () => {
  it('initialize 返回正确的 serverInfo', () => {
    const [res] = rpc([{ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }], tmpDir);
    expect(res.result.serverInfo.name).toBe('axiom');
    expect(res.result.capabilities.tools).toBeDefined();
  });

  it('tools/list 返回所有工具定义', () => {
    const [res] = rpc([{ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }], tmpDir);
    const names = res.result.tools.map(t => t.name);
    expect(names).toContain('phase_context_write');
    expect(names).toContain('phase_context_read');
    expect(names).toContain('axiom_write_manifest');
    expect(names).toContain('axiom_harvest');
  });

  it('未知方法返回 -32601 错误', () => {
    const [res] = rpc([{ jsonrpc: '2.0', id: 1, method: 'unknown/method', params: {} }], tmpDir);
    expect(res.error.code).toBe(-32601);
  });
});

describe('MCP Axiom Server: phase_context_write / read', () => {
  it('写入 phase0 后可读回', () => {
    const responses = rpc([
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
        name: 'phase_context_write',
        arguments: { phase: 'phase0', data: { acceptance_criteria: ['AC1', 'AC2'] } },
      }},
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: {
        name: 'phase_context_read',
        arguments: { phase: 'phase0' },
      }},
    ], tmpDir);

    const writeRes = JSON.parse(responses[0].result.content[0].text);
    expect(writeRes.ok).toBe(true);
    expect(writeRes.phase).toBe('phase0');

    const readRes = JSON.parse(responses[1].result.content[0].text);
    expect(readRes.acceptance_criteria).toEqual(['AC1', 'AC2']);
  });

  it('读取不存在的 phase 返回 null', () => {
    const [res] = rpc([
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
        name: 'phase_context_read',
        arguments: { phase: 'phase1' },
      }},
    ], tmpDir);
    const text = res.result.content[0].text;
    expect(text).toBe('null');
  });

  it('phase=all 返回完整上下文', () => {
    const responses = rpc([
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
        name: 'phase_context_write',
        arguments: { phase: 'kb_context', data: { query: 'test' } },
      }},
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: {
        name: 'phase_context_read',
        arguments: { phase: 'all' },
      }},
    ], tmpDir);
    const all = JSON.parse(responses[1].result.content[0].text);
    expect(all.kb_context).toEqual({ query: 'test' });
    expect(all._updated).toBeDefined();
  });
});

describe('MCP Axiom Server: axiom_write_manifest', () => {
  it('写入 manifest.md 包含任务表格和验收标准', () => {
    const [res] = rpc([
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
        name: 'axiom_write_manifest',
        arguments: {
          feature: '用户登录',
          tasks: [
            { id: 'T01', description: '实现登录接口', priority: 'P0', acceptance: '返回 JWT token' },
            { id: 'T02', description: '实现登出接口', depends: 'T01' },
          ],
        },
      }},
    ], tmpDir);

    const result = JSON.parse(res.result.content[0].text);
    expect(result.ok).toBe(true);
    expect(result.tasks).toBe(2);

    const manifest = readFileSync(join(tmpDir, '.agent', 'memory', 'manifest.md'), 'utf8');
    expect(manifest).toContain('# Manifest - 用户登录');
    expect(manifest).toContain('T01');
    expect(manifest).toContain('返回 JWT token');
    expect(manifest).toContain('T02');
    expect(manifest).toContain('T01'); // depends
  });
});
