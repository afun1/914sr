Param(
  [string]$Repo = 'https://github.com/afun1/97sr.git',
  [string]$Branch = 'main',
  [string]$Message = 'Backup and updates'
)

# Run from project root
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))

$log = Join-Path $PSScriptRoot 'git_push_verbose.log'
Write-Host "Repo: $Repo"
Write-Host "Branch: $Branch"
Write-Host "Log: $log"

# Ensure origin
$originUrl = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
  git remote add origin $Repo
} else {
  git remote remove origin
  git remote add origin $Repo
}

# Stage and commit
git add -A
try { git commit -m "$Message" | Out-Null } catch { Write-Host "No changes to commit or commit failed" }

# Enable verbose tracing for git
$env:GIT_TRACE = '1'
$env:GIT_CURL_VERBOSE = '1'

# Execute push and capture output
Write-Host "Executing git push with verbose tracing..."
& git push -u origin $Branch 2>&1 | Tee-Object -FilePath $log

if ($LASTEXITCODE -ne 0) {
  Write-Host "git push failed (exit $LASTEXITCODE). Showing last 200 lines of log:"
  Get-Content $log -Tail 200 | ForEach-Object { Write-Host $_ }
  exit $LASTEXITCODE
}

Write-Host "Push completed successfully. Log written to $log"