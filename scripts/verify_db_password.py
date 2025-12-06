#!/usr/bin/env python3
"""
Database Password Verification Script
Ensures the database password in secrets matches what's configured in PostgreSQL.
Run this before starting services to prevent authentication failures.
"""

import os
import sys
import psycopg2
from pathlib import Path

def verify_password():
    """Verify database password matches between file and database"""
    
    # Read password from file
    password_file = Path('/srv/secrets/reverie_db_password.txt')
    
    if not password_file.exists():
        print(f"❌ Password file not found: {password_file}")
        return False
    
    with open(password_file, 'r') as f:
        file_password = f.read().strip()
    
    if not file_password:
        print("❌ Password file is empty")
        return False
    
    # Try to connect with the password from file
    try:
        conn = psycopg2.connect(
            host=os.getenv('POSTGRES_HOST', 'reverie_db'),
            port=int(os.getenv('POSTGRES_PORT', '5432')),
            database=os.getenv('POSTGRES_DB', 'reverie_house'),
            user=os.getenv('POSTGRES_USER', 'reverie'),
            password=file_password,
            connect_timeout=5
        )
        conn.close()
        print("✅ Database password verification successful")
        return True
    except psycopg2.OperationalError as e:
        if "password authentication failed" in str(e):
            print("❌ Password authentication failed!")
            print(f"   The password in {password_file} does not match PostgreSQL")
            print("\nTo fix this, run:")
            print(f"   docker exec reverie_db psql -U reverie -d reverie_house -c \"ALTER USER reverie WITH PASSWORD '$(cat {password_file})';\"")
            return False
        else:
            print(f"❌ Database connection error: {e}")
            return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == '__main__':
    success = verify_password()
    sys.exit(0 if success else 1)
