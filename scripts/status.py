import re, json, sys, argparse
from pathlib import Path
from datetime import datetime
from typing import Tuple

PHASE_PROGRESS = [
    ('phase 1.5', ('Phase 1.5 - Reviewing',    40)),
    ('phase 3',   ('Phase 3 - Implementing',   70)),
    ('phase 2',   ('Phase 2 - Decomposing',    55)),
    ('phase 1',   ('Phase 1 - Drafting',       30)),
    ('phase 0',   ('Phase 0 - Understanding',  10)),
    ('reflecting',('REFLECTING',              100)),
]
KNOWN_STATUSES = {'drafting','confirming','reviewing','decomposing','implementing','reflecting','blocked'}

def resolve_phase(task_status: str, raw_phase: str) -> Tuple[str, int]:
    if task_status.lower() not in KNOWN_STATUSES:
        return ('未知阶段', 0)
    if not raw_phase or raw_phase == '—':
        return ('未知阶段', 0)
    for prefix, result in PHASE_PROGRESS:
        if raw_phase.lower().startswith(prefix):
            return result
    return ('未知阶段', 0)

def parse_frontmatter(text):
    m = re.match(r'^---\s*\n(.*?)\n---', text, re.DOTALL)
    if not m: return {}
    return dict(re.findall(r'^(\w+):\s*"?([^"\n]*)"?', m.group(1), re.MULTILINE))

def read_file(p):
    try: return Path(p).read_text(encoding='utf-8-sig')
    except: return ''

def count_lines_matching(text, pattern):
    return sum(1 for l in text.splitlines() if re.search(pattern, l))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--rich', action='store_true', help='使用 rich 渲染输出')
    args = parser.parse_args()

    if args.rich:
        try:
            import rich  # noqa: F401
        except ImportError:
            print('rich 未安装，请运行: pip install rich\n降级为 Markdown 输出。\n')
            args.rich = False

    sys.stdout.reconfigure(encoding='utf-8')
    root = Path(__file__).parent.parent
    mem = root / '.agent/memory'

    # 核心状态
    ctx = parse_frontmatter(read_file(mem / 'active_context.md'))
    status = ctx.get('task_status', 'N/A')
    session = ctx.get('session_name', '—')
    phase = ctx.get('current_phase', '—')
    task = ctx.get('current_task', '—')
    updated = ctx.get('last_updated', '—')
    provider = ctx.get('active_provider', 'claude_code')

    # 任务进度（从 manifest.md checkbox 统计）
    manifest_path = ctx.get('manifest_path', '') or str(mem / 'manifest.md')
    manifest_text = read_file(manifest_path)
    task_section = re.split(r'^##\s+', manifest_text, flags=re.MULTILINE)
    task_block = next((s for s in task_section if s.startswith('任务列表')), '')
    total = len(re.findall(r'^\s*-\s+\[[ xX]\]', task_block, re.MULTILINE))
    done = len(re.findall(r'^\s*-\s+\[[xX]\]', task_block, re.MULTILINE))
    pct = int(done / total * 100) if total > 0 else 0
    bar = '█' * (pct // 10) + '░' * (10 - pct // 10)

    # 知识库统计
    kb_text = read_file(mem / 'evolution/knowledge_base.md')
    kb_count = count_lines_matching(kb_text, r'^##\s+K-\d+')
    pat_text = read_file(mem / 'evolution/pattern_library.md')
    pat_count = count_lines_matching(pat_text, r'^##\s+P-\d+')
    lq_text = read_file(mem / 'evolution/learning_queue.md')
    lq_count = count_lines_matching(lq_text, r'^\s*-\s+\[')

    # 最近反思
    ref_text = read_file(mem / 'reflection_log.md')
    ref_entries = re.findall(r'###\s+(.+?)\n.*?Key Learning[：:]\s*(.+?)(?:\n|$)', ref_text, re.DOTALL)
    ref_rows = '\n'.join(f'| {d.strip()} | {l.strip()[:60]} |' for d, l in ref_entries[-5:]) or '| — | — |'

    # 守卫状态
    git_pre = '✅' if (root / '.git/hooks/pre-commit').exists() else '❌'
    git_post = '✅' if (root / '.git/hooks/post-commit').exists() else '❌'

    # 阶段进度
    phase_name, phase_pct = resolve_phase(status, phase)

    # OMC project-memory
    omc_status = 'N/A'
    pm = root / '.omc/project-memory.json'
    if pm.exists():
        try: omc_status = json.loads(pm.read_text('utf-8')).get('axiom_status', 'N/A')
        except: pass

    if args.rich:
        render_rich_status(ctx, status, session, phase, task, provider, updated, omc_status)
        render_rich_progress(bar, pct, done, total)
        render_rich_evolution(kb_count, pat_count, lq_count)
    else:
        print(f"""# 📊 Axiom — System Dashboard

## 🎯 系统状态
| 字段 | 值 |
|------|-----|
| Status | {status} |
| Session | {session} |
| Phase | {phase} |
| Current Task | {task} |
| Provider | {provider} |
| Last Updated | {updated} |
| OMC Status | {omc_status} |

## 📋 任务进度
**{bar} {pct}%** ({done}/{total if total > 0 else '—'} tasks)

## 🧬 进化统计
| 指标 | 数量 |
|------|------|
| 📚 知识条目 | {kb_count} |
| 🔄 活跃模式 | {pat_count} |
| 📥 学习队列 | {lq_count} |

## 💭 最近反思
| 日期 | 关键学习 |
|------|---------|
{ref_rows}

## 🛡️ 守卫状态
| 守卫 | 状态 |
|------|------|
| Pre-commit | {git_pre} |
| Post-commit | {git_post} |

## 📈 阶段进度
当前阶段：{phase_name}
完成进度：{phase_pct}%
""")
    print(render_monitor_section(root))

def render_monitor_section(root: Path) -> str:
    log_file = root / '.agent/memory/monitor.log'
    if not log_file.exists():
        return '## 🔍 监控日志\n_暂无日志_\n'
    lines = log_file.read_text(encoding='utf-8').splitlines()
    rows = []
    for line in lines[-20:]:
        try:
            e = json.loads(line)
            try:
                ts = datetime.fromisoformat(e.get('ts', '')).strftime('%Y-%m-%d %H:%M:%S')
            except (ValueError, TypeError):
                ts = e.get('ts', '')[:19]
            t = e.get('type', '')
            detail = ''
            if t == 'task_completed':
                detail = e.get('content', '')[:40]
            elif t == 'hook_write':
                detail = f"{e.get('tool','')} → {e.get('file','')}"
            elif t == 'session_start':
                detail = e.get('sessionId', '')[:20]
            detail = detail.replace('|', '\\|').replace('\n', ' ')
            rows.append(f'| {ts} | {t} | {detail} |')
        except (json.JSONDecodeError, KeyError, ValueError):
            pass
    if not rows:
        return '## 🔍 监控日志\n_暂无日志_\n'
    table = '| 时间 | 类型 | 详情 |\n|------|------|------|\n' + '\n'.join(rows)
    return f'## 🔍 监控日志（最近 {len(rows)} 条）\n{table}\n'


def render_rich_status(ctx, status, session, phase, task, provider, updated, omc_status):
    from rich.console import Console
    from rich.table import Table
    console = Console()
    t = Table(title="🎯 系统状态", show_header=True)
    t.add_column("字段"); t.add_column("值")
    for k, v in [("Status", status), ("Session", session), ("Phase", phase),
                 ("Current Task", task), ("Provider", provider),
                 ("Last Updated", updated), ("OMC Status", omc_status)]:
        t.add_row(k, v)
    console.print(t)

def render_rich_progress(bar, pct, done, total):
    from rich.console import Console
    Console().print(f"[bold]📋 任务进度[/bold]  {bar} [cyan]{pct}%[/cyan] ({done}/{total if total > 0 else '—'} tasks)")

def render_rich_evolution(kb_count, pat_count, lq_count):
    from rich.console import Console
    from rich.table import Table
    console = Console()
    t = Table(title="🧬 进化统计", show_header=True)
    t.add_column("指标"); t.add_column("数量", justify="right")
    for label, val in [("📚 知识条目", kb_count), ("🔄 活跃模式", pat_count), ("📥 学习队列", lq_count)]:
        t.add_row(label, str(val))
    console.print(t)

if __name__ == '__main__':
    main()
