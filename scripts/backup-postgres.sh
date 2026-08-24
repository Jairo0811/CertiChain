#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be set}"

BACKUP_DIR="${BACKUP_DIR:-backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="${BACKUP_DIR}/certichain-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="$TARGET"
sha256sum "$TARGET" > "${TARGET}.sha256"

echo "Backup created: $TARGET"
