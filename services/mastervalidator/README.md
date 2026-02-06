# Master Validator Service

Automatically maintains `actor.rpg.master` records for all reverie.house users based on
the authoritative spectrum data stored in the reverie.house PostgreSQL database.

## Purpose

When a user creates `actor.rpg.stats` on their own PDS (via rpg.actor), they can claim
any values they want. The AT Protocol is self-sovereign - there's no way to prevent
false claims. However, **verification** is possible:

1. Reverie.house maintains the "truth" in its database (the `spectrum` table)
2. This service publishes that truth as `actor.rpg.master` records from @reverie.house
3. Clients can compare a user's self-reported stats against the master record
4. If they match, the user's stats are "pre-validated"

## How It Works

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  PostgreSQL DB      │     │  Master          │     │  @reverie.house     │
│  spectrum table     │────▶│  Validator       │────▶│  actor.rpg.master   │
│  (authoritative)    │     │  Service         │     │  records on PDS     │
└─────────────────────┘     └──────────────────┘     └─────────────────────┘
                                    │
                                    ▼
                            ┌──────────────────┐
                            │  rpg.actor       │
                            │  displays        │
                            │  "Approved by    │
                            │   @reverie.house"│
                            └──────────────────┘
```

## Usage

### Full Sync (All Users)

```bash
cd /srv/reverie.house
python3 services/mastervalidator/master_validator.py
```

### Single User Sync

```bash
# By handle
python3 services/mastervalidator/master_validator.py --user flawed.center

# By DID
python3 services/mastervalidator/master_validator.py --user did:plc:xyz...
```

### Quiet Mode

```bash
python3 services/mastervalidator/master_validator.py --quiet
```

## Systemd Timer

The service runs automatically every 15 minutes via systemd:

```bash
# Check timer status
sudo systemctl status reverie-master-validator.timer

# View logs
sudo journalctl -u reverie-master-validator.service
tail -f /srv/reverie.house/logs/master_validator.log

# Manual trigger
sudo systemctl start reverie-master-validator.service
```

## Record Format

Each master record has this structure:

```json
{
  "$type": "actor.rpg.master",
  "player": "did:plc:user123...",
  "stats": {
    "reverie": {
      "oblivion": 52,
      "authority": 31,
      "skeptic": 45,
      "receptive": 45,
      "liberty": 73,
      "entropy": 32,
      "octant": "confused"
    }
  },
  "createdAt": "2026-02-05T10:29:15.206Z",
  "updatedAt": "2026-02-05T10:29:15.206Z"
}
```

## Files

- `master_validator.py` - Main service script
- `/srv/reverie.house/systemd/reverie-master-validator.service` - Systemd service unit
- `/srv/reverie.house/systemd/reverie-master-validator.timer` - Systemd timer (15 min interval)
- `/srv/reverie.house/logs/master_validator.log` - Service logs

## Dependencies

- PostgreSQL database with `spectrum` and `dreamers` tables
- `@reverie.house` account credentials in `user_credentials` table
- Encryption key at `/srv/secrets/reverie.encryption.key`
