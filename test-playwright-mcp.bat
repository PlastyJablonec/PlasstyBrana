@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"

echo Testuji MCP Playwright server...
echo.

npx @playwright/mcp --help

echo.
echo MCP Playwright server je pripraven!
pause
