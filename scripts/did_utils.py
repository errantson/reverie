import requests
from urllib.parse import quote

def get_did_from_handle(handle):
    handle_enc = quote(handle, safe='')
    candidate_endpoints = [
        "https://bsky.social",
        "https://reverie.house"
    ]
    for base_url in candidate_endpoints:
        url = f'{base_url}/xrpc/com.atproto.identity.resolveHandle?handle={handle_enc}'
        try:
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            did = data.get('did')
            if did:
                return did
        except requests.exceptions.RequestException:
            continue
    print(f"Error fetching DID for handle {handle} via any server")
    return None

def get_handle_and_server_from_did(did):
    url = f'https://plc.directory/{did}'
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        # Extract the 'alsoKnownAs' field
        also_known_as = data.get('alsoKnownAs', [])
        if also_known_as:
            handle = also_known_as[0].removeprefix("at://")
        else:
            handle = None
        
        # Extract the 'service' field (for the server)
        server = None
        services = data.get('service', [])
        if services and isinstance(services[0], dict):
            server = services[0].get('serviceEndpoint')
        
        return handle, server
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching DID {did}: {e}")
        return None, None