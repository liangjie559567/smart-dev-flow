import sys, os
sys.path.insert(0, os.path.dirname(__file__))

# 直接从 status 模块导入（此时函数尚不存在，测试应失败）
from status import resolve_phase

def test(name, got, expected):
    assert got == expected, f"FAIL [{name}]: got {got!r}, expected {expected!r}"
    print(f"PASS [{name}]")

# AC-7: IDLE → 0%
test("IDLE", resolve_phase("IDLE", "Phase 1 - Drafting"), ("未知阶段", 0))
test("idle lowercase", resolve_phase("idle", "Phase 1 - Drafting"), ("未知阶段", 0))

# AC-2/AC-6: 未知 status 或空 raw_phase → 降级
test("unknown status", resolve_phase("UNKNOWN", "Phase 1"), ("未知阶段", 0))
test("empty status", resolve_phase("", "Phase 1"), ("未知阶段", 0))
test("empty phase", resolve_phase("DRAFTING", ""), ("未知阶段", 0))
test("dash phase", resolve_phase("DRAFTING", "—"), ("未知阶段", 0))

# AC-1/AC-3: 6个阶段正确百分比
test("phase 0", resolve_phase("DRAFTING", "Phase 0 - Understanding"), ("Phase 0 - Understanding", 10))
test("phase 1", resolve_phase("DRAFTING", "Phase 1 - Drafting"), ("Phase 1 - Drafting", 30))
test("phase 1.5", resolve_phase("REVIEWING", "Phase 1.5 - Reviewing"), ("Phase 1.5 - Reviewing", 40))
test("phase 2", resolve_phase("DECOMPOSING", "Phase 2 - Decomposing"), ("Phase 2 - Decomposing", 55))
test("phase 3", resolve_phase("IMPLEMENTING", "Phase 3 - Done"), ("Phase 3 - Done", 95))
test("reflecting", resolve_phase("REFLECTING", "REFLECTING"), ("REFLECTING", 100))

# H-2: phase 1.5 优先于 phase 1（最长前缀优先）
test("phase 1.5 priority", resolve_phase("REVIEWING", "Phase 1.5 - Reviewing"), ("Phase 1.5 - Reviewing", 40))

# 大小写不敏感
test("uppercase phase", resolve_phase("DRAFTING", "PHASE 1 - DRAFTING"), ("Phase 1 - Drafting", 30))
test("mixed case", resolve_phase("reviewing", "phase 1.5 - reviewing"), ("Phase 1.5 - Reviewing", 40))

# CONFIRMING 状态应正常工作（不降级）
test("confirming", resolve_phase("CONFIRMING", "Phase 1 - Drafting"), ("Phase 1 - Drafting", 30))

print("\n所有测试通过 ✅")
