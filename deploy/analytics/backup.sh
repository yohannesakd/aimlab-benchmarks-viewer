#!/usr/bin/env bash
set -euo pipefail

backup_dir=/home/sai/.local/share/aimlab-analytics/backups
mkdir -p "$backup_dir"
backup_file="$backup_dir/umami-$(date -u +%Y-%m-%d).dump"
temporary_file=$(mktemp "$backup_dir/.umami-XXXXXX")
trap 'rm -f "$temporary_file"' EXIT

docker compose -f /home/sai/apps/aimlab-analytics/compose.yaml exec -T db \
  pg_dump -U umami -d umami -Fc > "$temporary_file"
mv "$temporary_file" "$backup_file"
find "$backup_dir" -maxdepth 1 -type f -name 'umami-*.dump' -mtime +7 -delete
