# Reverie House Lexicons

ATProto lexicon definitions for the reverie.house ecosystem.

## Lexicon: `house.reverie.dream`

A **dream** is an experiential website - a place to explore, play, or get lost in. Dreams are the creative output of the reverie.house community.

### Record Properties

| Property | Required | Description |
|----------|----------|-------------|
| `domain` | ✅ | The domain (e.g., `flawed.center`). No `https://` prefix. |
| `title` | ✅ | Display title of the dream |
| `description` | | Brief description |
| `tangledRepo` | | AT-URI to the `sh.tangled.repo` record for source code |
| `status` | | `dreaming` (unfinished), `awake` (complete), `archived` |
| `createdAt` | ✅ | Timestamp |

### Who Creates Dreams?

The **dream creator** (e.g., @flawed.center) posts this record to their own PDS. This declares "I made this dream."

### Validation via lore.farm

Dreams are validated using existing lore.farm labels:
- `lore:reverie.house` - Self-applied by creator, marks it as part of the shared lore
- `canon:reverie.house` - Applied by errantson, officially validates the dream

No new label types needed - the existing system handles validation.

### Contribution Tracking

Dreamstylers contribute via **Tangled** (tangled.org). When they push code:
- Tangled creates `sh.tangled.git.refUpdate` on their PDS
- This automatically tracks their contributions by DID
- No separate contribution lexicon needed

### Example Record

```json
{
  "$type": "house.reverie.dream",
  "domain": "flawed.center",
  "title": "Unfinished Things",
  "description": "An explorable space of incomplete ideas",
  "tangledRepo": "at://did:plc:xyz.../sh.tangled.repo/abc123",
  "status": "dreaming",
  "createdAt": "2025-12-17T00:00:00Z"
}
```

### Query Examples

```bash
# Get all dreams from a creator
GET /xrpc/com.atproto.repo.listRecords?repo=<creator-did>&collection=house.reverie.dream

# Get a dreamstyler's contributions (from Tangled)
GET /xrpc/com.atproto.repo.listRecords?repo=<dreamstyler-did>&collection=sh.tangled.git.refUpdate
```
