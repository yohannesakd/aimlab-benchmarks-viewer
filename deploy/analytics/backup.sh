#!/usr/bin/env bash
set -euo pipefail

backup_dir=/home/sai/code/aimlab/data/analytics/backups
mkdir -p "$backup_dir"
backup_file="$backup_dir/umami-$(date -u +%Y-%m-%d).dump"
temporary_file=$(mktemp "$backup_dir/.umami-XXXXXX")
trap 'rm -f "$temporary_file"' EXIT

docker compose -f /home/sai/code/aimlab/runtime/analytics/compose.yaml exec -T db \
  pg_dump -U umami -d umami -Fc > "$temporary_file"
mv "$temporary_file" "$backup_file"
