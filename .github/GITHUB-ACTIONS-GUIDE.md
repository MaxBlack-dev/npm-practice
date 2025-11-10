# GitHub Actions Guide

This project uses GitHub Actions for automated cross-platform testing.

## Workflows

### 1. **Quick Test** (`.github/workflows/quick-test.yml`)
- **Trigger**: Every push to main/master branch (only when .js or .json files change)
- **Runs on**: macOS only
- **Duration**: ~2-3 minutes
- **Purpose**: Fast feedback on code changes

### 2. **Test All Platforms** (`.github/workflows/test-all-platforms.yml`)
- **Trigger**: Push to main/master, pull requests, or manual trigger
- **Runs on**: macOS, Linux (Docker), Windows (Docker)
- **Duration**: ~10-15 minutes
- **Purpose**: Comprehensive cross-platform validation

## How to Use

### After Pushing to GitHub

1. Go to your repository on GitHub
2. Click the "Actions" tab
3. You'll see your workflows running
4. Click on a workflow to see detailed logs

### Manual Trigger

You can manually run the "Test All Platforms" workflow:

1. Go to Actions tab
2. Click "Test All Platforms" in the left sidebar
3. Click "Run workflow" button
4. Select branch and click "Run workflow"

## Test Results

### Viewing Results

Each workflow run shows:
- ✅ Green checkmark: All tests passed
- ❌ Red X: Some tests failed
- 🟡 Yellow dot: Tests running

### Detailed Logs

Click on a job (e.g., "Test on macOS") to see:
- Full test output
- Which tasks passed/failed
- Execution time
- Any error messages

### Test Summary

The "Test Summary" job creates a nice table showing results for all platforms:

| Platform | Status |
|----------|--------|
| macOS    | ✅ Passed |
| Linux    | ✅ Passed |
| Windows  | ✅ Passed |

## Local Testing Before Push

### Test on Mac (Native)
```bash
npm test
```

### Test on Linux (Docker)
```bash
npm run test-linux
# or for quick summary
npm run test-linux-quick
```

### Test on Windows (Requires Windows machine)
```cmd
test-windows-auto.cmd
```

## Understanding Test Modes

### Automated Mode (Default)
- Skips tasks requiring authentication
- Skips tasks requiring user input
- Runs ~85-89 tasks out of 107

### Interactive Mode
- Prompts for user input
- Requires authentication
- Runs all 107 tasks (if you provide credentials)

**GitHub Actions uses automated mode by default** since CI environments can't handle interactive prompts.

## Expected Results

Based on local testing:

| Platform | Passed | Failed | Skipped | Time |
|----------|--------|--------|---------|------|
| macOS    | 89     | 0      | 18      | ~162s |
| Linux    | 85     | 0      | 22      | ~62s |
| Windows  | ~80-90 | 0      | ~17-27  | ~TBD |

**Note**: Windows results are estimated until first run completes.

## Troubleshooting

### Workflow Not Running
- Check if you pushed to `main` or `master` branch
- Verify file paths match your setup
- Check Actions tab for any disabled workflows

### Windows Docker Fails
Windows containers can be finicky in GitHub Actions. If it fails:
1. Check the Docker switch command worked
2. Verify Windows container compatibility
3. Consider testing Windows natively without Docker

### Tests Fail in CI but Pass Locally
Common causes:
- Network/firewall restrictions in CI
- Missing environment variables
- Platform-specific paths
- Timing issues (CI can be slower)

## Free Usage Limits

- **Public repositories**: Unlimited minutes (free forever)
- **Private repositories**: 2,000 minutes/month free
- **Windows runners**: Count as 2x minutes
- **macOS runners**: Count as 10x minutes
- **Linux runners**: Count as 1x minutes

For this project (assuming 15 min per full test run):
- Linux: 15 minutes
- Windows: 30 minutes (15 × 2)
- macOS: 150 minutes (15 × 10)
- **Total per run**: ~195 minutes

With 2,000 free minutes/month, you can run ~10 full platform tests/month on a private repo.

## Next Steps

1. **Push to GitHub**: Workflows will run automatically
2. **Check Actions tab**: Monitor first run
3. **Add badges**: Use BADGES.md for status badges
4. **Iterate**: Fix any platform-specific issues

## Questions?

- GitHub Actions docs: https://docs.github.com/en/actions
- Workflow syntax: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions
