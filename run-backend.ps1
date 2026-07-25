[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$StartPort = 8000,

    [ValidateRange(1, 1000)]
    [int]$PortAttempts = 100,

    [switch]$NoReload
)

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$pythonPath = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw @"
.venv의 Python을 찾지 못했습니다. 프로젝트 루트에서 아래 명령을 먼저 실행하세요.

    python -m venv .venv
    .\.venv\Scripts\python.exe -m pip install -r requirements-test.txt
"@
}

function Test-PortAvailable {
    param([int]$Port)

    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new(
            [System.Net.IPAddress]::Loopback,
            $Port
        )
        $listener.Start()
        return $true
    }
    catch [System.Net.Sockets.SocketException] {
        return $false
    }
    finally {
        if ($null -ne $listener) {
            try {
                $listener.Stop()
            }
            catch {
                # 이미 닫힌 소켓은 무시합니다.
            }
        }
    }
}

$lastPort = [Math]::Min(65535, $StartPort + $PortAttempts - 1)
$selectedPort = $null

foreach ($candidate in $StartPort..$lastPort) {
    if (Test-PortAvailable -Port $candidate) {
        $selectedPort = $candidate
        break
    }
}

if ($null -eq $selectedPort) {
    throw "$StartPort~$lastPort 범위에서 사용할 수 있는 포트를 찾지 못했습니다."
}

$uvicornArguments = @(
    "-m", "uvicorn",
    "main:app",
    "--host", "127.0.0.1",
    "--port", $selectedPort.ToString()
)

if (-not $NoReload) {
    $uvicornArguments += "--reload"
}

Write-Host ""
Write-Host "사용 가능한 포트 $selectedPort 에서 백엔드를 실행합니다." -ForegroundColor Green
Write-Host "Swagger: http://127.0.0.1:$selectedPort/docs"
Write-Host "Health : http://127.0.0.1:$selectedPort/api/health"
Write-Host "종료   : Ctrl+C"
Write-Host ""

Push-Location $projectRoot
try {
    & $pythonPath @uvicornArguments
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}
