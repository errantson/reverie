#!/bin/bash
# Reverie House Feed Generator Management Script

SERVICE_NAME="feedgen"
SERVICE_FILE="/srv/ops/feedgen.service"
PYTHON_SCRIPT="/srv/core/feedgen_server.py"

check_status() {
    if systemctl is-active --quiet $SERVICE_NAME; then
        echo "✅ Feed generator is running"
        systemctl status $SERVICE_NAME --no-pager -l
    else
        echo "❌ Feed generator is not running"
        systemctl status $SERVICE_NAME --no-pager -l || true
    fi
}

check_endpoint() {
    echo ""
    echo "🔍 Testing feed endpoints..."
    
    # Test DID document
    echo -n "  /.well-known/did.json: "
    if curl -sf https://reverie.house/.well-known/did.json > /dev/null 2>&1; then
        echo "✅"
    else
        echo "❌"
    fi
    
    # Test describeFeedGenerator
    echo -n "  describeFeedGenerator: "
    if curl -sf "https://reverie.house/xrpc/app.bsky.feed.describeFeedGenerator" > /dev/null 2>&1; then
        echo "✅"
    else
        echo "❌"
    fi
    
    # Test getFeedSkeleton
    echo -n "  getFeedSkeleton (lore): "
    if curl -sf "https://reverie.house/xrpc/app.bsky.feed.getFeedSkeleton?feed=at://did:web:reverie.house/app.bsky.feed.generator/lore&limit=5" > /dev/null 2>&1; then
        echo "✅"
    else
        echo "❌"
    fi
}

case "$1" in
    install)
        echo "📦 Installing feed generator service..."
        sudo cp $SERVICE_FILE /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl enable $SERVICE_NAME
        echo "✅ Service installed and enabled"
        ;;
    
    start)
        echo "🚀 Starting feed generator..."
        sudo systemctl start $SERVICE_NAME
        sleep 2
        check_status
        ;;
    
    stop)
        echo "🛑 Stopping feed generator..."
        sudo systemctl stop $SERVICE_NAME
        check_status
        ;;
    
    restart)
        echo "🔄 Restarting feed generator..."
        sudo systemctl restart $SERVICE_NAME
        sleep 2
        check_status
        ;;
    
    status)
        check_status
        ;;
    
    check)
        check_status
        check_endpoint
        ;;
    
    logs)
        sudo journalctl -u $SERVICE_NAME -n 50 --no-pager
        ;;
    
    logs-follow)
        sudo journalctl -u $SERVICE_NAME -f
        ;;
    
    test)
        echo "🧪 Testing feed generator locally..."
        python3 $PYTHON_SCRIPT --test
        ;;
    
    *)
        echo "Reverie House Feed Generator Management"
        echo ""
        echo "Usage: $0 {install|start|stop|restart|status|check|logs|logs-follow|test}"
        echo ""
        echo "Commands:"
        echo "  install      Install and enable systemd service"
        echo "  start        Start the feed generator"
        echo "  stop         Stop the feed generator"
        echo "  restart      Restart the feed generator"
        echo "  status       Check service status"
        echo "  check        Check status and test endpoints"
        echo "  logs         Show recent logs"
        echo "  logs-follow  Follow logs in real-time"
        echo "  test         Test feed generator locally"
        exit 1
        ;;
esac
