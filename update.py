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
        
    python update.py souv <name> <souvenir>
        Add a souvenir to the dreamer's collection and record it in the journal.
        
    python update.py newsouv
        Create a new souvenir entry interactively. Fields will be prompted one by one.

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

if len(sys.argv) >= 3 and sys.argv[1].lower() == "souv":
    dreamer_name = sys.argv[2]
    print(f"Initiating souvenir addition for dreamer: {dreamer_name}")
    
    # Find dreamer by name (case-insensitive)
    matched_dreamer = next((d for d in dreamers if d.get('name','').lower() == dreamer_name.lower()), None)
    if not matched_dreamer:
        print(f"Error: Dreamer '{dreamer_name}' not found. Please add them first using the 'new' command.")
        sys.exit(1)
    print(f"Dreamer found: {matched_dreamer['name']} {matched_dreamer.get('did','')}")
    
    # Prompt for Souvenir ID to Apply and cross-reference with souvenirs.json
    try:
        souvenir_id_input = input("Enter Souvenir ID to Apply: ")
        souvenir_id = int(souvenir_id_input.strip())
    except ValueError:
        print("Souvenir ID must be an integer.")
        sys.exit(1)
    
    try:
        with open('data/souvenirs.json', 'r') as f:
            souvenirs_list = json.load(f)
    except Exception as e:
        print(f"Error: Couldn't load souvenirs.json ({e}).")
        sys.exit(1)
    souvenir_entry = next((s for s in souvenirs_list if s.get('id') == souvenir_id), None)
    if not souvenir_entry:
        print(f"Error: Souvenir with ID {souvenir_id} not found.")
        sys.exit(1)
    souvenir_name = souvenir_entry.get('name', '')
    souvenir_description = souvenir_entry.get('description', '')
    
    # Display summary for confirmation
    print(f"\nApply ({souvenir_name}) to {matched_dreamer['name']}?")
    print(f"\"{souvenir_description}\"")
    while True:
        confirm = input("Type YES to confirm: ")
        if confirm == "":
            continue
        elif confirm != "YES":
            print("Souvenir addition aborted.")
            sys.exit(0)
        else:
            break
    
    # Add souvenir to the dreamer's collection; create 'souvenirs' array if missing
    if 'souvenirs' not in matched_dreamer:
        matched_dreamer['souvenirs'] = []
    if souvenir_id in matched_dreamer['souvenirs']:
        print(f"Error: Souvenir ID '{souvenir_id}' already exists for {matched_dreamer['name']}.")
        sys.exit(1)
    else:
        matched_dreamer['souvenirs'].append(souvenir_id)
        # Instead of previous output, show general update message:
        print("Dreamer Data Updated")
    
    # Save updated dreamers.json
    save_dreamers(dreamers)
    
    # Create a new journal entry for the souvenir event using epoch from world.json
    current_epoch = world.get('epoch', 0)
    new_journal_entry = {
        "event": f"kept a souvenir ({souvenir_name})",
        "did": matched_dreamer.get('did', ''),
        "epoch": current_epoch,
        "link": f"/souvenirs.html?id={souvenir_id}"  # Updated link format to match journal.json events
    }
    journal.append(new_journal_entry)
    with open('data/journal.json', 'w') as f:
        json.dump(journal, f, indent=4)
    
    # Adjusted Journal Entry output with simplified format:
    print("Journal Data Updated")
    print(f"\n{matched_dreamer['name']} kept a souvenir ({souvenir_name})")
    print(f"{matched_dreamer.get('did','')} || epoch {current_epoch}\n")
    sys.exit(0)

if len(sys.argv) == 2 and sys.argv[1].lower() == "reset":
    reset_data()
    sys.exit(0)

if len(sys.argv) >= 2 and sys.argv[1].lower() == "newsouv":
    print("Creating new souvenir...")
    
    # Load existing souvenirs to compute next available ID
    try:
        with open('data/souvenirs.json', 'r') as f:
            existing_souvenirs = json.load(f)
    except Exception as e:
        print(f"Couldn't load souvenirs.json ({e}). Starting fresh.")
        existing_souvenirs = []
    next_id = max((s.get('id', 0) for s in existing_souvenirs), default=0) + 1

    override_input = input(f"NEXT AVAILABLE ID: {next_id:03d}\nPress Enter to Accept\n(or submit id override): ")
    if override_input.strip() == "":
        souvenir_id = next_id
    else:
        try:
            override_id = int(override_input.strip())
        except ValueError:
            print("Souvenir ID must be an integer.")
            sys.exit(1)
        if any(s.get('id') == override_id for s in existing_souvenirs):
            print("That ID already exists.")
            sys.exit(1)
        print("Override accepted: Using alternate ID.")
        souvenir_id = override_id

    souvenir = {}
    souvenir['id'] = souvenir_id
    souvenir['name'] = input("Souvenir name: ")
    souvenir['description'] = input("Description: ")
    # Prompt for art filename and verify file exists
    art_filename = input("Enter art filename (e.g., strange_dream.png): ").strip()
    if not art_filename:
        print("Error: Art filename cannot be empty.")
        sys.exit(1)
    art_path = os.path.join("souvenirs", art_filename)
    if not os.path.exists(art_path):
        print(f"Error: Art file '{art_path}' does not exist.")
        sys.exit(1)
    souvenir['art'] = f"/souvenirs/{art_filename}"
    current_epoch = world.get('epoch', 0)
    souvenir['epoch'] = current_epoch
    print(f"Epoch: {current_epoch}.")

    # Load existing souvenirs list or start new list
    try:
        with open('data/souvenirs.json', 'r') as f:
            souvenirs = json.load(f)
    except Exception as e:
        print(f"Couldn't load souvenirs.json ({e}). Starting fresh.")
        souvenirs = []
        
    souvenirs.append(souvenir)
    with open('data/souvenirs.json', 'w') as f:
        json.dump(souvenirs, f, indent=4)
    print(f"Souvenir saved: {souvenir}")
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
