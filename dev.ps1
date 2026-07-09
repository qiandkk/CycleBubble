# ============================================================================
#   CycleBubble 本地一键启停 — PowerShell 核心
#   File encoding: UTF-8 with BOM (so PowerShell reads CJK correctly
#                   even when called from a cmd that hasn't done chcp 65001)
#   Platform:  Windows 10/11 + PowerShell 5.1+
#   Companion: dev.bat — thin wrapper that launches this file.
#
#   Known small issue: PID file writes occasionally fail on Windows when
#   python's redirected stdout/stderr is still releasing handles to the same
#   directory.  symptom = status reads 'foreign' immediately after start,
#   but the actual processes are listening and stop() still works (it uses
#   port lookup, not the pid file).  work-around if bothersome: re-run
#   `dev.bat stop` then `dev.bat start` again.
# ============================================================================

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# --- 日志轮转配置 --------------------------------------------------------
# 按大小轮转（不依赖时钟）。日志超过 $LogMaxBytes 时滚动到 .1, .2, ...
# 保留 $LogKeepCount 代（含当前）。
$LogMaxBytes  = 2 * 1024 * 1024   # 2 MB
$LogKeepCount = 3                   # log、log.1、log.2

function Rotate-Log {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    $size = (Get-Item $Path).Length
    if ($size -lt $LogMaxBytes) { return }

    # 滚动链：.keep → 删除；.(keep-1) → .keep；…；.1 → .2
    $topIndex = $LogKeepCount
    if (Test-Path "$Path.$topIndex") { Remove-Item "$Path.$topIndex" -Force }
    for ($i = $topIndex - 1; $i -ge 1; $i--) {
        $from = "$Path.$i"
        $to   = "$Path.$($i + 1)"
        if (Test-Path $from) { Move-Item $from -Destination $to -Force }
    }
    if (Test-Path $Path) {
        Move-Item $Path -Destination "$Path.1" -Force
    }
    Write-Host ("  已轮转日志：{0}（{1} KB → .1）" -f $Path, [int]($size / 1024)) -ForegroundColor DarkGray
}


$ScriptDir         = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot       = $ScriptDir
$BackendDir        = Join-Path $ProjectRoot 'backend'
# 前端静态服务的根目录：frontend/ 子目录。
# 这样 http://127.0.0.1:8766/ 直接进 CycleBubble 前端，不需要 /frontend/ 前缀。
$FrontendDir       = Join-Path $ProjectRoot 'frontend'
$BackendHost       = '127.0.0.1'
$BackendPort       = 8765
$FrontendHost      = '127.0.0.1'
$FrontendPort      = 8766
$LogDir            = Join-Path $ProjectRoot '.runlogs'
$BackendPidFile    = Join-Path $LogDir 'backend.pid'
$FrontendPidFile   = Join-Path $LogDir 'frontend.pid'
$BackendOutFile    = Join-Path $LogDir 'backend.out.log'
$BackendErrFile    = Join-Path $LogDir 'backend.err.log'
$FrontendOutFile   = Join-Path $LogDir 'frontend.out.log'
$FrontendErrFile   = Join-Path $LogDir 'frontend.err.log'
$CbJwtSecret       = 'dev-local-secret-not-for-prod'
$CbCorsOrigins     = "http://localhost:$FrontendPort,http://127.0.0.1:$FrontendPort"
# 与 backend/main.py 的 DEMO_EMAIL/DEMO_PASSWORD 保持一致（dev 启动横幅）
$DemoEmail         = 'demo'
$DemoPassword      = 'demo'

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

# --- 顶部横幅 --------------------------------------------------------------
function Write-Banner {
    Write-Host ''
    Write-Host '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' -ForegroundColor Cyan
    Write-Host '       CycleBubble  本地开发服务' -ForegroundColor Cyan
    Write-Host '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' -ForegroundColor Cyan
    Write-Host ("   后端地址 ：http://{0}:{1}  (uvicorn)"   -f $BackendHost,  $BackendPort)
    Write-Host ("   前端地址 ：http://{0}:{1}             ← 直接进 CycleBubble" -f $FrontendHost, $FrontendPort) -ForegroundColor Green
    Write-Host ("   接口文档 ：http://{0}:{1}/docs"          -f $BackendHost,  $BackendPort)
    Write-Host ("   日志目录 ：{0}"                            -f $LogDir)
    Write-Host '──────────────────────────────────────────────────────' -ForegroundColor Cyan
}

# Return @([int[]] $pids) of anything LISTENING on $port (IPv4 + IPv6).
function Get-PidsOnPort {
    param([int]$Port)
    $listeners = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    $pids = @()
    if ($listeners) {
        $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    }
    return ,$pids
}

function Read-PidFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return @() }
    $pids = @()
    foreach ($line in (Get-Content $Path)) {
        $line = $line.Trim()
        if ($line -match '^\d+$') { $pids += [int]$line }
    }
    return $pids
}

function Write-PidFile {
    param([int]$ProcessId, [string]$Path)
    $dir = Split-Path -Parent $Path
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    # Try Set-Content first; fall back to direct .NET write if PowerShell's
    # stream layer swallows the IO.  Either way, never throw — stop() uses
    # port lookup so a missing pid file is non-fatal (state just reads 'foreign').
    try {
        Set-Content -Path $Path -Value "$ProcessId" -Encoding ascii -Force
        return $true
    } catch {
        try {
            [System.IO.File]::WriteAllText($Path, "$ProcessId`n", [System.Text.Encoding]::ASCII)
            return $true
        } catch {
            return $false
        }
    }
}

function Remove-PidFile {
    param([string]$Path)
    if (Test-Path $Path) { Remove-Item -Path $Path -Force }
}

function Kill-Pid {
    param([int]$Pid)
    $proc = Get-Process -Id $Pid -ErrorAction SilentlyContinue
    if ($proc) {
        try { Stop-Process -Id $Pid -Force -ErrorAction Stop } catch { }
    }
}

# Compute state: 'running' (our PID on port) | 'foreign' (port busy but not by us) | 'stopped'
function Get-ServiceState {
    param([int]$Port, [string]$PidFile, [string]$Label)
    $portPids  = Get-PidsOnPort -Port $Port
    $ownPids   = Read-PidFile -Path $PidFile
    if ($ownPids.Count -eq 0) {
        if ($portPids.Count -gt 0) {
            return @{ State='foreign'; Pids=$portPids }
        } else {
            return @{ State='stopped'; Pids=@() }
        }
    }
    foreach ($op in $ownPids) {
        if ($portPids -contains $op) {
            return @{ State='running'; Pids=$portPids }
        }
    }
    # our recorded PIDs do not match anyone on the port — PID file stale
    Remove-PidFile -Path $PidFile
    if ($portPids.Count -gt 0) {
        return @{ State='foreign'; Pids=$portPids }
    } else {
        return @{ State='stopped'; Pids=@() }
    }
}

function Print-State {
    param([string]$Label, [hashtable]$S)
    $stateText = switch ($S.State) {
        'running' { '运行中' }
        'foreign' { '已被占用' }
        'stopped' { '已停止' }
    }
    $color = switch ($S.State) {
        'running' { 'Green'  }
        'foreign' { 'Yellow' }
        'stopped' { 'Gray'   }
    }
    $pidsStr = ''
    if ($S.State -eq 'running') { $pidsStr = ("进程：{0}" -f ($S.Pids -join ' ')) }
    elseif ($S.State -eq 'foreign') { $pidsStr = ("进程：{0}（非本脚本启动）" -f ($S.Pids -join ' ')) }
    else { $pidsStr = '' }
    $port = if ($Label -eq 'backend') { $BackendPort } else { $FrontendPort }
    $labelText = if ($Label -eq 'backend') { '后端服务' } else { '前端服务' }
    Write-Host ("   {0,-9}  端口 {1,-5}  " -f $labelText, $port) -NoNewline
    Write-Host ("{0,-8}" -f $stateText) -ForegroundColor $color -NoNewline
    if ($pidsStr) { Write-Host ("  {0}" -f $pidsStr) } else { Write-Host '' }
}

function Http-Probe {
    param([string]$Label, [string]$Url)
    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        $code = $resp.StatusCode
        $ok   = ($code -lt 400)
    } catch {
        $resp = $_.Exception.Response
        if ($resp -and $resp.StatusCode) {
            $code = [int]$resp.StatusCode
        } else {
            $code = 'err'
        }
        $ok = $false
    }
    if ($ok) {
        Write-Host ("   {0,-22}" -f $Label) -NoNewline
        Write-Host '可访问' -ForegroundColor Green -NoNewline
        Write-Host ("  HTTP {0}" -f $code)
    } else {
        Write-Host ("   {0,-22}" -f $Label) -NoNewline
        Write-Host '不可访问' -ForegroundColor Gray -NoNewline
        Write-Host ("  HTTP {0}" -f $code)
    }
}

function Show-Status {
    Write-Banner
    $be = Get-ServiceState -Port $BackendPort  -PidFile $BackendPidFile  -Label 'backend'
    Print-State 'backend'  $be
    $fe = Get-ServiceState -Port $FrontendPort -PidFile $FrontendPidFile -Label 'frontend'
    Print-State 'frontend' $fe
    Write-Host '──────────────────────────────────────────────────────' -ForegroundColor Gray
    Write-Host '【接口探测】'                                              -ForegroundColor Cyan
    Http-Probe '后端 健康检查   '  ("http://{0}:{1}/api/health" -f $BackendHost,  $BackendPort)
    Http-Probe '后端 接口文档   '  ("http://{0}:{1}/docs"       -f $BackendHost,  $BackendPort)
    Http-Probe '前端 入口页面   '  ("http://{0}:{1}/"           -f $FrontendHost, $FrontendPort)
    Write-Host '──────────────────────────────────────────────────────' -ForegroundColor Gray
    Write-Host ''
}

function Start-One {
    param(
        [string]$Label,
        [string]$WorkingDir,
        [string[]]$CommandArgs,
        [string]$PidFile,
        [string]$OutFile,
        [string]$ErrFile,
        [hashtable]$ExtraEnv
    )
    $portPids = Get-PidsOnPort -Port ($ExtraEnv.Port)
    if ($portPids.Count -gt 0) {
        $labelText2 = if ($Label -eq 'backend') { '后端服务' } else { '前端服务' }
        Write-Host ("⚠ {0} 端口 {1} 已被占用（PID：{2}）" -f $labelText2, $ExtraEnv.Port, ($portPids -join ' ')) -ForegroundColor Yellow
        Write-Host '   跳过启动。如需重启请先执行 stop 或手动 taskkill。'
        return
    }

    # Rotate before each start so the new run lands on a fresh log file.
    # Rotation is size-based (no clock dependency), so it's safe to call
    # back-to-back from rapid restart loops.
    Rotate-Log -Path $OutFile
    Rotate-Log -Path $ErrFile

    $labelText = if ($Label -eq 'backend') { '后端服务' } else { '前端服务' }
    Write-Host ("▶ 启动 {0}  ...  日志：{1}" -f $labelText, $OutFile) -ForegroundColor Cyan
    try {
        # 先把 ExtraEnv 里的非 Port 变量 set 到当前 PowerShell 进程环境，
        # Start-Process 派生的子进程会继承这些变量。
        # 注意：必须放在 Start-Process 之前才有效。
        foreach ($k in $ExtraEnv.Keys) {
            if ($k -eq 'Port') { continue }
            $v = $ExtraEnv[$k]
            if ($null -ne $v -and "$v" -ne '') {
                try { [Environment]::SetEnvironmentVariable($k, $v, 'Process') } catch { }
            }
        }

        $proc = Start-Process -FilePath 'python.exe' `
                              -ArgumentList $CommandArgs `
                              -WorkingDirectory $WorkingDir `
                              -RedirectStandardOutput $OutFile `
                              -RedirectStandardError  $ErrFile `
                              -WindowStyle Hidden `
                              -PassThru
        Write-Host ("   已派生子进程：PID {0}" -f $proc.Id) -ForegroundColor Gray
    } catch {
        Write-Host ("   ✗ 启动失败：{0}" -f $_.Exception.Message) -ForegroundColor Red
        return
    }

    # 写 PID 文件放最后，避免半启动状态留下脏记录
    $pidWritten = Write-PidFile -ProcessId $proc.Id -Path $PidFile
    if ($pidWritten) {
        Write-Host ("✓ {0} 已就绪  PID {1}" -f $labelText, $proc.Id) -ForegroundColor Green
    } else {
        Write-Host ("⚠ {0} 已就绪  PID {1}（PID 文件未写入，状态会显示「已被占用」，不影响使用）" -f $labelText, $proc.Id) -ForegroundColor Yellow
    }
}

function Stop-One {
    param([string]$Label, [int]$Port, [string]$PidFile)
    $labelText = if ($Label -eq 'backend') { '后端服务' } else { '前端服务' }
    $ownPids = Read-PidFile -Path $PidFile
    $portPids = Get-PidsOnPort -Port $Port
    $targets = @($portPids | Sort-Object -Unique)
    if ($targets.Count -eq 0 -and $ownPids.Count -eq 0) {
        Write-Host ("{0} 端口 {1} 本来就没在运行" -f $labelText, $Port) -ForegroundColor Gray
        return
    }
    foreach ($p in $targets) {
        try { Stop-Process -Id $p -Force -ErrorAction Stop } catch { }
    }
    foreach ($p in $ownPids) {
        if ($targets -notcontains $p) {
            try { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } catch { }
        }
    }
    Remove-PidFile -Path $PidFile
    Write-Host ("✓ {0} 已停止  端口 {1}，结束 {2} 个进程" -f $labelText, $Port, $targets.Count) -ForegroundColor Green
}

# --- Actions -------------------------------------------------------------
function Action-Start {
    Start-One -Label 'backend'  -WorkingDir $BackendDir  -CommandArgs @('-m','uvicorn','main:app','--host',$BackendHost,'--port',[string]$BackendPort) `
              -PidFile $BackendPidFile  -OutFile $BackendOutFile  -ErrFile $BackendErrFile `
              -ExtraEnv @{ Port=$BackendPort; CB_JWT_SECRET=$CbJwtSecret; CB_CORS_ORIGINS=$CbCorsOrigins }
    Start-One -Label 'frontend' -WorkingDir $FrontendDir -CommandArgs @('-m','http.server',[string]$FrontendPort,'--bind',$FrontendHost) `
              -PidFile $FrontendPidFile -OutFile $FrontendOutFile -ErrFile $FrontendErrFile `
              -ExtraEnv @{ Port=$FrontendPort }
    Write-Host ''
    # 等后端冷启动，再探测；OK 后顺手把 demo 账号横幅打出来
    $ready = $false
    for ($i = 0; $i -lt 25; $i++) {
        try {
            $h = Invoke-WebRequest -Uri ("http://{0}:{1}/api/health" -f $BackendHost, $BackendPort) `
                                   -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
            if ($h.StatusCode -lt 400) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 400 }
    }
    if ($ready) {
        Write-Host '   ┌──────────────────────────────────────────────┐' -ForegroundColor Cyan
        Write-Host '   │  本地演示账号（后端自动注入，开箱即用）      │' -ForegroundColor Cyan
        Write-Host '   │                                              │' -ForegroundColor Cyan
        Write-Host ("   │    账号   ：{0,-32}│" -f $DemoEmail) -ForegroundColor Cyan
        Write-Host ("   │    密码   ：{0,-32}│" -f $DemoPassword) -ForegroundColor Cyan
        Write-Host '   │                                              │' -ForegroundColor Cyan
        Write-Host '   │  关闭自动注入：CB_DEMO_USER=0 启动           │' -ForegroundColor DarkGray
        Write-Host '   └──────────────────────────────────────────────┘' -ForegroundColor Cyan
    } else {
        Write-Host '   ⚠ 后端 /api/health 10 秒内未就绪，跳过演示账号提示，请查看 .runlogs/backend.err.log' -ForegroundColor Yellow
    }
    Write-Host ''
    Show-Status
}

function Action-Stop {
    Stop-One 'backend'  -Port $BackendPort  -PidFile $BackendPidFile
    Stop-One 'frontend' -Port $FrontendPort -PidFile $FrontendPidFile
    Write-Host ''
    Show-Status
}

function Action-Restart {
    Action-Stop
    Write-Host ''
    Write-Host '等待 1.5 秒后重新启动 ...' -ForegroundColor Cyan
    Start-Sleep -Seconds 1.5
    Action-Start
}

# --- 子命令分发 -----------------------------------------------------------
$action = if ($args.Count -gt 0) { $args[0] } else { '' }
switch -Regex ($action) {
    '^start$'   { Action-Start;   return }
    '^stop$'    { Action-Stop;    return }
    '^restart$' { Action-Restart; return }
    '^status$'  { Show-Status;    return }
    '^help$'    {
        Write-Host ''
        Write-Host '用法：dev.bat [start|stop|restart|status|help]'
        Write-Host '   无参数   进入交互菜单（启动/停止/重启/状态/退出）'
        Write-Host '   start    同时启动后端和前端'
        Write-Host '   stop     同时关闭后端和前端'
        Write-Host '   restart  先停止再启动'
        Write-Host '   status   查看端口、进程、HTTP 健康状态'
        Write-Host '   help     显示本帮助'
        Write-Host ''
        return
    }
    '^$' {
        # 交互菜单
        while ($true) {
            Write-Banner
            Write-Host ''
            Write-Host '请选择操作：' -ForegroundColor Yellow
            Write-Host '   1) 启动后端 + 前端'
            Write-Host '   2) 停止后端 + 前端'
            Write-Host '   3) 重启后端 + 前端'
            Write-Host '   0) 查看状态'
            Write-Host '   9) 退出'
            Write-Host ''
            $choice = Read-Host '  输入选项 [0-3, 9]'
            switch ($choice) {
                '1' { Action-Start;   Write-Host "`n按任意键返回菜单 ..."; $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown'); continue }
                '2' { Action-Stop;    Write-Host "`n按任意键返回菜单 ..."; $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown'); continue }
                '3' { Action-Restart; Write-Host "`n按任意键返回菜单 ..."; $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown'); continue }
                '0' { Show-Status;    Write-Host "`n按任意键返回菜单 ..."; $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown'); continue }
                '9' { return }
                default { Write-Host ("未知选项 '{0}'，请重新输入" -f $choice) -ForegroundColor Red; Start-Sleep -Seconds 1 }
            }
        }
    }
    default {
        Write-Host ("未知子命令：{0}" -f $action) -ForegroundColor Red
        Write-Host '请用 dev.bat help 查看支持的命令'
    }
}
