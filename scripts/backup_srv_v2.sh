#!/bin/bash
#
# Backup /srv/ to USB Drive (Post-Restructure Version)
# =====================================================
# 
# This is the updated backup script for the new modular Caddy architecture.
# 
# Usage:
#   ./backup_srv_v2.sh [destination]
#
# Default destination: /mnt/backup
#

set -e

BACKUP_DEST="${1:-/mnt/backup}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="srv_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DEST}/${BACKUP_NAME}"

echo "================================================================================"
echo "  Reverie /srv Backup System (v2 - Post-Caddy Restructure)"
echo "================================================================================"
echo "Timestamp: ${TIMESTAMP}"
echo "Destination: ${BACKUP_PATH}"
echo ""

# Check if destination is mounted
if ! mountpoint -q "${BACKUP_DEST}"; then
    echo "❌ ERROR: ${BACKUP_DEST} is not mounted!"
    echo ""
    echo "Mount your backup drive first:"
    echo "  sudo mount /dev/sda1 ${BACKUP_DEST}"
    exit 1
fi

# Check available space
echo "📊 Checking disk space..."
SRV_SIZE=$(du -sb /srv 2>/dev/null | awk '{print $1}' || echo "0")
AVAIL_SIZE=$(df --output=avail -B1 "${BACKUP_DEST}" | tail -1)

echo "  /srv size:  $(numfmt --to=iec ${SRV_SIZE})"
echo "  Available:  $(numfmt --to=iec ${AVAIL_SIZE})"

if [ "${SRV_SIZE}" -gt "${AVAIL_SIZE}" ]; then
    echo "❌ ERROR: Not enough space on backup drive!"
    exit 1
fi

# Create backup directory
mkdir -p "${BACKUP_PATH}"

echo ""
echo "🚀 Starting backup..."
echo ""

# Backup with progress
rsync -av --progress \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='logs/*' \
    --exclude='caddy/data/caddy/locks' \
    --exclude='caddy/data/caddy/acme' \
    --exclude='lorefarm/data/uploads/temp' \
    --exclude='site/temp/*' \
    /srv/ "${BACKUP_PATH}/"

# Create metadata file
cat > "${BACKUP_PATH}/BACKUP_INFO.txt" << EOF
===============================================================================
REVERIE /SRV BACKUP INFORMATION
===============================================================================
Backup Created: $(date)
Hostname: $(hostname)
Source: /srv/
Backup Version: v2 (Post-Caddy Restructure)

===============================================================================
STRUCTURE
===============================================================================
This backup includes the NEW modular Caddy architecture:

/srv/
├── caddy/
│   ├── Caddyfile                    # Master config (imports fragments)
│   ├── base.caddy                   # Reverie static routes
│   ├── includes/                    # Project-specific fragments
│   │   ├── reverie.caddy           # Auto-generated dreamer subdomains
│   │   ├── lorefarm.caddy          # Lorefarm labeler
│   │   ├── bibliobond.caddy        # Bibliobond service
│   │   └── dreams.caddy            # Standalone dreams
│   └── data/                        # Caddy SSL certs & data
│
├── reverie/
│   └── scripts/
│       └── build_caddy_fragment.py  # Dreamer subdomain generator
│
├── data/
│   ├── reverie.db                   # Main database
│   └── pds/                         # AT Protocol data
│
├── lorefarm/                        # Lorefarm project
├── bibliobond/                      # Bibliobond project
├── avonlea/                         # avonlea.town dream
├── flawed/                          # flawed.center dream
├── lakeblood/                       # lakeblood.ca dream
└── site/                            # Reverie frontend

===============================================================================
STATISTICS
===============================================================================
Backup Size: $(du -sh "${BACKUP_PATH}" | awk '{print $1}')

Docker Containers (at backup time):
$(docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" 2>/dev/null || echo "Docker not available")

===============================================================================
CADDY CONFIGURATION
===============================================================================
Active Caddy imports:
$(grep "^import " /srv/caddy/Caddyfile 2>/dev/null || echo "Could not read Caddyfile")

Dreamer subdomains generated:
$(grep -c "reverie.house {" /srv/caddy/includes/reverie.caddy 2>/dev/null || echo "0") subdomains

===============================================================================
DATABASE INFO
===============================================================================
$(sqlite3 /srv/data/reverie.db "SELECT COUNT(*) || ' dreamers' FROM dreamers" 2>/dev/null || echo "Could not query database")
$(sqlite3 /srv/data/reverie.db "SELECT COUNT(*) || ' canon records' FROM canon" 2>/dev/null || echo "")

EOF

# Create restore notes
cat > "${BACKUP_PATH}/RESTORE_NOTES.txt" << 'EOF'
===============================================================================
RESTORE GUIDE - POST-CADDY RESTRUCTURE
===============================================================================

⚠️  IMPORTANT: This backup uses the NEW modular Caddy architecture!

===============================================================================
QUICK RESTORE (Full System)
===============================================================================

1. Stop all services:
   cd /srv && docker compose down

2. Restore files:
   sudo rsync -av /mnt/backup/srv_backup_TIMESTAMP/ /srv/

3. Fix permissions:
   sudo chown -R errantson:errantson /srv
   sudo chown -R root:root /srv/caddy/data

4. Recreate Caddy container (needed for new volume mounts):
   cd /srv
   docker stop caddy && docker rm caddy
   docker compose up -d caddy

5. Restart all services:
   docker compose up -d

6. Verify:
   docker ps
   curl https://reverie.house

===============================================================================
PARTIAL RESTORE (Specific Components)
===============================================================================

Restore Database Only:
  sudo cp /mnt/backup/srv_backup_TIMESTAMP/data/reverie.db /srv/data/
  docker restart admin

Restore Caddy Config Only:
  sudo cp /mnt/backup/srv_backup_TIMESTAMP/caddy/Caddyfile /srv/caddy/
  sudo cp -r /mnt/backup/srv_backup_TIMESTAMP/caddy/includes /srv/caddy/
  sudo cp /mnt/backup/srv_backup_TIMESTAMP/caddy/base.caddy /srv/caddy/
  docker exec caddy caddy reload

Restore PDS Data:
  sudo rsync -av /mnt/backup/srv_backup_TIMESTAMP/data/pds/ /srv/data/pds/
  docker restart admin

Rebuild Dreamer Subdomains (if needed):
  python3 /srv/reverie/scripts/build_caddy_fragment.py --reload

===============================================================================
CADDY ARCHITECTURE NOTES
===============================================================================

The new system uses modular fragments:
- /srv/caddy/Caddyfile: Master (imports all fragments)
- /srv/caddy/base.caddy: Reverie static routes
- /srv/caddy/includes/*.caddy: Project-specific configs

Each project can manage its own Caddy fragment independently.

To add new dreamer subdomains after restore:
  python3 /srv/reverie/scripts/build_caddy_fragment.py --reload

===============================================================================
TROUBLESHOOTING
===============================================================================

If Caddy won't start:
  docker logs caddy
  # Check for import errors
  # Verify all fragment files exist

If dreamer subdomains missing:
  python3 /srv/reverie/scripts/build_caddy_fragment.py --reload

If feeds not working:
  docker logs admin
  docker restart admin

If PDS not responding:
  docker restart admin
  # Check /srv/data/pds/ permissions

===============================================================================
EOF

echo ""
echo "================================================================================"
echo "  ✅ BACKUP COMPLETE"
echo "================================================================================"
echo "Location: ${BACKUP_PATH}"
echo "Size: $(du -sh "${BACKUP_PATH}" | awk '{print $1}')"
echo ""
echo "📄 Documentation:"
echo "  ${BACKUP_PATH}/BACKUP_INFO.txt"
echo "  ${BACKUP_PATH}/RESTORE_NOTES.txt"
echo ""

# List recent backups
echo "📦 Recent backups on this drive:"
ls -lhtr "${BACKUP_DEST}" | grep "srv_backup_" | tail -5

echo ""
echo "================================================================================"
