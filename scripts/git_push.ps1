Param(
  [string]$Repo = 'https://github.com/afun1/97sr.git',
  [string]$Branch = 'main',
  [string]$Message = 'Backup and updates'
)

Write-Host "Repo: $Repo"
Write-Host "Branch: $Branch"

if (-not (Test-Path -Path .git)) {
  Write-Host "Initializing git repository..."
  git init
}

# Set or update origin
$origin = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
  git remote add origin $Repo
} else {
  git remote remove origin
  git remote add origin $Repo
}

# Stage and commit
git add -A
$commit = git commit -m "$Message" 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "Committed changes"
} else {
  Write-Host "No changes to commit or commit failed"
}

# Push
Write-Host "Pushing to origin/$Branch..."
git push -u origin $Branch

Write-Host "Done. If push failed due to auth, configure SSH or use a PAT and run the script again."