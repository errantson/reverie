import json
import sys
from scripts.dreamer_utils import save_dreamers

def add_kindred(name1, name2, link, dreamers):
    if not link:
        print("Error: No link supplied. Operation aborted.")
        return  # Exit function without proceeding further

    # Ensure both dreamers exist in dreamers.json
    dreamer1 = next((d for d in dreamers if d['name'].lower() == name1.lower() or d['handle'].lower() == name1.lower()), None)
    dreamer2 = next((d for d in dreamers if d['name'].lower() == name2.lower() or d['handle'].lower() == name2.lower()), None)

    if not dreamer1:
        print(f"Error: Dreamer '{name1}' not found. Operation aborted.")
        return  # Exit function without proceeding further
    if not dreamer2:
        print(f"Error: Dreamer '{name2}' not found. Operation aborted.")
        return  # Exit function without proceeding further

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

    full_link = f"{dreamer1['did']}/app.bsky.feed.post/{link}"
    new_journal_entry = {
        "event": f"is kindred to {dreamer1['name']}",
        "did": dreamer2['did'],
        "epoch": current_epoch,
        "link": full_link
    }

    with open('data/journal.json', 'r') as f:
        journal = json.load(f)
    journal.append(new_journal_entry)

    with open('data/journal.json', 'w') as f:
        json.dump(journal, f, indent=4)

    print(f"Journal entry added: {new_journal_entry}")

def update_kindred(dreamers, current_epoch):
    # Load existing kindred pairs from kindred.json
    try:
        with open('data/kindred.json', 'r') as f:
            kindred_pairs = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        kindred_pairs = []

    # Convert kindred pairs to a set of tuples for easier checking
    kindred_set = {tuple(sorted(pair)) for pair in kindred_pairs}

    # Load journal entries
    with open('data/journal.json', 'r') as f:
        journal = json.load(f)

    for dreamer1 in dreamers:
        if 'kindred' not in dreamer1:
            continue

        for did2 in dreamer1['kindred']:
            dreamer2 = next((d for d in dreamers if d['did'] == did2), None)
            if not dreamer2 or 'kindred' not in dreamer2:
                continue

            # Check if dreamer2 lists dreamer1 as kindred
            if dreamer1['did'] in dreamer2['kindred']:
                pair = tuple(sorted([dreamer1['did'], dreamer2['did']]))
                if pair not in kindred_set:
                    # Add the pair to kindred.json
                    kindred_pairs.append(list(pair))
                    kindred_set.add(pair)
                    print(f"Added kindred pair: {pair}")

                    # Add a journal entry
                    journal_entry = {
                        "event": f" and {dreamer2['name']} are true kindred",
                        "did": dreamer1['did'],
                        "epoch": current_epoch,
                        "link": ""
                    }
                    journal.append(journal_entry)
                    print(f"Added journal entry: {journal_entry}")

    # Save updated kindred.json
    with open('data/kindred.json', 'w') as f:
        json.dump(kindred_pairs, f, indent=4)

    # Save updated journal.json
    with open('data/journal.json', 'w') as f:
        json.dump(journal, f, indent=4)

    print("Kindred relationships updated successfully.")
