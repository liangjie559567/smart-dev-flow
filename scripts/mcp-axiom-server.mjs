#!/usr/bin/env node
/**
 * Axiom MCP 服务器 - 将 Axiom Python 工具暴露为 MCP 工具
 */
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, '..');
const AXIOM_PATH = process.env.AXIOM_PATH || resolve(PLUGIN_ROOT, '..', 'Axiom');
const BRIDGE_SCRIPT = join(__dirname, 'axiom-bridge.py');

// 查找 Python 可执行文件
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';

// 工具定义
const TOOLS = [
  {
    name: 'axiom_harvest',
    description: '将知识沉淀到 Axiom 知识库。用于记录代码变更、错误修复等可复用经验。',
    inputSchema: {
      type: 'object',
      properties: {
        source_type: { type: 'string', description: 'code_change | error_fix | workflow_run | conversation' },
        title: { type: 'string', description: '知识标题' },
        summary: { type: 'string', description: '一句话概述' },
        category: { type: 'string', description: 'architecture | debugging | pattern | workflow | tooling', default: 'architecture' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
        details: { type: 'string', description: '详细说明' },
        code_example: { type: 'string', description: '代码示例' },
        confidence: { type: 'number', description: '置信度 0.0-1.0', default: 0.7 },
      },
      required: ['source_type', 'title', 'summary'],
    },
  },
  {
    name: 'axiom_get_knowledge',
    description: '从 Axiom 知识库查询知识。可按 ID 精确获取或按关键词搜索。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        id: { type: 'string', description: '知识条目 ID（如 k-001），精确获取' },
        limit: { type: 'number', description: '返回数量上限', default: 5 },
      },
    },
  },
  {
    name: 'axiom_search_by_tag',
    description: '按标签搜索 Axiom 知识库条目。',
    inputSchema: {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
        limit: { type: 'number', description: '返回数量上限', default: 5 },
      },
      required: ['tags'],
    },
  },
  {
    name: 'axiom_evolve',
    description: '触发 Axiom 进化周期：处理学习队列、重建索引、置信度衰减、生成进化报告。',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'axiom_reflect',
    description: '执行 Axiom 反思，记录本次会话的经验教训并入队学习。',
    inputSchema: {
      type: 'object',
      properties: {
        session_name: { type: 'string', description: '会话名称' },
        duration: { type: 'number', description: '持续时间（分钟）', default: 0 },
        went_well: { type: 'array', items: { type: 'string' }, description: '做得好的事' },
        could_improve: { type: 'array', items: { type: 'string' }, description: '可改进的事' },
        learnings: { type: 'array', items: { type: 'string' }, description: '学到的经验' },
        action_items: { type: 'array', items: { type: 'string' }, description: '行动项' },
      },
      required: ['session_name'],
    },
  },
  {
    name: 'phase_context_write',
    description: '持久化阶段上下文到 .agent/memory/phase-context.json。用于 axiom-draft/decompose 技能在阶段结束时保存 phase0/phase1/phase2 数据和 kb_context，供下一阶段读取。',
    inputSchema: {
      type: 'object',
      properties: {
        phase: { type: 'string', description: 'phase0 | phase1 | phase2 | kb_context' },
        data: { type: 'object', description: '要写入的数据对象' },
      },
      required: ['phase', 'data'],
    },
  },
  {
    name: 'phase_context_read',
    description: '读取 .agent/memory/phase-context.json 中的阶段上下文。用于技能开始时获取前序阶段的产物（验收标准、接口契约、kb_context 等）。',
    inputSchema: {
      type: 'object',
      properties: {
        phase: { type: 'string', description: '要读取的阶段：phase0 | phase1 | phase2 | kb_context | all' },
      },
      required: ['phase'],
    },
  },
  {
    name: 'axiom_write_manifest',
    description: '将任务清单写入 .agent/memory/manifest.md。由 axiom-decompose 技能在 planner 子代理输出后调用，确保任务清单落地。',
    inputSchema: {
      type: 'object',
      properties: {
        feature: { type: 'string', description: '功能名称' },
        tasks: {
          type: 'array',
          description: '任务列表',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              description: { type: 'string' },
              priority: { type: 'string' },
              depends: { type: 'string' },
              complexity: { type: 'string' },
              acceptance: { type: 'string' },
            },
            required: ['id', 'description'],
          },
        },
      },
      required: ['feature', 'tasks'],
    },
  },
];

// 调用 Python 桥接脚本
async function callPython(tool, args, cwd) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      AXIOM_PATH,
      AXIOM_BASE_DIR: join(cwd, '.agent', 'memory'),
      PYTHONPATH: AXIOM_PATH,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    };

    const proc = spawn(PYTHON, [BRIDGE_SCRIPT], { env, cwd });
    let output = '';
    let error = '';

    proc.stdout.on('data', d => { output += d; });
    proc.stderr.on('data', d => { error += d; });

    proc.on('close', code => {
      if (!output.trim()) {
        reject(new Error(error || `Python 进程退出码 ${code}`));
        return;
      }
      try {
        const res = JSON.parse(output.trim());
        if (res.ok) resolve(res.result);
        else reject(new Error(res.error));
      } catch {
        reject(new Error(`解析响应失败: ${output}`));
      }
    });

    proc.stdin.write(JSON.stringify({ tool, args }) + '\n');
    proc.stdin.end();
  });
}

// MCP JSON-RPC 服务器
const rl = createInterface({ input: process.stdin });
const cwd = process.cwd();

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

rl.on('line', async line => {
  let req;
  try { req = JSON.parse(line); } catch { return; }

  const { id, method, params } = req;

  if (method === 'initialize') {
    send({ jsonrpc: '2.0', id, result: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'axiom', version: '1.0.0' },
    }});
    return;
  }

  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params;
    try {
      let result;
      if (name === 'phase_context_write') {
        result = handlePhaseContextWrite(args, cwd);
      } else if (name === 'phase_context_read') {
        result = handlePhaseContextRead(args, cwd);
      } else if (name === 'axiom_write_manifest') {
        result = handleWriteManifest(args, cwd);
      } else {
        result = await callPython(name, args, cwd);
      }
      const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
    } catch (e) {
      send({ jsonrpc: '2.0', id, result: {
        content: [{ type: 'text', text: `错误: ${e.message}` }],
        isError: true,
      }});
    }
    return;
  }

  // notifications/initialized 等无需响应
  if (id !== undefined) {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
  }
});

function phaseContextPath(cwd) {
  return join(cwd, '.agent', 'memory', 'phase-context.json');
}

function handlePhaseContextWrite({ phase, data }, cwd) {
  const path = phaseContextPath(cwd);
  const ctx = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  ctx[phase] = data;
  ctx._updated = new Date().toISOString();
  writeFileSync(path, JSON.stringify(ctx, null, 2), 'utf8');
  return { ok: true, phase, keys: Object.keys(data) };
}

function handlePhaseContextRead({ phase }, cwd) {
  const path = phaseContextPath(cwd);
  if (!existsSync(path)) return phase === 'all' ? {} : null;
  const ctx = JSON.parse(readFileSync(path, 'utf8'));
  return phase === 'all' ? ctx : (ctx[phase] ?? null);
}

function handleWriteManifest({ feature, tasks }, cwd) {
  const rows = tasks.map(t =>
    `| ${t.id} | ${t.description} | ${t.priority || 'P1'} | ${t.depends || '-'} | ${t.complexity || '中等'} |`
  ).join('\n');
  const checks = tasks.map(t =>
    `- [ ] ${t.id}: ${t.acceptance || t.description}`
  ).join('\n');
  const content = `# Manifest - ${feature}\n生成时间：${new Date().toISOString().slice(0, 10)}\n\n## 任务列表\n| ID | 描述 | 优先级 | 依赖 | 预估复杂度 |\n|----|------|--------|------|----------|\n${rows}\n\n## 验收标准\n${checks}\n`;
  writeFileSync(join(cwd, '.agent', 'memory', 'manifest.md'), content, 'utf8');
  return { ok: true, tasks: tasks.length };
}
