# tasks.json Field Reference

This document describes all available fields in `tasks.json` for defining npm learning tasks.

---

## Core Fields

### `description` (required)
- **Type**: `string`
- **Description**: Brief description of what the user should accomplish in this task
- **Example**: `"Install the lodash package into your project."`
- **Usage**: Displayed to the user as the task prompt

### `expectedCommand` (required)
- **Type**: `string`
- **Description**: The exact npm command the user should enter to complete the task
- **Example**: `"npm install lodash"`
- **Usage**: Used to validate user input and provide hints

### `explanation` (required)
- **Type**: `string`
- **Description**: Detailed explanation of what the command does and why it's useful
- **Example**: `"Installs the lodash package and adds it to your dependencies in package.json."`
- **Usage**: Displayed when user types `explain` command

---

## Validation Fields

### `checkCommand`
- **Type**: `string`
- **Description**: Shell command to verify the task was completed successfully (Unix/Linux/Mac)
- **Example**: `"test -f package.json"`
- **Usage**: Runs after the main command to confirm it worked
- **Platform**: Unix-based systems (Mac, Linux)

### `windowsCheckCommand`
- **Type**: `string`
- **Description**: Shell command to verify the task was completed successfully (Windows)
- **Example**: `"if exist package.json (exit 0) else (exit 1)"`
- **Usage**: Alternative to `checkCommand` for Windows systems
- **Platform**: Windows only

### `preCheckCommand`
- **Type**: `string`
- **Description**: Shell command to verify prerequisites before running the main command
- **Example**: `"test -f package-lock.json"`
- **Usage**: Runs before the main command; task is skipped if it fails
- **Note**: Useful for tasks that depend on previous task results

### `outputIncludes`
- **Type**: `string`
- **Description**: String that must appear in the command's stdout/stderr output
- **Example**: `"added"`
- **Usage**: Validates that the command produced expected output
- **Note**: Case-sensitive substring match

---

## Setup and Cleanup Fields

### `beforeCommand`
- **Type**: `string`
- **Description**: Shell command to run before the main command (setup)
- **Example**: `"rm -rf node_modules"`
- **Usage**: Prepares the environment for the task
- **Execution**: Runs before `preCheckCommand` and `expectedCommand`

### `beforeRequiresSudo`
- **Type**: `boolean`
- **Description**: Whether `beforeCommand` needs sudo on Linux
- **Example**: `true`
- **Usage**: Automatically prepends `sudo` to `beforeCommand` on Linux
- **Platform**: Linux only (ignored on Mac/Windows)
- **Default**: `false`

### `afterCommand`
- **Type**: `string`
- **Description**: Shell command to run after the main command (cleanup)
- **Example**: `"rm my-npm-project-*.tgz"`
- **Usage**: Cleans up side effects or temporary files
- **Execution**: Runs after `expectedCommand` and `checkCommand`

---

## Permission and Platform Fields

### `requireSudo`
- **Type**: `boolean`
- **Description**: Whether the main command needs sudo on Linux
- **Example**: `true`
- **Usage**: Automatically prepends `sudo` to `expectedCommand` on Linux
- **Platform**: Linux only (ignored on Mac/Windows)
- **Default**: `false`
- **Common Use Cases**: Global npm installs, linking packages

---

## Behavior Control Fields

### `strictCommandMatch`
- **Type**: `boolean`
- **Description**: Requires exact match of the command (no partial matches)
- **Example**: `true`
- **Usage**: For commands with specific flags or arguments
- **Default**: `false` (allows fuzzy matching)

### `nonZeroOkay`
- **Type**: `boolean`
- **Description**: Command is allowed to exit with non-zero status
- **Example**: `true`
- **Usage**: For commands that intentionally fail or return error codes
- **Default**: `false`
- **Common Use Cases**: `npm outdated`, `npm audit`

### `isBrowserCommand`
- **Type**: `boolean`
- **Description**: Command opens a browser instead of producing terminal output
- **Example**: `true`
- **Usage**: Skips output validation for browser commands
- **Default**: `false`
- **Common Use Cases**: `npm docs`, `npm bugs`, `npm repo`

---

## Test Control Fields

### `skipTest`
- **Type**: `boolean`
- **Description**: Skip this task in automated test runs
- **Example**: `true`
- **Usage**: For tasks requiring user interaction or authentication
- **Default**: `false`
- **Common Use Cases**: `npm login`, `npm adduser`, `npm publish`

### `requiresUserInput`
- **Type**: `boolean`
- **Description**: Task requires interactive user input
- **Example**: `true`
- **Usage**: Displays warning in `go` command; handled specially in tests
- **Default**: `false`
- **Note**: Usually paired with `skipTest: true`

### `doesntWork`
- **Type**: `boolean`
- **Description**: Command is known to be broken in current npm version
- **Example**: `true`
- **Usage**: Documents known issues without failing tests
- **Default**: `false`
- **Common Use Cases**: Deprecated or buggy npm commands

---

## Field Combinations and Best Practices

### Minimal Task
```json
{
  "description": "List installed packages.",
  "expectedCommand": "npm ls",
  "explanation": "Displays a tree of all installed packages."
}
```

### Task with Validation
```json
{
  "description": "Install lodash package.",
  "expectedCommand": "npm install lodash",
  "checkCommand": "test -d node_modules/lodash",
  "outputIncludes": "added",
  "explanation": "Installs lodash and adds it to dependencies."
}
```

### Task with Setup and Cleanup
```json
{
  "description": "Reinstall dependencies cleanly.",
  "expectedCommand": "npm ci",
  "beforeCommand": "rm -rf node_modules",
  "preCheckCommand": "test -f package-lock.json",
  "checkCommand": "test -d node_modules",
  "afterCommand": "echo 'Cleanup complete'",
  "explanation": "Clean install from lockfile."
}
```

### Task Requiring Sudo (Linux)
```json
{
  "description": "Link package globally.",
  "expectedCommand": "npm link",
  "requireSudo": true,
  "checkCommand": "npm ls -g | grep -q 'my-package'",
  "explanation": "Creates global symlink to your package."
}
```

### Task with Setup Requiring Sudo (Linux)
```json
{
  "description": "Diagnose npm environment.",
  "expectedCommand": "npm doctor",
  "beforeCommand": "npm install -g npm@11.6.1",
  "beforeRequiresSudo": true,
  "preCheckCommand": "npm -v | grep -q '^11\\.6\\.1$'",
  "explanation": "Runs environment diagnostics."
}
```

### Cross-Platform Task
```json
{
  "description": "Initialize npm project.",
  "expectedCommand": "npm init -y",
  "checkCommand": "test -f package.json",
  "windowsCheckCommand": "if exist package.json (exit 0) else (exit 1)",
  "explanation": "Creates package.json with defaults."
}
```

### Authentication Task (Skipped in Tests)
```json
{
  "description": "Log in to npm.",
  "expectedCommand": "npm login",
  "requiresUserInput": true,
  "skipTest": true,
  "outputIncludes": "Logged in",
  "explanation": "Authenticates your npm account."
}
```

### Browser Command
```json
{
  "description": "View axios repository.",
  "expectedCommand": "npm repo axios",
  "strictCommandMatch": true,
  "isBrowserCommand": true,
  "explanation": "Opens the source code repository."
}
```

---

## Execution Order

When a task is executed, the following order is followed:

1. **beforeCommand** (with sudo if `beforeRequiresSudo: true` on Linux)
2. **preCheckCommand** (validation - task skipped if fails)
3. **expectedCommand** (with sudo if `requireSudo: true` on Linux)
4. **outputIncludes** (validation - checks command output)
5. **checkCommand** or **windowsCheckCommand** (validation)
6. **afterCommand** (cleanup - always runs)

---

## Platform-Specific Behavior

### Linux
- Uses `checkCommand` for validation
- Prepends `sudo` when `requireSudo: true`
- Prepends `sudo` to beforeCommand when `beforeRequiresSudo: true`
- Some tasks may be skipped (e.g., sqlite3 due to SSL issues)

### macOS
- Uses `checkCommand` for validation
- No `sudo` prepending (user typically has permissions)
- All tasks should work natively

### Windows
- Uses `windowsCheckCommand` for validation (falls back to `checkCommand`)
- No `sudo` support
- May require admin privileges for global installs
- Path separators differ (backslash vs forward slash)

---

## Common Patterns

### Global Install Pattern
```json
{
  "description": "Install package globally.",
  "expectedCommand": "npm install -g <package>",
  "requireSudo": true,
  "checkCommand": "command -v <package>",
  "explanation": "Installs package globally for CLI usage."
}
```

### Registry Switch Pattern
```json
{
  "description": "Switch to local registry.",
  "expectedCommand": "npm set registry http://localhost:4873",
  "checkCommand": "npm config get registry | grep -q 'localhost:4873'",
  "explanation": "Points npm to local Verdaccio registry."
}
```

### Cleanup Pattern
```json
{
  "description": "Create temporary file.",
  "expectedCommand": "npm pack",
  "checkCommand": "ls *.tgz | grep -q '.tgz'",
  "afterCommand": "rm *.tgz",
  "explanation": "Creates tarball and cleans up after."
}
```

---

## Validation Tips

### Writing Good Check Commands

✅ **Good**: Specific and reliable
```json
"checkCommand": "npm list lodash | grep -q 'lodash@4.17.21'"
```

❌ **Bad**: Too generic or fragile
```json
"checkCommand": "ls node_modules"
```

### Using outputIncludes

✅ **Good**: Unique substring
```json
"outputIncludes": "added 1 package"
```

❌ **Bad**: Common word that might appear elsewhere
```json
"outputIncludes": "npm"
```

---

## Debugging Tasks

If a task isn't working as expected, check:

1. ✅ Is `requireSudo` or `beforeRequiresSudo` set correctly for Linux?
2. ✅ Does `checkCommand` work independently?
3. ✅ Is `windowsCheckCommand` provided for cross-platform tasks?
4. ✅ Does `outputIncludes` match actual command output?
5. ✅ Are `beforeCommand`/`afterCommand` idempotent (safe to run multiple times)?
6. ✅ Should the task be marked `skipTest: true`?

---

## Adding New Tasks

When adding a new task to `tasks.json`:

1. Start with minimal fields (`description`, `expectedCommand`, `explanation`)
2. Add `checkCommand` to verify completion
3. Add `windowsCheckCommand` if task should work on Windows
4. Add `beforeCommand` if setup is needed
5. Set `requireSudo` or `beforeRequiresSudo` if it needs elevated permissions on Linux
6. Set `skipTest` if it requires authentication or user input
7. Test on all platforms if possible

---

## Version History

- **v1.0**: Initial field definitions
- **v1.1**: Added `requireSudo` for Linux global installs
- **v1.2**: Added `beforeRequiresSudo` for setup commands requiring sudo
- **v1.3**: Added `windowsCheckCommand` for cross-platform support
