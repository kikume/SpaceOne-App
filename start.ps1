# ============================================================
#  CryptoVault — Inicia tudo (Postgres + Backend + Frontend)
#  Clique direito > "Executar com PowerShell"  ou rode:  .\start.ps1
# ============================================================
$ROOT   = $PSScriptRoot
$PGBIN  = Join-Path $ROOT "pgsql\bin"
$PGDATA = Join-Path $ROOT "pgdata"

Write-Host "`n=== CryptoVault: iniciando ===" -ForegroundColor Magenta

# 1) PostgreSQL
$status = & "$PGBIN\pg_ctl.exe" -D $PGDATA status 2>$null
if ($status -match "server is running") {
  Write-Host "[1/3] PostgreSQL ja esta rodando (porta 5432)" -ForegroundColor Green
} else {
  Write-Host "[1/3] Iniciando PostgreSQL (porta 5432)..." -ForegroundColor Cyan
  & "$PGBIN\pg_ctl.exe" -D $PGDATA -o "-p 5432" -l (Join-Path $ROOT "pgsql.log") -w start | Out-Null
  Write-Host "      OK" -ForegroundColor Green
}

# 2) Backend (abre em nova janela para voce ver os logs)
Write-Host "[2/3] Abrindo backend (porta 3001) em nova janela..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$ROOT\backend'; node server.js"

# 3) Frontend (abre em nova janela)
Write-Host "[3/3] Abrindo frontend (porta 3000) em nova janela..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$ROOT\frontend'; `$env:BROWSER='none'; npm start"

Write-Host "`nPronto! Em ~30s o app estara em:  http://localhost:3000" -ForegroundColor Green
Write-Host "(Backend e Frontend rodam nas duas janelas que abriram. Feche-as para parar.)`n" -ForegroundColor DarkGray
