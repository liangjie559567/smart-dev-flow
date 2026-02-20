---
name: note
description: Save notes to notepad.md for compaction resilience
---

# Note Skill

Save important context to `.omc/notepad.md` that survives conversation compaction.

## Usage

| Command | Action |
|---------|--------|
| `/smart-dev-flow:note <content>` | Add to Working Memory with timestamp |
| `/smart-dev-flow:note --priority <content>` | Add to Priority Context (always loaded) |
| `/smart-dev-flow:note --manual <content>` | Add to MANUAL section (never pruned) |
| `/smart-dev-flow:note --show` | Display current notepad contents |
| `/smart-dev-flow:note --prune` | Remove entries older than 7 days |
| `/smart-dev-flow:note --clear` | Clear Working Memory (keep Priority + MANUAL) |

## Sections

### Priority Context (500 char limit)
- **Always** injected on session start
- Use for critical facts: "Project uses pnpm", "API in src/api/client.ts"
- Keep it SHORT - this eats into your context budget

### Working Memory
- Timestamped session notes
- Auto-pruned after 7 days
- Good for: debugging breadcrumbs, temporary findings

### MANUAL
- Never auto-pruned
- User-controlled permanent notes
- Good for: team contacts, deployment info

## Examples

```
/smart-dev-flow:note Found auth bug in UserContext - missing useEffect dependency
/smart-dev-flow:note --priority Project uses TypeScript strict mode, all files in src/
/smart-dev-flow:note --manual Contact: api-team@company.com for backend questions
/smart-dev-flow:note --show
/smart-dev-flow:note --prune
```

## Behavior

1. Creates `.omc/notepad.md` if it doesn't exist
2. Parses the argument to determine section
3. Appends content with timestamp (for Working Memory)
4. Warns if Priority Context exceeds 500 chars
5. Confirms what was saved

## Integration

Notepad content is automatically loaded on session start:
- Priority Context: ALWAYS loaded
- Working Memory: Loaded if recent entries exist

This helps survive conversation compaction without losing critical context.
