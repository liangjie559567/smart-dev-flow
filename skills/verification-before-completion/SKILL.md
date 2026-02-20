---
name: verification-before-completion
description: 在声称工作完成、修复或通过之前使用，在提交或创建 PR 之前必须运行验证命令并确认输出；证据先于断言
triggers: ["verification-before-completion", "完成验证", "提交前验证"]
---

# 完成前验证

## 铁律

**证据先于断言。在运行验证命令并看到实际输出之前，不得声称任何工作已完成。**

## 5 步验证门控

### 步骤 1：运行所有测试
```bash
# 运行完整测试套件，展示完整输出
npm test / pytest / go test ./... / cargo test
```
必须看到：测试数量、通过数、失败数（0 失败）

### 步骤 2：检查类型/静态分析
```bash
# TypeScript 项目
npx tsc --noEmit
# 其他语言的等效命令
```
必须看到：0 错误

### 步骤 3：运行构建
```bash
npm run build / cargo build / go build ./...
```
必须看到：构建成功，0 错误

### 步骤 4：对照验收标准逐项确认
从 `manifest.md` 读取当前任务的验收标准，逐项核对：
```
□ 验收标准 1：[具体描述] → ✅/❌
□ 验收标准 2：[具体描述] → ✅/❌
```

### 步骤 5：输出验证报告
```
验证结果：PASS / FAIL
- 测试：{N} 通过，0 失败
- 类型检查：0 错误
- 构建：成功
- 验收标准：{N}/{N} 通过
```

## 禁止声明

- "测试应该通过了"（没运行）
- "看起来没问题"（没验证）
- "我相信这是正确的"（没证据）

## 与 Axiom 集成

- 由 `axiom-implement` 在所有子任务完成后调用
- 验证报告作为 code-reviewer agent 的输入
- FAIL → 更新 `fail_count`，调用 `systematic-debugging`
- PASS → 继续代码审查流程
