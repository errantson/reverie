#!/bin/bash
# Courier Service Management Script

SERVICE_NAME="courier"
SERVICE_FILE="/srv/reverie.house/ops/courier.service"
SYSTEMD_PATH="/etc/systemd/system/courier.service"

case "$1" in
    install)
        echo "📬 Installing courier service..."
        sudo cp "$SERVICE_FILE" "$SYSTEMD_PATH"
        sudo systemctl daemon-reload
        sudo systemctl enable courier
        echo "✅ Courier service installed"
        echo "Run: sudo systemctl start courier"
        ;;
    
    start)
        echo "📬 Starting courier service..."
        sudo systemctl start courier
        sudo systemctl status courier --no-pager
        ;;
    
    stop)
        echo "📬 Stopping courier service..."
        sudo systemctl stop courier
        ;;
    
    restart)
        echo "📬 Restarting courier service..."
        sudo systemctl restart courier
        sudo systemctl status courier --no-pager
        ;;
    
    status)
        sudo systemctl status courier --no-pager
        ;;
    
    logs)
        echo "📬 Courier logs (last 50 lines):"
        tail -n 50 /srv/reverie.house/logs/courier.log
        ;;
    
    errors)
        echo "❌ Courier errors (last 50 lines):"
        tail -n 50 /srv/reverie.house/logs/courier.error.log
        ;;
    
    follow)
        echo "📬 Following courier logs (Ctrl+C to exit)..."
        tail -f /srv/reverie.house/logs/courier.log
        ;;
    
    uninstall)
        echo "📬 Uninstalling courier service..."
        sudo systemctl stop courier
        sudo systemctl disable courier
        sudo rm "$SYSTEMD_PATH"
        sudo systemctl daemon-reload
        echo "✅ Courier service uninstalled"
        ;;
    
    *)
        echo "Courier Service Manager"
        echo ""
        echo "Usage: $0 {install|start|stop|restart|status|logs|errors|follow|uninstall}"
        echo ""
        echo "Commands:"
        echo "  install   - Install service to systemd"
        echo "  start     - Start the courier service"
        echo "  stop      - Stop the courier service"
        echo "  restart   - Restart the courier service"
        echo "  status    - Show service status"
        echo "  logs      - Show recent logs"
        echo "  errors    - Show recent errors"
        echo "  follow    - Follow logs in real-time"
        echo "  uninstall - Remove service from systemd"
        exit 1
        ;;
esac

exit 0
