"""
Reverie Configuration
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def read_secret(key: str, default: str = '') -> str:
    """
    Read secret from Docker secrets or mapped secrets directory.
    Priority: /run/secrets/ (Docker Swarm) -> /srv/secrets/ (bind mount) -> env var
    """
    # Docker Swarm secrets path
    docker_secret_path = f'/run/secrets/{key.lower()}'
    # Bind-mounted secrets path (used in our docker-compose setup)
    mounted_secret_path = f'/srv/secrets/{key.lower()}.txt'
    
    # Try Docker swarm secret first
    if os.path.exists(docker_secret_path):
        try:
            with open(docker_secret_path, 'r') as f:
                return f.read().strip()
        except Exception as e:
            print(f"Failed to read secret {key}: {e}")
    
    # Try bind-mounted secrets directory
    if os.path.exists(mounted_secret_path):
        try:
            with open(mounted_secret_path, 'r') as f:
                return f.read().strip()
        except Exception as e:
            print(f"Failed to read mounted secret {key}: {e}")
    
    # Fall back to environment variable
    return os.getenv(key, default)


class Config:
    
    PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR = os.path.join(PROJECT_ROOT, 'data')
    BACKUP_DIR = os.path.join(PROJECT_ROOT, '.backup')
    SESSION_CACHE = os.path.join(PROJECT_ROOT, '.session.json')

    ## DEBUG MODE
    DEBUG = os.getenv('DEBUG', 'false').lower() in ('true', '1', 'yes', 'on')
    BACKUP = os.getenv('BACKUP', 'true').lower() in ('true', '1', 'yes', 'on')
    PREDEL = os.getenv('PREDEL', 'true').lower() in ('true', '1', 'yes', 'on')
    SYSINFO = os.getenv('SYSINFO', 'true').lower() in ('true', '1', 'yes', 'on')
    
    ## CYCLE - Master switch for entire reverie cycle (false = skip all cycle operations)
    CYCLE = os.getenv('CYCLE', 'true').lower() in ('true', '1', 'yes', 'on')
    
    ## PROFILE UPDATES - Enable profile updates in reverie cycle (false = skip, rely on firehose)
    PROFILE_UPDATES = os.getenv('PROFILE_UPDATES', 'true').lower() in ('true', '1', 'yes', 'on')

    ## AUTO_CREATE_DREAMERS - Auto-create dreamer records when someone views a profile via /spectrum/calculate
    ## When disabled (default), dreamers are only created when users actually log in
    AUTO_CREATE_DREAMERS = os.getenv('AUTO_CREATE_DREAMERS', 'false').lower() in ('true', '1', 'yes', 'on')

    ## Backup settings
    REVERIE_BACKUP_COUNT = int(os.getenv('REVERIE_BACKUP_COUNT', '3'))  # Keep only N most recent backups

    ## Network settings
    REQUEST_TIMEOUT = int(os.getenv('REQUEST_TIMEOUT', '10'))
    
    # Read sensitive credentials from Docker secrets (preferred) or .env (fallback)
    BSKY_HANDLE = read_secret('BSKY_HANDLE', os.getenv('BSKY_HANDLE', ''))
    BSKY_APP_PASSWORD = read_secret('BSKY_APP_PASSWORD', os.getenv('BSKY_APP_PASSWORD', ''))
    
    @classmethod
    def validate_credentials(cls):
        """Validate that required credentials are configured."""
        if not cls.BSKY_HANDLE:
            return False, "BSKY_HANDLE not configured"
        if not cls.BSKY_APP_PASSWORD:
            return False, "BSKY_APP_PASSWORD not configured"
        return True, "Credentials configured"
    
    @classmethod
    def rewind_data(cls, backup_timestamp=None, include_all=False):
        """Restore files from backup. include_all=True restores souvenirs and world too."""
        import shutil
        import glob
        
        backup_base = cls.BACKUP_DIR
        
        if not os.path.exists(backup_base):
            print(f"No backup directory found")
            return False
        
        # If no timestamp specified, find the most recent backup
        if not backup_timestamp:
            backup_dirs = glob.glob(os.path.join(backup_base, '*'))
            backup_dirs = [d for d in backup_dirs if os.path.isdir(d)]
            if not backup_dirs:
                print(f"No backups found")
                return False
            
            # Sort by directory name (timestamp) and get the most recent
            backup_dirs.sort(reverse=True)
            backup_dir = backup_dirs[0]
            backup_timestamp = os.path.basename(backup_dir)
        else:
            backup_dir = os.path.join(backup_base, backup_timestamp)
        
        if not os.path.exists(backup_dir):
            print(f"Backup {backup_timestamp} not found")
            return False
        
        print(f"Rewinding from backup: {backup_timestamp}")
        
        # Files to restore
        if include_all:
            rewind_files = ['dreamers.json', 'canon.json', 'souvenirs.json', 'world.json']
            print("   Including souvenirs and world data")
        else:
            rewind_files = ['dreamers.json', 'canon.json']
        
        restored_count = 0
        
        for filename in rewind_files:
            backup_file = os.path.join(backup_dir, filename)
            target_file = os.path.join(cls.DATA_DIR, filename)
            
            if os.path.exists(backup_file):
                try:
                    shutil.copy2(backup_file, target_file)
                    print(f"   ✅ Restored {filename}")
                    restored_count += 1
                except Exception as e:
                    print(f"   ❌ Failed to restore {filename}: {e}")
            else:
                print(f"   ⚠️ {filename} not found in backup")
        
        if restored_count > 0:
            print(f"Restored {restored_count} files from backup {backup_timestamp}")
            return True
        else:
            print(f"No files were restored")
            return False
    
    @classmethod
    def list_backups(cls):
        """List available backups."""
        import glob
        
        backup_base = cls.BACKUP_DIR
        
        if not os.path.exists(backup_base):
            print(f"No backup directory found")
            return []
        
        backup_dirs = glob.glob(os.path.join(backup_base, '*'))
        backup_dirs = [d for d in backup_dirs if os.path.isdir(d)]
        
        if not backup_dirs:
            print(f"No backups found")
            return []
        
        # Sort by timestamp (newest first)
        backup_dirs.sort(reverse=True)
        
        print(f"Available backups:")
        for backup_dir in backup_dirs:
            timestamp = os.path.basename(backup_dir)
            # Check if it contains the files we care about
            dreamers_exists = os.path.exists(os.path.join(backup_dir, 'dreamers.json'))
            canon_exists = os.path.exists(os.path.join(backup_dir, 'canon.json'))
            
            status = "📁"
            if dreamers_exists and canon_exists:
                status = "✅"
            elif dreamers_exists or canon_exists:
                status = "⚠️"
            
            print(f"   {status} {timestamp}")
        
        return [os.path.basename(d) for d in backup_dirs]

    @classmethod
    def set_debug(cls, value):
        """Set DEBUG value in .env file."""
        env_path = os.path.join(cls.PROJECT_ROOT, '.env')
        
        # Read current .env content safely
        lines = []
        orig_mode = None
        if os.path.exists(env_path):
            try:
                stat = os.stat(env_path)
                orig_mode = stat.st_mode
            except Exception:
                orig_mode = None

            with open(env_path, 'r') as f:
                lines = f.readlines()

        # Ensure all lines end with newline (fix malformed .env)
        for i, line in enumerate(lines):
            if not line.endswith('\n'):
                lines[i] = line + '\n'

        # Remove any existing DEBUG lines
        lines = [line for line in lines if not line.strip().startswith('DEBUG=')]

        # Add new DEBUG line (write boolean-like string without quotes)
        debug_val = 'true' if str(value).lower() in ('true', '1', 'yes', 'on') else 'false'
        debug_line = f'DEBUG={debug_val}\n'
        lines.append(debug_line)

        # Write to a temporary file in the same directory and atomically replace
        import tempfile
        dirpath = os.path.dirname(env_path) or '.'
        fd = None
        tmp_path = None
        try:
            fd, tmp_path = tempfile.mkstemp(dir=dirpath, prefix='.env.tmp.')
            with os.fdopen(fd, 'w') as tmpf:
                tmpf.writelines(lines)

            # Preserve original permissions if we could read them
            if orig_mode is not None:
                try:
                    os.chmod(tmp_path, orig_mode)
                except Exception:
                    pass

            # Atomic replace
            os.replace(tmp_path, env_path)

            if debug_val == 'false':
                print("DEBUG is OFF")
            else:
                print("DEBUG is ON")
        finally:
            # Clean up tmp file if it still exists
            try:
                if tmp_path and os.path.exists(tmp_path):
                    os.remove(tmp_path)
            except Exception:
                pass


def main():
    """CLI interface for config management."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python config.py <command> [args]")
        print("Commands:")
        print("  debug false        - Set DEBUG to false")
        print("  debug true         - Set DEBUG to true")
        print("  rewind             - Restore dreamers/canon from most recent backup")
        print("  rewind <timestamp> - Restore dreamers/canon from specific backup")
        print("  rewind all         - Restore all data from most recent backup")
        print("  rewind all <time>  - Restore all data from specific backup")
        print("  backups            - List available backups")
        return
    
    command = sys.argv[1].lower()
    
    if command == "debug" and len(sys.argv) > 2:
        value = sys.argv[2].lower()
        if value in ['true', 'false']:
            Config.set_debug(value)
        else:
            print(f"DEBUG value must be 'true' or 'false'")
    
    elif command == "rewind":
        if len(sys.argv) > 2:
            if sys.argv[2] == "all":
                # Restore all data from most recent or specific backup
                timestamp = sys.argv[3] if len(sys.argv) > 3 else None
                Config.rewind_data(timestamp, include_all=True)
            else:
                # Specific timestamp provided for dreamers/canon only
                timestamp = sys.argv[2]
                Config.rewind_data(timestamp)
        else:
            # Use most recent backup for dreamers/canon only
            Config.rewind_data()
    
    elif command == "backups":
        Config.list_backups()
    
    else:
        print(f"Unknown command: {command}")
        print("Use 'python config.py' with no args to see available commands")


if __name__ == "__main__":
    main()