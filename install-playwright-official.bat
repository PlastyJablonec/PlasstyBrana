@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"

echo Instaluji oficialni MCP Playwright server...
echo.

echo 1. Instaluji @playwright/mcp...
npm install @playwright/mcp

echo.
echo 2. Instaluji Playwright browsery...
npx playwright install

echo.
echo 3. Testuji instalaci...
npx @playwright/mcp --help

echo.
echo Instalace MCP Playwright dokoncena!
pause
