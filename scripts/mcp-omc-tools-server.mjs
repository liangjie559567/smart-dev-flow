#!/usr/bin/env node
// OMC Tools MCP Server 入口
import('../omc-dist/mcp/omc-tools-server.js').catch(e => {
  process.stderr.write('[mcp-omc-tools-server] Error: ' + e.message + '\n');
  process.exit(1);
});
