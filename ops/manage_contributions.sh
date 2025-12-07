#!/bin/bash
#
# Contribution Score Updater Manager
# Runs the contribution calculator to update dreamer scores
#

ACTION=${1:-run}

case "$ACTION" in
    run)
        echo "🏆 Running contribution score calculator..."
        docker exec reverie_api python3 /srv/core/contributions.py --verbose
        ;;
    
    quiet)
        echo "Running contribution calculator (quiet mode)..."
        docker exec reverie_api python3 /srv/core/contributions.py --quiet
        ;;
    
    logs)
        echo "No dedicated logs - run with 'run' or 'quiet'"
        ;;
    
    status)
        echo "Contribution Calculator Status:"
        docker exec reverie_api python3 -c "
from core.database import DatabaseManager
db = DatabaseManager()
cursor = db.execute('SELECT COUNT(*) as total, SUM(CASE WHEN contribution_score > 0 THEN 1 ELSE 0 END) as contributors, SUM(CASE WHEN patron_score > 0 THEN 1 ELSE 0 END) as patrons FROM dreamers')
row = cursor.fetchone()
print(f'  Total dreamers: {row[\"total\"]}')
print(f'  Contributors: {row[\"contributors\"]}')
print(f'  Patrons: {row[\"patrons\"]}')
"
        ;;
    
    *)
        echo "Usage: $0 {run|quiet|status|logs}"
        echo ""
        echo "Commands:"
        echo "  run      - Run contribution calculator with verbose output"
        echo "  quiet    - Run contribution calculator silently"
        echo "  status   - Show current contribution statistics"
        echo "  logs     - (No dedicated logs for this service)"
        exit 1
        ;;
esac
