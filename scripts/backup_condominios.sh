#!/bin/bash
set -euo pipefail
BACKUP_DIR=/var/backups/conectaai_condominios
DATE=2026-05-24_14-12
DB_CONTAINER=conectaai_db
DB_NAME=conectaai
DB_USER=conectaai_user
mkdir -p $BACKUP_DIR
docker exec $DB_CONTAINER pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/condominios_${DATE}.sql.gz
echo Backup OK: condominios_${DATE}.sql.gz
find $BACKUP_DIR -name condominios_*.sql.gz -mtime +7 -delete
echo Cleanup: backups older than 7 days removed
