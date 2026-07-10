# CycleBubble 后端启动脚本 (PowerShell)

# ===== 配置端口（想换端口改这里）=====
$PORT = 8000

Write-Host "==================================="
Write-Host " CycleBubble 后端启动 (端口 $PORT)"
Write-Host "==================================="
Write-Host ""

# =============================================
#  Step 1: 检查 Python
# =============================================
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "[错误] 未找到 Python，请先安装 Python 3.10+" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}
Write-Host "[OK] Python 已找到" -ForegroundColor Green

# =============================================
#  Step 2: 检查依赖（全局 Python）
# =============================================
$fastapiCheck = python -c "import fastapi" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[1/3] 依赖已安装" -ForegroundColor Green
    Write-Host "[2/3] 跳过 pip install" -ForegroundColor Green
} else {
    Write-Host "[1/3] 安装依赖（首次运行需联网）..." -ForegroundColor Cyan
    python -m pip install --index-url http://pypi.org/simple --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "[错误] 依赖安装失败" -ForegroundColor Red
        Write-Host "提示: 网络受限？尝试运行 python -m pip install -r requirements.txt 手动安装" -ForegroundColor Yellow
        Read-Host "按 Enter 退出"
        exit 1
    }
    Write-Host "[2/3] 依赖安装完成" -ForegroundColor Green
}
Write-Host "[3/3] 准备启动" -ForegroundColor Green
Write-Host ""

# =============================================
#  Step 3: 检查端口冲突
# =============================================
$portInUse = Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "[警告] 端口 $PORT 已被占用 (PID: $($portInUse.OwningProcess))" -ForegroundColor Yellow
    Write-Host "这可能是上一次启动过的程序残留。"
    Write-Host ""
    Write-Host "请选择:"
    Write-Host "  [1] 自动关闭占用进程后继续"
    Write-Host "  [2] 修改 dev.ps1 第 5 行 `$PORT=XXXX 换端口"
    Write-Host ""
    $choice = Read-Host "请输入 (1 或 2)"
    if ($choice -eq "1") {
        Write-Host "关闭 PID $($portInUse.OwningProcess) ..." -ForegroundColor Yellow
        Stop-Process -Id $portInUse.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    } else {
        Write-Host "已取消。请修改 dev.ps1 第 5 行设置 PORT。" -ForegroundColor Yellow
        Read-Host "按 Enter 退出"
        exit 1
    }
}

# =============================================
#  Step 4: 启动后端（全局 Python）
# =============================================
Write-Host "==================================="
Write-Host " 后端启动中" -ForegroundColor Green
Write-Host " API:   http://localhost:$PORT/docs"
Write-Host " 前端:  浏览器打开 index.html"
Write-Host "        或运行 python -m http.server 8806"
Write-Host " 停止:  按 Ctrl+C"
Write-Host "==================================="
Write-Host ""

# 本地 dev 默认注入仅供本地的 JWT 密钥，避免双击启动因缺密钥失败
# 如需用真实密钥，覆盖 $env:CB_JWT_SECRET 即可
if (-not $env:CB_JWT_SECRET) {
    $env:CB_JWT_SECRET = "dev-only-local-secret-do-not-use-in-prod-2026"
}

python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port $PORT

Read-Host "按 Enter 退出"
