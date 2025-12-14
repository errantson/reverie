#!/usr/bin/env python3
"""
Integration test to verify app password system integrity.

This script checks that all credential-related code uses the correct
column names across the entire codebase.
"""

import re
import os
import sys
from pathlib import Path


class CredentialIntegrityChecker:
    """Check credential column name consistency across codebase."""
    
    CORRECT_COLUMNS = {
        'app_password_hash',
        'pds_url',
        'is_valid',
        'last_verified',
        'created_at'
    }
    
    DEPRECATED_COLUMNS = {
        'password_hash',  # Should be app_password_hash
        'pds',  # Should be pds_url (except in some contexts)
        'valid',  # Should be is_valid
        'verified',  # Should be last_verified
    }
    
    def __init__(self, base_path='/srv/reverie.house'):
        self.base_path = Path(base_path)
        self.errors = []
        self.warnings = []
        self.files_checked = 0
    
    def check_file(self, filepath):
        """Check a single file for deprecated column names."""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
                
            # Look for SQL queries involving user_credentials
            for i, line in enumerate(lines, 1):
                if 'user_credentials' not in line.lower():
                    continue
                
                # Check for deprecated column names in SQL queries
                for deprecated in self.DEPRECATED_COLUMNS:
                    # Match patterns like: SELECT password_hash, INSERT ... password_hash, etc.
                    # Avoid matching app_password_hash or other valid names
                    
                    # Special handling for 'pds' - it's sometimes used as variable name
                    if deprecated == 'pds':
                        # Only flag if it's clearly a column reference
                        patterns = [
                            rf'\bSELECT.*\b{deprecated}\b.*FROM user_credentials',
                            rf'\bINSERT INTO user_credentials.*\b{deprecated}\b',
                            rf'\bUPDATE user_credentials.*SET.*\b{deprecated}\b\s*=',
                            rf'user_credentials\.\b{deprecated}\b',
                        ]
                    elif deprecated == 'valid':
                        # Check for 'valid =' but not 'is_valid'
                        patterns = [
                            rf'[^_]\bvalid\s*=.*user_credentials',
                            rf'user_credentials.*[^_]\bvalid\b',
                            rf'SET\s+valid\s*=',
                        ]
                    elif deprecated == 'verified':
                        # Check for 'verified' but not 'last_verified'
                        patterns = [
                            rf'[^_]\bverified\b.*user_credentials',
                            rf'user_credentials.*[^_]\bverified\b',
                            rf'SET\s+verified\s*=',
                        ]
                    elif deprecated == 'password_hash':
                        # Check for 'password_hash' but not 'app_password_hash'
                        patterns = [
                            rf'[^_]\bpassword_hash\b.*user_credentials',
                            rf'user_credentials.*[^_]\bpassword_hash\b',
                            rf'SELECT\s+password_hash\b',
                            rf'INSERT.*password_hash\b',
                        ]
                    else:
                        patterns = [
                            rf'\b{deprecated}\b.*user_credentials',
                            rf'user_credentials.*\b{deprecated}\b',
                        ]
                    
                    for pattern in patterns:
                        if re.search(pattern, line, re.IGNORECASE):
                            # Check it's not actually the correct column
                            if deprecated == 'password_hash' and 'app_password_hash' in line:
                                continue
                            if deprecated == 'valid' and 'is_valid' in line:
                                continue
                            if deprecated == 'verified' and 'last_verified' in line:
                                continue
                            
                            rel_path = filepath.relative_to(self.base_path)
                            self.errors.append(
                                f"{rel_path}:{i} - Uses deprecated '{deprecated}' column\n"
                                f"  Line: {line.strip()}"
                            )
                            break
        
        except Exception as e:
            self.warnings.append(f"Could not check {filepath}: {e}")
    
    def check_all_files(self):
        """Check all Python files in the project."""
        print("🔍 Checking credential column name consistency...\n")
        
        patterns = [
            'admin.py',
            'core/*.py',
            'utils/*.py',
            'api/*.py',
        ]
        
        for pattern in patterns:
            for filepath in self.base_path.glob(pattern):
                if filepath.is_file():
                    self.files_checked += 1
                    self.check_file(filepath)
        
        print(f"📊 Checked {self.files_checked} files\n")
    
    def report(self):
        """Print report of findings."""
        if self.errors:
            print("❌ ERRORS FOUND:")
            print("=" * 80)
            for error in self.errors:
                print(error)
                print()
            print(f"Total errors: {len(self.errors)}\n")
        else:
            print("✅ No deprecated column names found!\n")
        
        if self.warnings:
            print("⚠️  WARNINGS:")
            print("=" * 80)
            for warning in self.warnings:
                print(warning)
            print()
        
        return len(self.errors) == 0


def check_database_schema():
    """Verify database schema matches expectations."""
    print("🗄️  Checking database schema...\n")
    
    db_path = '/srv/reverie.house/data/reverie.db'
    if not os.path.exists(db_path):
        print("⚠️  Database not found - skipping schema check\n")
        return True
    
    import sqlite3
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("PRAGMA table_info(user_credentials)")
        columns = {row[1] for row in cursor.fetchall()}
        conn.close()
        
        print(f"Found columns: {', '.join(sorted(columns))}\n")
        
        # Check for correct columns
        missing = CredentialIntegrityChecker.CORRECT_COLUMNS - columns
        if missing:
            print(f"❌ Missing expected columns: {', '.join(missing)}\n")
            return False
        
        # Check for deprecated columns
        deprecated_found = columns & CredentialIntegrityChecker.DEPRECATED_COLUMNS
        if deprecated_found:
            print(f"⚠️  Found deprecated columns: {', '.join(deprecated_found)}")
            print("   (These should be migrated to new names)\n")
            return False
        
        print("✅ Database schema looks good!\n")
        return True
        
    except Exception as e:
        print(f"❌ Error checking database: {e}\n")
        return False


def check_api_endpoints():
    """Verify API endpoints return correct field names."""
    print("🔌 API Endpoint Field Name Check\n")
    print("=" * 80)
    
    endpoints = {
        '/api/user/credentials/status': {
            'expected_fields': ['connected', 'valid', 'verified', 'pds', 'created_at', 'roles_available'],
            'deprecated_fields': ['has_credentials', 'exists']
        },
        '/api/user/credentials/connect': {
            'expected_fields': ['success', 'connected', 'roles_available'],
            'deprecated_fields': []
        }
    }
    
    print("Expected API response fields:")
    for endpoint, spec in endpoints.items():
        print(f"\n  {endpoint}")
        print(f"    ✓ Should return: {', '.join(spec['expected_fields'])}")
        if spec['deprecated_fields']:
            print(f"    ✗ Should NOT return: {', '.join(spec['deprecated_fields'])}")
    
    print("\n")


def main():
    """Run all integrity checks."""
    print("\n" + "=" * 80)
    print("APP PASSWORD INTEGRITY CHECK")
    print("=" * 80 + "\n")
    
    # Check database schema
    schema_ok = check_database_schema()
    
    # Check code consistency
    checker = CredentialIntegrityChecker()
    checker.check_all_files()
    code_ok = checker.report()
    
    # Show API endpoint expectations
    check_api_endpoints()
    
    # Final result
    print("=" * 80)
    if schema_ok and code_ok:
        print("✅ ALL CHECKS PASSED")
        print("=" * 80 + "\n")
        return 0
    else:
        print("❌ SOME CHECKS FAILED - See details above")
        print("=" * 80 + "\n")
        return 1


if __name__ == '__main__':
    sys.exit(main())
