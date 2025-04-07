import sys
import json
from scripts.did_utils import get_did_from_handle, get_handle_and_server_from_did
from scripts.profile_utils import get_bsky_profile, get_bsky_description_from_did
from scripts.journal_utils import add_event, add_journal_entry, update_journal, sort_journal_by_epoch, shuffle_epoch_0_items
from scripts.world_utils import update_world
from scripts.dreamer_utils import add_dreamer, update_dreamer_entry, load_dreamers, save_dreamers

# Load data from JSON files
with open('data/dreamers.json', 'r') as f:
    dreamers = json.load(f)

with open('data/journal.json', 'r') as f:
    journal = json.load(f)

with open('data/world.json', 'r') as f:
    world = json.load(f)

# Command-line argument handling
if len(sys.argv) == 2 and sys.argv[1].lower() == "help":
    display_help()
    sys.exit(0)

if len(sys.argv) == 4 and sys.argv[1].lower() == "new":
    name_arg = sys.argv[2]
    handle_or_did_arg = sys.argv[3]
    add_dreamer(name_arg, handle_or_did_arg, dreamers)
    sys.exit(0)

if len(sys.argv) >= 4 and sys.argv[1].lower() == "journal":
    name_arg = sys.argv[2]
    event_arg = sys.argv[3]
    link_arg = sys.argv[4] if len(sys.argv) > 4 else None
    add_journal_entry(name_arg, event_arg, link_arg, dreamers)
    sys.exit(0)

# Update dreamers
for dreamer in dreamers:
    update_dreamer_entry(dreamer)

# Save updated dreamers
with open('data/dreamers.json', 'w') as f:
    json.dump(dreamers, f, indent=4)

# Update journal
update_journal(dreamers)

# Shuffle and sort journal
shuffle_epoch_0_items()
sort_journal_by_epoch()

# Update world state
update_world()
