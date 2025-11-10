# Linux Testing Guide

This guide explains how to test your npm-practice changes on Linux using Docker.

---

## Prerequisites

Make sure the Linux Docker image is built with your latest changes:

```bash
docker build -f Dockerfile.linux -t npm-practice-linux .
```

**Note**: You need to rebuild the image every time you make code changes!

---

## Option 1: Quick Automated Testing (Recommended)

### Run All Tests

```bash
npm run test-linux
```

This builds the image and runs all automated tests. Full output is displayed.

### Run All Tests (Quick Summary)

```bash
npm run test-linux-quick
```

Shows only the last 25 lines (test summary).

### What Gets Tested

- ✅ **89 tasks** run automatically
- ⏭️ **18 tasks** skipped (require authentication or user input)
- ⏱️ **~60-75 seconds** execution time

---

## Option 2: Interactive Testing (Manual Control)

### Step 1: Start Interactive Container

```bash
docker run -it --rm npm-practice-linux
```

Or use the helper script:

```bash
./test-linux-interactive.sh
```

You'll get a bash shell inside the Linux container.

---

### Step 2: Run Tests

#### A) Run All Tests (Automated Mode)

```bash
cd /home/tester/npm-practice-source
node test-cli.js
```

**Output**: Runs all 107 tasks, skips 18 that need authentication.

---

#### B) Run Specific Test Range

**Example: Run tasks 10 to 20**

```bash
cd /home/tester/npm-practice-source
node test-cli.js 10 20
```

**Syntax**: `node test-cli.js [start] [end]`

**More Examples**:
```bash
# Run just task 5
node test-cli.js 5 5

# Run first 10 tasks
node test-cli.js 1 10

# Run tasks 50-60
node test-cli.js 50 60

# Run last 10 tasks
node test-cli.js 98 107
```

---

#### C) Run Tests in Interactive Mode

If you want to be prompted for authentication tasks:

```bash
cd /home/tester/npm-practice-source
node test-cli.js --interactive
```

Or with a range:

```bash
node test-cli.js 46 58 --interactive
```

**Note**: You'll need to provide npm login credentials for authentication tasks.

---

### Step 3: Test the App Manually

To use the interactive CLI app and practice npm commands yourself:

#### 1. Navigate to source directory

```bash
cd /home/tester/npm-practice-source
```

#### 2. Link the app globally (requires sudo on Linux)

```bash
sudo npm link
```

**Output**: Makes `npm-practice` command available globally.

#### 3. Go to test workspace

```bash
cd /home/tester/test-workspace
```

#### 4. Start the interactive app

```bash
npm-practice
```

**Now you can**:
- Practice npm commands task by task
- Get hints with `hint`
- Skip tasks with `skip`
- See correct answers with `show`
- Fast-forward with `ff` or `fast-forward`

#### 5. Exit the app

```bash
# Inside npm-practice
quit
# or
exit

# Then exit the container
exit
```

---

## Common Workflows

### Workflow 1: Test Code Changes

```bash
# 1. Make changes to your code
vim tasks.json

# 2. Rebuild Docker image with changes
docker build -f Dockerfile.linux -t npm-practice-linux .

# 3. Run quick test
npm run test-linux-quick

# 4. If tests pass, commit
git add .
git commit -m "Updated tasks"
```

---

### Workflow 2: Debug a Specific Task

```bash
# 1. Rebuild image with latest code
docker build -f Dockerfile.linux -t npm-practice-linux .

# 2. Start interactive container
docker run -it --rm npm-practice-linux

# 3. Inside container: Test specific task range
cd /home/tester/npm-practice-source
node test-cli.js 42 42  # Test just task 42

# 4. Or test manually
sudo npm link
cd /home/tester/test-workspace
npm-practice
# Navigate to task 42 and test it
```

---

### Workflow 3: Test Authentication Tasks

```bash
# 1. Start interactive container
docker run -it --rm npm-practice-linux

# 2. Inside container: Run specific auth tasks interactively
cd /home/tester/npm-practice-source
node test-cli.js 46 58 --interactive

# You'll be prompted to login when needed
```

---

## Quick Reference

### NPM Scripts (Run on Mac)

| Command | Description |
|---------|-------------|
| `npm run test-linux` | Full Linux test with complete output |
| `npm run test-linux-quick` | Shows last 25 lines (summary only) |

### Docker Commands

| Command | Description |
|---------|-------------|
| `docker build -f Dockerfile.linux -t npm-practice-linux .` | Rebuild image with latest code |
| `docker run -it --rm npm-practice-linux` | Start interactive container |
| `./test-linux-interactive.sh` | Start interactive container (helper script) |

### Test Commands (Inside Container)

| Command | Description |
|---------|-------------|
| `node test-cli.js` | Run all tests (automated mode) |
| `node test-cli.js 10 20` | Run tasks 10-20 |
| `node test-cli.js --interactive` | Run all tests with prompts |
| `node test-cli.js 10 20 --interactive` | Run tasks 10-20 with prompts |

### Manual Testing (Inside Container)

```bash
# Setup
cd /home/tester/npm-practice-source
sudo npm link

# Use
cd /home/tester/test-workspace
npm-practice

# Commands inside npm-practice
hint          # Get a hint
show          # Show correct answer
skip          # Skip current task
ff            # Fast-forward to specific task
quit/exit     # Exit app
```

---

## Differences: Linux vs Mac

| Feature | Mac | Linux (Docker) |
|---------|-----|----------------|
| Global installs | No sudo needed | Requires `sudo` |
| sqlite3 tasks | ✅ Works | ⏭️ Skipped (SSL issues) |
| Test speed | ~162 seconds | ~62 seconds |
| Tasks passed | 89 | 85 |
| Tasks skipped | 18 | 22 |

---

## Troubleshooting

### "Image not found" error

**Problem**: Docker image doesn't exist or is outdated.

**Solution**: Rebuild the image
```bash
docker build -f Dockerfile.linux -t npm-practice-linux .
```

### Changes not reflected in tests

**Problem**: You made code changes but tests still use old code.

**Solution**: Always rebuild after code changes
```bash
docker build -f Dockerfile.linux -t npm-practice-linux .
npm run test-linux-quick
```

### "Permission denied" errors

**Problem**: Global npm operations need elevated permissions.

**Solution**: Use `sudo` inside container
```bash
sudo npm link
sudo npm install -g verdaccio
```

The test runner automatically adds `sudo` for tasks marked with `requireSudo: true`.

### Container exits immediately

**Problem**: Using `docker run` without `-it` flags.

**Solution**: Always use `-it` for interactive mode
```bash
docker run -it --rm npm-practice-linux
```

### Can't find npm-practice command

**Problem**: App not linked globally.

**Solution**: Run `sudo npm link` first
```bash
cd /home/tester/npm-practice-source
sudo npm link
cd /home/tester/test-workspace
npm-practice
```

---

## Tips

### 💡 Faster Testing

If you're iterating on a specific task:

```bash
# Test just that task instead of all 107
node test-cli.js 42 42
```

### 💡 Keep Container Running

Want to run multiple test commands without restarting?

```bash
# Start container once
docker run -it --rm npm-practice-linux

# Inside container, run multiple commands
node test-cli.js 1 10
node test-cli.js 20 30
node test-cli.js 50 60
exit  # When done
```

### 💡 Check Test File Changes

Before rebuilding, check what changed:

```bash
git diff tasks.json
git diff test-cli.js
```

### 💡 Test Both Platforms

```bash
# Test on Mac (native)
npm test

# Test on Linux (Docker)
npm run test-linux-quick

# Compare results
```

---

## Next Steps

- ✅ **Test locally** on both Mac and Linux
- ✅ **Push to GitHub** to test on Windows via Actions
- ✅ **Check Actions tab** for cross-platform results
- ✅ **Add status badges** to your README (see `.github/BADGES.md`)
