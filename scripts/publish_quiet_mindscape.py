#!/usr/bin/env python3
"""
Publish the quiet-mindscape app.bsky.feed.generator record.

Run once after deploying to register the feed so Bluesky clients can subscribe to it.
The record is published from the reverie.house service account (did:plc:yauphjufk7phkwurn266ybx2).

Usage:
    python3 scripts/publish_quiet_mindscape.py
"""

import sys
import json
import requests
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

FEED_SLUG        = 'quiet-mindscape'
PUBLISHER_DID    = 'did:plc:yauphjufk7phkwurn266ybx2'   # reverie.house service account
GENERATOR_DID    = 'did:web:reverie.house'               # BskyFeedGenerator service host
PDS_URL          = 'https://reverie.house'

FEED_RECORD = {
    '$type':       'app.bsky.feed.generator',
    'did':         GENERATOR_DID,
    'displayName': 'Quiet Mindscape',
    'description': 'Quiet posters you follow, of rarer thoughts and fewer words.',
    'createdAt':   '2026-04-22T00:00:00.000Z',
}

AVATAR_PATH = Path(__file__).parent.parent / 'assets' / 'quiet_mindscape.png'


def get_credentials() -> tuple[str, str]:
    """Return (handle, app_password) for the reverie.house service account."""
    from core.database import DatabaseManager
    from core.encryption import decrypt_password

    db = DatabaseManager()
    row = db.fetch_one("""
        SELECT d.handle, c.app_password_hash
        FROM user_credentials c
        JOIN dreamers d ON d.did = c.did
        WHERE d.did = %s AND c.is_valid = TRUE
        LIMIT 1
    """, (PUBLISHER_DID,))

    if not row or not row['app_password_hash']:
        raise RuntimeError(
            f"No valid app_password found for {PUBLISHER_DID}. "
            "Run the AuthManager refresh or create one via pdsadmin."
        )

    password = decrypt_password(row['app_password_hash'])
    if not password:
        raise RuntimeError("Could not decrypt app_password")
    return row['handle'], password


def create_session(handle: str, password: str) -> dict:
    resp = requests.post(
        f'{PDS_URL}/xrpc/com.atproto.server.createSession',
        json={'identifier': handle, 'password': password},
        timeout=15,
    )
    if not resp.ok:
        raise RuntimeError(f"Auth failed ({resp.status_code}): {resp.text}")
    return resp.json()


def upload_avatar(session: dict) -> dict | None:
    """Upload quiet_mindscape.png as a blob and return the blob ref."""
    if not AVATAR_PATH.exists():
        print(f'   ⚠️  Avatar not found at {AVATAR_PATH}, skipping')
        return None

    with open(AVATAR_PATH, 'rb') as f:
        data = f.read()

    resp = requests.post(
        f'{PDS_URL}/xrpc/com.atproto.repo.uploadBlob',
        headers={
            'Content-Type':  'image/png',
            'Authorization': f'Bearer {session["accessJwt"]}',
        },
        data=data,
        timeout=30,
    )
    if not resp.ok:
        print(f'   ⚠️  Blob upload failed ({resp.status_code}): {resp.text}')
        return None
    blob = resp.json().get('blob')
    print(f'   ✅ Avatar uploaded: {blob}')
    return blob


def publish_record(session: dict, record: dict) -> dict:
    access_jwt = session['accessJwt']
    publisher_did = session['did']

    if publisher_did != PUBLISHER_DID:
        raise RuntimeError(
            f"DID mismatch: expected {PUBLISHER_DID}, got {publisher_did}"
        )

    resp = requests.post(
        f'{PDS_URL}/xrpc/com.atproto.repo.putRecord',
        headers={
            'Content-Type':  'application/json',
            'Authorization': f'Bearer {access_jwt}',
        },
        json={
            'repo':       publisher_did,
            'collection': 'app.bsky.feed.generator',
            'rkey':       FEED_SLUG,
            'record':     record,
        },
        timeout=15,
    )
    if not resp.ok:
        raise RuntimeError(f"putRecord failed ({resp.status_code}): {resp.text}")
    return resp.json()


def main():
    print('🌙 Publishing quiet-mindscape feed generator record')
    print('=' * 60)
    print(f'  Publisher DID : {PUBLISHER_DID}')
    print(f'  Generator DID : {GENERATOR_DID}')
    print(f'  Feed slug     : {FEED_SLUG}')
    print(f'  PDS           : {PDS_URL}')
    print()

    print('🔑 Loading credentials...')
    handle, password = get_credentials()
    print(f'   Handle: {handle}')

    print('🔐 Authenticating...')
    session = create_session(handle, password)
    print(f'   ✅ Authenticated as {session["did"]}')

    print('📸 Uploading avatar...')
    blob = upload_avatar(session)

    record = dict(FEED_RECORD)
    if blob:
        record['avatar'] = blob

    print(f'📝 Publishing feed record...')
    result = publish_record(session, record)
    print(f'   ✅ Published: {result.get("uri", "?")}')
    print()
    print('🎉 Done!')
    print()
    feed_uri = f'at://{PUBLISHER_DID}/app.bsky.feed.generator/{FEED_SLUG}'
    print(f'Feed URI: {feed_uri}')
    print(f'Share this with users or search for "Quiet Mindscape" on Bluesky.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'❌ {e}')
        sys.exit(1)
