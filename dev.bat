@echo off
REM ============================================================
REM   CycleBubble 本地一键启停 (thin wrapper)
REM   File encoding: UTF-8 with BOM
REM   Platform: Windows 10/11
REM   Pattern reference:  RunKeepOnline.bat — batch delegates
REM                       heavy lifting to a PowerShell helper.
REM ============================================================

REM 1) Force UTF-8 code page FIRST so cmd can echo CJK correctly.
chcp 65001 >nul

REM 2) Title (use a CJK-safe string)
title CycleBubble 本地开发

REM 3) Ensure partner PS1 file uses CJK-safe title in its console
REM (optional — only matters when invoked from explorer)

REM Forward EVERYTHING to dev.ps1.  PS1 is UTF-8 with BOM; powershell
REM reads it as UTF-8 already, so CJK in args/echo flow naturally.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
pause
