#!/usr/bin/env python3
"""
Contribution Score Calculator
Updates dreamer contribution, patron, canon, and lore scores in the database.

Run periodically via Docker container to keep scores fresh.
"""

import sys
import time
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import DatabaseManager
from config import Config


class ContributionCalculator:
    """Calculate and update contribution scores for all dreamers."""
    
    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.db = DatabaseManager()
        self.stats = {
            'dreamers_updated': 0,
            'patrons_found': 0,
            'contributors_found': 0,
            'start_time': datetime.now()
        }
    
    def log(self, message):
        """Print message if verbose."""
        if self.verbose:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
    
    def calculate_patron_score(self, did: str) -> int:
        """
        Calculate patron score (total books × 150).
        Parses quantities JSON to extract book counts.
        Returns: sum of all book quantities × 150
        """
        try:
            cursor = self.db.execute("""
                SELECT quantities 
                FROM events 
                WHERE did = %s AND type = %s AND quantities IS NOT NULL
            """, (did, 'order'))
            
            results = cursor.fetchall()
            total_books = 0
            
            for row in results:
                quantities = row['quantities']
                if quantities and 'books' in quantities:
                    total_books += quantities['books']
            
            return total_books * 150
            
        except Exception as e:
            self.log(f"⚠️  Error calculating patron score for {did}: {e}")
            return 0
    
    def calculate_canon_score(self, did: str) -> int:
        """
        Calculate canon score (raw count of canon events).
        Returns: number of canon events
        """
        try:
            cursor = self.db.execute("""
                SELECT COUNT(*) as canon_count 
                FROM events 
                WHERE did = %s AND type = %s
            """, (did, 'canon'))
            
            result = cursor.fetchone()
            return result['canon_count'] if result else 0
            
        except Exception as e:
            self.log(f"⚠️  Error calculating canon score for {did}: {e}")
            return 0
    
    def calculate_lore_score(self, did: str) -> int:
        """
        Calculate lore score (raw count of lore events).
        Returns: number of lore events
        """
        try:
            cursor = self.db.execute("""
                SELECT COUNT(*) as lore_count 
                FROM events 
                WHERE did = %s AND type = %s
            """, (did, 'lore'))
            
            result = cursor.fetchone()
            return result['lore_count'] if result else 0
            
        except Exception as e:
            self.log(f"⚠️  Error calculating lore score for {did}: {e}")
            return 0
    
    def calculate_contribution_score(self, canon_score: int, lore_score: int, patron_score: int) -> int:
        """
        Calculate total contribution score.
        Formula: (30 × canon) + (10 × lore) + (1 × patron)
        """
        return (canon_score * 30) + (lore_score * 10) + patron_score
    
    def update_dreamer_scores(self, did: str) -> dict:
        """Calculate and update all scores for a single dreamer."""
        try:
            # Calculate each score component
            patron_score = self.calculate_patron_score(did)
            canon_score = self.calculate_canon_score(did)
            lore_score = self.calculate_lore_score(did)
            contribution_score = self.calculate_contribution_score(canon_score, lore_score, patron_score)
            
            # Update database
            self.db.execute("""
                UPDATE dreamers 
                SET patron_score = %s,
                    canon_score = %s,
                    lore_score = %s,
                    contribution_score = %s,
                    updated_at = %s
                WHERE did = %s
            """, (patron_score, canon_score, lore_score, contribution_score, int(time.time()), did))
            
            return {
                'patron_score': patron_score,
                'canon_score': canon_score,
                'lore_score': lore_score,
                'contribution_score': contribution_score
            }
            
        except Exception as e:
            self.log(f"❌ Error updating scores for {did}: {e}")
            return None
    
    def update_all_dreamers(self):
        """Update contribution scores for all dreamers."""
        self.log("=" * 70)
        self.log("🏆 CONTRIBUTION SCORE CALCULATOR")
        self.log("=" * 70)
        
        try:
            # Get all dreamers
            cursor = self.db.execute("SELECT did, handle, name FROM dreamers ORDER BY arrival DESC")
            dreamers = cursor.fetchall()
            
            total = len(dreamers)
            self.log(f"📊 Found {total} dreamers to update")
            self.log("")
            
            for i, dreamer in enumerate(dreamers, 1):
                did = dreamer['did']
                handle = dreamer['handle'] or dreamer['name']
                
                scores = self.update_dreamer_scores(did)
                
                if scores:
                    self.stats['dreamers_updated'] += 1
                    
                    if scores['patron_score'] > 0:
                        self.stats['patrons_found'] += 1
                    
                    if scores['contribution_score'] > 0:
                        self.stats['contributors_found'] += 1
                    
                    # Log notable scores
                    if scores['contribution_score'] > 0 or scores['patron_score'] > 0:
                        self.log(f"✓ [{i}/{total}] {handle}: "
                                f"contribution={scores['contribution_score']}, "
                                f"patron={scores['patron_score']}, "
                                f"canon={scores['canon_score']}, "
                                f"lore={scores['lore_score']}")
                    elif i % 10 == 0:
                        self.log(f"⋯ [{i}/{total}] {handle}")
                
                # Brief pause every 50 dreamers to avoid overwhelming database
                if i % 50 == 0:
                    time.sleep(0.1)
            
            self.log("")
            self.log("=" * 70)
            self.log("📈 UPDATE COMPLETE")
            self.log("=" * 70)
            elapsed = (datetime.now() - self.stats['start_time']).total_seconds()
            self.log(f"✓ Dreamers updated: {self.stats['dreamers_updated']}")
            self.log(f"✓ Patrons found: {self.stats['patrons_found']}")
            self.log(f"✓ Contributors found: {self.stats['contributors_found']}")
            self.log(f"✓ Time elapsed: {elapsed:.1f}s")
            
        except Exception as e:
            self.log(f"❌ Fatal error during update: {e}")
            import traceback
            traceback.print_exc()
            return 1
        
        return 0


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Update dreamer contribution scores')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--quiet', '-q', action='store_true', help='Quiet mode (no output)')
    
    args = parser.parse_args()
    
    verbose = args.verbose or not args.quiet
    
    calculator = ContributionCalculator(verbose=verbose)
    return calculator.update_all_dreamers()


if __name__ == '__main__':
    sys.exit(main())
