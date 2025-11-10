# NPM Practice CLI - AI Coding Instructions

## Project Overview
Interactive CLI tutor for learning npm commands, companion to "NPM Book by Max Black". Users practice real npm workflows with automatic validation in an isolated `my-npm-project/` workspace. Published as `@max-black/npm-practice` with `npm-practice` bin command.

## Architecture

### Core Components
- **index.js**: Main CLI with readline interface, task runner, command validation, and AI integration
- **tasks.json**: Task definitions (see TASKS-JSON-REFERENCE.md for schema) - ordered curriculum of ~60 npm commands
- **test-cli.js**: Automated test runner that validates all tasks programmatically (runs in isolated `test-environment/`)
- **ai-helper.js**: Google Gemini integration for contextual npm help (free tier, 15 req/min)

### Task Engine Logic
Each task has `expectedCommand` + optional validation (`checkCommand`, `preCheckCommand`, `beforeCommand`, `afterCommand`). Users type commands; CLI validates with `execSync()` checks. Progress saved to `progress.json`. Tasks run in `my-npm-project/` subfolder (created on startup).

### Special Command System
Users can type beyond npm commands:
- `show` - reveal answer (tracks usage in showCount)
- `skip` - auto-execute and advance
- `explain` - show task.explanation
- `ai <question>` - ask Gemini AI (if configured via `setup-ai.js`)
- `reset` - wipe workspace + progress + Verdaccio state
- `go N [--skip]` - fast-forward to task N (with/without execution)
- Any shell command (ls, cat, etc.) - for environment inspection

## Critical Patterns

### Platform-Specific Handling
Linux commands requiring sudo use `requireSudo: true` flag (see tasks 19, 33-35, 40). Test runner and main CLI auto-prepend `sudo` on Linux via `maybeAddSudo()`. Windows uses `windowsCheckCommand` alternative validation.

### Test Automation
`test-cli.js` runs non-interactively (skips `skipTest: true` tasks like npm login). Uses `spawnSync` with dynamic timeouts (60s for installs, 30s for cache ops). Validates via `checkCommand` shell execution + optional `outputIncludes` string matching. Run specific range: `node test-cli.js 1 10`.

### Task Schema Extensions
- `nonZeroOkay: true` - exit code >0 is expected (deprecation warnings, etc.)
- `requiresUserInput: true` - needs stdin (interactive prompts)
- `doesntWork: true` - broken task, auto-skipped
- `outputIncludes: "string"` - must appear in stdout/stderr
- `beforeRequiresSudo: true` - beforeCommand needs sudo on Linux

### Verdaccio Integration
Tasks 50-59 run local npm registry (Verdaccio) for publish/unpublish practice. `reset` command must kill process (`lsof -ti :4873`) + clean `~/.config/verdaccio` + restore registry to `https://registry.npmjs.org/`.

## Development Workflows

### Testing
```bash
npm test                    # Run all tasks automated
npm run test-first-100      # Tasks 1-100 only
npm run test-linux          # Docker Linux validation
node test-cli.js -- 45 50   # Test tasks 45-50
node test-cli.js --interactive  # Include interactive tasks
```

### Docker Testing
Dockerfiles (linux/windows) test cross-platform. Creates `tester` user with passwordless sudo. Copies source to `/home/tester/npm-practice-source`, runs `npm link`, executes test suite. Use `npm run build-dokcer` + `npm run run-dokcer`.

### AI Setup Flow
`setup-ai.js` opens browser to `aistudio.google.com/app/apikey`, saves key to `~/.npm-practice/gemini-api-key` (chmod 600). `ai-helper.js` injects current task context into Gemini prompts for contextual answers.

## Common Pitfalls

1. **Task Dependencies**: Many tasks depend on previous state (e.g., Task 8 `npm ci` needs package-lock.json from earlier). Use `preCheckCommand` to validate prerequisites.

2. **Progress Persistence**: `progress.json` tracks currentTaskIndex + showCount. Users can resume mid-session. Always call `saveProgress()` after state changes.

3. **Registry State**: Verdaccio tasks (50+) change npm registry. Must reset to official registry before Task 46 (npm login) and in `reset` command.

4. **Command Execution Context**: User runs in `my-npm-project/`, but `cd` commands must update `process.cwd()` manually (special handling in handleInput). Shell commands run via `execSync({ cwd: process.cwd(), shell: true })`.

5. **Timeout Tuning**: Install operations need 60s timeout, cache ops 30s, Verdaccio startup 30s. Inadequate timeouts cause false negatives in tests.

## Key Files for Understanding
- **TASKS-JSON-REFERENCE.md**: Complete task schema documentation
- **tasks.json**: Live curriculum examples for all patterns
- **AI-ASSISTANT.md**: User-facing AI feature docs
- **index.js:128-400**: Command parser + validation logic
- **test-cli.js:150-250**: Test execution + validation patterns
