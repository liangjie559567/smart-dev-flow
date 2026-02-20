#!/usr/bin/env python3
import os, sys
from datetime import datetime

force = "--force" in sys.argv
ctx_path = ".agent/memory/active_context.md"

if os.path.exists(ctx_path) and not force:
    content = open(ctx_path).read()
    if "task_status: IDLE" not in content:
        ans = input("active_context.md exists and is not IDLE. Overwrite? [y/N] ")
        if ans.lower() != "y":
            sys.exit(0)

os.makedirs(".agent/memory", exist_ok=True)
os.makedirs(".omc", exist_ok=True)

now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
open(ctx_path, "w").write(f"""---
task_status: IDLE
current_phase: —
last_gate: —
omc_team_phase: —
current_task: —
completed_tasks: —
fail_count: 0
pending_confirmation: —
blocked_reason: —
manifest_path: —
last_updated: {now}
---

# Active Context

初始化完成，使用 `/dev-flow: 描述你的需求` 开始。
""")
print(f"Initialized {ctx_path}")
