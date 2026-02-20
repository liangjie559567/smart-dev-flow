---
name: axiom-knowledge
description: 查询知识库
---

# axiom-knowledge

## 用法

`/axiom-knowledge [关键词]`

## 流程

1. 读取 `.agent/memory/evolution/knowledge_base.md`
2. 如有关键词，过滤匹配条目
3. 格式化输出：条目标题、置信度、来源、摘要
4. 如无匹配，提示"知识库中暂无相关条目"
