param([string]$BaseUrl = "http://localhost:3000")
$ErrorActionPreference = "Stop"
Write-Host "IAM Selfcheck: Presigned POST" -ForegroundColor Cyan
if ($env:TENANT_PHOTO_FLOW_ENABLED -ne "true" -and $env:NODE_ENV -eq "production") { Write-Host "ERROR: TENANT_PHOTO_FLOW_ENABLED must be true" -ForegroundColor Red; exit 1 }
$payload = @{ fileName="maintenance-test.jpg"; mimeType="image/jpeg"; fileSize=102400 } | ConvertTo-Json
try {
  $headers = @{
    'Content-Type' = 'application/json'
    'x-org-id' = '00000000-0000-4000-8000-000000000001'
  }
  $res = Invoke-RestMethod -Uri "$BaseUrl/api/files/presign-photo" -Method POST -Headers $headers -Body $payload -TimeoutSec 12
  foreach ($k in @("url","fields","s3Key","expiresAt")) { if (-not $res.$k) { throw "Missing $k" } }
  if (-not $res.fields.'Content-Type') { throw "Missing fields.Content-Type" }
  if (-not $res.fields.key) { throw "Missing fields.key" }
  Write-Host "SUCCESS: Presign OK" -ForegroundColor Green; Write-Host "   S3 Key: $($res.s3Key)"; exit 0
} catch { Write-Host "ERROR: Presign FAILED: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }