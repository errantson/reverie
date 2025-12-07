#!/usr/bin/env python3
"""
Archive Unknown/Unused Code

Based on the active code analysis, this script archives Python files
that aren't imported by any running services.
"""

import json
import shutil
from pathlib import Path
from datetime import datetime

ROOT = Path('/srv/reverie.house')
ARCHIVE_DIR = ROOT / '.archive' / f'unused_code.{datetime.now().strftime("%Y%m%d")}'

def main():
    print("📦 ARCHIVING UNUSED CODE")
    print("=" * 80)
    
    # Load analysis results
    analysis_path = ROOT / 'scripts' / 'active_code_analysis.json'
    with open(analysis_path) as f:
        analysis = json.load(f)
    
    unknown_files = [ROOT / f for f in analysis['unknown']]
    
    print(f"\n Found {len(unknown_files)} unknown/unused files")
    print(f" Archive destination: {ARCHIVE_DIR.relative_to(ROOT.parent)}")
    
    # Create archive directory
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    
    # Archive each file, preserving directory structure
    archived_count = 0
    for filepath in unknown_files:
        if not filepath.exists():
            print(f"⚠️  Skipping (not found): {filepath.relative_to(ROOT)}")
            continue
        
        # Preserve directory structure in archive
        rel_path = filepath.relative_to(ROOT)
        archive_path = ARCHIVE_DIR / rel_path
        archive_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Move file to archive
        shutil.move(str(filepath), str(archive_path))
        archived_count += 1
        
        if archived_count <= 10:  # Show first 10
            print(f"📦 {rel_path}")
    
    if archived_count > 10:
        print(f"   ... and {archived_count - 10} more")
    
    print(f"\n✅ Archived {archived_count} files to: {ARCHIVE_DIR.relative_to(ROOT)}")
    print("\n⚠️  Monitor for 1 week - if no issues, can delete archive")
    print("=" * 80)

if __name__ == '__main__':
    main()
