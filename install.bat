@echo off
setlocal
where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js 22.18+ and npm are required. Install Node LTS and try again.
  exit /b 1
)
node "%~dp0scripts\install.mjs" %*
exit /b %errorlevel%
