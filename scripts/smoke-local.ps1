param(
  [string]$GatewayUrl = "http://localhost:3000",
  [string]$AuthUrl = "http://localhost:3001",
  [string]$UsersUrl = "http://localhost:3002",
  [string]$PostsUrl = "http://localhost:3003",
  [string]$CommentsUrl = "http://localhost:3004",
  [int]$TimeoutSec = 15
)

$ErrorActionPreference = "Stop"

function Test-Endpoint {
  param(
    [string]$Name,
    [string]$Url
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $TimeoutSec
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
      Write-Host "[OK]   $Name -> $Url" -ForegroundColor Green
      return $true
    }

    Write-Host "[FAIL] $Name -> status $($response.StatusCode)" -ForegroundColor Red
    return $false
  } catch {
    Write-Host "[FAIL] $Name -> $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }
}

$checks = @(
  @{ Name = "Gateway health"; Url = "$GatewayUrl/health" },
  @{ Name = "Auth health"; Url = "$AuthUrl/health" },
  @{ Name = "Users health"; Url = "$UsersUrl/health" },
  @{ Name = "Posts health"; Url = "$PostsUrl/health" },
  @{ Name = "Comments health"; Url = "$CommentsUrl/health" },
  @{ Name = "Gateway posts api"; Url = "$GatewayUrl/api/posts?limit=1" }
)

Write-Host ""
Write-Host "Running smoke checks..." -ForegroundColor Cyan
Write-Host ""

$failedCount = 0
foreach ($check in $checks) {
  $ok = Test-Endpoint -Name $check.Name -Url $check.Url
  if (-not $ok) {
    $failedCount += 1
  }
}

Write-Host ""
if ($failedCount -gt 0) {
  Write-Host "Smoke checks failed: $failedCount endpoint(s)." -ForegroundColor Red
  exit 1
}

Write-Host "Smoke checks passed." -ForegroundColor Green
exit 0

