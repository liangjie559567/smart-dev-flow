import re, json, sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

root = Path(__file__).parent.parent

def parse_frontmatter(text):
    m = re.match(r'^---\s*\n(.*?)\n---', text, re.DOTALL)
    if not m:
        return {}
    return dict(re.findall(r'^(\w+):\s*"?([^"\n]*)"?', m.group(1), re.MULTILINE))

ctx_text = (root / '.agent/memory/active_context.md').read_text(encoding='utf-8-sig')
dec_text = (root / '.agent/memory/project_decisions.md').read_text(encoding='utf-8-sig')

ctx = parse_frontmatter(ctx_text)
dec_summary = dec_text[:300]

axiom_status = 'N/A'
pm_path = root / '.omc/project-memory.json'
if pm_path.exists():
    data = json.loads(pm_path.read_text(encoding='utf-8-sig'))
    axiom_status = data.get('axiom_status', 'N/A')

print(f"""# Axiom 状态报告

## 当前上下文
| 字段 | 值 |
|------|-----|
| task_status | {ctx.get('task_status', 'N/A')} |
| current_phase | {ctx.get('current_phase') or '—'} |
| last_gate | {ctx.get('last_gate') or '—'} |
| omc_team_phase | {ctx.get('omc_team_phase') or '—'} |
| last_updated | {ctx.get('last_updated') or '—'} |

## Project Memory - axiom_status
{axiom_status}

## Project Decisions 摘要
{dec_summary}
""")
