---
name: axiom-meta
description: 查看和修改 smart-dev-flow 系统配置
---

# axiom-meta

## 触发条件
- 用户输入 `/meta` 或 `/axiom-meta`

## 执行步骤

1. 读取 `.agent/config/agent_config.md`：
   - 若文件不存在，提示"配置文件未找到，请先运行项目初始化（`python scripts/setup.py`）"并终止
   - 提取 `ACTIVE_PROVIDER` 和 `shared.guards` 配置

2. 展示当前配置：

```
## ⚙️ smart-dev-flow 系统配置

| 配置项 | 当前值 |
|--------|--------|
| ACTIVE_PROVIDER | {值} |
| 看门狗超时 | {watchdog_timeout_min} 分钟 |
| 看门狗间隔 | {watchdog_interval_min} 分钟 |
| Checkpoint 间隔 | {checkpoint_interval_min} 分钟 |
| 最大重试次数 | {max_restarts} |
```

3. 询问用户要修改哪项配置（或输入"退出"取消）：
   - **A. 切换 Provider** → 列出可选值，用户选择后更新 `ACTIVE_PROVIDER`
   - **B. 修改看门狗超时** → 用户输入分钟数，更新配置
   - **C. 退出** → 不做修改

4. 修改后写回 `.agent/config/agent_config.md` 对应字段，输出"配置已更新"。
