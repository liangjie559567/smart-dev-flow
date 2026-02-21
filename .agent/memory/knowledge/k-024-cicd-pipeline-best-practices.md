---
id: k-024
title: CI/CD Pipeline Best Practices
category: workflow
tags: [ci-cd, github-actions, automation]
created: 2026-02-09
confidence: 0.8
references: [seed-knowledge-pack-v1]
---

## Summary
CI Pipeline 三阶段: Lint → Test → Build。PR 必须通过 CI 才可合并。自动化越多, 人为失误越少。

## Details
### Pipeline 设计
1. **Lint**: `npm run lint`
2. **Test**: `npm test`（76 个测试，vitest）
3. **Build**: `npm run build`（编译 MCP 服务器）
4. **Deploy**: `claude plugin install .`

### GitHub Actions
- `on: [push, pull_request]`
- 缓存 npm 依赖: `actions/cache` with `~/.npm`
- Node.js 版本: 20+
