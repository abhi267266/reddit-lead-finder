#!/bin/bash
set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not set in .env"
  exit 1
fi

COMMAND=$1
if [ -z "$COMMAND" ]; then
  echo "Usage: bash $0 [up|down|status]"
  exit 1
fi

goose -dir migrations postgres "$DATABASE_URL" "$COMMAND"
