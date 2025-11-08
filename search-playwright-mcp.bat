@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"

echo Hledam MCP Playwright balicky...
echo.

npm search playwright mcp

pause
