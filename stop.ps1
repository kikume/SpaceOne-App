# ============================================================
#  CryptoVault — Para o PostgreSQL
#  (Para backend/frontend: feche as janelas do PowerShell deles)
# ============================================================
$ROOT   = $PSScriptRoot
$PGBIN  = Join-Path $ROOT "pgsql\bin"
$PGDATA = Join-Path $ROOT "pgdata"

Write-Host "Parando PostgreSQL..." -ForegroundColor Cyan
& "$PGBIN\pg_ctl.exe" -D $PGDATA stop 2>$null | Out-Null
Write-Host "PostgreSQL parado." -ForegroundColor Green
Write-Host "Para parar o backend/frontend, feche as janelas do PowerShell que abriram." -ForegroundColor DarkGray
