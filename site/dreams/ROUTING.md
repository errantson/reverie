# Dream Routing & Deployment Guide

## Current Routing Setup

All dreams are accessible via:
```
https://reverie.house/dreams/<dream-name>
```

### Active Dreams

1. **avonlea.town**
   - URL: https://reverie.house/dreams/avonlea.town
   - Type: RPG Maker MZ game
   - Created: November 13, 2024

2. **flawed.center**
   - URL: https://reverie.house/dreams/flawed.center
   - Type: Interactive explorable
   - Created: November 21, 2025

3. **Dreams Directory**
   - URL: https://reverie.house/dreams
   - Lists all available dreams

## Caddy Configuration

The routing is configured in both `/srv/caddy/Caddyfile` and `/srv/caddy/caddy.hard`:

```caddyfile
# Dreams system - individual dream routes
handle /dreams/avonlea.town* {
    root * /srv/site/dreams/avonlea.town
    try_files {path} /index.html
    file_server
}

handle /dreams/flawed.center* {
    root * /srv/site/dreams/flawed.center
    try_files {path} /index.html
    file_server
}

# Dreams directory/index
handle /dreams* {
    root * /srv/site
    try_files {path} /dreams/index.html
    file_server
}
```

### How It Works

1. **Specific dream routes** (`/dreams/avonlea.town*`) are matched first
2. Each dream gets its own document root
3. `try_files` ensures all paths fall back to the dream's `index.html` (SPA behavior)
4. The generic `/dreams*` handler serves the directory listing

## Adding a New Dream

### 1. Create Dream Directory

```bash
cd /srv/site/dreams
cp -r _templates/basic my-new-dream
cd my-new-dream
```

### 2. Update Dream Files

Update placeholders in:
- `dream.json` - Set dreamId to "my-new-dream"
- `index.html` - Update title and meta tags
- `js/main.js` - Set dreamId in runtime config

### 3. Add Caddy Route

Edit `/srv/caddy/caddy.hard` and add before the generic `/dreams*` handler:

```caddyfile
handle /dreams/my-new-dream* {
    root * /srv/site/dreams/my-new-dream
    try_files {path} /index.html
    file_server
}
```

### 4. Update Dreams Index

Edit `/srv/site/dreams/index.html` to add a card for your dream:

```html
<a href="/dreams/my-new-dream" class="dream-card">
    <h2>my-new-dream</h2>
    <div class="dream-meta">
        Type • Created Date
    </div>
    <div class="dream-description">
        Description of your dream...
    </div>
    <div class="dream-tags">
        <span class="dream-tag">Tag1</span>
        <span class="dream-tag">Tag2</span>
    </div>
</a>
```

### 5. Reload Caddy

```bash
# Copy updated config
cp /srv/caddy/caddy.hard /srv/caddy/Caddyfile

# Reload Caddy
sudo docker restart caddy
# OR
curl -X POST http://localhost:2222/load \
  -H "Content-Type: application/json" \
  -d @/srv/caddy/Caddyfile
```

### 6. Test

```bash
# Visit in browser:
https://reverie.house/dreams/my-new-dream

# Check Caddy logs:
tail -f /srv/logs/access.log
```

## Alternative: Subdomain Routing

If you want to use subdomains (e.g., `flawed.center` or `avonlea.town` as standalone domains):

### Option A: Subdomain on reverie.house

```caddyfile
# Add to Caddyfile
flawed-center.reverie.house {
    import log_config
    
    root * /srv/site/dreams/flawed.center
    try_files {path} /index.html
    file_server
    
    # API access
    handle /api/* {
        reverse_proxy localhost:4444
    }
}
```

### Option B: Separate Domain

```caddyfile
# Add to Caddyfile
flawed.center {
    import log_config
    
    root * /srv/site/dreams/flawed.center
    try_files {path} /index.html
    file_server
    
    # API access
    handle /api/* {
        reverse_proxy localhost:4444
    }
}
```

Then configure DNS:
```
A    flawed.center         → <server-ip>
AAAA flawed.center         → <server-ipv6>
```

## URL Structure Comparison

### Current: Path-based (Recommended)
```
✅ https://reverie.house/dreams/avonlea.town
✅ https://reverie.house/dreams/flawed.center
✅ https://reverie.house/dreams
```

**Pros:**
- Single SSL certificate
- Easy to add new dreams (no DNS changes)
- Clear hierarchy
- Shared session/cookies
- No CORS issues with main site

**Cons:**
- Longer URLs
- Dreams don't have "independent" identity

### Alternative: Subdomain-based

```
https://avonlea-town.reverie.house
https://flawed-center.reverie.house
```

**Pros:**
- Cleaner URLs
- Each dream feels independent
- Can use wildcard SSL

**Cons:**
- Requires Caddy config update per dream
- Subdomain name restrictions (no dots)
- Cookie/session complexity

### Alternative: Separate Domains

```
https://avonlea.town
https://flawed.center
```

**Pros:**
- Maximum independence
- Memorable URLs
- Each dream has its own identity

**Cons:**
- Requires domain purchase per dream
- DNS configuration per dream
- Separate SSL certificates
- More complex auth sharing

## Current Choice: Path-based

We're using path-based routing (`/dreams/<name>`) because:

1. **Simplicity**: No DNS configuration needed for new dreams
2. **Cost**: No additional domain purchases
3. **Integration**: Seamless with main site (auth, API, sessions)
4. **Flexibility**: Easy to change later
5. **Consistency**: Follows pattern of `/books`, `/spectrum`, etc.

## Testing Your Dream

### Local Testing

```bash
# Start local server
cd /srv
python3 -m http.server 8080

# Visit:
http://localhost:8080/site/dreams/my-new-dream/
```

### Production Testing

```bash
# After deployment:
curl -I https://reverie.house/dreams/my-new-dream

# Should return:
HTTP/2 200
content-type: text/html
```

### Debug Checklist

- [ ] Dream files exist in `/srv/site/dreams/<name>/`
- [ ] `index.html` exists at root of dream directory
- [ ] Caddy route added to `caddy.hard`
- [ ] Caddyfile updated from caddy.hard
- [ ] Caddy reloaded
- [ ] No errors in `/srv/logs/access.log`
- [ ] Browser console shows no 404s
- [ ] Dream listed in `/dreams` index

## API Access

Dreams can access the main Reverie API at `/api/*` endpoints:

```javascript
// From dream JavaScript:
const response = await fetch('/api/dreamers');
const dreamers = await response.json();
```

This works because the API is proxied at the root level, accessible from all paths.

## Static Assets

Dreams should reference their assets relatively:

```html
<!-- Correct: -->
<img src="./assets/backdrop.png">
<script src="./js/main.js"></script>

<!-- Incorrect (will break): -->
<img src="/assets/backdrop.png">
<script src="/js/main.js"></script>
```

Or use absolute paths from dream root:

```html
<img src="/dreams/my-dream/assets/backdrop.png">
```

## Shared Resources

Dreams can use shared infrastructure:

```html
<!-- Shared dream runtime -->
<script type="module" src="../_shared/js/dream-runtime.js"></script>
<link rel="stylesheet" href="../_shared/css/dream-core.css">

<!-- Main site utilities -->
<script src="/js/core/world-config-cache.js"></script>
<script src="/js/utils/shadowbox.js"></script>
```

## Summary

Current setup provides:
- ✅ Simple deployment process
- ✅ No DNS changes needed
- ✅ Consistent URL structure
- ✅ Easy API access
- ✅ Shared authentication
- ✅ Clear navigation hierarchy

Access your dreams at:
- **avonlea.town**: https://reverie.house/dreams/avonlea.town
- **flawed.center**: https://reverie.house/dreams/flawed.center
- **All dreams**: https://reverie.house/dreams
