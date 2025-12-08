#!/usr/bin/env python3
"""
🌍 REVERIE WORLD - World State and Movement System

This module provides:
1. World state reporting (canon, dreamers, souvenirs)
2. World tick system (heading-based movement)
3. CLI interface for world operations
4. Spectrum snapshot history tracking

Usage:
    python3 world.py                    # Show world state
    python3 world.py tick               # Execute one world tick
    python3 world.py tick --loop 60     # Continuous ticks every 60 seconds
    python3 world.py heading set <handle> <heading>
    python3 world.py heading get <handle>
    python3 world.py heading list
    python3 world.py heading stats
    python3 world.py reset              # Reset all dreamers to origin
    python3 world.py move <did> <axis>:<delta> [<axis>:<delta>...]
    python3 world.py snapshots list     # List spectrum snapshots
    python3 world.py snapshots view <id> # View snapshot details
"""

import os
import sys
import json
import time
import random
import urllib.request
from typing import Dict, Optional
from config import Config
from core.movement import HeadingManager, MovementUtilities


def hsl_to_hex(h, s, l):
    """Convert HSL color values to hex. H is 0-360, S and L are 0-100."""
    s = s / 100.0
    l = l / 100.0
    
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    
    if 0 <= h < 60:
        r, g, b = c, x, 0
    elif 60 <= h < 120:
        r, g, b = x, c, 0
    elif 120 <= h < 180:
        r, g, b = 0, c, x
    elif 180 <= h < 240:
        r, g, b = 0, x, c
    elif 240 <= h < 300:
        r, g, b = x, 0, c
    else:
        r, g, b = c, 0, x
    
    r = int((r + m) * 255)
    g = int((g + m) * 255)
    b = int((b + m) * 255)
    
    return f"#{r:02x}{g:02x}{b:02x}"


def display_world_data(canon_count, dreamers_count, souvenirs_count):
    """Display world data including system stats and counts."""
    from core.database import DatabaseManager
    
    keeper = "reverie.house"
    keeper_did = None
    
    # Get keeper info
    try:
        db = DatabaseManager()
        cursor = db.execute(
            "SELECT handle, did FROM dreamers WHERE handle = ? OR name = ?",
            ('reverie.house', 'errantson')
        )
        row = cursor.fetchone()
        if row:
            keeper = row['handle']
            keeper_did = row['did']
    except Exception:
        pass
    
    epoch = int(time.time())
    
    # Fetch Bluesky user count
    idle_dreamers = None
    try:
        with urllib.request.urlopen('https://bsky-users.theo.io/api/stats', timeout=5) as response:
            bsky_data = json.loads(response.read().decode())
            idle_dreamers = bsky_data.get('last_user_count')
    except Exception:
        pass
    
    # Load discrete_dreamweavers
    discrete_dreamweavers = 0
    try:
        db = DatabaseManager()
        cursor = db.execute("SELECT value FROM world_state WHERE key = %s", ('discretes',))
        row = cursor.fetchone()
        if row:
            discrete_dreamweavers = int(row['value'])
    except Exception:
        pass
    
    # Load readers (book purchasers)
    readers = 0
    try:
        db = DatabaseManager()
        cursor = db.execute("SELECT value FROM world_state WHERE key = %s", ('readers',))
        row = cursor.fetchone()
        if row:
            readers = int(json.loads(row['value']))
    except Exception:
        pass

    total_dreamweavers = dreamers_count + discrete_dreamweavers
    
    # Generate world color (default: lapis blue)
    world_color = "#4169E1"
    env_color = os.getenv('COLOR', '').strip()
    if env_color and env_color.startswith('#'):
        world_color = env_color
    
    rng_color = os.getenv('RNGCOLOR', 'false').lower() in ('true', '1', 'yes', 'on')
    if rng_color:
        random.seed(epoch)
        hue = random.randint(0, 360)
        saturation = random.randint(50, 80)
        lightness = random.randint(35, 55)
        world_color = hsl_to_hex(hue, saturation, lightness)

    logins_enabled = os.getenv('LOGINS', 'false').lower() in ('true', '1', 'yes', 'on')
    
    # Canon ratio: multiplier for canon tags vs lore tags in contribution scoring
    # 1pt per lore:reverie.house tag, canon_ratio pts per canon:reverie.house tag
    canon_ratio = 3
    
    # Contribution scoring parameters
    early_bonus_max = 0.5      # 50% bonus for founding era contributions as they age
    quiet_bonus_max = 1.0      # 100% bonus when community is smallest
    capacity = 2000            # Target community size for phase calculations
    
    world_data = {
        "keeper": keeper,
        "keeper_did": keeper_did,
        "epoch": epoch,
        "canon_size": canon_count,
        "dreamers": total_dreamweavers,
        "discretes": discrete_dreamweavers,
        "souvenirs": souvenirs_count,
        "idle_dreamers": idle_dreamers,
        "color": world_color,
        "logins": logins_enabled,
        "readers": readers,
        "canon_ratio": canon_ratio,
        "early_bonus_max": early_bonus_max,
        "quiet_bonus_max": quiet_bonus_max,
        "capacity": capacity
    }
    
    print(f"keeper: {keeper} ({keeper_did})")
    print(f"epoch: {epoch}")
    print()
    print(f"canon size: {canon_count} entries")
    print()
    print(f"dreamers: {total_dreamweavers} (public: {dreamers_count}, discrete: {discrete_dreamweavers})")
    print(f"souvenirs: {souvenirs_count}")
    print(f"readers: {readers}")
    if idle_dreamers:
        print(f"idle dreamers: {idle_dreamers:,}")
    
    # Save to world_state table
    try:
        db = DatabaseManager()
        for key, value in world_data.items():
            db.execute(
                "INSERT OR REPLACE INTO world_state (key, value, updated_at) VALUES (?, ?, ?)",
                (key, json.dumps(value), epoch)
            )
    except Exception:
        pass


def show_world_state():
    """Show current world state."""
    from core.database import DatabaseManager
    
    try:
        db = DatabaseManager()
        
        cursor = db.execute("SELECT COUNT(*) as count FROM dreamers")
        dreamers_count = cursor.fetchone()['count']
        
        cursor = db.execute("SELECT COUNT(DISTINCT souvenir_key) as count FROM dreamer_souvenirs")
        souvenirs_count = cursor.fetchone()['count']
        
        cursor = db.execute("SELECT COUNT(*) as count FROM canon")
        canon_count = cursor.fetchone()['count']
        
        display_world_data(canon_count, dreamers_count, souvenirs_count)
        
        # Save spectrum snapshot when displaying world state
        # DISABLED: Spectrum snapshots no longer saved (2025-12-08)
        # try:
        #     snapshot_id = db.save_spectrum_snapshot(
        #         operation='world_state_display',
        #         notes='Snapshot from world.py execution'
        #     )
        #     print()
        #     print(f"📸 Spectrum snapshot saved (ID: {snapshot_id})")
        # except Exception as e:
        #     print()
        #     print(f"⚠️ Failed to save spectrum snapshot: {e}")
        
    except Exception as e:
        print(f"Error loading world data: {e}")
        sys.exit(1)


def cmd_tick(args):
    """Execute world tick."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Execute world tick')
    parser.add_argument('--quiet', '-q', action='store_true', help='Suppress output')
    parser.add_argument('--loop', '-l', type=int, help='Run continuously (seconds)')
    parser.add_argument('--no-zones', action='store_true', help='Skip zone processing')
    
    parsed = parser.parse_args(args)
    
    manager = HeadingManager()
    
    # Import zone manager
    from core.zones import ZoneManager
    zone_manager = ZoneManager()
    zone_manager.load_zones_from_db()
    
    if parsed.loop:
        print(f"🌍 World Tick Loop started (interval: {parsed.loop}s)")
        print("   Press Ctrl+C to stop")
        print()
        
        try:
            while True:
                # Execute heading-based movement
                manager.execute_tick(verbose=not parsed.quiet)
                
                # Process zones
                if not parsed.no_zones:
                    print()
                    zone_stats = zone_manager.process_zones(verbose=not parsed.quiet)
                    if not parsed.quiet:
                        print(f"🌌 Zones: {zone_stats['zones_processed']} processed, {zone_stats['effects_applied']} effects applied")
                
                # Save spectrum snapshot after each tick
                # DISABLED: Spectrum snapshots no longer saved (2025-12-08)
                # try:
                #     from core.database import DatabaseManager
                #     db = DatabaseManager()
                #     snapshot_id = db.save_spectrum_snapshot(
                #         operation='world_tick_loop',
                #         notes=f'Automated tick from loop (interval: {parsed.loop}s)'
                #     )
                #     if not parsed.quiet:
                #         print(f"📸 Spectrum snapshot saved (ID: {snapshot_id})")
                # except Exception as e:
                #     if not parsed.quiet:
                #         print(f"⚠️ Failed to save spectrum snapshot: {e}")
                
                print()
                time.sleep(parsed.loop)
        except KeyboardInterrupt:
            print("\n🛑 World Tick Loop stopped")
            sys.exit(0)
    else:
        # Single tick execution
        stats = manager.execute_tick(verbose=not parsed.quiet)
        
        # Process zones
        if not parsed.no_zones:
            print()
            zone_stats = zone_manager.process_zones(verbose=not parsed.quiet)
            print(f"🌌 Zones: {zone_stats['zones_processed']} processed, {zone_stats['effects_applied']} effects applied")
        
        # Save spectrum snapshot after tick
        # DISABLED: Spectrum snapshots no longer saved (2025-12-08)
        # try:
        #     from core.database import DatabaseManager
        #     db = DatabaseManager()
        #     snapshot_id = db.save_spectrum_snapshot(
        #         operation='world_tick',
        #         notes='Single world tick execution'
        #     )
        #     print(f"📸 Spectrum snapshot saved (ID: {snapshot_id})")
        # except Exception as e:
        #     print(f"⚠️ Failed to save spectrum snapshot: {e}")
        
        sys.exit(0 if stats['failed'] == 0 else 1)


def cmd_heading(args):
    """Manage headings."""
    from core.database import DatabaseManager
    from collections import Counter
    
    if len(args) == 0:
        print("Usage: world.py heading <command>")
        print("Commands: set, get, list, clear, stats")
        sys.exit(1)
    
    subcmd = args[0]
    manager = HeadingManager()
    db = DatabaseManager()
    
    if subcmd == 'set':
        if len(args) != 3:
            print("Usage: world.py heading set <handle> <heading>")
            sys.exit(1)
        
        handle = args[1]
        heading = args[2]
        
        # Validate heading
        valid_axes = ['entropy', 'oblivion', 'liberty', 'authority', 'receptive', 'skeptic']
        if heading not in ['keeper', 'affix'] and not heading.startswith('did:'):
            valid = any(heading in [f"{axis}+", f"{axis}-"] for axis in valid_axes)
            if not valid:
                print(f"❌ Invalid heading: {heading}")
                print(f"   Valid: <axis>+/-, keeper, did:plc:..., affix")
                sys.exit(1)
        
        # Get DID from handle
        cursor = db.execute("SELECT did FROM dreamers WHERE handle = %s", (handle,))
        row = cursor.fetchone()
        if not row:
            print(f"❌ Dreamer not found: {handle}")
            sys.exit(1)
        
        result = manager.set_heading(row['did'], heading)
        if result['success']:
            print(f"✅ Set heading for {handle}: {heading}")
        else:
            print(f"❌ Failed to set heading")
            sys.exit(1)
    
    elif subcmd == 'get':
        if len(args) != 2:
            print("Usage: world.py heading get <handle>")
            sys.exit(1)
        
        cursor = db.execute(
            "SELECT handle, name, heading FROM dreamers WHERE handle = ?",
            (args[1],)
        )
        row = cursor.fetchone()
        if not row:
            print(f"❌ Dreamer not found: {args[1]}")
            sys.exit(1)
        
        heading = row['heading'] or '(none)'
        print(f"🧭 {row['name']} ({row['handle']})")
        print(f"   Heading: {heading}")
    
    elif subcmd == 'list':
        cursor = db.execute("SELECT handle, name, heading FROM dreamers ORDER BY name")
        print("🧭 Dreamer Headings")
        print()
        for row in cursor.fetchall():
            heading = row['heading'] or '(none)'
            print(f"   {row['name']:20} | {heading}")
    
    elif subcmd == 'clear':
        if len(args) != 2:
            print("Usage: world.py heading clear <handle>")
            sys.exit(1)
        
        cursor = db.execute("SELECT did FROM dreamers WHERE handle = %s", (args[1],))
        row = cursor.fetchone()
        if not row:
            print(f"❌ Dreamer not found: {args[1]}")
            sys.exit(1)
        
        if manager.clear_heading(row['did']):
            print(f"✅ Cleared heading for {args[1]}")
        else:
            print(f"❌ Failed to clear heading")
            sys.exit(1)
    
    elif subcmd == 'stats':
        cursor = db.execute("SELECT heading FROM dreamers")
        headings = [row['heading'] for row in cursor.fetchall()]
        
        total = len(headings)
        set_headings = [h for h in headings if h]
        unset = total - len(set_headings)
        
        print("📊 Heading Statistics")
        print()
        print(f"   Total dreamers: {total}")
        print(f"   With headings: {len(set_headings)}")
        print(f"   Without headings: {unset}")
        print()
        
        if set_headings:
            print("   Heading distribution:")
            counter = Counter(set_headings)
            for heading, count in counter.most_common():
                print(f"      {heading:20} : {count}")
    
    else:
        print(f"Unknown heading command: {subcmd}")
        sys.exit(1)


def cmd_reset(args):
    """Reset all dreamers to origin."""
    utils = MovementUtilities()
    result = utils.reset_all_to_origin(verbose=True)
    sys.exit(0 if result['failed'] == 0 else 1)


def cmd_move(args):
    """Move a dreamer by deltas."""
    if len(args) < 2:
        print("Usage: world.py move <did> <axis>:<delta> [<axis>:<delta>...]")
        print("Example: world.py move did:plc:... entropy:+5 liberty:-3")
        sys.exit(1)
    
    did = args[0]
    deltas = {}
    
    for arg in args[1:]:
        if ':' not in arg:
            print(f"Invalid delta format: {arg}")
            sys.exit(1)
        
        axis, delta_str = arg.split(':', 1)
        try:
            delta = int(delta_str)
            deltas[axis] = delta
        except ValueError:
            print(f"Invalid delta value: {delta_str}")
            sys.exit(1)
    
    print(f"Moving dreamer: {did}")
    print(f"Deltas: {deltas}")
    print()
    
    utils = MovementUtilities()
    result = utils.move_dreamer(did, deltas, reason="manual_cli_move")
    
    if result['success']:
        print(f"✅ Moved successfully")
        print(f"   Distance: {result['distance_moved']:.2f}")
        print(f"   Old: {result['old_spectrum']}")
        print(f"   New: {result['new_spectrum']}")
    else:
        print(f"❌ Movement failed: {result.get('error', 'unknown')}")
        sys.exit(1)


def cmd_snapshots(args):
    """View spectrum snapshots."""
    from core.database import DatabaseManager
    from datetime import datetime
    
    if len(args) == 0 or args[0] == 'list':
        # List recent snapshots
        limit = 20
        if len(args) > 1:
            try:
                limit = int(args[1])
            except ValueError:
                print("Invalid limit value")
                sys.exit(1)
        
        db = DatabaseManager()
        cursor = db.execute("""
            SELECT id, epoch, operation, total_dreamers, created_at, notes
            FROM spectrum_snapshots
            ORDER BY id DESC
            LIMIT ?
        """, (limit,))
        
        snapshots = cursor.fetchall()
        
        if not snapshots:
            print("No snapshots found")
            return
        
        print(f"📸 Recent Spectrum Snapshots (last {limit})")
        print()
        print(f"{'ID':<8} {'Date/Time':<20} {'Operation':<25} {'Dreamers':<10}")
        print("=" * 70)
        
        for snap in snapshots:
            dt = datetime.fromtimestamp(snap['created_at'])
            dt_str = dt.strftime('%Y-%m-%d %H:%M:%S')
            print(f"{snap['id']:<8} {dt_str:<20} {snap['operation']:<25} {snap['total_dreamers']:<10}")
            if snap['notes']:
                print(f"         Note: {snap['notes']}")
        
    elif args[0] == 'view':
        # View a specific snapshot
        if len(args) < 2:
            print("Usage: world.py snapshots view <id>")
            sys.exit(1)
        
        try:
            snapshot_id = int(args[1])
        except ValueError:
            print("Invalid snapshot ID")
            sys.exit(1)
        
        db = DatabaseManager()
        cursor = db.execute("""
            SELECT id, epoch, operation, snapshot_data, created_at, notes
            FROM spectrum_snapshots
            WHERE id = ?
        """, (snapshot_id,))
        
        snap = cursor.fetchone()
        
        if not snap:
            print(f"Snapshot {snapshot_id} not found")
            sys.exit(1)
        
        snapshot_data = json.loads(snap['snapshot_data'])
        dt = datetime.fromtimestamp(snap['created_at'])
        
        print(f"📸 Spectrum Snapshot #{snap['id']}")
        print(f"   Date: {dt.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"   Operation: {snap['operation']}")
        if snap['notes']:
            print(f"   Notes: {snap['notes']}")
        print()
        print(f"   Total Dreamers: {snapshot_data['total_dreamers']}")
        print(f"   With Spectrum: {snapshot_data['dreamers_with_spectrum']}")
        print()
        print("Dreamers:")
        print()
        
        for dreamer in snapshot_data['dreamers']:
            heading = dreamer.get('heading') or 'None'
            print(f"   {dreamer['name']:<20} | Heading: {heading:<15}", end='')
            
            if dreamer['coordinates']:
                coords = dreamer['coordinates']
                print(f" | Position: ({coords['x']:>4}, {coords['y']:>4}, {coords['z']:>4})")
            else:
                print(" | Position: No spectrum")
    
    else:
        print("Usage: world.py snapshots <command>")
        print("Commands:")
        print("  list [limit]  - List recent snapshots (default: 20)")
        print("  view <id>     - View detailed snapshot")
        sys.exit(1)


def main():
    """Main CLI entry point."""
    if len(sys.argv) == 1:
        show_world_state()
        return
    
    command = sys.argv[1]
    args = sys.argv[2:]
    
    if command == 'tick':
        cmd_tick(args)
    elif command == 'heading':
        cmd_heading(args)
    elif command == 'reset':
        cmd_reset(args)
    elif command == 'move':
        cmd_move(args)
    elif command == 'snapshots':
        cmd_snapshots(args)
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
