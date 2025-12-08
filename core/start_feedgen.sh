#!/bin/bash
set -e

echo "📦 Installing dependencies..."
pip install -q flask atproto python-dotenv requests websocket-client cbor2

echo "🔥 Starting Firehose Indexer in background..."
python3 -u core/firehose_indexer.py --verbose &

echo "🎯 Starting Feed Generator Server..."
python3 -u core/feedgen_server.py
