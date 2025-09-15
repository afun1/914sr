# Git command snippets (click to copy)

## PowerShell (Windows)

Use these lines in PowerShell (run each line separately or paste as a block). Note: older PowerShell versions don't accept `&&`, use `;` or separate lines.

```powershell
# Show remote URL
git remote -v

# Show local branches and tracking info
git branch -vv

# Fetch remote and show latest origin/main commit
git fetch origin; git log origin/main -1 --oneline --decorate

# Show recent commits locally
git log --oneline --decorate -n 5

# Show status
git status

# Inspect a commit (replace COMMIT)
git show COMMIT --name-only

# List remote branches
git branch -r

# Checkout main and push it to origin
git checkout main
git push -u origin main

# Push current branch to origin (set upstream)
$branch = git rev-parse --abbrev-ref HEAD; git push -u origin $branch

# Run the verbose push helper (captures logs)
.
\scripts\git_push_verbose.ps1 -Repo 'https://github.com/afun1/97sr.git' -Branch 'main' -Message 'Backup and fixes'
```

## Git Bash / CMD (Unix-like syntax works with &&)

```bash
# Show remote URL
git remote -v

# Show branch tracking info
git branch -vv

# Fetch and show latest remote main commit
git fetch origin && git log origin/main -1 --oneline --decorate

# Show recent commits
git log --oneline --decorate -n 5

# Show status
git status

# Inspect a commit (replace COMMIT)
git show COMMIT --name-only

# List remote branches
git branch -r

# Checkout main and push
git checkout main && git push -u origin main

# Push current branch to origin
git push -u origin $(git rev-parse --abbrev-ref HEAD)
```

## If you hit errors

- Paste output of `git remote -v` and `git branch -vv` here.
- If using PowerShell, run the traced helper and paste `c:\sr97\scripts\git_push_verbose.log`.
