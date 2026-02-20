# PowerShell 安装脚本
Write-Host "=== smart-dev-flow 安装 ===" -ForegroundColor Cyan

# 检查依赖
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Error "需要 Node.js 20+"; exit 1 }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { Write-Error "需要 Python 3.8+"; exit 1 }

# 安装 Python 依赖
if (Test-Path ".agent/requirements.txt") {
    Write-Host "安装 Python 依赖..."
    pip install -r .agent/requirements.txt --quiet
}

# 安装 Git 守卫
if (Test-Path ".agent/guards/install_hooks.py") {
    Write-Host "安装 Git 守卫..."
    python .agent/guards/install_hooks.py
}

# 初始化 .omc 目录
New-Item -ItemType Directory -Force -Path ".omc/state" | Out-Null

Write-Host ""
Write-Host "✅ 安装完成！" -ForegroundColor Green
Write-Host "使用方法：/dev-flow: 描述你的需求"
