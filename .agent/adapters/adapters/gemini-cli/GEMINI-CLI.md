# Axiom — Gemini CLI 适配器
# Provider: Gemini CLI
# Version: 4.4 | Updated: 2026-02-21

## 0. 强制规则
- 语言: 全程中文。
- 输出: 简洁、可执行。
- 代码改动后: 必须执行最小验证（analyze/test）。

## 1. 启动协议
1. 读取 `.agent/memory/active_context.md`。
2. 若存在 `.agent/`，继续读取：
   - `.agent/memory/project_decisions.md`
   - `.agent/memory/user_preferences.md`
3. 根据用户意图匹配 `.agent/workflows/` 下流程。

## 2. 能力映射
- 读文件: `view_file`
- 写文件: `replace_file_content`
- 搜索: `find_by_name`
- 运行命令: `run_command`

## 3. 推荐命令
- 测试: `npm test`（76 个测试）
- 构建: `npm run build`

## 4. 门禁
- 新需求先走评审/PRD门禁。
- 代码完成后必须通过 `npm test`（76 个测试）。

_Axiom v4.4 — Gemini CLI Adapter_
