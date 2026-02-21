# Windows CRLF 导致正则 $ 不匹配

## 问题
manifest.md 在 Windows 上保存为 CRLF，`split('\n')` 后每行末尾有 `\r`，导致正则 `/^- \[( |x)\] (T\d+): (.+)$/` 中的 `$` 无法匹配。

## 修复
```javascript
const lines = text.split('\n').map(l => l.replace(/\r$/, ''));
```

## 适用场景
任何在 Windows 上读取文本文件后用正则解析行内容的场景。
