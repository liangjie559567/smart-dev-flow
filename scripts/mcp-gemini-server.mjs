#!/usr/bin/env node
// Gemini MCP Server 入口
import('../omc-dist/mcp/gemini-standalone-server.js').catch(e => {
  process.stderr.write('[mcp-gemini-server] Error: ' + e.message + '\n');
  process.exit(1);
});
