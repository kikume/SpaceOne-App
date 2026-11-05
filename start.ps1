# ============================================================
#  SpaceOne — Start the app (100% local, no server/database)
#  Right-click > "Run with PowerShell"  or run:  .\start.ps1
# ============================================================
$ROOT = $PSScriptRoot

Write-Host "`n=== SpaceOne: starting ===" -ForegroundColor Magenta
Write-Host "[1/1] Opening the app (port 3000) in a new window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$ROOT\frontend'; `$env:BROWSER='none'; npm start"

Write-Host "`nDone! In ~30s the app will be at:  http://localhost:3000" -ForegroundColor Green
Write-Host "(The app runs in the window that just opened. Close it to stop.)`n" -ForegroundColor DarkGray
