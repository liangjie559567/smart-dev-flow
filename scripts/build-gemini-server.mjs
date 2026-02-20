#!/usr/bin/env node
/**
 * 构建 Gemini MCP 服务器独立包
 * 将 agents/*.md 角色定义嵌入到 bridge/gemini-server.cjs 中
 */

import * as esbuild from 'esbuild';
import { mkdir, readdir, readFile } from 'fs/promises';
import { basename, join } from 'path';

const outfile = 'bridge/gemini-server.cjs';

const agentFiles = (await readdir('agents')).filter(f => f.endsWith('.md')).sort();
const agentRoles = agentFiles.map(f => basename(f, '.md'));

const agentPrompts = {};
for (const file of agentFiles) {
  const content = await readFile(join('agents', file), 'utf-8');
  const match = content.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  agentPrompts[basename(file, '.md')] = match ? match[1].trim() : content.trim();
}
console.log(`嵌入 ${agentRoles.length} 个 agent 角色到 ${outfile}`);

await mkdir('bridge', { recursive: true });

const banner = `
try {
  var _cp = require('child_process');
  var _Module = require('module');
  var _globalRoot = _cp.execSync('npm root -g', { encoding: 'utf8', timeout: 5000 }).trim();
  if (_globalRoot) {
    var _sep = process.platform === 'win32' ? ';' : ':';
    process.env.NODE_PATH = _globalRoot + (process.env.NODE_PATH ? _sep + process.env.NODE_PATH : '');
    _Module._initPaths();
  }
} catch (_e) {}
`;

await esbuild.build({
  entryPoints: ['scripts/mcp-gemini-server.mjs'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile,
  banner: { js: banner },
  define: {
    '__AGENT_ROLES__': JSON.stringify(agentRoles),
    '__AGENT_PROMPTS__': JSON.stringify(agentPrompts),
  },
  external: [
    'fs', 'path', 'os', 'util', 'stream', 'events',
    'buffer', 'crypto', 'http', 'https', 'url',
    'child_process', 'assert', 'module', 'net', 'tls',
    'dns', 'readline', 'tty', 'worker_threads',
  ],
});

console.log(`构建完成: ${outfile}`);
