import json
from scripts.did_utils import get_did_from_handle, get_handle_and_server_from_did
from scripts.profile_utils import get_bsky_profile, get_bsky_description_from_did
from scripts.journal_utils import shuffle_epoch_0_items

def load_dreamers():
    with open('data/dreamers.json', 'r') as f:
        return json.load(f)

def save_dreamers(dreamers):
    with open('data/dreamers.json', 'w') as f:
        json.dump(dreamers, f, indent=4)

def add_dreamer(name, handle, dreamers, link=None):
    print(f"Starting the process to add a new dreamer: {name} with handle: {handle}.")

    new_dreamer = {
        "name": name,
        "handle": handle,
        "did": None,
        "server": None,
        "bio": "",
        "avatar": None,
        "banner": None
    }
    dreamers.append(new_dreamer)
    print(f"Step 1: Added new dreamer to the local list. Name: {name}, Handle: {handle}")

    # Update the new dreamer's profile to fetch DID and other details
    print(f"Step 2: Attempting to update the dreamer's profile to fetch DID and other details...")
    update_dreamer_entry(new_dreamer)

    # Ensure DID is resolved before adding journal entries
    if not new_dreamer['did']:
        print(f"Step 3: Failed to resolve DID for {name} with handle: {handle}. Skipping journal entry.")
        return
    print(f"Step 3: Successfully resolved DID for {name}. DID: {new_dreamer['did']}")

    # Save the updated dreamers list to dreamers.json
    print(f"Step 4: Saving the updated dreamers list to dreamers.json...")
    save_dreamers(dreamers)
    print(f"Dreamers list successfully updated in dreamers.json.")

    # Add to journal.json under epoch 0
    print(f"Step 5: Adding a journal entry for 'discovered our wild mindscape' under epoch 0...")
    with open('data/journal.json', 'r') as f:
        journal = json.load(f)
    
    new_journal_entry = {
        "event": "discovered our wild mindscape",
        "did": new_dreamer['did'],  # DID is now resolved
        "epoch": 0,
        "link": ""  # Ensure no link is added here
    }
    journal.append(new_journal_entry)
    print(f"Journal entry added for {name} with DID: {new_dreamer['did']} at epoch 0.")

    # Add a "gained a name (name)" entry at the current epoch
    print(f"Step 6: Adding a 'gained a name' journal entry for {name}...")
    with open('data/world.json', 'r') as f:
        world = json.load(f)
    current_epoch = world['epoch']
    
    gained_name_entry = {
        "event": f"gained a name ({name})",
        "did": new_dreamer['did'],  # DID is now resolved
        "epoch": current_epoch,
        "link": f"{new_dreamer['did']}/app.bsky.feed.post/{link}" if link else ""  # Add link here if provided
    }
    journal.append(gained_name_entry)
    print(f"'Gained a name' journal entry added for {name} at epoch {current_epoch}.")

    # Save the updated journal
    print(f"Step 7: Saving the updated journal to journal.json...")
    with open('data/journal.json', 'w') as f:
        json.dump(journal, f, indent=4)
    print(f"Journal successfully updated for {name}. Process completed.")

    # Step 8: Shuffle epoch 0 items
    print(f"Step 8: Shuffling epoch 0 items in the journal...")
    shuffle_epoch_0_items()
    print(f"Epoch 0 items shuffled successfully.")

def update_dreamer_entry(dreamer):
    record_updated = False
    did = dreamer.get('did')
    handle = dreamer.get('handle')
    
    if not did and handle:
        new_did = get_did_from_handle(handle)
        if new_did:
            dreamer['did'] = new_did
            did = new_did
            record_updated = True
        else:
            print(f"DID not found for handle: {handle}")
    
    if did:
        new_handle, server = get_handle_and_server_from_did(did)
        if new_handle and new_handle != handle:
            dreamer['handle'] = new_handle
            handle = new_handle
            record_updated = True
        if server and server != dreamer.get('server'):
            dreamer['server'] = server
            record_updated = True
        elif not server:
            print(f"Server not found for DID: {did}")
    
    # Fetch additional bsky profile details if available
    if handle and not handle.endswith('.reverie.house'):
        bsky_profile = get_bsky_profile(handle)
        if bsky_profile:
            if dreamer.get('displayName') != bsky_profile.get('displayName'):
                dreamer['displayName'] = bsky_profile.get('displayName')
                record_updated = True
            if dreamer.get('avatar') != bsky_profile.get('avatar'):
                dreamer['avatar'] = bsky_profile.get('avatar')
                record_updated = True
            if dreamer.get('banner') != bsky_profile.get('banner'):
                dreamer['banner'] = bsky_profile.get('banner')
                record_updated = True
    
    # Update profile details from the bsky getRecord call
    if dreamer.get('did'):
        profile_record = get_bsky_description_from_did(dreamer['did'], dreamer.get('server'))
        if profile_record:
            if profile_record.get('description') and dreamer.get('bio') != profile_record.get('description'):
                dreamer['bio'] = profile_record.get('description')
                record_updated = True
            if profile_record.get('avatar') and dreamer.get('avatar') != profile_record.get('avatar'):
                dreamer['avatar'] = profile_record.get('avatar')
                record_updated = True
            if profile_record.get('banner') and dreamer.get('banner') != profile_record.get('banner'):
                dreamer['banner'] = profile_record.get('banner')
                record_updated = True
    
    if record_updated:
        print(f"Updated dreamer record for DID: {dreamer['did']}")