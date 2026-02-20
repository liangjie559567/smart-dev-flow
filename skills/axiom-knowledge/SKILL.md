---
name: axiom-knowledge
description: 查询知识库
---

# axiom-knowledge

## 用法

`/axiom-knowledge [关键词]`

## 流程

1. 读取 `.agent/memory/evolution/knowledge_base.md`，若文件不存在提示"知识库尚未初始化，请先完成一次 /axiom-reflect"
2. 若无关键词，列出全部条目（最多20条）
3. 若有关键词，过滤匹配条目（标题或摘要包含关键词）
4. 格式化输出：条目标题、置信度、来源、摘要
5. 如无匹配，提示"知识库中暂无相关条目，可尝试更宽泛的关键词"
