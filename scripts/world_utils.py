import json
import time

def update_world():
    with open('data/world.json', 'r') as f:
        world = json.load(f)

    world['epoch'] += 1  # Increment the epoch by 1
    world['update'] = int(time.time())  # Set the current timestamp

    with open('data/world.json', 'w') as f:
        json.dump(world, f, indent=4)

    print("World updated successfully.")