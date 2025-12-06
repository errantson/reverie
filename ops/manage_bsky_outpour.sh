#!/bin/bash
# Bluesky Outpour Management Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="bsky-outpour"
PYTHON_SCRIPT="/srv/core/bsky_outpour.py"

case "$1" in
    check)
        echo "🔍 Checking what would change (dry run)..."
        python3 "$PYTHON_SCRIPT" --check --verbose
        ;;
    
    check-follows)
        echo "🔍 Checking follows..."
        python3 "$PYTHON_SCRIPT" --sync-follows --check --verbose
        ;;
    
    check-lists)
        echo "🔍 Checking lists..."
        python3 "$PYTHON_SCRIPT" --sync-lists --check --verbose
        ;;
    
    sync-follows)
        echo "👥 Syncing follows..."
        python3 "$PYTHON_SCRIPT" --sync-follows --verbose
        ;;
    
    sync-lists)
        echo "📋 Syncing lists..."
        python3 "$PYTHON_SCRIPT" --sync-lists --verbose
        ;;
    
    sync-feeds)
        echo "🎯 Syncing feeds (with backfill)..."
        python3 "$PYTHON_SCRIPT" --sync-feeds --verbose
        ;;
    
    sync-all)
        echo "🌊 Syncing everything..."
        python3 "$PYTHON_SCRIPT" --sync-all --verbose
        ;;
    
    install)
        echo "📦 Installing $SERVICE_NAME service..."
        sudo cp "$SCRIPT_DIR/$SERVICE_NAME.service" /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl enable "$SERVICE_NAME"
        echo "✅ Service installed and enabled"
        echo "Use './ops/manage_bsky_outpour.sh start' to start it"
        ;;
    
    start)
        echo "▶️  Starting $SERVICE_NAME service..."
        sudo systemctl start "$SERVICE_NAME"
        sudo systemctl status "$SERVICE_NAME" --no-pager
        ;;
    
    stop)
        echo "⏹️  Stopping $SERVICE_NAME service..."
        sudo systemctl stop "$SERVICE_NAME"
        ;;
    
    restart)
        echo "🔄 Restarting $SERVICE_NAME service..."
        sudo systemctl restart "$SERVICE_NAME"
        sudo systemctl status "$SERVICE_NAME" --no-pager
        ;;
    
    status)
        sudo systemctl status "$SERVICE_NAME" --no-pager
        ;;
    
    logs)
        echo "📜 Recent logs..."
        sudo journalctl -u "$SERVICE_NAME" -n 50 --no-pager
        ;;
    
    logs-follow)
        echo "📜 Following logs (Ctrl+C to stop)..."
        sudo journalctl -u "$SERVICE_NAME" -f
        ;;
    
    *)
        echo "🌊 Bluesky Outpour Management"
        echo ""
        echo "Usage: $0 {command}"
        echo ""
        echo "Commands:"
        echo "  check          - Dry run, show what would change"
        echo "  check-follows  - Check follows only"
        echo "  check-lists    - Check lists only"
        echo ""
        echo "  sync-follows   - Sync follows now"
        echo "  sync-lists     - Sync lists now"
        echo "  sync-feeds     - Backfill feed data"
        echo "  sync-all       - Sync everything now"
        echo ""
        echo "  install        - Install systemd service"
        echo "  start          - Start service"
        echo "  stop           - Stop service"
        echo "  restart        - Restart service"
        echo "  status         - Show service status"
        echo "  logs           - Show recent logs"
        echo "  logs-follow    - Follow logs in real-time"
        exit 1
        ;;
esac
