#!/usr/bin/env python3
"""进化引擎 CLI 包装脚本 - 调用 EvolutionOrchestrator"""
import sys
import os
import argparse
import json

# 将 .agent 目录加入路径
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), '.agent'))

def get_orchestrator():
    from evolution.orchestrator import EvolutionOrchestrator
    return EvolutionOrchestrator(base_dir=".agent/memory")

def cmd_reflect(args):
    evo = get_orchestrator()
    report = evo.reflect(
        session_name=args.session_name,
        duration=args.duration,
        went_well=args.went_well.split('|') if args.went_well else [],
        could_improve=args.could_improve.split('|') if args.could_improve else [],
        learnings=args.learnings.split('|') if args.learnings else [],
        action_items=args.action_items.split('|') if args.action_items else [],
        auto_fix_count=args.auto_fix_count,
        rollback_count=args.rollback_count,
    )
    print(report)

def cmd_evolve(args):
    evo = get_orchestrator()
    report = evo.evolve()
    print(report)

def cmd_on_task_completed(args):
    evo = get_orchestrator()
    evo.on_task_completed(task_id=args.task_id, description=args.description)

def cmd_on_error_fixed(args):
    evo = get_orchestrator()
    evo.on_error_fixed(
        error_type=args.error_type,
        root_cause=args.root_cause,
        solution=args.solution,
    )

def cmd_on_workflow_completed(args):
    evo = get_orchestrator()
    evo.on_workflow_completed(
        workflow=args.workflow,
        duration_min=args.duration_min,
        success=args.success,
        notes=args.notes or '',
    )

def main():
    parser = argparse.ArgumentParser(description='进化引擎 CLI')
    sub = parser.add_subparsers(dest='cmd', required=True)

    # reflect
    p = sub.add_parser('reflect')
    p.add_argument('--session-name', default='session')
    p.add_argument('--duration', type=float, default=0)
    p.add_argument('--went-well', default='')
    p.add_argument('--could-improve', default='')
    p.add_argument('--learnings', default='')
    p.add_argument('--action-items', default='')
    p.add_argument('--auto-fix-count', type=int, default=0)
    p.add_argument('--rollback-count', type=int, default=0)

    # evolve
    sub.add_parser('evolve')

    # on-task-completed
    p = sub.add_parser('on-task-completed')
    p.add_argument('--task-id', required=True)
    p.add_argument('--description', default='')

    # on-error-fixed
    p = sub.add_parser('on-error-fixed')
    p.add_argument('--error-type', required=True)
    p.add_argument('--root-cause', default='')
    p.add_argument('--solution', default='')

    # on-workflow-completed
    p = sub.add_parser('on-workflow-completed')
    p.add_argument('--workflow', required=True)
    p.add_argument('--duration-min', type=float, default=0)
    p.add_argument('--success', type=lambda x: x.lower() == 'true', default=True)
    p.add_argument('--notes', default='')

    args = parser.parse_args()
    dispatch = {
        'reflect': cmd_reflect,
        'evolve': cmd_evolve,
        'on-task-completed': cmd_on_task_completed,
        'on-error-fixed': cmd_on_error_fixed,
        'on-workflow-completed': cmd_on_workflow_completed,
    }
    dispatch[args.cmd](args)

if __name__ == '__main__':
    main()
