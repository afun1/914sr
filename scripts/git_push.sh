#!/usr/bin/env bash
set -e
REPO=${1:-https://github.com/afun1/97sr.git}
BRANCH=${2:-main}
MSG=${3:-"Backup and updates"}

echo "Repo: $REPO"
echo "Branch: $BRANCH"

if [ ! -d .git ]; then
  echo "Initializing git repository..."
  git init
fi

# Ensure origin is set to the requested repo
if git remote get-url origin >/dev/null 2>&1; then
  echo "Updating origin to $REPO"
  git remote remove origin || true
fi

git remote add origin "$REPO" || true

# Stage and commit
git add -A
set +e
git commit -m "$MSG"
COMMIT_EXIT=$?
set -e
if [ $COMMIT_EXIT -eq 0 ]; then
  echo "Committed changes"
else
  echo "No changes to commit or commit failed (exit $COMMIT_EXIT)"
fi

# Push
echo "Pushing to origin/$BRANCH..."
git push -u origin "$BRANCH"

echo "Done. If push failed due to auth, configure SSH or use a PAT and run the script again."