import requests
import os
import json

def download_file(url, local_path):
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()  # Parse JSON response
        with open(local_path, 'w') as f:
            json.dump(data, f, indent=4)  # Properly indented JSON format
        print(f"Downloaded and saved: {local_path}")
    except requests.exceptions.RequestException as e:
        print(f"Error downloading {url}: {e}")
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON from {url}: {e}")

def reset_data():
    base_url = "https://reverie.house/data"
    files = ["journal.json", "dreamers.json", "world.json"]
    local_dir = "data"

    if not os.path.exists(local_dir):
        os.makedirs(local_dir)

    for file in files:
        url = f"{base_url}/{file}"
        local_path = os.path.join(local_dir, file)
        download_file(url, local_path)
