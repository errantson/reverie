import sys
import json
import os
from scripts.did_utils import get_did_from_handle, get_handle_and_server_from_did
from scripts.profile_utils import get_bsky_profile, get_bsky_description_from_did
from scripts.journal_utils import add_journal_entry, update_discoveries, sort_journal_by_epoch, shuffle_epoch_0_items
from scripts.world_utils import update_world, get_current_epoch
from scripts.dreamer_utils import add_dreamer, update_dreamer_entry, load_dreamers, save_dreamers
from scripts.kindred_utils import add_kindred, update_kindred
from scripts.reset_utils import reset_data

# Helper function to load JSON files safely
def load_json_file(filepath):
    if not os.path.exists(filepath):
        print(f"Error: File not found - {filepath}")
        return None
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Failed to parse JSON file - {filepath}. Error: {e}")
        return None

# Load data from JSON files
dreamers = load_json_file('data/dreamers.json') or []
journal = load_json_file('data/journal.json') or []
world = load_json_file('data/world.json') or {"epoch": 0}

def display_help():
    print("""
Usage:
    python update.py help
        Display this help message.

    python update.py new <name> <handle_or_did> [link]
        Add a new dreamer with the given name, handle or DID, and optional link.

    python update.py journal <name> <event> [link]
        Add a journal entry for the specified dreamer with an event and optional link.

    python update.py kindred <name1> <name2> <link>
        Add a kindred relationship between two dreamers with a mandatory link.

    python update.py reset
        Reset the data files by downloading the latest versions from reverie.house.

    Run without arguments to update all dreamers, journal, and world state.
    """)

# Command-line argument handling
if len(sys.argv) == 2 and sys.argv[1].lower() == "help":
    display_help()
    sys.exit(0)

if len(sys.argv) >= 4 and sys.argv[1].lower() == "new":
    name_arg = sys.argv[2]
    handle_or_did_arg = sys.argv[3]
    link_arg = sys.argv[4] if len(sys.argv) > 4 else None
    add_dreamer(name_arg, handle_or_did_arg, dreamers, link_arg)
    save_dreamers(dreamers)

    # Run baseline updates after adding a new dreamer
    for dreamer in dreamers:
        update_dreamer_entry(dreamer)
    save_dreamers(dreamers)
    update_discoveries(dreamers)
    current_epoch = get_current_epoch(world)
    update_kindred(dreamers, current_epoch)
    sort_journal_by_epoch()
    shuffle_epoch_0_items()
    update_world()

    sys.exit(0)

if len(sys.argv) >= 4 and sys.argv[1].lower() == "journal":
    name_arg = sys.argv[2]
    event_arg = sys.argv[3]
    link_arg = sys.argv[4] if len(sys.argv) > 4 else None
    add_journal_entry(name_arg, event_arg, link_arg, dreamers)
    sys.exit(0)

if len(sys.argv) >= 5 and sys.argv[1].lower() == "kindred":
    name1_arg = sys.argv[2]
    name2_arg = sys.argv[3]
    link_arg = sys.argv[4]  # Link is now mandatory
    add_kindred(name1_arg, name2_arg, link_arg, dreamers)
    save_dreamers(dreamers)

    # Run baseline updates after adding kindred relationships
    for dreamer in dreamers:
        update_dreamer_entry(dreamer)
    save_dreamers(dreamers)
    update_discoveries(dreamers)
    current_epoch = get_current_epoch(world)
    update_kindred(dreamers, current_epoch)
    sort_journal_by_epoch()
    shuffle_epoch_0_items()
    update_world()

    sys.exit(0)

if len(sys.argv) == 2 and sys.argv[1].lower() == "reset":
    reset_data()
    sys.exit(0)

# Only run the following updates if no specific command was executed
if len(sys.argv) == 1:
    # Update dreamers
    for dreamer in dreamers:
        update_dreamer_entry(dreamer)

    # Save updated dreamers
    save_dreamers(dreamers)

    # Update discoveries 
    update_discoveries(dreamers)

    # Update kindred relationships
    current_epoch = get_current_epoch(world)
    update_kindred(dreamers, current_epoch)

    # Sort journal by epoch
    sort_journal_by_epoch()

    # Shuffle epoch 0 items (moved after sorting)
    shuffle_epoch_0_items()

    # Update world state
    update_world()
