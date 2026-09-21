#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run build
TS="$(date -u +'%Y%m%d-%H%M%S')"
mkdir -p "$ROOT/backups"
tar -czf "$ROOT/backups/frontend-dist-$TS.tgz" -C "$ROOT" dist || true
if [ -d "$ROOT/backend" ] && [ -f "$ROOT/backend/Cargo.toml" ]; then
  cd "$ROOT/backend"
  cargo build --release
  cd "$ROOT"
  tar -czf "$ROOT/backups/backend-target-$TS.tgz" -C "$ROOT/backend" target || true
fi
if [ ! -d .git ]; then
  git init
  git config user.name "backup-bot"
  git config user.email "backup@example.com"
fi
git add -A . ':(exclude)backend/target'
git commit -m "backup:$TS" || true
git tag "backup-$TS" || true
if [ -d "$ROOT/backend/.git" ]; then
  cd "$ROOT/backend"
  git add -A .
  git commit -m "backup:$TS" || true
  git tag "backup-$TS" || true
fi
echo "created backup-$TS"
