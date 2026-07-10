@echo off
REM ==========================================================
REM  CycleBubble 后端启动脚本（双击运行）
REM
REM  使用方法：双击 dev.bat
REM  - 脚本会自动切到所在目录运行（无需硬编码路径）
REM  - 端口冲突会提示选择（关闭进程 / 换端口）
REM  - 错误时会暂停等待查看，不会闪退
REM ==========================================================

chcp 65001 >nul
cd /d "%~dp0"

REM ===== 可配置：端口 =====
set "PORT=8000"

echo ===================================
echo  CycleBubble 后端启动 (端口 %PORT%)
echo ===================================
echo.

REM ==========================================================
REM  Step 1: 检查 Python
REM ==========================================================
where python >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.10+
    echo        下载地址: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)
echo [OK] Python 已找到

REM ==========================================================
REM  Step 2: 检查依赖（fastapi 是否已装）
REM ==========================================================
python -c "import fastapi" >nul 2>&1
if errorlevel 1 (
    echo [1/2] 安装依赖（首次运行需联网）...
    python -m pip install --index-url http://pypi.org/simple --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装失败
        echo 提示: 网络受限？尝试手动运行:
        echo        python -m pip install -r requirements.txt
        echo.
        pause
        exit /b 1
    )
    echo [2/2] 依赖安装完成
) else (
    echo [1/2] 依赖已安装
    echo [2/2] 跳过 pip install
)
echo.

REM ==========================================================
REM  Step 3: 检查端口冲突
REM ==========================================================
netstat -ano | findstr ":%PORT% " >nul 2>&1
if not errorlevel 1 (
    echo [警告] 端口 %PORT% 已被占用
    echo 这可能是上一次启动过的程序残留。
    echo.
    echo 请选择:
    echo   [1] 自动关闭占用进程后继续
    echo   [2] 退出并修改本脚本第 13 行 PORT=XXXX 换端口
    echo.
    set /p "CHOICE=请输入 (1 或 2): "
    if "!CHOICE!"=="1" (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% "') do (
            echo 关闭 PID %%a ...
            taskkill /F /PID %%a 2>nul
        )
        timeout /t 2 >nul
    ) else (
        echo 已取消。请编辑 dev.bat 第 13 行修改 PORT。
        echo.
        pause
        exit /b 1
    )
)

REM ==========================================================
REM  Step 4: 启动后端
REM ==========================================================
echo ===================================
echo  后端启动中
echo  API:   http://localhost:%PORT%/docs
echo  前端:  浏览器打开 index.html
echo         或运行 python -m http.server 8806
echo  停止:  按 Ctrl+C
echo ===================================
echo.

REM ==========================================================
REM  Step 4: 启动后端
REM  - 本地 dev 默认注入一个仅供本地的 CB_JWT_SECRET
REM  - 如需用真实密钥，覆盖 CB_JWT_SECRET 环境变量即可
REM ==========================================================
if not defined CB_JWT_SECRET (
    set "CB_JWT_SECRET=dev-only-local-secret-do-not-use-in-prod-2026"
)

python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port %PORT%

echo.
echo 后端已停止
pause
