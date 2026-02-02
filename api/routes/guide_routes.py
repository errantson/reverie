"""
API Guide Routes
Provides comprehensive documentation for external services accessing Reverie House public APIs.

This endpoint serves as a self-documenting guide for probes, bots, and external services
that want to integrate with Reverie House data. No authentication required.
"""

from flask import Blueprint, jsonify, request
import time

bp = Blueprint('guide', __name__, url_prefix='/api')


def get_api_guide():
    """Generate the complete API documentation"""
    
    return {
        "meta": {
            "service": "Reverie House",
            "description": "A social dream layer for the AT Protocol / Bluesky ecosystem",
            "version": "1.0",
            "base_url": "https://reverie.house",
            "documentation_generated": int(time.time()),
            "contact": "errantson.bsky.social",
            "rate_limiting": {
                "default": "100 requests/minute per IP",
                "note": "Rate limits vary by endpoint. Respect 429 responses and Retry-After headers."
            },
            "data_format": "JSON",
            "cors": "Enabled for all origins on public endpoints"
        },
        
        "concepts": {
            "dreamers": {
                "description": "Users who have interacted with Reverie House. Each dreamer has a unique AT Protocol DID.",
                "identifier": "DID (Decentralized Identifier) - e.g., did:plc:abc123...",
                "attributes": [
                    "handle - AT Protocol handle (e.g., user.bsky.social)",
                    "name - Short name extracted from handle",
                    "display_name - User's chosen display name",
                    "avatar - URL to avatar image",
                    "banner - URL to banner image",
                    "server - PDS (Personal Data Server) URL",
                    "arrival - Unix epoch when user joined Reverie",
                    "color_hex - User's chosen color (#RRGGBB)",
                    "spectrum - Personality spectrum values",
                    "phanera - Selected souvenir for display"
                ]
            },
            "spectrum": {
                "description": "A six-axis personality visualization derived algorithmically from a user's DID and PDS.",
                "axes": {
                    "entropy": "0-100, tendency toward chaos vs order",
                    "oblivion": "0-100, comfort with the unknown",
                    "liberty": "0-100, value of freedom",
                    "authority": "0-100, value of structure",
                    "receptive": "0-100, openness to new ideas",
                    "skeptic": "0-100, critical thinking tendency"
                },
                "octant": "A 6-character code representing the dominant tendencies (e.g., 'EOLARS')",
                "origin_values": "The original calculated spectrum values, preserved even if user modifies current"
            },
            "souvenirs": {
                "description": "Collectible achievements that dreamers earn through participation.",
                "attributes": [
                    "key - Unique identifier (e.g., 'dream/strange')",
                    "category - Category grouping",
                    "name - Display name",
                    "description - What it represents",
                    "phanera - Visual representation path",
                    "keepers - List of dreamers who have earned it"
                ]
            },
            "heraldry": {
                "description": "PDS community badges. Each PDS domain can have heraldry managed by an ambassador.",
                "attributes": [
                    "name - Community name",
                    "description - Community description",
                    "color_primary - Primary brand color",
                    "color_secondary - Secondary brand color",
                    "icon_path - Path to community icon",
                    "domains - List of PDS domains covered",
                    "ambassador_did - DID of community ambassador"
                ]
            },
            "events": {
                "description": "Historical log of dreamer activities - arrivals, achievements, contributions.",
                "types": [
                    "arrival - When a dreamer first joined",
                    "souvenir - When a dreamer earned a collectible",
                    "order - Book purchases",
                    "name - Name changes",
                    "origin - Origin story updates"
                ]
            },
            "kindred": {
                "description": "Bidirectional connections between dreamers who share spectrum similarity.",
                "note": "Kindred relationships are stored once but apply in both directions."
            }
        },
        
        "public_endpoints": {
            
            "dreamers": {
                "list_all": {
                    "method": "GET",
                    "path": "/api/dreamers",
                    "description": "Get all dreamers with full profile data, spectrum, souvenirs, and kindred connections.",
                    "parameters": None,
                    "response": {
                        "type": "array",
                        "items": "Dreamer objects with nested spectrum, souvenirs{}, kindred[]"
                    },
                    "example": "GET https://reverie.house/api/dreamers",
                    "use_cases": [
                        "Building a directory of all Reverie users",
                        "Analyzing spectrum distributions",
                        "Finding users by criteria",
                        "Syncing user data to external services"
                    ]
                },
                "recent": {
                    "method": "GET",
                    "path": "/api/dreamers/recent",
                    "description": "Get the most recently joined dreamers.",
                    "parameters": {
                        "limit": "Number of results (1-50, default 10)"
                    },
                    "example": "GET https://reverie.house/api/dreamers/recent?limit=5"
                },
                "active": {
                    "method": "GET",
                    "path": "/api/dreamers/active",
                    "description": "Get the most active dreamers by lore contribution count.",
                    "parameters": {
                        "limit": "Number of results (1-20, default 3)"
                    },
                    "example": "GET https://reverie.house/api/dreamers/active?limit=10"
                },
                "newcomers_today": {
                    "method": "GET",
                    "path": "/api/dreamers/stats/newcomers-today",
                    "description": "Get count of dreamers who joined today.",
                    "response": {
                        "count": "Number of new dreamers",
                        "date": "Today's date (YYYY-MM-DD)"
                    }
                },
                "by_did": {
                    "method": "GET",
                    "path": "/api/dreamers/<did>",
                    "description": "Get a single dreamer by their DID.",
                    "parameters": {
                        "did": "The dreamer's DID (URL parameter)"
                    },
                    "example": "GET https://reverie.house/api/dreamers/did:plc:abc123..."
                },
                "by_handle": {
                    "method": "GET",
                    "path": "/api/dreamer/by-handle/<handle>",
                    "description": "Get a dreamer by their handle (case-insensitive).",
                    "parameters": {
                        "handle": "Full handle including domain (e.g., user.bsky.social)"
                    },
                    "example": "GET https://reverie.house/api/dreamer/by-handle/errantson.bsky.social"
                },
                "check_exists": {
                    "method": "GET",
                    "path": "/api/dreamer/check",
                    "description": "Check if a dreamer exists in the database.",
                    "parameters": {
                        "did": "The DID to check (query parameter)"
                    },
                    "response": {
                        "exists": "boolean",
                        "dreamer": "Basic dreamer info if exists"
                    },
                    "example": "GET https://reverie.house/api/dreamer/check?did=did:plc:abc123..."
                },
                "contribution": {
                    "method": "GET",
                    "path": "/api/dreamer/contribution",
                    "description": "Calculate contribution score based on lore.farm tags with temporal/contextual weighting.",
                    "parameters": {
                        "did": "The DID to calculate contribution for (required)",
                        "detailed": "Set to 'true' to include timeline breakdown (optional)"
                    },
                    "response": {
                        "score": "Calculated contribution score",
                        "timeline": "(if detailed=true) Breakdown of contributions over time"
                    },
                    "example": "GET https://reverie.house/api/dreamer/contribution?did=did:plc:abc123...&detailed=true"
                },
                "minimal_profile": {
                    "method": "GET",
                    "path": "/api/dreamer/did/<did>",
                    "description": "Get minimal dreamer profile by DID (for lightweight lookups).",
                    "parameters": {
                        "did": "The DID (URL parameter)"
                    },
                    "response": {
                        "did": "DID",
                        "handle": "Handle",
                        "name": "Short name",
                        "display_name": "Display name",
                        "avatar": "Avatar URL"
                    },
                    "example": "GET https://reverie.house/api/dreamer/did/did:plc:abc123..."
                }
            },
            
            "spectrum": {
                "calculate": {
                    "method": "GET",
                    "path": "/api/spectrum/calculate",
                    "description": "Calculate spectrum for ANY DID or handle on-the-fly. Does not require the user to be in Reverie's database.",
                    "parameters": {
                        "handle": "Full handle (e.g., user.bsky.social)",
                        "did": "OR a DID (did:plc:...)"
                    },
                    "response": {
                        "did": "Resolved DID",
                        "handle": "User's handle",
                        "display_name": "User's display name",
                        "avatar": "Avatar URL",
                        "server": "PDS URL",
                        "spectrum": {
                            "entropy": "0-100",
                            "oblivion": "0-100",
                            "liberty": "0-100",
                            "authority": "0-100",
                            "receptive": "0-100",
                            "skeptic": "0-100",
                            "octant": "6-character code"
                        }
                    },
                    "example": "GET https://reverie.house/api/spectrum/calculate?handle=user.bsky.social",
                    "use_cases": [
                        "Show spectrum for any Bluesky user",
                        "Build spectrum comparison tools",
                        "Pre-calculate spectrum before registration"
                    ]
                },
                "origin": {
                    "method": "GET",
                    "path": "/api/spectrum/origin/<handle>",
                    "description": "Get a dreamer's origin spectrum values (the original calculation).",
                    "parameters": {
                        "handle": "User's handle (URL parameter)"
                    },
                    "example": "GET https://reverie.house/api/spectrum/origin/errantson.bsky.social"
                },
                "generate_image": {
                    "method": "GET",
                    "path": "/api/spectrum/generate-image/<handle>",
                    "description": "Generate and return a PNG spectrum visualization image.",
                    "parameters": {
                        "handle": "User's handle (URL parameter)"
                    },
                    "response": "PNG image data",
                    "example": "GET https://reverie.house/api/spectrum/generate-image/user.bsky.social"
                }
            },
            
            "events": {
                "list": {
                    "method": "GET",
                    "path": "/api/events",
                    "description": "Get events (world history), optionally filtered.",
                    "parameters": {
                        "did": "Filter by dreamer DID (optional)",
                        "limit": "Max results (default 20)",
                        "type": "Filter by event type (optional)"
                    },
                    "example": "GET https://reverie.house/api/events?limit=50&type=arrival"
                }
            },
            
            "souvenirs": {
                "list": {
                    "method": "GET",
                    "path": "/api/souvenirs",
                    "description": "Get all souvenirs with their keepers and canon entries.",
                    "response": {
                        "type": "object",
                        "keys": "Souvenir keys",
                        "values": "Souvenir objects with keepers[] and canon[]"
                    },
                    "example": "GET https://reverie.house/api/souvenirs"
                }
            },
            
            "heraldry": {
                "list_all": {
                    "method": "GET",
                    "path": "/api/heraldry",
                    "description": "Get all heraldry entries (PDS community badges).",
                    "response": "Array of heraldry objects with domains[]",
                    "example": "GET https://reverie.house/api/heraldry"
                },
                "by_id": {
                    "method": "GET",
                    "path": "/api/heraldry/<id>",
                    "description": "Get a specific heraldry entry by ID.",
                    "parameters": {
                        "id": "Heraldry ID (integer, URL parameter)"
                    },
                    "example": "GET https://reverie.house/api/heraldry/1"
                },
                "for_domain": {
                    "method": "GET",
                    "path": "/api/heraldry/for-domain/<domain>",
                    "description": "Get heraldry for a specific PDS domain.",
                    "parameters": {
                        "domain": "PDS domain (e.g., bsky.social)"
                    },
                    "example": "GET https://reverie.house/api/heraldry/for-domain/bsky.social"
                },
                "coterie": {
                    "method": "GET",
                    "path": "/api/heraldry/<id>/coterie",
                    "description": "Get all dreamers (coterie) from a heraldry's PDS domains.",
                    "parameters": {
                        "id": "Heraldry ID (integer, URL parameter)"
                    },
                    "response": "Array of dreamer objects from that PDS community",
                    "example": "GET https://reverie.house/api/heraldry/1/coterie"
                }
            },
            
            "formers": {
                "lookup": {
                    "method": "GET",
                    "path": "/api/formers/<identifier>",
                    "description": "Get archived data for departed dreamers (users who have left).",
                    "parameters": {
                        "identifier": "DID or handle of the former member"
                    },
                    "response": {
                        "did": "Original DID",
                        "handle": "Original handle",
                        "avatar_archived": "Local copy of avatar",
                        "departure_date": "When they left"
                    },
                    "example": "GET https://reverie.house/api/formers/did:plc:abc123..."
                }
            },
            
            "game_integration": {
                "_description": "Simple endpoints for external games/dreams to register users and record events. No authentication required - works just like the greeter quest.",
                
                "register": {
                    "method": "POST",
                    "path": "/api/game/register",
                    "description": "Register a new dreamer from a game. Same flow as greeter quest - if user exists, returns their info. If new, creates them.",
                    "request_body": {
                        "did": "(required) User's AT Protocol DID - e.g. did:plc:abc123...",
                        "handle": "(optional) User's handle - will be resolved from DID if not provided",
                        "name": "(optional) Proposed name - will derive from handle if not provided",
                        "source": "(optional) Game identifier - e.g. 'avonlea.town'"
                    },
                    "response": {
                        "success": "boolean",
                        "newly_registered": "true if this created a new dreamer",
                        "dreamer": {"did": "...", "name": "...", "handle": "..."}
                    },
                    "example": "POST https://reverie.house/api/game/register\nBody: {\"did\": \"did:plc:abc123\", \"handle\": \"alice.bsky.social\", \"source\": \"avonlea.town\"}",
                    "notes": [
                        "Returns existing dreamer if DID is already registered",
                        "Uses same registration logic as OAuth login and greeter quest",
                        "Creates arrival canon event with game source"
                    ]
                },
                
                "lookup_user": {
                    "method": "GET",
                    "path": "/api/game/user/<identifier>",
                    "description": "Look up a dreamer by DID or handle. Returns full profile with spectrum.",
                    "parameters": {
                        "identifier": "DID (did:plc:...) or handle (alice.bsky.social)"
                    },
                    "response": {
                        "did": "User's DID",
                        "handle": "User's handle",
                        "name": "Reverie name",
                        "display_name": "Display name",
                        "avatar": "Avatar URL",
                        "spectrum": {"entropy": 50, "oblivion": 30, "...": "..."}
                    },
                    "example": "GET https://reverie.house/api/game/user/did:plc:abc123"
                },
                
                "check_exists": {
                    "method": "GET",
                    "path": "/api/game/exists/<identifier>",
                    "description": "Quick check if user is registered. Lightweight - good for login flows.",
                    "parameters": {
                        "identifier": "DID or handle"
                    },
                    "response": {
                        "exists": "boolean",
                        "name": "Reverie name if exists"
                    },
                    "example": "GET https://reverie.house/api/game/exists/did:plc:abc123"
                },
                
                "write_canon": {
                    "method": "POST",
                    "path": "/api/game/canon",
                    "description": "Record a game event to a dreamer's canon timeline.",
                    "request_body": {
                        "did": "(required) User's DID",
                        "event": "(required) Event description - e.g. 'defeated the dragon'",
                        "source": "(optional) Game identifier",
                        "context": "(optional) Additional data object"
                    },
                    "response": {
                        "success": "boolean",
                        "timestamp": "Unix epoch when recorded"
                    },
                    "example": "POST https://reverie.house/api/game/canon\nBody: {\"did\": \"did:plc:abc123\", \"event\": \"completed the main quest\", \"source\": \"avonlea.town\"}",
                    "notes": [
                        "User must be registered first",
                        "Events appear in user's canon timeline",
                        "Context data stored in event quantities field"
                    ]
                },
                
                "health": {
                    "method": "GET",
                    "path": "/api/game/health",
                    "description": "Simple health check for game API.",
                    "example": "GET https://reverie.house/api/game/health"
                }
            },
            
            "utilities": {
                "proxy_image": {
                    "method": "GET",
                    "path": "/api/proxy-image",
                    "description": "Proxy external AT Protocol images to avoid CORS issues. Works with any PDS.",
                    "parameters": {
                        "url": "HTTPS URL to an AT Protocol image"
                    },
                    "security": [
                        "Only HTTPS URLs allowed",
                        "Must be valid ATProto image path (/xrpc/com.atproto.sync.getBlob, /img/avatar/, etc.)",
                        "Internal/private IPs blocked (SSRF protection)",
                        "5MB max size"
                    ],
                    "example": "GET https://reverie.house/api/proxy-image?url=https://cdn.bsky.app/img/avatar/..."
                },
                "check_handle": {
                    "method": "GET",
                    "path": "/api/check-handle",
                    "description": "Check if a handle is available for Reverie House PDS registration.",
                    "parameters": {
                        "handle": "Desired handle (without .reverie.house suffix)"
                    },
                    "example": "GET https://reverie.house/api/check-handle?handle=newuser"
                },
                "auth_status": {
                    "method": "GET",
                    "path": "/api/auth-status",
                    "description": "Check authentication status for current session.",
                    "note": "Returns limited info without valid auth"
                },
                "generate_facets": {
                    "method": "POST",
                    "path": "/api/spectrum/generate-facets",
                    "description": "Generate AT Protocol facets for @mentions in post text.",
                    "request_body": {
                        "text": "Post text with @mentions"
                    },
                    "response": {
                        "facets": "Array of AT Protocol facet objects",
                        "count": "Number of facets generated"
                    },
                    "example_request": "POST https://reverie.house/api/spectrum/generate-facets\nBody: {\"text\": \"Hello @errantson.bsky.social!\"}"
                },
                "guide": {
                    "method": "GET",
                    "path": "/api/guide",
                    "description": "This endpoint! Complete API documentation for external services.",
                    "variants": [
                        "/api/guide - Full documentation",
                        "/api/guide/endpoints - Just endpoints",
                        "/api/guide/concepts - Just concepts",
                        "/api/guide/patterns - Integration patterns",
                        "/api/guide/health - Simple health check"
                    ]
                }
            }
        },
        
        "data_relationships": {
            "dreamer_to_spectrum": "1:1 - Each dreamer has exactly one spectrum record",
            "dreamer_to_souvenirs": "1:many - Dreamers can earn multiple souvenirs",
            "dreamer_to_kindred": "many:many - Bidirectional kindred connections",
            "dreamer_to_events": "1:many - Dreamers can have many events",
            "heraldry_to_domains": "1:many - Heraldry covers multiple PDS domains",
            "heraldry_to_dreamers": "1:many via domain - Dreamers belong to heraldry by their PDS"
        },
        
        "integration_patterns": {
            "game_integration": {
                "description": "Integrate a game or dream with Reverie House user system",
                "steps": [
                    "1. When user logs into your game (via Bluesky OAuth), you have their DID",
                    "2. GET /api/game/exists/<did> - Check if they're already a dreamer",
                    "3. If not: POST /api/game/register with {did, handle, source: 'your-game'}",
                    "4. GET /api/game/user/<did> - Fetch their spectrum and profile data",
                    "5. POST /api/game/canon - Record game events to their timeline"
                ],
                "example_flow": {
                    "check": "GET /api/game/exists/did:plc:abc123",
                    "register": "POST /api/game/register {did, handle, source}",
                    "get_spectrum": "GET /api/game/user/did:plc:abc123",
                    "record_event": "POST /api/game/canon {did, event, source}"
                },
                "note": "No API keys needed - registration is open like the greeter quest"
            },
            "full_sync": {
                "description": "Sync all Reverie data to your service",
                "steps": [
                    "1. GET /api/dreamers - Get all users with spectrum and souvenirs",
                    "2. GET /api/souvenirs - Get souvenir definitions and keepers",
                    "3. GET /api/heraldry - Get PDS community data",
                    "4. GET /api/events?limit=1000 - Get recent history"
                ],
                "recommended_interval": "Every 5-15 minutes for active sync"
            },
            "user_lookup": {
                "description": "Look up a specific user",
                "by_did": "GET /api/dreamers/<did>",
                "by_handle": "GET /api/dreamer/by-handle/<handle>",
                "spectrum_only": "GET /api/spectrum/calculate?handle=<handle>"
            },
            "spectrum_widget": {
                "description": "Embed spectrum visualization",
                "steps": [
                    "1. GET /api/spectrum/calculate?handle=<handle>",
                    "2. Use returned values to render your own visualization",
                    "3. OR use /api/spectrum/generate-image/<handle> for PNG"
                ]
            },
            "community_directory": {
                "description": "Build a directory of a PDS community",
                "steps": [
                    "1. GET /api/heraldry/for-domain/<domain> - Get heraldry info",
                    "2. GET /api/heraldry/<id>/coterie - Get all members"
                ]
            },
            "webhook_integration": {
                "description": "Coming soon - Subscribe to events via webhook",
                "status": "planned"
            }
        },
        
        "static_resources": {
            "spectrum_images": {
                "path": "https://reverie.house/spectrum/<handle>.png",
                "description": "Pre-generated spectrum visualization images",
                "example": "https://reverie.house/spectrum/errantson.bsky.social.png"
            },
            "heraldry_icons": {
                "path": "https://reverie.house/assets/heraldry/<name>.png",
                "description": "PDS community icons (512x512 PNG)"
            },
            "souvenir_assets": {
                "path": "https://reverie.house/assets/souvenirs/",
                "description": "Souvenir icons and phanera images"
            }
        },
        
        "at_protocol_integration": {
            "description": "Reverie House is built on the AT Protocol",
            "did_resolution": "DIDs can be resolved via https://plc.directory/<did>",
            "handle_resolution": "Handles resolve via https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=<handle>",
            "profile_data": "Profiles via https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=<did>",
            "our_lexicons": {
                "note": "Reverie House defines custom lexicons in /lexicons/",
                "residence_record": "house.reverie.actor.residence"
            }
        },
        
        "error_responses": {
            "400": {
                "meaning": "Bad Request",
                "causes": ["Missing required parameters", "Invalid format"]
            },
            "404": {
                "meaning": "Not Found",
                "causes": ["Dreamer not in database", "Invalid DID/handle"]
            },
            "429": {
                "meaning": "Rate Limited",
                "action": "Wait and retry. Check Retry-After header."
            },
            "500": {
                "meaning": "Server Error",
                "action": "Report to errantson.bsky.social"
            }
        },
        
        "changelog": [
            {
                "date": "2026-02-01",
                "changes": [
                    "Added /api/game/* endpoints for external game integration",
                    "Games can register users, look up profiles, and record canon events",
                    "No authentication required - same open model as greeter quest"
                ]
            },
            {
                "date": "2026-01-15",
                "changes": ["Initial /api/guide endpoint published"]
            }
        ]
    }


@bp.route('/guide')
def api_guide():
    """
    Comprehensive API documentation for external services.
    
    This endpoint returns a complete guide to all public Reverie House APIs,
    designed for bots, probes, and external services seeking integration.
    
    No authentication required.
    """
    return jsonify(get_api_guide())


@bp.route('/guide/endpoints')
def api_endpoints_only():
    """Return just the endpoint documentation for quick reference."""
    guide = get_api_guide()
    return jsonify({
        "base_url": guide["meta"]["base_url"],
        "endpoints": guide["public_endpoints"]
    })


@bp.route('/guide/concepts')
def api_concepts_only():
    """Return just the concept definitions."""
    guide = get_api_guide()
    return jsonify(guide["concepts"])


@bp.route('/guide/patterns')
def api_patterns_only():
    """Return integration patterns for common use cases."""
    guide = get_api_guide()
    return jsonify({
        "integration_patterns": guide["integration_patterns"],
        "data_relationships": guide["data_relationships"]
    })


@bp.route('/guide/health')
def api_health():
    """Simple health check for probe verification."""
    return jsonify({
        "status": "ok",
        "service": "reverie.house",
        "timestamp": int(time.time()),
        "documentation": "https://reverie.house/api/guide"
    })
