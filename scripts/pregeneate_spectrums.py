#!/usr/bin/env python3
"""
Pre-generate spectrum data and origin images for all dreamers.
This speeds up the Spectrum Calculator by having data ready.

Usage:
    python3 scripts/pregeneate_spectrums.py [--limit N] [--force]

Options:
    --limit N   Only process N dreamers (for testing)
    --force     Regenerate even if spectrum already exists
"""

import sys
import os
import time
import argparse
import requests

BASE_URL = "http://localhost:4444"
ORIGINCARDS_URL = "http://172.23.0.4:3050"  # Docker container IP
SPECTRUM_DIR = "/srv/reverie.house/data/spectrum"

def get_all_dreamers(limit=None):
    """Get all dreamers via API."""
    try:
        response = requests.get(f"{BASE_URL}/api/dreamers", timeout=30)
        if response.status_code == 200:
            dreamers = response.json()
            if limit:
                return dreamers[:limit]
            return dreamers
        else:
            print(f"❌ Failed to fetch dreamers: {response.status_code}")
            return []
    except Exception as e:
        print(f"❌ Error fetching dreamers: {e}")
        return []

def has_spectrum(handle):
    """Check if spectrum image already exists."""
    safe_handle = handle.replace('/', '').replace('\\', '').replace('..', '')
    image_path = os.path.join(SPECTRUM_DIR, f"{safe_handle}.png")
    return os.path.exists(image_path)

def calculate_spectrum(handle):
    """Calculate spectrum for a dreamer."""
    try:
        response = requests.get(
            f"{BASE_URL}/api/spectrum/calculate",
            params={"handle": handle},
            timeout=15
        )
        if response.status_code == 200:
            return response.json()
        else:
            print(f"  ⚠️  API returned {response.status_code}")
            return None
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return None

def generate_origin_image(handle, display_name, avatar, spectrum):
    """Generate origin card image."""
    try:
        response = requests.post(
            f"{ORIGINCARDS_URL}/generate",
            json={
                'handle': handle,
                'displayName': display_name or handle,
                'avatar': avatar,
                'spectrum': spectrum,
                'coordinates': spectrum.get('coordinates')
            },
            timeout=20
        )
        if response.status_code == 200:
            result = response.json()
            return result.get('url')
        else:
            print(f"  ⚠️  Image gen returned {response.status_code}")
            return None
    except Exception as e:
        print(f"  ❌ Image error: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description='Pre-generate spectrum data for all dreamers')
    parser.add_argument('--limit', type=int, help='Limit number of dreamers to process')
    parser.add_argument('--force', action='store_true', help='Regenerate even if exists')
    args = parser.parse_args()
    
    print("🌈 Spectrum Pre-Generator")
    print("=" * 50)
    
    # Ensure spectrum directory exists
    os.makedirs(SPECTRUM_DIR, exist_ok=True)
    
    dreamers = get_all_dreamers(args.limit)
    total = len(dreamers)
    print(f"📊 Found {total} dreamers to process\n")
    
    processed = 0
    skipped = 0
    errors = 0
    
    for i, dreamer in enumerate(dreamers, 1):
        handle = dreamer['handle']
        display_name = dreamer['display_name'] or dreamer['name'] or handle
        avatar = dreamer['avatar']
        
        print(f"[{i}/{total}] {handle}")
        
        # Check if already exists
        if not args.force and has_spectrum(handle):
            print(f"  ✓ Already exists, skipping")
            skipped += 1
            continue
        
        # Calculate spectrum
        print(f"  🔄 Calculating spectrum...")
        spectrum_data = calculate_spectrum(handle)
        
        if not spectrum_data:
            errors += 1
            continue
        
        spectrum = spectrum_data.get('spectrum', {})
        octant = spectrum.get('octant', 'unknown')
        print(f"  ✅ Spectrum: {octant}")
        
        # Generate origin image
        print(f"  🎨 Generating image...")
        image_url = generate_origin_image(
            spectrum_data.get('handle', handle),
            spectrum_data.get('display_name', display_name),
            spectrum_data.get('avatar', avatar),
            spectrum
        )
        
        if image_url:
            print(f"  ✅ Image: {image_url}")
            processed += 1
        else:
            errors += 1
        
        # Small delay to avoid overwhelming services
        time.sleep(0.5)
    
    print("\n" + "=" * 50)
    print(f"📊 Summary:")
    print(f"   ✅ Processed: {processed}")
    print(f"   ⏭️  Skipped: {skipped}")
    print(f"   ❌ Errors: {errors}")
    print(f"   📁 Images in: {SPECTRUM_DIR}")

if __name__ == '__main__':
    main()
