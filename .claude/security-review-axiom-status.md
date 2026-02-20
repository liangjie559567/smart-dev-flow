# 安全评审报告：axiom-status manifest.md 任务进度功能

**评审日期**：2026-02-21  
**评审员**：Security Reviewer  
**PRD**：axiom-status 任务进度从 manifest.md 读取  
**范围**：scripts/status.py 第31-37行修改

---

## 📊 综合安全评分

**总分：70/100** ⚠️ **需要改进**

| 维度 | 评分 | 状态 |
|------|------|------|
| 访问控制（OWASP A01） | 60/100 | 🔴 高风险 |
| 资源管理（OWASP A05） | 70/100 | 🟡 中风险 |
| 错误处理（OWASP A09） | 50/100 | 🔴 高风险 |
| 信息泄露防护（OWASP A01） | 75/100 | 🟡 中风险 |
| **综合评分** | **70/100** | 🟡 **需改进** |

---

## 🔍 关键安全风险

### 1. 路径遍历漏洞（CWE-22）- HIGH 风险

**问题描述**：
- PRD 要求"从本地文件系统读取 manifest.md"，但 `manifest_path` 来自 `active_context.md` 的 frontmatter
- 当前代码无路径规范化检查，攻击者可注入 `../../../etc/passwd` 等路径遍历序列
- 符号链接未检测，可指向任意敏感文件

**威胁场景**：
```
恶意修改 active_context.md：
manifest_path: "../../../../etc/passwd"

结果：读取系统敏感文件
```

**建议修复**：
```python
# 添加路径规范化和验证
def safe_read_manifest(path_str):
    try:
        p = Path(path_str).resolve()  # 规范化路径
        # 验证路径在允许范围内
        if not str(p).startswith(str(root)):
            return None
        if p.is_symlink():  # 检测符号链接
            return None
        return p.read_text(encoding='utf-8-sig')
    except:
        return None
```

---

### 2. 资源耗尽（CWE-400）- MEDIUM 风险

**问题描述**：
- 无文件大小限制，大文件读取可导致内存溢出
- 无超时机制，可能导致 DoS

**建议修复**：
```python
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB 限制
if p.stat().st_size > MAX_FILE_SIZE:
    return None
```

---

### 3. 错误处理不当（CWE-391）- MEDIUM 风险

**问题描述**：
- AC-3 要求"不抛异常"，但异常吞掉隐藏真实问题
- 无日志记录，无法审计文件访问
- 无法区分"文件不存在"和"权限拒绝"

**建议修复**：
```python
# 改进异常处理
try:
    return p.read_text(encoding='utf-8-sig')
except FileNotFoundError:
    return None  # 正常降级
except PermissionError:
    # 记录权限问题（可选）
    return None
except Exception:
    return None  # 其他异常也降级
```

---

## ✅ 正面因素

1. **本地文件系统限制**：仅读取本地文件，不涉及网络输入
2. **异常捕获**：基础异常处理存在，避免崩溃
3. **只读操作**：不修改文件，降低破坏风险
4. **开发环境**：通常在受信任的开发机器上运行

---

## 🛡️ 信任模型分析

**假设**：
- ✅ 本地文件系统可信
- ✅ 开发者可信
- ❌ active_context.md 内容未验证
- ❌ 无访问控制检查

**攻击面**：
- 本地特权提升
- 符号链接攻击
- 竞态条件（TOCTOU）

---

## 📋 验收标准安全性评估

| AC | 安全性 | 备注 |
|----|----|------|
| AC-1 | ⚠️ 中 | 需验证路径来源 |
| AC-2 | ✅ 安全 | 仅统计行数，无风险 |
| AC-3 | ⚠️ 中 | 异常吞掉可隐藏问题 |
| AC-4 | ✅ 安全 | 移除不可信字段 |
| AC-5 | ✅ 安全 | 纯计算，无风险 |

---

## 🎯 关键建议（3条）

### 建议1：实施路径规范化和验证（必须）
**优先级**：P0 - 阻塞  
**理由**：防止路径遍历漏洞  
**实现**：
- 使用 `Path.resolve()` 规范化路径
- 验证路径在 `.agent/memory/` 范围内
- 检测符号链接

### 建议2：添加文件大小限制（应该）
**优先级**：P1 - 重要  
**理由**：防止资源耗尽  
**实现**：
- 限制文件大小 <10MB
- 检查 `stat().st_size`

### 建议3：改进错误处理和日志（应该）
**优先级**：P2 - 可选  
**理由**：提高可审计性  
**实现**：
- 区分异常类型（FileNotFoundError vs PermissionError）
- 可选：记录访问日志

---

## 📝 OWASP Top 10 映射

| OWASP | 风险 | 状态 |
|-------|------|------|
| A01:2021 - Broken Access Control | 路径遍历、符号链接 | 🔴 HIGH |
| A05:2021 - Resource Exhaustion | 无大小限制 | 🟡 MEDIUM |
| A09:2021 - Logging & Monitoring Failures | 无审计日志 | 🟡 MEDIUM |

---

## 🔐 最终决策

**评分**：70/100  
**建议**：**需改进后通过**

**通过条件**：
- [ ] 实施路径规范化和验证（建议1）
- [ ] 添加文件大小限制（建议2）
- [ ] 改进错误处理（建议3）

**当前状态**：❌ **不通过** - 存在 HIGH 风险的路径遍历漏洞

---

## 📌 审查清单

- [x] 需求字段完整性检查
- [x] OWASP Top 10 风险评估
- [x] 信任模型分析
- [x] 威胁场景识别
- [x] 修复建议提供
- [x] 时间戳记录：2026-02-21T00:00:00Z
