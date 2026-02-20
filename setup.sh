#!/bin/bash
set -e

echo "=== smart-dev-flow 安装 ==="

# 检查依赖
command -v node >/dev/null 2>&1 || { echo "需要 Node.js 20+"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "需要 Python 3.8+"; exit 1; }

# 安装 Python 依赖（进化引擎）
if [ -f ".agent/requirements.txt" ]; then
  echo "安装 Python 依赖..."
  pip3 install -r .agent/requirements.txt --quiet
fi

# 安装 Git 守卫
if [ -f ".agent/guards/install_hooks.py" ]; then
  echo "安装 Git 守卫..."
  python3 .agent/guards/install_hooks.py
fi

# 初始化 .omc 目录
mkdir -p .omc/state

# 注册 Claude Code Plugin
if command -v claude >/dev/null 2>&1; then
  echo "注册 Claude Code Plugin..."
  claude plugin install . 2>/dev/null || echo "（Plugin 注册需手动执行：/plugin install smart-dev-flow）"
fi

echo ""
echo "✅ 安装完成！"
echo "使用方法：/dev-flow: 描述你的需求"
