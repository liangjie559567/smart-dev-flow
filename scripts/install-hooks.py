#!/usr/bin/env python3
"""install-hooks.py - 安装 git hooks（pre-commit + post-commit checkpoint）"""
import os, sys, shutil, stat
from pathlib import Path

root = Path.cwd()
git_hooks = root / '.git/hooks'
guards = root / 'guards'

if not git_hooks.exists():
    print('错误：未找到 .git/hooks 目录，请在项目根目录运行')
    sys.exit(1)

hooks = [
    ('post-commit', guards / 'post-commit'),
    ('post-commit.ps1', guards / 'post-commit.ps1'),
]

for name, src in hooks:
    if not src.exists():
        continue
    dst = git_hooks / name
    shutil.copy2(src, dst)
    dst.chmod(dst.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    print(f'✅ 已安装 {name}')

print('Git hooks 安装完成。每次 commit 后将自动创建 checkpoint tag。')
