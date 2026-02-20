import re
from datetime import datetime

path = ".agent/memory/active_context.md"
with open(path, encoding="utf-8") as f:
    content = f.read()

now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
content = re.sub(r'(last_updated:\s*).*', rf'\g<1>{now}', content)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

def get(key):
    m = re.search(rf'{key}:\s*"?([^"\n]*)"?', content)
    return m.group(1).strip() if m else ""

completed = content.count("- [x]")
print(f"""## 会话挂起摘要

- **task_status**: {get('task_status')}
- **current_task**: {get('current_phase')}
- **completed_tasks**: {completed}
- **last_updated**: {now}

> 下次恢复：运行 `/dev-flow` 并查看 active_context.md 继续任务。""")
