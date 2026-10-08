@echo off
where node >nul 2>nul
if errorlevel 1 (
  echo iThread CLI requires Node.js 18 or newer.
  exit /b 1
)
node "%~dp0ithread-cli.mjs" %*
