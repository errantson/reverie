#!/usr/bin/env bash
#
# Reverie House Service Monitor
# Check status of greeterwatch and mapperwatch services
# Shows health status, uptime, and recent activity
#

REVERIE_GREEN='\033[0;32m'
REVERIE_RED='\033[0;31m'
REVERIE_YELLOW='\033[1;33m'
REVERIE_BLUE='\033[0;34m'
NC='\033[0m' # No Color

check_service() {
    local service_name=$1
    local service_unit="reverie-$service_name.service"
    
    # Get status
    if systemctl is-active --quiet "$service_unit"; then
        local status="${REVERIE_GREEN}✅ RUNNING${NC}"
    else
        local status="${REVERIE_RED}❌ STOPPED${NC}"
    fi
    
    # Get uptime
    local active_since=$(systemctl show -p ActiveEnterTimestamp "$service_unit" 2>/dev/null | cut -d= -f2)
    
    # Get restart count
    if systemctl is-active --quiet "$service_unit"; then
        local restart_count=$(systemctl show -p NRestarts "$service_unit" 2>/dev/null | cut -d= -f2 || echo "0")
    else
        restart_count="N/A"
    fi
    
    # Get recent logs
    local recent_lines=$(journalctl -u "$service_unit" --no-pager -n 3 2>/dev/null)
    
    printf "%-20s %b\n" "$service_name:" "$status"
    if [[ ! -z "$active_since" ]]; then
        printf "  Active since: %s\n" "$active_since"
    fi
    printf "  Restarts: %s\n" "$restart_count"
    printf "  Recent logs:\n"
    echo "$recent_lines" | sed 's/^/    /'
    printf "\n"
}

echo
echo -e "${REVERIE_BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${REVERIE_BLUE}║      REVERIE HOUSE - Service Monitor              ║${NC}"
echo -e "${REVERIE_BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo

check_service "greeterwatch"
check_service "mapperwatch"

echo -e "${REVERIE_BLUE}System Summary:${NC}"
uptime_output=$(uptime | awk -F'load average' '{print $1}')
echo "  System uptime: $uptime_output"

# Check database connection
if timeout 5 psql -U reverie -d reverie_house -h localhost -c "SELECT 1" > /dev/null 2>&1; then
    echo "  Database: ${REVERIE_GREEN}✅ Connected${NC}"
else
    echo "  Database: ${REVERIE_RED}❌ Disconnected${NC}"
fi

echo
echo -e "${REVERIE_BLUE}🔧 Common Commands:${NC}"
echo "  View greeterwatch logs:  journalctl -u reverie-greeterwatch.service -f"
echo "  View mapperwatch logs:   journalctl -u reverie-mapperwatch.service -f"
echo "  Restart greeterwatch:    sudo systemctl restart reverie-greeterwatch.service"
echo "  Restart mapperwatch:     sudo systemctl restart reverie-mapperwatch.service"
echo "  View all reverie logs:   journalctl -u 'reverie-*.service' -f"
echo
