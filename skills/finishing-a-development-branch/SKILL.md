---
name: finishing-a-development-branch
description: 当实现完成、所有测试通过，需要决定如何集成工作时使用 - 通过提供结构化选项（合并/PR/保留/清理）来指导开发工作的完成
triggers: ["finishing-a-development-branch", "完成分支", "合并分支", "收尾工作"]
---

# 完成开发分支

## 概述

实现完成后，引导用户选择如何集成工作。

**核心原则：** 先验证，再集成。不跳过测试直接合并。

## 前置条件（必须全部满足）

```
□ 所有测试通过（运行并展示输出）
□ 构建成功
□ 代码审查完成（或已记录跳过原因）
□ active_context.md 状态为 REFLECTING
```

## 4 个选项

展示给用户选择：

**A. 合并到主分支**
```bash
git checkout main
git merge --no-ff {branch} -m "feat: {描述}"
git branch -d {branch}
# 如果是 worktree：git worktree remove {path}
```

**B. 创建 Pull Request**
```bash
git push origin {branch}
gh pr create --title "{标题}" --body "{描述}"
# 调用 requesting-code-review 技能
```

**C. 保留分支（稍后处理）**
```bash
git push origin {branch}
# 更新 active_context.md：task_status: IDLE
# 记录分支名和待办事项
```

**D. 丢弃工作**
```bash
# 警告：此操作不可逆！
git checkout main
git branch -D {branch}
# 如果是 worktree：git worktree remove --force {path}
```

## 清理 Worktree

如果使用了 git worktree 隔离工作区：
```bash
# 选项 A/D 后清理
git worktree remove {worktree-path}
```

## 与 Axiom 集成

- 由 `dev-flow` 在 REFLECTING 阶段调用（在 `axiom-reflect` 之前）
- 完成后更新 `active_context.md`：`task_status: IDLE`（选项 A/D）或保持 REFLECTING（选项 B/C）
- 选项 B 后调用 `requesting-code-review`
- 所有选项完成后调用 `axiom-reflect` 进行知识沉淀
