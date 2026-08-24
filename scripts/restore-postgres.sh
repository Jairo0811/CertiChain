#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${1:?Usage: scripts/restore-postgres.sh <backup.dump>}"

if [ "${ALLOW_RESTORE:-}" != "YES" ]; then
  echo "Refusing restore. Set ALLOW_RESTORE=YES after verifying the target environment." >&2
  exit 1
fi

BACKUP="$1"
if [ ! -f "$BACKUP" ]; then
  echo "Backup not found: $BACKUP" >&2
  exit 1
fi

if [ -f "${BACKUP}.sha256" ]; then
  sha256sum -c "${BACKUP}.sha256"
fi

pg_restore "$BACKUP" --dbname="$DATABASE_URL" --clean --if-exists --no-owner --no-acl

echo "Restore completed from: $BACKUP"
