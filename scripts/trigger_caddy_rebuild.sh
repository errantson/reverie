#!/bin/bash
#
# Trigger Caddy Configuration Rebuild
# ====================================
# 
# Called by Reverie application when dreamer state changes:
# - New dreamer registration
# - Handle changes
# - DID updates
#
# This script lives in /srv/reverie/ but calls the infrastructure
# layer builder at /srv/caddy/caddybuilder.py
#
# Usage:
#   ./trigger_caddy_rebuild.sh           # Standard rebuild + reload
#   ./trigger_caddy_rebuild.sh --force   # Force full restart
#

set -e

BUILDER="/srv/caddy/caddybuilder.py"
FORCE_RESTART="${1}"

echo "🔧 Reverie requesting Caddy rebuild..."

# Check if builder exists
if [ ! -f "$BUILDER" ]; then
    echo "❌ ERROR: Caddy builder not found at $BUILDER"
    exit 1
fi

# Call infrastructure builder
if [ "$FORCE_RESTART" = "--force" ]; then
    echo "   (with full restart)"
    python3 "$BUILDER" --restart
else
    echo "   (with reload)"
    python3 "$BUILDER"
fi

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo "✅ Caddy rebuild successful"
else
    echo "❌ Caddy rebuild failed with code $exit_code"
fi

exit $exit_code
