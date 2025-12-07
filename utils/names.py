import os
import re
from typing import List, Dict, Optional, Tuple

class NameManager:
    """Handles name management and monitoring posts for new names."""

    def __init__(self):
        from core.database import DatabaseManager
        self.db = DatabaseManager()

    def sanitize_name(self, name: str) -> Optional[str]:
        """Sanitize and validate a name for use in the system."""
        if not name or not isinstance(name, str):
            return None
        
        cleaned = re.sub(r'[^A-Za-z0-9_\-\s]', '', name.strip())
        sanitized = re.sub(r'\s+', '', cleaned)[:20]
        
        if not re.search(r'[A-Za-z0-9]', sanitized):
            return None
            
        return sanitized

    def normalize_name(self, name: str) -> str:
        """Normalize a name for uniqueness checks."""
        if not name:
            return ""
        return self.sanitize_name(name).lower() if self.sanitize_name(name) else ""

    def is_name_unique(self, name: str, exclude_did: Optional[str] = None) -> bool:
        """Check if a name is unique among dreamers, optionally excluding a specific DID."""
        normalized = self.normalize_name(name)
        if not normalized:
            return False
        
        if exclude_did:
            cursor = self.db.execute(
                "SELECT COUNT(*) as count FROM dreamers WHERE LOWER(name) = ? AND did != ?",
                (normalized, exclude_did)
            )
        else:
            cursor = self.db.execute(
                "SELECT COUNT(*) as count FROM dreamers WHERE LOWER(name) = ?",
                (normalized,)
            )
        
        result = cursor.fetchone()
        return result['count'] == 0

    def suggest_unique_name(self, base_name: str, exclude_did: Optional[str] = None) -> str:
        """Suggest a unique name based on the input, adding numbers if needed."""
        sanitized = self.sanitize_name(base_name)
        if not sanitized:
            sanitized = "Dreamer"
        
        if self.is_name_unique(sanitized, exclude_did):
            return sanitized
        
        for i in range(2, 100):
            candidate = f"{sanitized}{i}"
            if len(candidate) <= 20 and self.is_name_unique(candidate, exclude_did):
                return candidate
        
        import time
        timestamp_suffix = str(int(time.time()))[-4:]
        return f"{sanitized[:15]}{timestamp_suffix}"

    def update_dreamer_name(self, dreamer_did: str, new_name: str) -> bool:
        """Update a dreamer's name by DID, ensuring uniqueness."""
        sanitized_name = self.sanitize_name(new_name)
        if not sanitized_name:
            print(f"❌ Invalid name format: '{new_name}'")
            return False
        
        if not self.is_name_unique(sanitized_name, exclude_did=dreamer_did):
            suggested = self.suggest_unique_name(sanitized_name, exclude_did=dreamer_did)
            print(f"❌ Name '{sanitized_name}' is taken. Suggested: '{suggested}'")
            return False
        
        cursor = self.db.execute("SELECT name FROM dreamers WHERE did = %s", (dreamer_did,))
        row = cursor.fetchone()
        
        if not row:
            print(f"❌ Dreamer with DID '{dreamer_did}' not found")
            return False
        
        old_name = row['name'] or 'Unknown'
        
        try:
            self.db.execute(
                "UPDATE dreamers SET name = ? WHERE did = ?",
                (sanitized_name, dreamer_did)
            )
            print(f"✅ Updated dreamer name: '{old_name}' → '{sanitized_name}'")
            return True
        except Exception as e:
            print(f"❌ Database error: {e}")
            return False

    def monitor_posts_for_names(self, post_uris: Optional[List[str]] = None) -> List[Dict]:
        """
        Scan monitored posts for new names (handles/display names).
        Returns a list of new name candidates.
        """
        from core.network import NetworkClient
        network = NetworkClient()
        
        import json
        try:
            with open('/srv/ops/quest.json', 'r') as f:
                monitors = json.load(f)
        except:
            monitors = {}
        
        posts = post_uris or monitors.get("posts", [])
        
        cursor = self.db.execute("SELECT name FROM dreamers WHERE name IS NOT NULL")
        known_names = {self.normalize_name(row['name']) for row in cursor.fetchall()}
        found = []

        for uri in posts:
            thread = network.get_thread_replies(uri, max_depth=10, include_metadata=True)
            for author in thread.get('authors', []):
                display = author.get('displayName', '')
                handle = author.get('handle', '')
                for candidate in [display, handle]:
                    norm = self.normalize_name(candidate)
                    if norm and norm not in known_names:
                        found.append({
                            "name": candidate,
                            "did": author.get('did', ''),
                            "handle": handle,
                            "source_post": uri
                        })
                        known_names.add(norm)
        return found

    def list_names(self) -> List[str]:
        """List all current names."""
        cursor = self.db.execute("SELECT name FROM dreamers WHERE name IS NOT NULL ORDER BY name")
        return [row['name'] for row in cursor.fetchall()]

    def get_dreamer_by_name(self, name: str) -> Optional[Dict]:
        """Find a dreamer by normalized name."""
        norm = self.normalize_name(name)
        cursor = self.db.execute("SELECT * FROM dreamers")
        for row in cursor.fetchall():
            if self.normalize_name(row['name'] or '') == norm:
                return dict(row)
        return None

    def generate_name_from_identity(self, handle: str = "", display_name: str = "", did: str = "") -> str:
        """Generate a suitable name from available identity information."""
        candidates = []
        
        if display_name:
            sanitized = self.sanitize_name(display_name)
            if sanitized:
                candidates.append(sanitized)
        
        if handle:
            handle_base = handle.split('.')[0] if '.' in handle else handle
            sanitized = self.sanitize_name(handle_base)
            if sanitized:
                candidates.append(sanitized)
        
        if handle:
            sanitized = self.sanitize_name(handle.replace('.', ''))
            if sanitized:
                candidates.append(sanitized)
        
        if did and did.startswith('did:'):
            did_parts = did.split(':')
            if len(did_parts) > 2:
                did_suffix = did_parts[-1][:10]
                sanitized = self.sanitize_name(did_suffix)
                if sanitized:
                    candidates.append(f"did{sanitized}")
        
        for candidate in candidates:
            if self.is_name_unique(candidate):
                return candidate
        
        base = candidates[0] if candidates else "Dreamer"
        return self.suggest_unique_name(base)

    def extract_name_from_post_content(self, post_text: str) -> Optional[str]:
        """Extract a potential name from post content using broad patterns with multilingual support."""
        if not post_text:
            return None
        
        text = post_text.strip()
        if not text:
            return None
        
        text_lower = text.lower()
        
        text_lower = re.sub(r'^(hi|hello|hey|yo|sup)\s+', '', text_lower)
        text_lower = re.sub(r'^(i\'m|im|i am|my name is|name:)\s+', '', text_lower)
        text_lower = re.sub(r'^(just\s+)?(call|name)\s+me\s+', '', text_lower)
        text_lower = re.sub(r'^(simply|just|only)\s+', '', text_lower)
        
        # Remove common French name introduction patterns
        text_lower = re.sub(r'^(je\s+m\'appelle|je\s+suis|mon\s+nom\s+(est|c\'est)|on\s+m\'appelle)\s+', '', text_lower)
        text_lower = re.sub(r'^(appelle[z]?\s+moi|nom:)\s+', '', text_lower)
        text_lower = re.sub(r'^(simplement|juste|seulement)\s+', '', text_lower)
        
        text_lower = re.sub(r'^(me\s+llamo|mi\s+nombre\s+es|soy)\s+', '', text_lower)
        text_lower = re.sub(r'^(ll[aá]mame|nombre:)\s+', '', text_lower)
        text_lower = re.sub(r'^(simplemente|solamente|solo)\s+', '', text_lower)
        
        text_lower = re.sub(r'^(ich\s+hei[sß]e|ich\s+bin|mein\s+name\s+ist)\s+', '', text_lower)
        text_lower = re.sub(r'^(nenn\s+mich|name:)\s+', '', text_lower)
        
        words = re.findall(r'\b[a-zA-Z][a-zA-Z0-9_-]*\b', text_lower)
        
        excluded_words = {
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
            'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might',
            'this', 'that', 'these', 'those', 'here', 'there', 'where', 'when', 'why', 'how',
            'what', 'who', 'which', 'whose', 'whom', 'hi', 'hello', 'hey', 'yo', 'sup',
            'thanks', 'thank', 'you', 'your', 'yours', 'me', 'my', 'mine', 'we', 'us', 'our',
            'they', 'them', 'their', 'it', 'its', 'he', 'him', 'his', 'she', 'her', 'hers',
            'just', 'simply', 'only', 'also', 'very', 'really', 'quite', 'too', 'so',
            'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'on',
            'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux',
            'et', 'ou', 'mais', 'donc', 'car', 'ni', 'or',
            'ce', 'cet', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
            'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
            'suis', 'es', 'est', 'sommes', 'etes', 'sont', 'ai', 'as', 'a', 'avons', 'avez', 'ont',
            'moi', 'toi', 'lui', 'eux', 'elles',
            'appelle', 'appellez', 'nom', 'name',
            'simplement', 'juste', 'seulement', 'aussi', 'tres', 'bien', 'mal',
            'el', 'la', 'los', 'las', 'lo', 'al', 'del',
            'yo', 'tu', 'usted', 'nosotros', 'vosotros', 'ellos', 'ellas',
            'mi', 'mis', 'su', 'sus', 'nuestro', 'vuestra',
            'soy', 'eres', 'somos', 'son', 'llamo', 'nombre',
            'solamente', 'simplemente', 'solo', 'tambien', 'muy', 'bien', 'mal',
            'de', 'del', 'norte', 'sur', 'este', 'oeste',
            'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr',
            'der', 'die', 'das', 'den', 'dem', 'des',
            'mein', 'dein', 'sein', 'unser', 'euer',
            'bin', 'bist', 'ist', 'sind', 'heisse', 'heisst', 'name'
        }
        
        for word in words:
            if len(word) >= 2 and word not in excluded_words:
                sanitized = self.sanitize_name(word)
                if sanitized and len(sanitized) >= 2:
                    return sanitized
        
        if len(text) <= 30:
            cleaned_text = re.sub(r'[@#]', '', text)
            cleaned_text = re.sub(r'\s+', '', cleaned_text)
            sanitized = self.sanitize_name(cleaned_text)
            if sanitized and len(sanitized) >= 2:
                return sanitized
        
        return None

    def generate_name_from_reply_context(self, author_data: Dict, reply_content: str = "") -> str:
        """Generate name considering both author data and reply content."""
        if reply_content:
            extracted_name = self.extract_name_from_post_content(reply_content)
            if extracted_name and self.is_name_unique(extracted_name):
                print(f"🎯 Extracted name from reply: '{extracted_name}'")
                return extracted_name
        
        generated_name = self.generate_name_from_identity(
            author_data.get('handle', ''),
            author_data.get('displayName', ''),
            author_data.get('did', '')
        )
        
        return generated_name

    def validate_all_names(self) -> Dict[str, List[str]]:
        """Validate all dreamer names and return issues found."""
        cursor = self.db.execute("SELECT did, name, handle FROM dreamers")
        dreamers = cursor.fetchall()
        
        issues = {
            "invalid": [],
            "duplicates": [],
            "missing": []
        }
        
        seen_names = {}
        
        for dreamer in dreamers:
            name = dreamer['name']
            did = dreamer['did']
            
            if not name:
                issues["missing"].append(did or dreamer['handle'])
                continue
            
            if not self.sanitize_name(name):
                issues["invalid"].append(f"{name} ({did})")
                continue
            
            normalized = self.normalize_name(name)
            if normalized in seen_names:
                issues["duplicates"].append(f"{name} (conflicts with {seen_names[normalized]})")
            else:
                seen_names[normalized] = name
        
        return issues

    def fix_name_issues(self) -> Dict[str, int]:
        """Automatically fix name issues where possible."""
        cursor = self.db.execute("SELECT did, name, handle, description FROM dreamers")
        dreamers = cursor.fetchall()
        
        stats = {"fixed_invalid": 0, "fixed_missing": 0, "fixed_duplicates": 0}
        
        for dreamer in dreamers:
            name = dreamer['name']
            did = dreamer['did']
            
            if not name:
                new_name = self.generate_name_from_identity(
                    dreamer['handle'],
                    (dreamer['description'] or '').split(' ')[0] if dreamer['description'] else '',
                    did
                )
                self.db.execute("UPDATE dreamers SET name = %s WHERE did = %s", (new_name, did))
                stats["fixed_missing"] += 1
                print(f"🔧 Generated name for nameless dreamer: '{new_name}'")
                
            elif not self.sanitize_name(name):
                new_name = self.generate_name_from_identity(
                    dreamer['handle'],
                    name,
                    did
                )
                self.db.execute("UPDATE dreamers SET name = %s WHERE did = %s", (new_name, did))
                stats["fixed_invalid"] += 1
                print(f"🔧 Fixed invalid name: '{name}' → '{new_name}'")
        
        cursor = self.db.execute("SELECT did, name FROM dreamers ORDER BY arrival")
        dreamers = cursor.fetchall()
        
        seen_names = {}
        for dreamer in dreamers:
            name = dreamer['name']
            did = dreamer['did']
            normalized = self.normalize_name(name)
            
            if normalized in seen_names:
                new_name = self.suggest_unique_name(name, exclude_did=did)
                self.db.execute("UPDATE dreamers SET name = %s WHERE did = %s", (new_name, did))
                stats["fixed_duplicates"] += 1
                print(f"🔧 Fixed duplicate name: '{name}' → '{new_name}'")
            else:
                seen_names[normalized] = name
        
        if sum(stats.values()) > 0:
            print(f"✅ Fixed {sum(stats.values())} name issues")
        
        return stats
