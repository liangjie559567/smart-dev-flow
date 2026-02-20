---
name: axiom-patterns
description: 查询模式库
---

# axiom-patterns

## 用法

`/axiom-patterns [关键词]`

## 流程

1. 读取 `.agent/memory/evolution/pattern_library.md`，若文件不存在提示"模式库尚未初始化，请先完成一次 /axiom-reflect"
2. 若无关键词，列出全部条目（最多20条）
3. 若有关键词，过滤匹配条目（名称或适用场景包含关键词）
4. 格式化输出：模式名称、适用场景、示例
5. 如无匹配，提示"模式库中暂无相关条目，可尝试更宽泛的关键词"
