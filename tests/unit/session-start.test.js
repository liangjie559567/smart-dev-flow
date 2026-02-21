import { describe, it, expect } from 'vitest';

// 直接测试从 session-start.cjs 提取的纯函数逻辑

function stripFrontmatter(content) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
}

function semverCompare(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function recoverSessionState(ultrawork, ralph) {
  const messages = [];
  if (ultrawork?.active && ultrawork.tasks?.length) {
    const pending = ultrawork.tasks.filter(t => t.status !== 'completed').length;
    if (pending > 0) messages.push(`⚡ Ultrawork 会话恢复：${pending} 个任务待完成，运行 /ultrawork 继续`);
  }
  if (ralph?.active && ralph.goal) {
    messages.push(`🔄 Ralph 循环恢复：目标「${ralph.goal}」，运行 /ralph 继续`);
  }
  return messages;
}

function detectTodos(todosArray) {
  if (!Array.isArray(todosArray) || !todosArray.length) return [];
  const pending = todosArray.filter(t => !t.done && !t.completed).length;
  if (pending > 0) return [`📋 检测到 ${pending} 个待办任务`];
  return [];
}

function getNotepadPriority(content) {
  if (!content) return '';
  const m = content.match(/##\s+Priority Context\s*\n([\s\S]*?)(?=\n##\s|\s*$)/);
  return m ? m[1].trim() : '';
}

describe('stripFrontmatter', () => {
  it('移除 YAML frontmatter 块', () => {
    const input = '---\nname: test\n---\n# 正文内容';
    expect(stripFrontmatter(input)).toBe('# 正文内容');
  });

  it('无 frontmatter 时原样返回', () => {
    const input = '# 正文内容';
    expect(stripFrontmatter(input)).toBe('# 正文内容');
  });

  it('支持 Windows 换行符 \\r\\n', () => {
    const input = '---\r\nname: test\r\n---\r\n# 正文';
    expect(stripFrontmatter(input)).toBe('# 正文');
  });
});

describe('semverCompare', () => {
  it('较大版本返回正数', () => {
    expect(semverCompare('1.2.0', '1.1.9')).toBeGreaterThan(0);
  });

  it('较小版本返回负数', () => {
    expect(semverCompare('1.0.0', '1.1.0')).toBeLessThan(0);
  });

  it('相同版本返回 0', () => {
    expect(semverCompare('2.3.4', '2.3.4')).toBe(0);
  });

  it('主版本号差异优先', () => {
    expect(semverCompare('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });
});

describe('recoverSessionState', () => {
  it('ultrawork 有待完成任务时返回恢复消息', () => {
    const ultrawork = { active: true, tasks: [{ status: 'pending' }, { status: 'completed' }] };
    const msgs = recoverSessionState(ultrawork, null);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('1 个任务待完成');
  });

  it('ralph 激活时返回恢复消息', () => {
    const ralph = { active: true, goal: '实现登录功能' };
    const msgs = recoverSessionState(null, ralph);
    expect(msgs[0]).toContain('实现登录功能');
  });

  it('无激活状态时返回空数组', () => {
    expect(recoverSessionState(null, null)).toEqual([]);
  });

  it('ultrawork 全部完成时不返回消息', () => {
    const ultrawork = { active: true, tasks: [{ status: 'completed' }] };
    expect(recoverSessionState(ultrawork, null)).toEqual([]);
  });
});

describe('detectTodos', () => {
  it('有未完成 todo 时返回提示', () => {
    const todos = [{ done: false }, { done: true }];
    const msgs = detectTodos(todos);
    expect(msgs[0]).toContain('1 个待办任务');
  });

  it('全部完成时返回空数组', () => {
    const todos = [{ done: true }, { completed: true }];
    expect(detectTodos(todos)).toEqual([]);
  });

  it('空数组时返回空数组', () => {
    expect(detectTodos([])).toEqual([]);
  });
});

describe('getNotepadPriority', () => {
  it('提取 Priority Context 段落内容', () => {
    const content = '## Priority Context\n重要任务：完成登录\n## Other Section\n其他内容';
    expect(getNotepadPriority(content)).toBe('重要任务：完成登录');
  });

  it('无 Priority Context 时返回空字符串', () => {
    expect(getNotepadPriority('## Other\n内容')).toBe('');
  });

  it('内容为空时返回空字符串', () => {
    expect(getNotepadPriority('')).toBe('');
  });
});
