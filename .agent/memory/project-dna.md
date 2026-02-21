---
project: smart-dev-flow
tech_stack: [Node.js, CJS hooks, ESM scripts, Vitest]
last_updated: 2026-02-21
---

## 技术选型
- Hook 格式: CJS（Claude Code 要求，不能用 ESM）
- 脚本格式: ESM .mjs（scripts/ 目录）
- 测试框架: Vitest（ESM 原生，速度快）
- 路径处理: path.join（Windows/Unix 兼容）

## 踩过的坑

## 成功模式
