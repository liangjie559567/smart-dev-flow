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

# 将 Axiom 项目路径加入 sys.path
AXIOM_PATH = os.environ.get("AXIOM_PATH", "")
BASE_DIR = os.environ.get("AXIOM_BASE_DIR", ".agent/memory")

if AXIOM_PATH:
    sys.path.insert(0, AXIOM_PATH)
    sys.path.insert(0, os.path.join(AXIOM_PATH, '.agent'))

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

    else:
        raise ValueError(f"未知工具: {tool}")

if __name__ == "__main__":
    run()
