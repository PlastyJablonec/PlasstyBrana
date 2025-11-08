@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"

echo Spoustim MCP Playwright pro testovani aplikace...
echo.

npx @playwright/mcp --browser chrome --port 3000

pause
