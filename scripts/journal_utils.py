import json
import random

def add_journal_entry(name, event, link, dreamers):
    matched_dreamer = next((dreamer for dreamer in dreamers if dreamer.get('name') == name), None)
    
    if not matched_dreamer:
        print(f"Dreamer '{name}' not found. Please add the dreamer first using the 'new' function.")
        return
    
    did = matched_dreamer['did']
    print(f"Dreamer found: {matched_dreamer['name']} (DID: {did})")
    
    with open('world.json', 'r') as f:
        world = json.load(f)
    current_epoch = world['epoch']
    
    new_journal_entry = {
        "event": event,
        "did": did,
        "epoch": current_epoch,
        "link": f"did:plc:{link}" if link else ""
    }
    
    with open('data/journal.json', 'r') as f:
        journal = json.load(f)
    journal.append(new_journal_entry)
    
    with open('data/journal.json', 'w') as f:
        json.dump(journal, f, indent=4)
    
    print(f"Added new event to journal.json: {new_journal_entry}")

def update_journal(dreamers):
    with open('data/journal.json', 'r') as f:
        journal = json.load(f)

    journal_dids = {entry['did'] for entry in journal if entry['epoch'] == 0 and entry['event'] == "discovered our wild mindscape"}
    dreamer_dids = {dreamer['did'] for dreamer in dreamers if dreamer.get('did')}

    missing_dids = dreamer_dids - journal_dids
    for did in missing_dids:
        journal.append({
            "event": "discovered our wild mindscape",
            "did": did,
            "epoch": 0,
            "link": ""
        })
        print(f"Added missing journal entry for DID: {did}")

    with open('data/journal.json', 'w') as f:
        json.dump(journal, f, indent=4)

    print("Journal updated successfully.")

def sort_journal_by_epoch():
    with open('data/journal.json', 'r') as f:
        journal = json.load(f)
    
    journal.sort(key=lambda entry: entry['epoch'])
    
    with open('data/journal.json', 'w') as f:
        json.dump(journal, f, indent=4)
    
    print("Journal sorted by epoch successfully.")

def shuffle_epoch_0_items():
    with open('data/journal.json', 'r') as f:
        journal = json.load(f)
    
    # Separate epoch 0 items and other items
    epoch_0_items = [entry for entry in journal if entry['epoch'] == 0]
    other_items = [entry for entry in journal if entry['epoch'] != 0]
    
    # Shuffle epoch 0 items
    random.shuffle(epoch_0_items)
    
    # Combine epoch 0 items at the top, followed by other items
    journal = epoch_0_items + other_items
    
    # Save the updated journal
    with open('data/journal.json', 'w') as f:
        json.dump(journal, f, indent=4)
    
    print("Shuffled epoch 0 items and placed them at the top in journal.json.")