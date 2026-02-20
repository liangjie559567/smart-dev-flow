# 设计文档：axiom-status 任务进度从 manifest.md 读取

**日期**：2026-02-21

## ADR

将任务进度计算从 frontmatter 字段迁移到 manifest.md checkbox 统计，checkbox 是任务看板的单一事实来源（SSOT）。

## Manifest Schema 约定

`manifest.md` 中的验收标准区块使用 checkbox 格式记录每个任务的验收条件：

```markdown
- [ ] T1: readFile 返回文本内容
- [x] T2: manifest 不存在时返回空字符串
```

**统计对象**：验收标准 checkbox 行（`- [ ]` / `- [x]`），而非任务表格行。每个 checkbox 代表一条验收标准，`[x]` 表示已验收通过。

## 接口契约

**变更1**：替换 `scripts/status.py` 第 31-37 行（任务进度计算）：

```python
# 旧：从 frontmatter 读取
completed = [t.strip() for t in ctx.get('completed_tasks', '').split(',') if t.strip()]
total_raw = ctx.get('total_tasks', '0')
try: total = int(total_raw)
except: total = 0
done = len(completed)

# 新：从 manifest.md 统计验收标准 checkbox
manifest_path = ctx.get('manifest_path', '') or str(mem / 'manifest.md')
manifest_text = read_file(manifest_path)  # 文件不存在时返回空字符串
total = len(re.findall(r'^\s*-\s+\[[ xX]\]', manifest_text, re.MULTILINE))
done = len(re.findall(r'^\s*-\s+\[[xX]\]', manifest_text, re.MULTILINE))
```

**变更2**：替换 `scripts/status.py` 第 78 行（删除依赖 `completed` 变量的输出行）：

```python
# 旧：
已完成：{', '.join(completed) if completed else '—'}

# 新：删除此行（进度信息已由进度条和 done/total 数字完整表达）
```

## 变更范围

- 文件：`scripts/status.py`
- 变更1：第 31-37 行（7行替换为4行）
- 变更2：第 78 行（删除1行）
- 不引入新依赖
