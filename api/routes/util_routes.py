"""
Utility Routes
Simple utility endpoints for the Reverie House API
"""

from flask import Blueprint, request, Response
import requests
from io import BytesIO

bp = Blueprint('util', __name__, url_prefix='/api')

@bp.route('/proxy-image', methods=['GET'])
def proxy_image():
    """
    Proxy external images to avoid CORS issues
    Usage: /api/proxy-image?url=https://example.com/image.jpg
    """
    try:
        image_url = request.args.get('url')
        if not image_url:
            return {'error': 'Missing url parameter'}, 400
        
        # Fetch the image
        response = requests.get(image_url, timeout=10, headers={
            'User-Agent': 'ReverieHouse/1.0'
        })
        
        if response.status_code != 200:
            return {'error': 'Failed to fetch image'}, response.status_code
        
        # Return the image with proper headers
        return Response(
            response.content,
            mimetype=response.headers.get('content-type', 'image/jpeg'),
            headers={
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': '*'
            }
        )
        
    except requests.RequestException as e:
        return {'error': f'Request failed: {str(e)}'}, 500
    except Exception as e:
        return {'error': f'Proxy error: {str(e)}'}, 500
