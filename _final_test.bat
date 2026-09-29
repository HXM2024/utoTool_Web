@echo off
chcp 65001 >nul
title 清除临时文件

echo ============================================
echo            临时文件清理工具
echo ============================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 当前非管理员权限，系统 Temp 可能无法完全清理。
    echo        建议右键 - 以管理员身份运行。
    echo.
)

for %%D in ("%TEMP%" "%SystemRoot%\Temp") do (
    if exist "%%~D" (
        echo [清理] %%~D
        del /f /q /s "%%~D\*.*" >nul 2>&1
        for /d %%E in ("%%~D\*") do rd /s /q "%%~E" >nul 2>&1
    )
)

echo.
echo 清理完成！
