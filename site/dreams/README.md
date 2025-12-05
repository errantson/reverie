# Reverie Dreams System

**Version:** 0.1.0  
**Created:** November 21, 2025

## Overview

The Dreams system enables creation of immersive, interactive experiences within the Reverie House mindscape. Each dream is a self-contained web experience that can:

- Display interactive narratives and explorable environments
- Read/write user data from reverie.db and AT Protocol PDS
- Award souvenirs and trigger quests
- Persist state across sessions

## Directory Structure

```
/site/dreams/
├── GUIDE.md              # Comprehensive documentation
├── README.md             # This file
├── _shared/              # Shared infrastructure
│   ├── js/
│   │   └── dream-runtime.js
│   └── css/
│       └── dream-core.css
├── _templates/           # Starter templates
│   └── basic/            # Basic dream template
├── avonlea.town/         # RPG Maker MZ game (first dream)
└── flawed.center/        # Interactive explorable (example)
```

## Quick Start

### Accessing Dreams

All dreams are accessible via:
```
https://reverie.house/dreams/<dream-name>
```

**Live Dreams:**
- avonlea.town: https://reverie.house/dreams/avonlea.town
- flawed.center: https://reverie.house/dreams/flawed.center
- All dreams: https://reverie.house/dreams

### Creating a New Dream

1. Copy the basic template:
   ```bash
   cp -r _templates/basic my-dream-name
   cd my-dream-name
   ```

2. Replace placeholders in files:
   - `{{DREAM_ID}}` → `my-dream-name`
   - `{{DREAM_TITLE}}` → `My Dream Title`
   - `{{DREAM_DESCRIPTION}}` → Description text
   - `{{AUTHOR}}` → Your handle
   - `{{DATE}}` → Current date

3. Add your artwork:
   - Create `assets/backdrop.png` (recommended: 1920x1080)

4. Implement dream logic in `js/main.js`

5. Test locally:
   ```bash
   python3 -m http.server 8080
   # Visit: http://localhost:8080/site/dreams/my-dream-name/
   ```

### Examples

- **avonlea.town** - Full RPG Maker MZ game with Reverie integration (created Nov 13, 2024)
- **flawed.center** - Interactive explorable with hotspots, narrative popups, and minigame

## Documentation

See **[GUIDE.md](./GUIDE.md)** for:
- System architecture
- Integration with reverie.db and AT Protocol
- Data flow and persistence
- API reference
- Best practices
- Known issues and opportunities

## Integration Points

### Reverie Database
- Read: spectrum, canon, dreamers, souvenirs
- Write: canon entries

### AT Protocol PDS
- Collections: `house.reverie.dream.<dreamname>`
- Custom lexicons for portability

### Quest System
- Events: `dream:<dreamname>:<event>`
- Triggers quests and souvenir awards

## Requirements

- Modern browser with ES6 module support
- Optional: User authentication for personalization
- Optional: PDS access for data persistence

## Support

For questions or issues:
- Check GUIDE.md for detailed documentation
- Review flawed.center example
- Consult main Reverie documentation in /docs

---

**The mindscape awaits your dreams.** 🌙
