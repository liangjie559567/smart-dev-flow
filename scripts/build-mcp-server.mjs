#!/usr/bin/env node
/**
 * 构建 OMC Tools MCP 服务器独立包
 */

import * as esbuild from 'esbuild';
import { mkdir } from 'fs/promises';

const outfile = 'bridge/mcp-server.cjs';

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
  entryPoints: ['scripts/mcp-omc-tools-server.mjs'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile,
  banner: { js: banner },
  external: [
    'fs', 'path', 'os', 'util', 'stream', 'events',
    'buffer', 'crypto', 'http', 'https', 'url',
    'child_process', 'assert', 'module', 'net', 'tls',
    'dns', 'readline', 'tty', 'worker_threads',
    'better-sqlite3',
  ],
});

console.log(`构建完成: ${outfile}`);
