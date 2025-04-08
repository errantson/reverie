import sys
import json
from scripts.did_utils import get_did_from_handle, get_handle_and_server_from_did
from scripts.profile_utils import get_bsky_profile, get_bsky_description_from_did
from scripts.journal_utils import add_journal_entry, update_journal, sort_journal_by_epoch, shuffle_epoch_0_items
from scripts.world_utils import update_world
from scripts.dreamer_utils import add_dreamer, update_dreamer_entry, load_dreamers, save_dreamers

# Load data from JSON files
with open('data/dreamers.json', 'r') as f:
    dreamers = json.load(f)

with open('data/journal.json', 'r') as f:
    journal = json.load(f)

with open('data/world.json', 'r') as f:
    world = json.load(f)

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
        Add a kindred relationship between two dreamers with an optional link.

    Run without arguments to update all dreamers, journal, and world state.
    """)

def add_kindred(name1, name2, link, dreamers):
    if not link:
        print("Error: No link supplied. Operation cancelled.")
        return

    # Ensure both dreamers exist in dreamers.json
    dreamer1 = next((d for d in dreamers if d['name'].lower() == name1.lower() or d['handle'].lower() == name1.lower()), None)
    dreamer2 = next((d for d in dreamers if d['name'].lower() == name2.lower() or d['handle'].lower() == name2.lower()), None)

    if not dreamer1:
        print(f"Error: Dreamer '{name1}' not found. Operation cancelled.")
        return
    if not dreamer2:
        print(f"Error: Dreamer '{name2}' not found. Operation cancelled.")
        return

    # Add kindred relationship to dreamer1
    if 'kindred' not in dreamer1:
        dreamer1['kindred'] = []
    if dreamer2['did'] not in dreamer1['kindred']:
        dreamer1['kindred'].append(dreamer2['did'])
        print(f"Added {dreamer2['did']} as kindred to {dreamer1['name']}.")

    # Save updated dreamers.json
    save_dreamers(dreamers)

    # Add journal entry
    with open('data/world.json', 'r') as f:
        world = json.load(f)
    current_epoch = world['epoch']

    new_journal_entry = {
        "event": f"is kindred to {dreamer1['name']}",
        "did": dreamer2['did'],
        "epoch": current_epoch,
        "link": f"{dreamer1['did']}/app.bsky.feed.post/{link}"
    }

    with open('data/journal.json', 'r') as f:
        journal = json.load(f)
    journal.append(new_journal_entry)

    with open('data/journal.json', 'w') as f:
        json.dump(journal, f, indent=4)

    print(f"Journal entry added: {new_journal_entry}")

# Command-line argument handling
if len(sys.argv) == 2 and sys.argv[1].lower() == "help":
    display_help()
    sys.exit(0)

if len(sys.argv) >= 4 and sys.argv[1].lower() == "new":
    name_arg = sys.argv[2]
    handle_or_did_arg = sys.argv[3]
    link_arg = sys.argv[4] if len(sys.argv) > 4 else None
    add_dreamer(name_arg, handle_or_did_arg, dreamers, link_arg)
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
    link_arg = sys.argv[4]
    add_kindred(name1_arg, name2_arg, link_arg, dreamers)
    sys.exit(0)

# Update dreamers
for dreamer in dreamers:
    update_dreamer_entry(dreamer)

# Save updated dreamers
with open('data/dreamers.json', 'w') as f:
    json.dump(dreamers, f, indent=4)

# Update journal
update_journal(dreamers)

# Sort journal by epoch
sort_journal_by_epoch()

# Shuffle epoch 0 items (moved after sorting)
shuffle_epoch_0_items()

# Update world state
update_world()
