"""
Utility Routes
Simple utility endpoints for the Reverie House API
"""

from flask import Blueprint, request, Response, jsonify
import requests
from io import BytesIO
from urllib.parse import urlparse
import ipaddress
import socket
import re
import dns.resolver

bp = Blueprint('util', __name__, url_prefix='/api')

# === AT PROTOCOL IMAGE PROXY SECURITY ===
#
# FUTURE-PROOF APPROACH:
# Instead of maintaining a list of allowed PDS hosts, we validate the URL STRUCTURE.
# Any HTTPS host with a valid ATProto image path is allowed, as long as it:
# 1. Uses HTTPS
# 2. Has a valid ATProto image path (getBlob, /img/avatar/, etc.)
# 3. Resolves to a PUBLIC IP (not internal/private/loopback)
# 4. Returns actual image content
# 5. Is under size limit
#
# This works for ANY PDS: bsky.social, blacksky.social, witchcraft.systems,
# self-hosted servers, future PDS providers, etc. - NO MANUAL UPDATES NEEDED.
#
# The path validation is the key security control - attackers can't use
# generic URLs to probe internal services.

# Trusted CDN hosts - skip path validation for performance (they only serve images)
TRUSTED_CDN_HOSTS = {
    'cdn.bsky.app',
    'av-cdn.bsky.app',
    'cdn.bsky.social',
}

# Valid ATProto image paths that we'll proxy
# These are specific enough to prevent abuse while covering all legitimate image sources
VALID_ATPROTO_PATHS = [
    '/xrpc/com.atproto.sync.getBlob',  # Direct blob access from any PDS
    '/img/avatar/',                     # CDN-style avatar paths
    '/img/banner/',                     # CDN-style banner paths
    '/img/feed_thumbnail/',             # CDN-style thumbnails
    '/img/feed_fullsize/',              # CDN-style full images
]

# Maximum image size (5MB)
MAX_IMAGE_SIZE = 5 * 1024 * 1024


def is_trusted_cdn(hostname: str) -> bool:
    """Check if hostname is a trusted CDN (skip path validation)."""
    return hostname in TRUSTED_CDN_HOSTS


def has_valid_atproto_path(path: str) -> bool:
    """Check if URL path matches a valid ATProto image path."""
    for valid_path in VALID_ATPROTO_PATHS:
        if path.startswith(valid_path):
            return True
    return False


def is_safe_url(url: str) -> tuple[bool, str]:
    """
    Validate that a URL is safe to proxy.
    
    FUTURE-PROOF: Works with ANY PDS as long as it has valid ATProto paths
    and doesn't resolve to internal IPs.
    
    Returns: (is_safe, error_message)
    """
    try:
        parsed = urlparse(url)
        
        # Must be HTTPS
        if parsed.scheme != 'https':
            return False, 'Only HTTPS URLs are allowed'
        
        # Must have a valid host
        if not parsed.netloc:
            return False, 'Invalid URL: no host'
        
        hostname = parsed.hostname
        if not hostname:
            return False, 'Invalid URL: no hostname'
        
        # Trusted CDNs can use any path
        if is_trusted_cdn(hostname):
            pass  # Skip path validation, continue to IP check
        # For all other hosts, validate the path is ATProto-specific
        elif not has_valid_atproto_path(parsed.path):
            return False, f'Invalid path. Must be an ATProto image path like /xrpc/com.atproto.sync.getBlob or /img/avatar/'
        
        # CRITICAL: Block internal/private IPs (SSRF protection)
        # This is the main security control for unknown hosts
        try:
            ip_addresses = socket.getaddrinfo(hostname, None)
            for family, type_, proto, canonname, sockaddr in ip_addresses:
                ip = sockaddr[0]
                ip_obj = ipaddress.ip_address(ip)
                
                # Block any internal addressing
                if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved:
                    return False, 'Internal/private IP addresses are not allowed'
        except socket.gaierror:
            return False, 'Could not resolve hostname'
        
        # URL is safe: HTTPS + valid ATProto path + public IP
        return True, ''
        
    except Exception as e:
        return False, f'URL validation error: {str(e)}'


@bp.route('/proxy-image', methods=['GET'])
def proxy_image():
    """
    Proxy external images to avoid CORS issues.
    Works with ANY ATProto PDS that uses standard image paths.
    
    Usage: /api/proxy-image?url=https://cdn.bsky.app/image.jpg
           /api/proxy-image?url=https://my-pds.com/xrpc/com.atproto.sync.getBlob?did=...
    
    Security: Validates URLs to prevent SSRF attacks.
    """
    try:
        image_url = request.args.get('url')
        if not image_url:
            return {'error': 'Missing url parameter'}, 400
        
        # Validate URL is safe to fetch
        is_safe, error_msg = is_safe_url(image_url)
        if not is_safe:
            return {'error': error_msg}, 403
        
        # Fetch the image with size limit
        response = requests.get(
            image_url, 
            timeout=10, 
            headers={'User-Agent': 'ReverieHouse/1.0'},
            stream=True
        )
        
        if response.status_code != 200:
            return {'error': 'Failed to fetch image'}, response.status_code
        
        # Check content-type is an image
        content_type = response.headers.get('content-type', '')
        if not content_type.startswith('image/'):
            return {'error': 'URL does not point to an image'}, 400
        
        # Check content-length if provided
        content_length = response.headers.get('content-length')
        if content_length and int(content_length) > MAX_IMAGE_SIZE:
            return {'error': 'Image too large'}, 413
        
        # Read with size limit
        content = b''
        for chunk in response.iter_content(chunk_size=8192):
            content += chunk
            if len(content) > MAX_IMAGE_SIZE:
                return {'error': 'Image too large'}, 413
        
        # Return the image with proper headers
        return Response(
            content,
            mimetype=content_type,
            headers={
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': '*'
            }
        )
        
    except requests.RequestException as e:
        return {'error': f'Request failed: {str(e)}'}, 500
    except Exception as e:
        return {'error': f'Proxy error: {str(e)}'}, 500


# Handle validation: only allow safe characters (letters, digits, dots, hyphens)
HANDLE_RE = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9._-]{0,252}$')


@bp.route('/resolve-handle', methods=['GET'])
def resolve_handle():
    """
    Resolve an AT Protocol handle to a DID — independently of Bluesky.
    Tries DNS TXT (_atproto.<handle>) first, then HTTPS .well-known/atproto-did.
    Returns: { "did": "did:plc:..." }
    """
    handle = request.args.get('handle', '').strip().lstrip('@')
    if not handle or not HANDLE_RE.match(handle):
        return jsonify({'error': 'InvalidRequest', 'message': 'Invalid handle'}), 400

    did = None

    # 1. DNS TXT: _atproto.<handle>
    try:
        answers = dns.resolver.resolve(f'_atproto.{handle}', 'TXT', lifetime=5)
        for rdata in answers:
            txt = rdata.to_text().strip('"')
            if txt.startswith('did='):
                candidate = txt[4:]
                if candidate.startswith('did:'):
                    did = candidate
                    break
    except Exception:
        pass

    # 2. HTTPS .well-known/atproto-did
    if not did:
        try:
            resp = requests.get(
                f'https://{handle}/.well-known/atproto-did',
                timeout=5,
                allow_redirects=False,
                headers={'User-Agent': 'ReverieHouse/1.0'}
            )
            if resp.status_code == 200:
                candidate = resp.text.strip().split('\n')[0].strip()
                if candidate.startswith('did:'):
                    did = candidate
        except Exception:
            pass

    if did:
        return jsonify({'did': did}), 200, {'Cache-Control': 'public, max-age=300'}

    return jsonify({
        'error': 'InvalidRequest',
        'message': 'Unable to resolve handle'
    }), 400
