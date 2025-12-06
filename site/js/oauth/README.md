# OAuth Implementation with AT Protocol SDK

This directory contains the OAuth authentication implementation for Reverie House using the official `@atproto/oauth-client-browser` SDK.

## Architecture

- **SDK**: `@atproto/oauth-client-browser` v0.3.34
- **Bundler**: Vite 5 (minimal build setup)
- **Client Type**: Public client (SPA pattern)
- **Session Storage**: IndexedDB (managed by SDK)

## Files

### Source Files (`/srv/site/js/oauth/src/`)
- `oauth-manager.js` - OAuth client wrapper using BrowserOAuthClient SDK
- `oauth-callback.js` - OAuth callback handler

### Build Output (`/srv/site/js/widgets/`)
- `oauth-manager.js` - Bundled OAuth manager (~464KB with SDK)
- `oauth-callback.js` - Bundled callback handler (~1KB)

### Configuration
- `package.json` - Dependencies and build scripts
- `vite.config.js` - Build configuration

## Building

```bash
cd /srv/site/js/oauth
npm install
npm run build        # One-time build
npm run dev          # Watch mode for development
```

## How It Works

### 1. Initialization
The OAuth manager auto-initializes when loaded:
```javascript
window.oauthManager.init()
```

This:
- Creates a `BrowserOAuthClient` instance
- Checks for existing sessions (restores from IndexedDB)
- Handles OAuth callback if URL contains auth response
- Dispatches `oauth:login` events on successful auth

### 2. Login Flow

**Bluesky Login (Simplified)**:
```javascript
await oauthManager.loginWithBluesky()
```
- Redirects to bsky.social OAuth page
- User enters their handle there
- Returns to `/oauth/callback` after authorization

**Custom Handle Login**:
```javascript
await oauthManager.login('alice.bsky.social')
```
- Resolves handle to DID
- Discovers user's PDS
- Redirects to appropriate OAuth server

### 3. Session Management

The SDK automatically handles:
- DPoP key generation and proofs
- Token exchange with PKCE
- Token refresh
- Session persistence in IndexedDB
- Session invalidation events

### 4. Events

The OAuth manager dispatches custom events:

- `oauth:login` - User successfully authenticated
  ```javascript
  window.addEventListener('oauth:login', (e) => {
    console.log('User logged in:', e.detail.session)
  })
  ```

- `oauth:logout` - User logged out or session deleted
  ```javascript
  window.addEventListener('oauth:logout', (e) => {
    console.log('User logged out')
  })
  ```

## Features

### ✅ Implemented
- Official AT Protocol SDK integration
- Automatic DPoP handling
- PKCE support
- Session restoration across page loads
- Token refresh
- Profile loading with avatar support
- Bluesky simplified login
- Custom handle login
- Session revocation

### 🔄 Automatic (SDK Managed)
- DPoP key pair generation (ES256)
- DPoP proof creation and signing
- DPoP nonce challenge handling
- Token storage and security
- Session lifecycle management

### 🚫 Not Needed Anymore
- Manual DPoP implementation
- Manual token exchange
- Manual handle resolution (SDK uses our configured resolver)
- SessionStorage token management (SDK uses IndexedDB)

## SDK Advantages

1. **Security**: Proper token storage, automatic rotation, secure key management
2. **Reliability**: Handles edge cases (nonces, errors, retries)
3. **Maintenance**: Updates and fixes from AT Protocol team
4. **Standards**: Follows AT Protocol OAuth 2.1 spec exactly
5. **Features**: Token refresh, multi-session support, events

## Configuration

The client metadata is burned into the code for performance (vs fetching it):

```javascript
{
  client_id: "https://reverie.house/client-metadata.json",
  client_name: "Reverie House",
  redirect_uris: ["https://reverie.house/oauth/callback"],
  scope: "atproto",
  grant_types: ["authorization_code", "refresh_token"],
  dpop_bound_access_tokens: true,
  // ... see oauth-manager.js for complete metadata
}
```

Handle resolution uses `bsky.social` as the resolver service.

## Upgrading

To update the SDK:
```bash
cd /srv/site/js/oauth
npm update @atproto/oauth-client-browser
npm run build
```

## Future: BFF Pattern

For production deployments with long-lived sessions, consider migrating to the BFF (Backend For Frontend) pattern:

- Use `@atproto/oauth-client-node` on the server (admin.py or reverie2.py)
- Server manages OAuth sessions
- Frontend proxies requests through server
- Longer token lifetimes (confidential client)
- Better security (tokens never in browser)

See: https://atproto.com/specs/oauth

## Debugging

Enable SDK logging in browser console:
```javascript
localStorage.setItem('DEBUG', '@atproto/*')
```

Check current session:
```javascript
window.oauthManager.getSession()
```

View IndexedDB sessions:
- Open DevTools → Application → IndexedDB → `@atproto-oauth-client`
