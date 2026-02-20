"""session_watchdog.py — 会话看门狗，监控 active_context.md 超时未更新则提醒"""
import argparse, sys, time
from datetime import datetime, timedelta
from pathlib import Path

DEFAULT_TIMEOUT = 30
DEFAULT_INTERVAL = 5
CTX_PATH = '.agent/memory/active_context.md'

def check(root, timeout_min):
    p = root / CTX_PATH
    if not p.exists():
        return
    mtime = datetime.fromtimestamp(p.stat().st_mtime)
    idle = datetime.now() - mtime
    if idle > timedelta(minutes=timeout_min):
        mins = int(idle.total_seconds() // 60)
        print(f'\033[93m[smart-dev-flow] ⚠️  会话已 {mins} 分钟未更新，请检查任务状态。运行 /axiom-status 查看详情。\033[0m', flush=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--timeout', type=int, default=DEFAULT_TIMEOUT)
    parser.add_argument('--interval', type=int, default=DEFAULT_INTERVAL)
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()

    root = Path.cwd()
    if args.once:
        check(root, args.timeout)
        return

    print(f'[smart-dev-flow] 看门狗启动，超时阈值 {args.timeout} 分钟，检查间隔 {args.interval} 分钟', flush=True)
    try:
        while True:
            check(root, args.timeout)
            time.sleep(args.interval * 60)
    except KeyboardInterrupt:
        print('\n[smart-dev-flow] 看门狗已停止')

if __name__ == '__main__':
    main()
