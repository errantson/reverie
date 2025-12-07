#!/bin/bash
# Build OAuth modules with SDK
# Run this after modifying oauth-manager.js or oauth-callback.js

cd "$(dirname "$0")"

echo "🔨 Building OAuth modules..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build complete!"
    echo "📦 Output: /srv/site/js/widgets/oauth-manager.js"
    echo "📦 Output: /srv/site/js/widgets/oauth-callback.js"
else
    echo "❌ Build failed!"
    exit 1
fi
