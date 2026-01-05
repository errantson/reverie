-- Seed data for heraldry system
-- Assigns initial ambassadors:
--   - @libre.reverie.house for reverie.house
--   - @pfrazee.com for bsky.social, bsky.team, bsky.app

-- First, we need to look up the DIDs for these handles
-- These will need to be filled in with actual DIDs from the dreamers table

-- Insert reverie.house heraldry
INSERT INTO heraldry (slug, name, description, color_primary, icon_path)
VALUES (
    'reverie',
    'Reverie House',
    'The official Reverie House PDS - a dreamlike oasis in the Bluesky network',
    '#87408d',
    '/assets/heraldry/reverie.png'
)
ON CONFLICT (slug) DO NOTHING;

-- Insert Bluesky heraldry
INSERT INTO heraldry (slug, name, description, color_primary, icon_path)
VALUES (
    'bluesky',
    'Bluesky',
    'The official Bluesky PDS operated by Bluesky PBC',
    '#0085ff',
    '/assets/heraldry/default.png'
)
ON CONFLICT (slug) DO NOTHING;

-- Add domains for reverie.house
INSERT INTO heraldry_domains (heraldry_id, domain)
SELECT h.id, 'reverie.house'
FROM heraldry h WHERE h.name = 'Reverie House'
ON CONFLICT DO NOTHING;

-- Add domains for Bluesky
INSERT INTO heraldry_domains (heraldry_id, domain)
SELECT h.id, 'bsky.social'
FROM heraldry h WHERE h.name = 'Bluesky'
ON CONFLICT DO NOTHING;

INSERT INTO heraldry_domains (heraldry_id, domain)
SELECT h.id, 'bsky.team'
FROM heraldry h WHERE h.name = 'Bluesky'
ON CONFLICT DO NOTHING;

INSERT INTO heraldry_domains (heraldry_id, domain)
SELECT h.id, 'bsky.app'
FROM heraldry h WHERE h.name = 'Bluesky'
ON CONFLICT DO NOTHING;

-- Assign @libre.reverie.house as ambassador for Reverie House
-- First find their DID
UPDATE heraldry 
SET ambassador_did = (
    SELECT did FROM dreamers WHERE handle = 'libre.reverie.house' LIMIT 1
)
WHERE name = 'Reverie House'
  AND EXISTS (SELECT 1 FROM dreamers WHERE handle = 'libre.reverie.house');

-- Assign @pfrazee.com as ambassador for Bluesky
UPDATE heraldry 
SET ambassador_did = (
    SELECT did FROM dreamers WHERE handle = 'pfrazee.com' LIMIT 1
)
WHERE name = 'Bluesky'
  AND EXISTS (SELECT 1 FROM dreamers WHERE handle = 'pfrazee.com');

-- If dreamers don't exist yet, log which handles need to be assigned
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dreamers WHERE handle = 'libre.reverie.house') THEN
        RAISE NOTICE 'Warning: libre.reverie.house not found in dreamers - ambassador for Reverie House not assigned';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM dreamers WHERE handle = 'pfrazee.com') THEN
        RAISE NOTICE 'Warning: pfrazee.com not found in dreamers - ambassador for Bluesky not assigned';
    END IF;
END $$;

-- Show current state
SELECT 
    h.name,
    h.ambassador_did,
    d.handle as ambassador_handle,
    array_agg(hd.domain) as domains
FROM heraldry h
LEFT JOIN dreamers d ON h.ambassador_did = d.did
LEFT JOIN heraldry_domains hd ON h.id = hd.heraldry_id
GROUP BY h.id, h.name, h.ambassador_did, d.handle
ORDER BY h.name;
