import json
import time

def update_world():
    with open('data/world.json', 'r') as f:
        try:
            world = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Error: Failed to parse world.json. Error: {e}")
            return

    world['epoch'] += 1  # Increment the epoch by 1
    world['update'] = int(time.time())  # Set the current timestamp

    with open('data/world.json', 'w') as f:
        json.dump(world, f, indent=4)

    print("World updated successfully.")

def get_current_epoch(world):
    return world.get("epoch", 0)