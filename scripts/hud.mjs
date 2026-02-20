#!/usr/bin/env node
// HUD 入口 - 转发到 omc-dist/hud/index.js
import('../omc-dist/hud/index.js').catch(e => {
  console.error('[hud] Error:', e.message);
  process.exit(1);
});
