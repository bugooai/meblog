#!/bin/bash
# Migration script to apply SQL migrations
# Usage: ./migrate.sh [migration_name]

set -e

MIGRATION_DIR="migrations/sql"
DATABASE_URL="${DATABASE_URL:-postgresql://memblog:memblog@localhost:5432/memblog}"

if [ $# -eq 0 ]; then
    echo "Usage: $0 [migration_name]"
    echo "Available migrations:"
    ls -1 $MIGRATION_DIR/*.sql | xargs -n1 basename
    exit 1
fi

MIGRATION_FILE="$MIGRATION_DIR/$1.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "Applying migration: $1"
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

echo "Migration completed successfully!"