#!/usr/bin/env python3
"""
Trace Active Code - Find what's actually being used in production

This script identifies which Python files are actively imported by running services,
helping distinguish between active code and experimental archives.
"""

import ast
import sys
from pathlib import Path
from typing import Set, Dict, List
import json

# Project root
ROOT = Path('/srv/reverie.house')


def find_imports(filepath: Path) -> Set[str]:
    """Extract all import statements from a Python file."""
    try:
        with open(filepath) as f:
            tree = ast.parse(f.read(), filename=str(filepath))
    except (SyntaxError, UnicodeDecodeError) as e:
        print(f"⚠️  Skipping {filepath}: {e}")
        return set()
    
    imports = set()
    
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.add(node.module)
    
    return imports


def module_to_filepath(module_name: str, search_root: Path) -> Path:
    """
    Convert module name to potential filepath.
    e.g., 'core.database' -> 'core/database.py' or 'core/database/__init__.py'
    """
    parts = module_name.split('.')
    
    # Try as .py file
    py_path = search_root / '/'.join(parts[:-1]) / f"{parts[-1]}.py" if len(parts) > 1 else search_root / f"{parts[0]}.py"
    if py_path.exists():
        return py_path
    
    # Try as package
    pkg_path = search_root / '/'.join(parts) / '__init__.py'
    if pkg_path.exists():
        return pkg_path
    
    # Try relative to root
    alt_path = search_root / ('/'.join(parts) + '.py')
    if alt_path.exists():
        return alt_path
    
    return None


def trace_imports_recursive(entry_point: Path, search_root: Path, max_depth: int = 10) -> Set[Path]:
    """
    Recursively trace all imports from an entry point.
    Returns set of all Python files that are imported.
    """
    found = set()
    to_check = {entry_point}
    checked = set()
    depth = 0
    
    while to_check and depth < max_depth:
        current_batch = to_check.copy()
        to_check.clear()
        
        for current_file in current_batch:
            if current_file in checked:
                continue
            
            checked.add(current_file)
            found.add(current_file)
            
            # Find imports in this file
            imports = find_imports(current_file)
            
            # Convert module names to file paths
            for module_name in imports:
                # Skip stdlib and external packages
                if module_name in ('sys', 'os', 'json', 'time', 'datetime', 're', 'pathlib',
                                  'typing', 'collections', 'functools', 'itertools',
                                  'atproto', 'flask', 'psycopg2', 'requests', 'jwt',
                                  'sqlite3', 'threading', 'concurrent', 'logging'):
                    continue
                
                filepath = module_to_filepath(module_name, search_root)
                if filepath and filepath not in checked:
                    to_check.add(filepath)
        
        depth += 1
    
    return found


def find_entry_points() -> Dict[str, Path]:
    """
    Find entry points - files that are directly executed by services.
    Based on docker-compose and systemd service files.
    """
    entry_points = {
        # Main services
        'admin': ROOT / 'admin.py',
        'world': ROOT / 'world.py',
        'questing': ROOT / 'questing.py',
        'aviary': ROOT / 'aviary.py',
        'reverie': ROOT / 'reverie.py',
        
        # Firehose services
        'dreamerhose': ROOT / 'core' / 'dreamerhose.py',
        'questhose': ROOT / 'core' / 'questhose.py',
        'dreamhose': ROOT / 'core' / 'dreamhose.py',
        'phrasehose': ROOT / 'core' / 'phrasehose.py',
        'firehose_indexer': ROOT / 'core' / 'firehose_indexer.py',
    }
    
    # Filter to only existing files
    return {name: path for name, path in entry_points.items() if path.exists()}


def categorize_all_files(active_files: Set[Path]) -> Dict[str, List[Path]]:
    """
    Categorize all Python files in the project.
    """
    all_py_files = set(ROOT.rglob('*.py'))
    
    # Exclude beta and archive directories
    all_py_files = {f for f in all_py_files if '/beta/' not in str(f) and '/.archive/' not in str(f)}
    
    categories = {
        'active': [],
        'utilities': [],
        'tests': [],
        'unknown': []
    }
    
    for filepath in all_py_files:
        rel_path = filepath.relative_to(ROOT)
        
        if filepath in active_files:
            categories['active'].append(filepath)
        elif 'test' in str(filepath).lower() or 'scripts/' in str(filepath):
            categories['utilities'].append(filepath)
        else:
            categories['unknown'].append(filepath)
    
    return categories


def main():
    """Main analysis."""
    print("🔍 TRACING ACTIVE CODE")
    print("=" * 80)
    
    # Find entry points
    print("\n1. Finding entry points...")
    entry_points = find_entry_points()
    print(f"   Found {len(entry_points)} entry points:")
    for name, path in sorted(entry_points.items()):
        print(f"   - {name}: {path.relative_to(ROOT)}")
    
    # Trace imports from each entry point
    print("\n2. Tracing imports from entry points...")
    all_active_files = set()
    
    for name, entry_path in sorted(entry_points.items()):
        print(f"\n   Tracing {name}...")
        imports = trace_imports_recursive(entry_path, ROOT)
        all_active_files.update(imports)
        print(f"   → {len(imports)} files")
    
    print(f"\n   Total unique active files: {len(all_active_files)}")
    
    # Categorize all files
    print("\n3. Categorizing all Python files...")
    categories = categorize_all_files(all_active_files)
    
    print("\n📊 RESULTS")
    print("=" * 80)
    print(f"\n✅ Active (imported by services): {len(categories['active'])} files")
    print(f"🔧 Utilities/Scripts: {len(categories['utilities'])} files")
    print(f"❓ Unknown/Unused: {len(categories['unknown'])} files")
    
    # Save results to JSON
    output = {
        'active': [str(f.relative_to(ROOT)) for f in sorted(categories['active'])],
        'utilities': [str(f.relative_to(ROOT)) for f in sorted(categories['utilities'])],
        'unknown': [str(f.relative_to(ROOT)) for f in sorted(categories['unknown'])]
    }
    
    output_path = ROOT / 'scripts' / 'active_code_analysis.json'
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n💾 Results saved to: {output_path.relative_to(ROOT)}")
    
    # Show some unknown files as examples
    if categories['unknown']:
        print(f"\n❓ Sample unknown/unused files (first 20):")
        for f in sorted(categories['unknown'])[:20]:
            print(f"   {f.relative_to(ROOT)}")
        if len(categories['unknown']) > 20:
            print(f"   ... and {len(categories['unknown']) - 20} more")
    
    print("\n" + "=" * 80)


if __name__ == '__main__':
    main()
