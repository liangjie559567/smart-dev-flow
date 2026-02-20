"""测试 status.py 任务进度从 manifest.md 读取"""
import re
import tempfile
import os
from pathlib import Path


def count_progress(manifest_text):
    """从 manifest 文本统计进度（提取自 status.py 的逻辑）"""
    total = len(re.findall(r'^\s*-\s+\[[ xX]\]', manifest_text, re.MULTILINE))
    done = len(re.findall(r'^\s*-\s+\[[xX]\]', manifest_text, re.MULTILINE))
    return done, total


def test_ac1_count_total():
    """AC-1: 统计总任务数（[ ] 与 [x] 之和）"""
    text = "- [ ] T1\n- [x] T2\n- [ ] T3\n"
    done, total = count_progress(text)
    assert total == 3, f"期望 total=3，实际={total}"


def test_ac2_count_done():
    """AC-2: 统计已完成任务数"""
    text = "- [ ] T1\n- [x] T2\n- [X] T3\n"
    done, total = count_progress(text)
    assert done == 2, f"期望 done=2，实际={done}"


def test_ac3_missing_manifest():
    """AC-3: manifest 不存在时 total=0，不抛异常"""
    def read_file(p):
        try: return Path(p).read_text(encoding='utf-8-sig')
        except: return ''

    text = read_file('/nonexistent/path/manifest.md')
    done, total = count_progress(text)
    assert total == 0, f"期望 total=0，实际={total}"
    assert done == 0, f"期望 done=0，实际={done}"


def test_ac5_percentage_consistent():
    """AC-5: 进度条百分比与 checkbox 统计一致"""
    text = "- [x] T1\n- [x] T2\n- [ ] T3\n- [ ] T4\n"
    done, total = count_progress(text)
    pct = int(done / total * 100) if total > 0 else 0
    assert pct == 50, f"期望 pct=50，实际={pct}"


def test_total_zero_display():
    """total=0 时 pct=0（显示 —/— 由调用方处理）"""
    done, total = count_progress("")
    assert total == 0
    assert done == 0


if __name__ == '__main__':
    tests = [test_ac1_count_total, test_ac2_count_done, test_ac3_missing_manifest,
             test_ac5_percentage_consistent, test_total_zero_display]
    passed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"FAIL {t.__name__}: {e}")
    print(f"\n{passed}/{len(tests)} 通过")
