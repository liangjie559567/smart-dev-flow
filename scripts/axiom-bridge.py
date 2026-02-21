#!/usr/bin/env python3
"""Axiom MCP 桥接脚本 - 通过 stdin/stdout 接收 JSON 命令并调用 Axiom 工具"""
import sys
import json
import os

# 强制 stdout/stderr 使用 UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# 将 evolution 模块路径加入 sys.path
# 优先使用内嵌路径（scripts/ 目录），回退到外部 AXIOM_PATH
AXIOM_PATH = os.environ.get("AXIOM_PATH", "")
BASE_DIR = os.environ.get("AXIOM_BASE_DIR", ".agent/memory")

# 内嵌路径：本脚本所在的 scripts/ 目录即包含 evolution/ 包
_scripts_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _scripts_dir)

# 外部 Axiom 路径作为回退
if AXIOM_PATH:
    sys.path.append(AXIOM_PATH)
    sys.path.append(os.path.join(AXIOM_PATH, '.agent'))

def run():
    line = sys.stdin.readline()
    if not line:
        return
    req = json.loads(line)
    tool = req.get("tool")
    args = req.get("args", {})

    try:
        result = dispatch(tool, args)
        print(json.dumps({"ok": True, "result": result}), flush=True)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}), flush=True)

def dispatch(tool, args):
    if tool == "axiom_harvest":
        from evolution.harvester import KnowledgeHarvester
        from evolution.index_manager import KnowledgeIndexManager
        h = KnowledgeHarvester(base_dir=BASE_DIR)
        entry = h.harvest(**args)
        mgr = KnowledgeIndexManager(base_dir=BASE_DIR)
        mgr.add_to_index(entry.id, entry.title, entry.category, entry.confidence, entry.created)
        return {"id": entry.id, "title": entry.title, "category": entry.category}

    elif tool == "axiom_get_knowledge":
        from evolution.harvester import KnowledgeHarvester
        h = KnowledgeHarvester(base_dir=BASE_DIR)
        kid = args.get("id")
        if kid:
            return h.get_entry(kid)
        return h.search(args.get("query", ""))

    elif tool == "axiom_search_by_tag":
        from evolution.harvester import KnowledgeHarvester
        h = KnowledgeHarvester(base_dir=BASE_DIR)
        tags = args.get("tags", [])
        query = " ".join(tags) if tags else args.get("query", "")
        results = h.search(query)
        limit = args.get("limit", 10)
        return results[:limit]

    elif tool == "axiom_evolve":
        from evolution.orchestrator import EvolutionOrchestrator
        evo = EvolutionOrchestrator(base_dir=BASE_DIR)
        return evo.evolve()

    elif tool == "axiom_reflect":
        from evolution.orchestrator import EvolutionOrchestrator
        evo = EvolutionOrchestrator(base_dir=BASE_DIR)
        return evo.reflect(**args)

    elif tool == "axiom_detect_patterns":
        from evolution.pattern_detector import PatternDetector
        d = PatternDetector(base_dir=BASE_DIR)
        diff = args.get("diff", "")
        return d.detect_and_update(diff)

    elif tool == "axiom_suggest_patterns":
        from evolution.pattern_detector import PatternDetector
        d = PatternDetector(base_dir=BASE_DIR)
        return d.suggest_reuse(args.get("feature_description", ""))

    elif tool == "axiom_reflection_report":
        from evolution.reflection import ReflectionEngine
        e = ReflectionEngine(base_dir=BASE_DIR)
        report = e.reflect(
            session_name=args["session_name"],
            duration=args.get("duration", 0),
            went_well=args.get("went_well", []),
            could_improve=args.get("could_improve", []),
            learnings=args.get("learnings", []),
            action_items=args.get("action_items", []),
        )
        return report.to_markdown()

    elif tool == "axiom_pending_actions":
        from evolution.reflection import ReflectionEngine
        e = ReflectionEngine(base_dir=BASE_DIR)
        return e.get_pending_action_items()

    elif tool == "axiom_status":
        from status_dashboard import StatusDashboard
        base = os.path.dirname(BASE_DIR)  # .agent/memory -> .agent
        d = StatusDashboard(base_dir=base)
        return d.generate()

    elif tool == "context_read":
        from context_manager import ContextManager
        cm = ContextManager(base_dir=os.path.dirname(os.path.dirname(BASE_DIR)))
        data = cm.read_context()
        return {"frontmatter": data.frontmatter, "body": data.body}

    elif tool == "context_update_state":
        from context_manager import ContextManager
        cm = ContextManager(base_dir=os.path.dirname(os.path.dirname(BASE_DIR)))
        return cm.update_state(args["new_state"])

    elif tool == "context_record_error":
        from context_manager import ContextManager
        cm = ContextManager(base_dir=os.path.dirname(os.path.dirname(BASE_DIR)))
        cm.record_error(args["error_type"], args["root_cause"], args["fix_solution"], args["scope"])
        return "ok"

    elif tool == "context_update_progress":
        from context_manager import ContextManager
        cm = ContextManager(base_dir=os.path.dirname(os.path.dirname(BASE_DIR)))
        cm.update_progress(args["task_id"], args["status"], args["summary"])
        return "ok"

    else:
        raise ValueError(f"未知工具: {tool}")

if __name__ == "__main__":
    run()
