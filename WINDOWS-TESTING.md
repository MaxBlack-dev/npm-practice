# Windows Testing Setup

## Requirements

⚠️ **Important**: Windows Docker containers can **only** be built and run on:
- Windows 10/11 Pro, Enterprise, or Education (with Hyper-V support)
- Windows Server 2019 or later
- Docker Desktop for Windows configured to use **Windows containers** (not Linux containers)

## Why Can't I Test on Mac/Linux?

Docker uses the host OS kernel. Windows containers require the Windows kernel, which is only available on Windows hosts. This is different from Linux containers, which can run on Mac/Linux using virtualization.

## Testing on Windows

If you have access to a Windows machine, follow these steps:

### 1. Switch Docker to Windows Containers

In Docker Desktop:
- Right-click the Docker icon in system tray
- Select "Switch to Windows containers..."

### 2. Build the Windows Image

```cmd
docker build -f Dockerfile.windows -t npm-practice-windows .
```

**Note**: First build may take 10-30 minutes as it downloads Windows Server Core base image (~4-5GB)

### 3. Run Automated Tests

```cmd
test-windows-auto.cmd
```

Or manually:

```cmd
docker run --rm npm-practice-windows powershell -Command "cd C:\npm-practice-source; node test-cli.js"
```

### 4. Interactive Testing

```cmd
docker run -it --rm npm-practice-windows
```

Then inside the container:
```powershell
cd C:\npm-practice-source
node index.js
```

## Expected Test Results

Based on Mac and Linux testing, we expect:
- **~80-90 tasks** to pass
- **~18-22 tasks** to skip (authentication required)
- **~0-5 tasks** to potentially fail (platform-specific issues)

### Known Differences on Windows

1. **No sudo needed** - Windows doesn't use sudo, but may require admin privileges for global installs
2. **Path separators** - Windows uses backslashes (`\`) instead of forward slashes (`/`)
3. **Shell commands** - Some Unix commands may not work (e.g., `rm`, `ls`, `grep`)
4. **windowsCheckCommand** - tasks.json includes Windows-specific validation commands

## CI/CD for Windows

For automated Windows testing, you can use:
- **GitHub Actions**: `windows-latest` runner with Docker Desktop
- **Azure Pipelines**: Native Windows containers support
- **AppVeyor**: Windows CI/CD platform

Example GitHub Actions workflow:

```yaml
name: Test on Windows

on: [push, pull_request]

jobs:
  test-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Switch to Windows containers
        run: |
          & "C:\Program Files\Docker\Docker\DockerCli.exe" -SwitchWindowsEngine
      
      - name: Build and test
        run: |
          docker build -f Dockerfile.windows -t npm-practice-windows .
          docker run --rm npm-practice-windows powershell -Command "cd C:\npm-practice-source; node test-cli.js"
```

## Alternative: Testing on Windows Without Docker

If Docker Windows containers aren't available, you can test directly on Windows:

1. Install Node.js from https://nodejs.org
2. Clone the repository
3. Run `node test-cli.js` directly

This tests the npm commands natively without containerization.

## Troubleshooting

### Error: "image operating system 'windows' cannot be used on this platform"

**Solution**: You're trying to run Windows containers on Mac/Linux. See "Requirements" section above.

### Build takes forever

**Solution**: First Windows container build downloads large base image. Subsequent builds are much faster.

### PowerShell execution policy errors

**Solution**: Run in elevated PowerShell:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
