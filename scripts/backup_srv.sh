#!/bin/bash
#
# Backup /srv/ to external drive
# Usage: ./backup_srv.sh [destination_path]
#

set -e

BACKUP_DEST="${1:-/mnt/backup}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="srv_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DEST}/${BACKUP_NAME}"

echo "=== Reverie /srv Backup System ==="
echo "Timestamp: ${TIMESTAMP}"
echo "Destination: ${BACKUP_PATH}"
echo ""

# Check if destination is mounted
if ! mountpoint -q "${BACKUP_DEST}"; then
    echo "ERROR: ${BACKUP_DEST} is not mounted!"
    echo "Mount your backup drive first:"
    echo "  sudo mount /dev/sda1 ${BACKUP_DEST}"
    exit 1
fi

# Check available space
echo "Checking disk space..."
SRV_SIZE=$(du -sb /srv 2>/dev/null | awk '{print $1}' || echo "0")
AVAIL_SIZE=$(df --output=avail -B1 "${BACKUP_DEST}" | tail -1)

echo "  /srv size: $(numfmt --to=iec ${SRV_SIZE})"
echo "  Available: $(numfmt --to=iec ${AVAIL_SIZE})"

if [ "${SRV_SIZE}" -gt "${AVAIL_SIZE}" ]; then
    echo "ERROR: Not enough space on backup drive!"
    exit 1
fi

# Create backup directory
mkdir -p "${BACKUP_PATH}"

echo ""
echo "Starting backup..."
echo ""

# Backup with progress, excluding cache/temp files
rsync -av --progress \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='logs/*' \
    --exclude='caddy/data/caddy/locks' \
    --exclude='lorefarm/data/uploads/temp' \
    /srv/ "${BACKUP_PATH}/"

# Create metadata file
cat > "${BACKUP_PATH}/BACKUP_INFO.txt" << EOF
Backup Created: $(date)
Hostname: $(hostname)
Source: /srv/
Backup Size: $(du -sh "${BACKUP_PATH}" | awk '{print $1}')

Contents:
$(ls -la "${BACKUP_PATH}")

Docker Containers (at backup time):
$(docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" 2>/dev/null || echo "Docker not available")
EOF

# Create quick restore notes
cat > "${BACKUP_PATH}/RESTORE_NOTES.txt" << EOF
=== Quick Restore Guide ===

To restore this backup:

1. Stop all services:
   docker-compose down (in each project)

2. Restore files:
   sudo rsync -av ${BACKUP_PATH}/ /srv/

3. Fix permissions:
   sudo chown -R errantson:errantson /srv
   
4. Restart services:
   cd /srv && docker-compose up -d
   cd /srv/lorefarm && docker-compose up -d
   etc.

5. Verify:
   docker ps
   curl https://reverie.house

=== Backup Details ===
Date: $(date)
Original location: /srv/
Backup location: ${BACKUP_PATH}
EOF

echo ""
echo "=== Backup Complete ==="
echo "Location: ${BACKUP_PATH}"
echo "Size: $(du -sh "${BACKUP_PATH}" | awk '{print $1}')"
echo ""
echo "To restore: see ${BACKUP_PATH}/RESTORE_NOTES.txt"
echo ""

# List recent backups
echo "Recent backups on this drive:"
ls -lht "${BACKUP_DEST}" | grep "srv_backup_" | head -5
