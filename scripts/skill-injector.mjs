#!/usr/bin/env node

/**
 * Skill Injector Hook (UserPromptSubmit)
 * Injects relevant learned skills into context based on prompt triggers.
 *
 * STANDALONE SCRIPT - uses compiled bridge bundle from dist/hooks/skill-bridge.cjs
 * Falls back to inline implementation if bundle not available (first run before build)
 *
 * Enhancement in v3.5: Now uses RECURSIVE discovery (skills in subdirectories included)
 */

import { existsSync, readdirSync, readFileSync, realpathSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { readStdin } from './lib/stdin.mjs';
import { createRequire } from 'module';

// Try to load the compiled bridge bundle
const require = createRequire(import.meta.url);
let bridge = null;
try {
  bridge = require('../omc-dist/hooks/skill-bridge.cjs');
} catch {
  // Bridge not available - use fallback (first run before build, or dist/ missing)
}

// Constants (used by fallback)
const cfgDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
const USER_SKILLS_DIR = join(cfgDir, 'skills', 'omc-learned');
const GLOBAL_SKILLS_DIR = join(homedir(), '.omc', 'skills');
const PROJECT_SKILLS_SUBDIR = join('.omc', 'skills');
// smart-dev-flow 本地技能目录（项目根 skills/）
const SDF_SKILLS_SUBDIR = 'skills';

// Superpowers plugin skills directory (all installed versions)
function getSuperpowersSkillsDirs() {
  const base = join(homedir(), '.claude', 'plugins', 'cache', 'claude-plugins-official', 'superpowers');
  if (!existsSync(base)) return [];
  try {
    return readdirSync(base, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => join(base, d.name, 'skills'))
      .filter(existsSync);
  } catch { return []; }
}
const SKILL_EXTENSION = '.md';
const MAX_SKILLS_PER_SESSION = 5;

// =============================================================================
// Fallback Implementation (used when bridge bundle not available)
// =============================================================================

// In-memory cache (resets each process - known limitation, fixed by bridge)
const injectedCacheFallback = new Map();

// Parse YAML frontmatter from skill file (fallback)
function parseSkillFrontmatterFallback(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const yamlContent = match[1];
  const body = match[2].trim();

  // Simple YAML parsing for triggers (支持多行和内联数组两种格式)
  const triggers = [];
  const inlineMatch = yamlContent.match(/triggers:\s*\[([^\]]+)\]/);
  if (inlineMatch) {
    for (const t of inlineMatch[1].split(',')) {
      const v = t.trim().replace(/^["']|["']$/g, '');
      if (v) triggers.push(v.toLowerCase());
    }
  } else {
    const triggerMatch = yamlContent.match(/triggers:\s*\n((?:\s+-\s*.+\n?)*)/);
    if (triggerMatch) {
      for (const line of triggerMatch[1].split('\n')) {
        const itemMatch = line.match(/^\s+-\s*["']?([^"'\n]+)["']?\s*$/);
        if (itemMatch) triggers.push(itemMatch[1].trim().toLowerCase());
      }
    }
  }

  // Extract name
  const nameMatch = yamlContent.match(/name:\s*["']?([^"'\n]+)["']?/);
  const name = nameMatch ? nameMatch[1].trim() : 'Unnamed Skill';

  return { name, triggers, content: body };
}

// Recursively collect SKILL.md files (maxDepth=3)
function collectSkillFiles(dir, scope, seenPaths, candidates, depth = 0) {
  if (depth > 3 || !existsSync(dir)) return;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isFile() && entry.name === 'SKILL.md') {
        try {
          const realPath = realpathSync(fullPath);
          if (!seenPaths.has(realPath)) { seenPaths.add(realPath); candidates.push({ path: fullPath, scope }); }
        } catch {}
      } else if (entry.isDirectory()) {
        collectSkillFiles(fullPath, scope, seenPaths, candidates, depth + 1);
      }
    }
  } catch {}
}

// Find all skill files (fallback - NON-RECURSIVE for backward compat)
function findSkillFilesFallback(directory) {
  const candidates = [];
  const seenPaths = new Set();

  // smart-dev-flow 本地 skills/ 目录（最高优先级，递归扫描 SKILL.md）
  const sdfSkillsDir = join(directory, SDF_SKILLS_SUBDIR);
  collectSkillFiles(sdfSkillsDir, 'project', seenPaths, candidates);

  // Project-level skills (higher priority)
  const projectDir = join(directory, PROJECT_SKILLS_SUBDIR);
  if (existsSync(projectDir)) {
    try {
      const files = readdirSync(projectDir, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() && file.name.endsWith(SKILL_EXTENSION)) {
          const fullPath = join(projectDir, file.name);
          try {
            const realPath = realpathSync(fullPath);
            if (!seenPaths.has(realPath)) {
              seenPaths.add(realPath);
              candidates.push({ path: fullPath, scope: 'project' });
            }
          } catch {
            // Ignore symlink resolution errors
          }
        }
      }
    } catch {
      // Ignore directory read errors
    }
  }

  // User-level skills (search both global and legacy directories, plus superpowers)
  const userDirs = [GLOBAL_SKILLS_DIR, USER_SKILLS_DIR, ...getSuperpowersSkillsDirs()];
  for (const userDir of userDirs) {
    if (existsSync(userDir)) {
      try {
        const files = readdirSync(userDir, { withFileTypes: true });
        for (const file of files) {
          if (file.isFile() && file.name.endsWith(SKILL_EXTENSION)) {
            const fullPath = join(userDir, file.name);
            try {
              const realPath = realpathSync(fullPath);
              if (!seenPaths.has(realPath)) {
                seenPaths.add(realPath);
                candidates.push({ path: fullPath, scope: 'user' });
              }
            } catch {
              // Ignore symlink resolution errors
            }
          }
        }
      } catch {
        // Ignore directory read errors
      }
    }
  }

  return candidates;
}

// Find matching skills (fallback)
function findMatchingSkillsFallback(prompt, directory, sessionId) {
  const promptLower = prompt.toLowerCase();
  const candidates = findSkillFilesFallback(directory);
  const matches = [];

  // Get or create session cache
  if (!injectedCacheFallback.has(sessionId)) {
    injectedCacheFallback.set(sessionId, new Set());
  }
  const alreadyInjected = injectedCacheFallback.get(sessionId);

  for (const candidate of candidates) {
    // Skip if already injected this session
    if (alreadyInjected.has(candidate.path)) continue;

    try {
      const content = readFileSync(candidate.path, 'utf-8');
      const skill = parseSkillFrontmatterFallback(content);
      if (!skill) continue;

      // Check if any trigger matches
      let score = 0;
      for (const trigger of skill.triggers) {
        if (promptLower.includes(trigger)) {
          score += 10;
        }
      }

      if (score > 0) {
        matches.push({
          path: candidate.path,
          name: skill.name,
          content: skill.content,
          score,
          scope: candidate.scope,
          triggers: skill.triggers
        });
      }
    } catch {
      // Ignore file read errors
    }
  }

  // Sort by score (descending) and limit
  matches.sort((a, b) => b.score - a.score);
  const selected = matches.slice(0, MAX_SKILLS_PER_SESSION);

  // Mark as injected
  for (const skill of selected) {
    alreadyInjected.add(skill.path);
  }

  return selected;
}

// =============================================================================
// Main Logic (uses bridge if available, fallback otherwise)
// =============================================================================

// Find matching skills - delegates to bridge or fallback
function findMatchingSkills(prompt, directory, sessionId) {
  if (bridge) {
    const sdfSkillsDir = join(directory, SDF_SKILLS_SUBDIR);
    const matches = bridge.matchSkillsForInjection(prompt, directory, sessionId, {
      maxResults: MAX_SKILLS_PER_SESSION
    });
    if (matches.length > 0) {
      bridge.markSkillsInjected(sessionId, matches.map(s => s.path), directory);
      return matches;
    }
    // bridge 未找到时，补充搜索项目本地 skills/ 目录
    if (existsSync(sdfSkillsDir)) {
      return findMatchingSkillsFallback(prompt, directory, sessionId);
    }
    return matches;

    // Mark as injected via bridge
    if (matches.length > 0) {
      bridge.markSkillsInjected(sessionId, matches.map(s => s.path), directory);
    }

    return matches;
  }

  // Fallback (NON-RECURSIVE, in-memory cache)
  return findMatchingSkillsFallback(prompt, directory, sessionId);
}

// Format skills for injection
function formatSkillsMessage(skills) {
  const lines = [
    '<mnemosyne>',
    '',
    '## Relevant Learned Skills',
    '',
    'The following skills from previous sessions may help:',
    ''
  ];

  for (const skill of skills) {
    lines.push(`### ${skill.name} (${skill.scope})`);

    // Add metadata block for programmatic parsing
    const metadata = {
      path: skill.path,
      triggers: skill.triggers,
      score: skill.score,
      scope: skill.scope
    };
    lines.push(`<skill-metadata>${JSON.stringify(metadata)}</skill-metadata>`);
    lines.push('');

    lines.push(skill.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('</mnemosyne>');
  return lines.join('\n');
}

// Main
async function main() {
  try {
    const input = await readStdin();
    if (!input.trim()) {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      return;
    }

    let data = {};
    try { data = JSON.parse(input); } catch { /* ignore parse errors */ }

    const prompt = data.prompt || '';
    const sessionId = data.session_id || data.sessionId || 'unknown';
    const directory = data.cwd || process.cwd();

    // Skip if no prompt
    if (!prompt) {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      return;
    }

    const matchingSkills = findMatchingSkills(prompt, directory, sessionId);

    // Record skill activations to flow trace (best-effort)
    if (matchingSkills.length > 0) {
      try {
        const { recordSkillActivated } = await import('../dist/hooks/subagent-tracker/flow-tracer.js');
        for (const skill of matchingSkills) {
          recordSkillActivated(directory, sessionId, skill.name, skill.scope || 'learned');
        }
      } catch { /* silent - trace is best-effort */ }
    }

    if (matchingSkills.length > 0) {
      console.log(JSON.stringify({
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: formatSkillsMessage(matchingSkills)
        }
      }));
    } else {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    }
  } catch (error) {
    // On any error, allow continuation
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
