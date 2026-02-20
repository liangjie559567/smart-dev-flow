#!/usr/bin/env node
// user-prompt-submit.cjs - 关键词检测 + 技能路由
const fs = require('fs');
const path = require('path');

const KEYWORDS = {
  '/start':          '检测到 /start，建议运行 /axiom-start 恢复会话上下文。',
  '/suspend':        '检测到 /suspend，建议运行 /axiom-suspend 保存会话现场。',
  '/status':         '检测到 /status，建议运行 /axiom-status 查看当前状态。',
  '/reflect':        '检测到 /reflect，建议运行 /axiom-reflect 进行知识沉淀。',
  '/rollback':       '检测到 /rollback，建议运行 /axiom-rollback 回滚到检查点。',
  '/analyze-error':  '检测到 /analyze-error，建议运行 /axiom-analyze-error 分析错误。',
  '/knowledge':      '检测到 /knowledge，建议运行 /axiom-knowledge 查询知识库。',
  '/patterns':       '检测到 /patterns，建议运行 /axiom-patterns 查询模式库。',
  '/evolve':         '检测到 /evolve，建议运行 /axiom-evolve 处理学习队列。',
  '/feature-flow':   '检测到 /feature-flow，建议运行 /axiom-feature-flow 启动开发流水线。',
  '/export':         '检测到 /export，建议运行 /axiom-export 导出任务报告。',
  '/meta':           '检测到 /meta，建议运行 /axiom-meta 查看系统配置。',
};

async function main() {
  const input = await readStdin();
  const hook = JSON.parse(input);
  const prompt = (hook.prompt || '').trim();

  if (!prompt) process.exit(0);

  for (const [kw, msg] of Object.entries(KEYWORDS)) {
    if (prompt === kw || prompt.startsWith(kw + ' ')) {
      console.log(`[smart-dev-flow] ${msg}`);
      process.exit(0);
    }
  }

  process.exit(0);
}

function readStdin() {
  return new Promise(resolve => {
    let data = '';
    process.stdin.on('data', c => data += c);
    process.stdin.on('end', () => resolve(data || '{}'));
    setTimeout(() => resolve(data || '{}'), 2000);
  });
}

main().catch(() => process.exit(0));
