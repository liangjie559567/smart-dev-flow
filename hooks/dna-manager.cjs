#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_TEMPLATE = `---
project: unknown
last_updated: ${new Date().toISOString().slice(0, 10)}
---

## 技术选型

## 踩过的坑

## 成功模式
`;

function readDna(cwd) {
  const projectPath = path.join(cwd, '.agent/memory/project-dna.md');
  const globalPath = path.join(os.homedir(), '.claude/global-dna.md');
  const project = tryRead(projectPath);
  const global_ = tryRead(globalPath);
  return [project, global_].filter(Boolean).join('\n');
}

function extractRelevant(dnaText, keywords) {
  if (!dnaText || !keywords.length) return [];
  const lines = dnaText.split('\n');
  const scored = lines
    .map(line => ({ line: line.trim(), score: keywords.filter(k => line.toLowerCase().includes(k.toLowerCase())).length }))
    .filter(({ line, score }) => score > 0 && line.length > 5 && !line.startsWith('#') && !line.startsWith('---'));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map(({ line }) => line);
}

function appendToDna(cwd, section, entry) {
  const filePath = path.join(cwd, '.agent/memory/project-dna.md');
  let content = tryRead(filePath) || DEFAULT_TEMPLATE;
  const marker = `## ${section}`;
  const idx = content.indexOf(marker);

  // 去重：提取 entry 核心词，若 section 内已有高度相似行则跳过
  if (idx !== -1) {
    const nextSection = content.indexOf('\n## ', idx + marker.length);
    const sectionBody = nextSection === -1 ? content.slice(idx) : content.slice(idx, nextSection);
    const entryWords = entry.toLowerCase().replace(/[\[\]()（）\d\-:：]/g, ' ').split(/\s+/).filter(w => w.length > 3);
    const isDuplicate = sectionBody.split('\n').some(line => {
      if (!line.trim() || line.startsWith('#')) return false;
      const matches = entryWords.filter(w => line.toLowerCase().includes(w)).length;
      return matches >= Math.max(2, Math.floor(entryWords.length * 0.6));
    });
    if (isDuplicate) return;
  }

  if (idx === -1) {
    content += `\n${marker}\n${entry}\n`;
  } else {
    const insertAt = idx + marker.length;
    content = content.slice(0, insertAt) + '\n' + entry + content.slice(insertAt);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function tryRead(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

module.exports = { readDna, extractRelevant, appendToDna };
