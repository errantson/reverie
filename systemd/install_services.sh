#!/usr/bin/env bash
#
# Reverie House Service Boot Script
# Install and start systemd services for greeterwatch and mapperwatch
# Run this script after deployment to enable persistent service management
#
# Usage:
#   sudo bash install_services.sh
#   sudo bash install_services.sh --uninstall  (to remove services)
#

set -e

REVERIE_HOME="/srv/reverie.house"
SYSTEMD_DIR="$REVERIE_HOME/systemd"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root${NC}"
   exit 1
fi

if [[ "$1" == "--uninstall" ]]; then
    echo -e "${YELLOW}🗑️  Uninstalling Reverie House services...${NC}"
    
    systemctl stop reverie-greeterwatch.service 2>/dev/null || true
    systemctl disable reverie-greeterwatch.service 2>/dev/null || true
    rm -f /etc/systemd/system/reverie-greeterwatch.service
    
    systemctl stop reverie-mapperwatch.service 2>/dev/null || true
    systemctl disable reverie-mapperwatch.service 2>/dev/null || true
    rm -f /etc/systemd/system/reverie-mapperwatch.service
    
    systemctl daemon-reload
    echo -e "${GREEN}✅ Services uninstalled${NC}"
    exit 0
fi

echo -e "${GREEN}📋 Installing Reverie House services...${NC}"
echo

# Copy service files
if [[ ! -f "$SYSTEMD_DIR/reverie-greeterwatch.service" ]]; then
    echo -e "${RED}❌ $SYSTEMD_DIR/reverie-greeterwatch.service not found${NC}"
    exit 1
fi

if [[ ! -f "$SYSTEMD_DIR/reverie-mapperwatch.service" ]]; then
    echo -e "${RED}❌ $SYSTEMD_DIR/reverie-mapperwatch.service not found${NC}"
    exit 1
fi

echo "Installing reverie-greeterwatch.service..."
cp "$SYSTEMD_DIR/reverie-greeterwatch.service" /etc/systemd/system/
chmod 644 /etc/systemd/system/reverie-greeterwatch.service

echo "Installing reverie-mapperwatch.service..."
cp "$SYSTEMD_DIR/reverie-mapperwatch.service" /etc/systemd/system/
chmod 644 /etc/systemd/system/reverie-mapperwatch.service

echo

# Reload daemon and enable services
echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Enabling services to start on boot..."
systemctl enable reverie-greeterwatch.service
systemctl enable reverie-mapperwatch.service

echo

# Start services
echo "Starting services..."
systemctl start reverie-greeterwatch.service
systemctl start reverie-mapperwatch.service

echo
echo -e "${GREEN}✅ Installation complete!${NC}"
echo
echo "Service status:"
systemctl status reverie-greeterwatch.service --no-pager | grep -E "Active|running"
systemctl status reverie-mapperwatch.service --no-pager | grep -E "Active|running"

echo
echo "View logs:"
echo "  Greeterwatch: journalctl -u reverie-greeterwatch.service -f"
echo "  Mapperwatch:  journalctl -u reverie-mapperwatch.service -f"
echo
echo "Manual control:"
echo "  Stop:    sudo systemctl stop reverie-greeterwatch.service"
echo "  Start:   sudo systemctl start reverie-greeterwatch.service"
echo "  Restart: sudo systemctl restart reverie-greeterwatch.service"
echo "  Status:  sudo systemctl status reverie-greeterwatch.service"
echo
echo "⚠️  Note: Services will auto-restart if they fail (RestartSec=10s)"
