# RPG Maker MZ Integration Guide

This guide explains how to integrate an RPG Maker MZ game as a Reverie Dream.

## Quick Start

1. **Export your RPG Maker MZ game** as a web deployment
2. Copy the exported files to `/srv/site/dreams/your-game/game/`
3. Copy the avonlea.town template files:
   - `index.html` (update game title/metadata)
   - `style.css` (customize if desired)
   - `js/avonlea.js` (rename and update dream ID)
   - `dream.json` (update all metadata)

4. Add the Reverie plugins to your game's plugin list in RPG Maker:
   - Copy `ReverieVariables.js` to `game/js/plugins/`
   - Copy `ReverieEvents.js` to `game/js/plugins/`
   - Enable them in RPG Maker's Plugin Manager

## Reverie Plugins

### ReverieVariables.js

Automatically exposes user's Reverie spectrum to RPG Maker variables:

- **Variable 1**: Entropy (-100 to +100)
- **Variable 2**: Oblivion (-100 to +100)
- **Variable 3**: Liberty (-100 to +100)
- **Variable 4**: Authority (-100 to +100)
- **Variable 5**: Adoptive (-100 to +100)
- **Variable 6**: Skeptic (-100 to +100)
- **Variable 7**: Has Reverie Account (0 or 1)

**Usage in Events:**

```
◆Conditional Branch: Variable [0001:Entropy] > 50
  ◆Show Text: You have a chaotic energy about you.
: Else
  ◆Show Text: You seem quite orderly today.
: Branch End
```

### ReverieEvents.js

Records game events to the user's Reverie canon.

**Plugin Command:**

```
◆Plugin Command: ReverieEvents > Record Reverie Event
  Event Name: completed the forest quest
  Context Data: {"location": "dark_woods", "reward": 500}
```

**Script Call:**

```javascript
await ReverieIntegration.recordEvent('found secret treasure', {
    location: 'hidden_cave',
    value: 10000
});
```

**Auto-recording:**

The plugin automatically records:
- Boss defeats (troops with `[BOSS]` in name)
- Large gold gains (>1000 gold)

## Integration Patterns

### 1. Personalized Dialogue

Use spectrum values to vary NPC dialogue:

```
◆Conditional Branch: Variable [0001:Entropy] > 30
  ◆Show Text: NPC: "You seem like someone who embraces chaos!"
: Else
  ◆Show Text: NPC: "You have a calm, orderly presence."
: Branch End
```

### 2. Spectrum-Based Rewards

Give items based on personality:

```
◆Conditional Branch: Variable [0005:Adoptive] > 50
  ◆Gain Item: [Friendship Charm] x1
  ◆Show Text: The townspeople give you a gift!
: Branch End
```

### 3. Recording Major Events

Mark important story moments:

```
◆Plugin Command: ReverieEvents > Record Reverie Event
  Event Name: saved the village from darkness
  Context Data: {"chapter": 3, "alignment": "hero"}

◆Show Text: Your deed will be remembered in the chronicles...
```

### 4. Check Authentication

See if player has a Reverie account:

```
◆Conditional Branch: Variable [0007:HasAccount] == 1
  ◆Show Text: Welcome back to Avonlea, $UserName!
: Else
  ◆Show Text: Welcome to Avonlea, traveler!
: Branch End
```

## Script Access

For advanced developers, access Reverie integration directly:

```javascript
// Get user spectrum
const spectrum = ReverieIntegration.getUserSpectrum();
if (spectrum) {
    console.log('Entropy:', spectrum.entropy);
    console.log('Adoptive:', spectrum.adoptive);
}

// Get user name
const name = ReverieIntegration.getUserName(); // Returns 'traveler' if not logged in

// Record custom event
await ReverieIntegration.recordEvent('custom event name', {
    customData: 'value',
    mapId: $gameMap.mapId(),
    gold: $gameParty.gold()
});
```

## Save System Integration

The wrapper automatically enriches RPG Maker saves with Reverie metadata:

```javascript
// Automatic - no action needed
{
    // Normal RPG Maker save data
    actors: [...],
    party: {...},
    // Added by integration
    reverie: {
        did: 'did:plc:...',
        timestamp: 1700000000,
        dreamId: 'your-game'
    }
}
```

Saves are stored to the user's PDS in `house.reverie.dream.yourgame.progress` collection.

## File Structure

```
your-game/
├── index.html              # Wrapper with Reverie integration
├── style.css               # UI overlay styles
├── dream.json              # Dream manifest
├── js/
│   └── your-game.js        # Reverie integration layer
├── game/                   # RPG Maker export goes here
│   ├── js/
│   │   ├── libs/
│   │   ├── plugins/
│   │   │   ├── ReverieVariables.js   ← Add this
│   │   │   └── ReverieEvents.js      ← Add this
│   │   └── rmmz_*.js
│   ├── data/
│   ├── audio/
│   └── img/
└── README.md
```

## Deployment Checklist

- [ ] RPG Maker game exported to `game/` directory
- [ ] Reverie plugins added and enabled in game
- [ ] `dream.json` manifest updated with correct metadata
- [ ] `index.html` updated with game title
- [ ] `js/your-game.js` updated with correct dream ID
- [ ] Caddy configuration added for domain/subdomain
- [ ] DNS configured (if using custom domain)
- [ ] Quest triggers added to quest system
- [ ] Souvenir keys registered

## Testing

1. **Local Test:**
   ```bash
   python3 -m http.server 8080
   # Visit: http://localhost:8080/site/dreams/your-game/
   ```

2. **Test Scenarios:**
   - Load game without Reverie login
   - Load game with Reverie login
   - Check that Variables 1-7 are set correctly
   - Trigger a plugin command to record event
   - Save and verify PDS storage
   - Test on mobile device

## Common Issues

**Game doesn't load:**
- Check browser console for errors
- Verify all RPG Maker files are in `game/` directory
- Ensure paths in `index.html` are correct

**Variables not set:**
- Check that `ReverieVariables.js` is enabled in plugin list
- Verify it's loaded before other plugins that might use the variables
- Check browser console for integration messages

**Events not recording:**
- Ensure user is logged in (Variable 7 == 1)
- Check browser console for errors
- Verify `ReverieEvents.js` is enabled

**Save system not working:**
- Check that PDS collection name matches `dream.json` manifest
- Verify user has authentication
- Check browser console for API errors

## Best Practices

1. **Graceful Degradation**: Game should be fully playable without Reverie account
2. **Optional Enhancement**: Use spectrum for flavor, not core mechanics
3. **Clear Communication**: Tell players about Reverie integration benefits
4. **Respect Privacy**: Only record significant events, not every action
5. **Test Both Modes**: Always test logged-in and logged-out experiences

## Examples

See `/srv/site/dreams/avonlea.town/` for a complete working example.

---

**Questions?** Check the main Dreams guide at `/srv/site/dreams/GUIDE.md`
