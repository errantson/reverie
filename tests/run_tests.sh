#!/usr/bin/env python3
"""
Test Runner for Courier System
Run all courier tests with coverage reporting
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if __name__ == '__main__':
    import pytest
    
    # Run tests with verbose output and coverage
    exit_code = pytest.main([
        'tests/test_courier.py',
        '-v',                    # Verbose
        '--tb=short',            # Short traceback format
        '--color=yes',           # Colored output
        '-s',                    # Don't capture stdout (show prints)
        '--maxfail=5',           # Stop after 5 failures
    ])
    
    sys.exit(exit_code)
