---
id: k-025
title: Documentation Standards
category: workflow
tags: [documentation, jsdoc, readme]
created: 2026-02-09
confidence: 0.8
references: [seed-knowledge-pack-v1]
---

## Summary
三级文档: README (项目) + JSDoc (代码) + Architecture Decision Records (决策)。公共 API 必须有 JSDoc 注释。

## Details
### 文档层次
1. **README.md**: 项目概述、安装、使用
2. **JSDoc**: `/** */` 注释, 描述参数/返回值/异常
3. **ADR**: Architecture Decision Records, 记录重大决策

### JSDoc 规范
- 第一行: 一句话概述
- 空行后: 详细说明
- `@param` / `@returns` / `@throws`
- 代码示例用 ` ```javascript ` 包裹
