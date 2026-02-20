---
name: axiom-evolve
description: 处理学习队列，更新知识库和模式库
triggers: ["/evolve", "axiom-evolve"]
---

# axiom-evolve

## 触发条件
- 用户输入 `/evolve`
- `axiom-reflect` 第三步自动调用

## 流程

1. 运行进化引擎：
   ```bash
   python scripts/evolve.py evolve
   ```

2. 输出进化报告（由脚本生成），包含：
   - 处理的学习队列条目数
   - 新增/更新的知识条目
   - 检测到的新模式
   - 优化建议
