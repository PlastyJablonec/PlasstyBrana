@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"

echo Instaluji MCP Playwright server...
echo.

echo 1. Instaluji MCP Playwright server...
npm install @modelcontextprotocol/server-playwright

echo.
echo 2. Vytvarim MCP konfiguraci...
echo.

echo 3. Testuji instalaci...
npx @modelcontextprotocol/server-playwright --version

echo.
echo Instalace MCP Playwright dokoncena!
pause
