# ============================================================
#  SpaceOne — Inicia o app (100% local, sem servidor/banco)
#  Clique direito > "Executar com PowerShell"  ou rode:  .\start.ps1
# ============================================================
$ROOT = $PSScriptRoot

Write-Host "`n=== SpaceOne: iniciando ===" -ForegroundColor Magenta
Write-Host "[1/1] Abrindo o app (porta 3000) em nova janela..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$ROOT\frontend'; `$env:BROWSER='none'; npm start"

Write-Host "`nPronto! Em ~30s o app estara em:  http://localhost:3000" -ForegroundColor Green
Write-Host "(O app roda na janela que abriu. Feche-a para parar.)`n" -ForegroundColor DarkGray
