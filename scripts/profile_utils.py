import requests

def get_bsky_profile(handle):
    candidate_endpoints = [
        "https://bsky.social",
        "https://reverie.house"
    ]
    for base_url in candidate_endpoints:
        url = f'{base_url}/xrpc/com.atproto.profile.getProfile?handle={handle}'
        try:
            response = requests.get(url)
            response.raise_for_status()
            return response.json()  # Returns detailed profile info as a dict
        except requests.exceptions.HTTPError as e:
            if e.response is not None and e.response.status_code == 401:
                continue
        except requests.exceptions.RequestException:
            continue
    return None

def get_bsky_description_from_did(did, server=None):
    # Use the provided server or fallback to a default
    if server is None:
        server = "https://morel.us-east.host.bsky.network"
    url = f'{server}/xrpc/com.atproto.repo.getRecord?repo={did}&collection=app.bsky.actor.profile&rkey=self'
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        value = data.get('value', {})  # Extract the "value" record
        return value  # <-- now returning the full record
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 401:
            return None
        else:
            print(f"Error fetching profile description for DID {did}: {e}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error fetching profile description for DID {did}: {e}")
        return None