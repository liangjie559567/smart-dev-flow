import { describe, it, expect } from 'vitest';

describe('post-tool-use: syncPhaseContext 逻辑', () => {
  it('合并 patch 到现有 JSON', () => {
    const patch = { manifest_path: '.agent/memory/manifest.md' };
    let pc = {};
    try { pc = JSON.parse('{}'); } catch {}
    Object.assign(pc, patch);
    expect(pc.manifest_path).toBe('.agent/memory/manifest.md');
  });

  it('现有字段不被覆盖', () => {
    const patch = { manifest_path: '.agent/memory/manifest.md' };
    let pc = { other: 'value' };
    Object.assign(pc, patch);
    expect(pc.other).toBe('value');
    expect(pc.manifest_path).toBe('.agent/memory/manifest.md');
  });
});

describe('post-tool-use: active_context.md 状态提取', () => {
  it('正确提取 task_status 字段', () => {
    const content = 'task_status: IMPLEMENTING\nexecution_mode: "standard"\n';
    const status = (content.match(/task_status:\s*(\w+)/) || [])[1];
    expect(status).toBe('IMPLEMENTING');
  });

  it('正确提取 execution_mode 字段（带引号）', () => {
    const content = 'execution_mode: "standard"\n';
    const execMode = (content.match(/execution_mode:\s*"?([^"\n]+)"?/) || [])[1];
    expect(execMode).toBe('standard');
  });

  it('execution_mode 无引号时也能提取', () => {
    const content = 'execution_mode: ralph\n';
    const execMode = (content.match(/execution_mode:\s*"?([^"\n]+)"?/) || [])[1];
    expect(execMode).toBe('ralph');
  });
});

describe('post-tool-use: manifest_path 自动补全逻辑', () => {
  it('manifest_path 为空且 manifest.md 存在时应补全', () => {
    const content = 'task_status: IMPLEMENTING\nmanifest_path: \n';
    const manifestPath = (content.match(/manifest_path:\s*"?([^"\n]*)"?/) || [])[1] || '';
    const defaultManifest = '.agent/memory/manifest.md';
    const manifestExists = true; // mock

    const shouldUpdate = !manifestPath.trim() && manifestExists;
    expect(shouldUpdate).toBe(true);
  });

  it('manifest_path 已有值时不应覆盖', () => {
    const content = 'manifest_path: .agent/memory/manifest.md\n';
    const manifestPath = (content.match(/manifest_path:\s*"?([^"\n]*)"?/) || [])[1] || '';

    const shouldUpdate = !manifestPath.trim();
    expect(shouldUpdate).toBe(false);
  });
});

describe('post-tool-use: 工具过滤逻辑', () => {
  it('非 Write/Edit/TodoWrite 工具应提前退出', () => {
    const toolName = 'Read';
    const shouldProcess = ['Write', 'Edit', 'TodoWrite'].includes(toolName);
    expect(shouldProcess).toBe(false);
  });

  it('Write 工具应继续处理', () => {
    const toolName = 'Write';
    const shouldProcess = ['Write', 'Edit'].includes(toolName);
    expect(shouldProcess).toBe(true);
  });

  it('文件路径不含 .agent/memory/ 时应跳过', () => {
    const filePath = '/some/other/path/file.md';
    const shouldProcess = filePath.includes('.agent/memory/');
    expect(shouldProcess).toBe(false);
  });

  it('文件路径含 .agent/memory/ 时应处理', () => {
    const filePath = '/project/.agent/memory/active_context.md';
    const shouldProcess = filePath.includes('.agent/memory/');
    expect(shouldProcess).toBe(true);
  });
});
