---
name: using-git-worktrees
description: 在开始需要与当前工作空间隔离的功能工作时使用，或在执行实现计划之前使用
triggers: ["using-git-worktrees", "git worktree", "隔离工作区", "worktree"]
---

# 使用 Git Worktrees

## 核心原则

**系统化目录选择 + 安全验证 = 可靠隔离。**

## 目录选择优先级

```
1. 检查 .worktrees/ 是否存在 → 使用它
2. 检查 worktrees/ 是否存在 → 使用它
3. 检查 CLAUDE.md 中的 worktree 配置 → 使用指定路径
4. 都没有 → 询问用户
```

## 创建步骤

### 1. 安全验证（项目本地目录必须）
```bash
git check-ignore -q .worktrees 2>/dev/null || echo "未忽略，需要添加到 .gitignore"
```
如果未忽略：添加到 `.gitignore` 并提交，再继续。

### 2. 创建 Worktree
```bash
BRANCH_NAME="feature/{功能名}"
git worktree add .worktrees/${BRANCH_NAME##*/} -b ${BRANCH_NAME}
cd .worktrees/${BRANCH_NAME##*/}
```

### 3. 运行项目初始化
```bash
# 自动检测并运行
[ -f package.json ] && npm install
[ -f Cargo.toml ] && cargo build
[ -f requirements.txt ] && pip install -r requirements.txt
[ -f go.mod ] && go mod download
```

### 4. 验证基线
```bash
# 运行测试确认干净起点
npm test / pytest / go test ./...
```
测试失败 → 报告失败，询问是否继续。

### 5. 报告就绪
```
Worktree 就绪：{完整路径}
测试通过：{N} 个测试，0 失败
准备实现：{功能名}
```

## 与 Axiom 集成

- 由 `dev-flow` 在 DECOMPOSING 完成后调用
- Worktree 路径记录到 `active_context.md`
- 实现完成后由 `finishing-a-development-branch` 清理

## 禁止行为

- 不验证 .gitignore 就创建项目本地 worktree
- 跳过基线测试验证
- 测试失败时不询问直接继续
