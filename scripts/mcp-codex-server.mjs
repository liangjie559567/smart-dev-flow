#!/usr/bin/env node
// Codex MCP Server 入口
import('../omc-dist/mcp/codex-standalone-server.js').catch(e => {
  process.stderr.write('[mcp-codex-server] Error: ' + e.message + '\n');
  process.exit(1);
});
