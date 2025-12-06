# 🌙 Reverie Dreams System - Comprehensive Guide

**Created:** November 21, 2025  
**Version:** 0.1.0  
**Status:** 🚧 Concept & Initial Implementation

---

## Table of Contents

1. [Vision & Philosophy](#vision--philosophy)
2. [System Architecture](#system-architecture)
3. [Integration Points](#integration-points)
4. [Dream Structure](#dream-structure)
5. [Data Flow & Persistence](#data-flow--persistence)
6. [Creating a Dream](#creating-a-dream)
7. [Shortcomings & Challenges](#shortcomings--challenges)
8. [Opportunities & Extensions](#opportunities--extensions)
9. [Technical Utilities](#technical-utilities)
10. [Examples](#examples)

---

## Vision & Philosophy

### What is a Dream?

In the Reverie House system, a **Dream** is a discrete, immersive experience that:

- **Narrative**: Tells a story or explores a concept within the mindscape
- **Interactive**: Allows user engagement beyond passive consumption
- **Persistent**: Can read and write to the user's permanent record (reverie.db, PDS)
- **Portable**: Can be created by anyone, easily adaptable, and self-contained
- **Domain-rooted**: Lives at its own subdomain/domain for clear identity

Dreams are **not** just pages or content—they are experiential containers that can be:
- Visual novels or interactive fiction
- Mini-games or puzzles
- Audio-visual journeys
- Data visualizations
- Collaborative spaces
- Mixed-media explorations

### Core Principles

1. **Decentralized Creation**: Anyone can create a dream using common infrastructure
2. **Data Sovereignty**: User data (from PDS and reverie.db) remains under user control
3. **Composability**: Dreams can reference and build upon each other
4. **Progressive Enhancement**: Works without auth, enhances with it
5. **Narrative Integration**: All dreams exist within the Reverie lore

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Reverie House Core                        │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐        │
│  │ reverie.db  │  │   PDS Data  │  │ OAuth/Session│        │
│  │  (SQLite)   │  │  (atproto)  │  │  Management  │        │
│  └─────────────┘  └─────────────┘  └──────────────┘        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │       Dream Runtime Layer              │
        │  ┌──────────────────────────────────┐  │
        │  │    dream-runtime.js              │  │
        │  │  - Auth & Session                │  │
        │  │  - Data Access API               │  │
        │  │  - State Persistence             │  │
        │  │  - PDS Integration               │  │
        │  └──────────────────────────────────┘  │
        └────────────────┬───────────────────────┘
                         │
         ┌───────────────┴──────────────────┐
         │                                   │
    ┌────▼─────┐                      ┌─────▼──────┐
    │ Dream A  │                      │  Dream B   │
    │ (flawed  │                      │  (another  │
    │ .center) │                      │   dream)   │
    └──────────┘                      └────────────┘
```

### Directory Structure

```
/site/dreams/
├── _shared/                    # Shared infrastructure
│   ├── js/
│   │   └── dream-runtime.js    # Core runtime library
│   ├── css/
│   │   └── dream-core.css      # Base styling
│   └── utils/                  # Shared utilities
│
├── _templates/                 # Starter templates
│   ├── basic/                  # Minimal dream template
│   ├── interactive/            # Interactive explorable
│   ├── narrative/              # Story-focused
│   └── minigame/              # Game-focused
│
├── flawed.center/             # Example dream
│   ├── index.html
│   ├── style.css
│   ├── dream.json             # Manifest
│   ├── js/
│   │   └── flawed-center.js
│   ├── assets/
│   │   ├── backdrop.png
│   │   └── ...
│   └── data/                  # Static dream data
│
└── GUIDE.md                   # This file
```

---

## Integration Points

### 1. AT Protocol / PDS Integration

Dreams can create custom lexicon collections on the user's PDS for dream-specific data.

**Pattern:** `house.reverie.dream.<dreamname>`

**Example Collections:**

```javascript
// Progress tracking
house.reverie.dream.flawedcenter.progress

// Achievements/souvenirs
house.reverie.dream.flawedcenter.achievement

// User-generated content
house.reverie.dream.flawedcenter.creation
```

**Advantages:**
- Data follows the user across instances
- Verifiable on-chain via AT Protocol
- Can be queried by other services
- User owns their dream data

**Implementation:**

```javascript
// Write dream progress to PDS
await runtime.writeToCollection('house.reverie.dream.flawedcenter.progress', {
    stage: 'center_examined',
    timestamp: Date.now(),
    fragmentsFound: 3
});

// Read user's dream history
const records = await runtime.readFromCollection(
    'house.reverie.dream.flawedcenter.progress', 
    10
);
```

### 2. Reverie Database (reverie.db)

Dreams can read from and write to the central reverie.db through the API.

**Read Permissions:**
- `read:dreamers` - User profile data
- `read:spectrum` - Personality coordinates
- `read:canon` - User's story history
- `read:souvenirs` - Achievements
- `read:kindred` - Relationships

**Write Permissions:**
- `write:canon` - Add story events
- `write:souvenirs` - Grant achievements (admin only)
- `write:spectrum` - Modify coordinates (quest-triggered only)

**Example:**

```javascript
// Declare permissions in dream manifest
{
  "permissions": {
    "reverie": {
      "read": ["spectrum", "canon"],
      "write": ["canon"]
    }
  }
}

// Use in dream
const userData = await runtime.getUserData();
console.log(userData.spectrum.entropy); // -42

await runtime.writeCanon({
    event: 'discovered the flawed center',
    context: { dreamId: 'flawed.center' }
});
```

### 3. Quest System Hooks

Dreams can trigger quest events that the quest system monitors.

**Event Pattern:** `dream:<dreamname>:<event>`

**Example:**

```javascript
// In dream code
runtime.emitEvent('entered', { timestamp: Date.now() });
runtime.emitEvent('minigame:complete', { score: 1500 });

// In quest monitor (questing.py)
{
    "title": "Dream Explorer",
    "uri": "at://reverie.house/quest/dream_explorer",
    "cond": "event:dream:flawed:entered",
    "cmnd": ["award_souvenir:dream/flawed/explorer", "like_post"],
    "canon": {
        "event": "stepped into a new dream",
        "keys": ["dream_explorer"]
    }
}
```

### 4. Souvenir System

Dreams can award souvenirs (achievements) through the existing system.

**Souvenir Key Pattern:** `dream/<dreamname>/<achievement>`

**Examples:**
- `dream/flawed/explorer` - Entered the dream
- `dream/flawed/centered` - Found the center
- `dream/flawed/complete` - Completed all content

**Integration:**

```javascript
// In dream.json manifest
{
  "integration": {
    "souvenirKeys": [
      "dream/flawed/explorer",
      "dream/flawed/centered",
      "dream/flawed/complete"
    ]
  }
}

// Awarded via quest system when events trigger
```

### 5. Lexicon Definition (Optional)

For maximum portability, dreams can define their own lexicons.

**Example Lexicon:** `house.reverie.dream`

```json
{
  "lexicon": 1,
  "id": "house.reverie.dream",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["dreamId", "action", "timestamp"],
        "properties": {
          "dreamId": {
            "type": "string",
            "maxLength": 100,
            "description": "Identifier of the dream"
          },
          "action": {
            "type": "string",
            "maxLength": 200,
            "description": "Action taken in dream"
          },
          "timestamp": {
            "type": "string",
            "format": "datetime"
          },
          "data": {
            "type": "unknown",
            "description": "Dream-specific data"
          }
        }
      }
    }
  }
}
```

This allows **any PDS** to store dream data, not just reverie.house.

---

## Dream Structure

### Essential Files

Every dream needs these components:

#### 1. `index.html` - Entry Point

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta name="dream:id" content="dreamname">
    <meta name="dream:type" content="interactive-explorable">
    
    <!-- Shared infrastructure -->
    <link rel="stylesheet" href="../_shared/css/dream-core.css">
    <script type="module" src="../_shared/js/dream-runtime.js"></script>
    
    <!-- Dream-specific -->
    <link rel="stylesheet" href="./style.css">
    <script type="module" src="./js/dreamname.js"></script>
</head>
<body class="dream-container" data-dream-id="dreamname">
    <div class="dream-backdrop">
        <img src="./assets/backdrop.png" class="dream-background-layer">
    </div>
    <div class="dream-interactive-layer" id="interactive-canvas"></div>
    <div class="dream-ui-overlay" id="ui-overlay"></div>
</body>
</html>
```

#### 2. `dream.json` - Manifest

```json
{
  "dreamId": "dreamname",
  "version": "1.0.0",
  "title": "Dream Title",
  "description": "What this dream is about",
  "author": "creator.bsky.social",
  "created": "2025-11-21",
  
  "manifest": {
    "type": "interactive-explorable",
    "entryPoint": "index.html",
    "domain": "dreamname.reverie.house",
    "requiresAuth": false,
    "permissions": {
      "reverie": {
        "read": ["spectrum"],
        "write": ["canon"]
      }
    }
  },
  
  "integration": {
    "pdsCollection": "house.reverie.dream.dreamname",
    "souvenirKeys": ["dream/dreamname/complete"],
    "questTriggers": ["dream:dreamname:complete"]
  }
}
```

#### 3. `js/dreamname.js` - Main Logic

```javascript
import { DreamRuntime } from '../../_shared/js/dream-runtime.js';

class MyDream {
    constructor() {
        this.runtime = new DreamRuntime({
            dreamId: 'dreamname',
            requireAuth: false,
            dataPermissions: ['read:spectrum', 'write:canon']
        });
    }
    
    async initialize() {
        await this.runtime.init();
        
        if (this.runtime.isAuthenticated()) {
            const userData = await this.runtime.getUserData();
            this.personalize(userData);
        }
        
        this.setupInteractivity();
    }
    
    setupInteractivity() {
        // Your dream logic here
    }
    
    personalize(userData) {
        // Customize based on user data
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const dream = new MyDream();
    await dream.initialize();
});
```

#### 4. `style.css` - Dream Styling

```css
:root {
    --dream-primary-color: #your-color;
    --dream-accent-color: #your-accent;
}

/* Dream-specific styles */
.dream-specific-element {
    /* Your styles */
}
```

### Optional Files

- `README.md` - Dream documentation
- `data/` - Static JSON data for the dream
- `assets/` - Images, audio, video
- `lexicons/` - Custom lexicon definitions

---

## Data Flow & Persistence

### Session Flow

```
1. User navigates to dream URL (e.g., flawed.center)
   ↓
2. Dream HTML loads, initializes DreamRuntime
   ↓
3. DreamRuntime checks for existing session (oauthManager)
   ↓
4. If authenticated:
   - Fetch user data from /api/dreamers/{did}
   - Load dream state from localStorage + PDS (optional)
   - Initialize PDS client for writing
   ↓
5. If not authenticated:
   - Load dream state from localStorage only
   - Dream works in limited/anonymous mode
   ↓
6. Dream-specific code runs with access to:
   - runtime.getUserData() → reverie.db data
   - runtime.getDreamState() → session state
   - runtime.writeCanon() → write to canon
   - runtime.writeToCollection() → write to PDS
```

### State Persistence Layers

**1. LocalStorage (Always Available)**
- Dream progress for anonymous users
- UI preferences
- Temporary state

**2. PDS Collection (Authenticated Only)**
- Permanent dream progress
- User-generated content within dream
- Cross-device synchronization

**3. Reverie Canon (Authenticated Only)**
- Narrative events from the dream
- Integration with main Reverie story
- Visible in user's timeline

**Example Multi-Layer State:**

```javascript
// Save to localStorage (immediate)
await runtime.saveDreamState({
    currentStage: 'minigame',
    score: 1500
});

// Save to PDS (persistent, portable)
await runtime.writeToCollection('house.reverie.dream.flawedcenter.progress', {
    stage: 'minigame',
    score: 1500,
    timestamp: Date.now()
});

// Save to canon (narrative record)
await runtime.writeCanon({
    event: 'achieved a high score in the flawed center',
    context: { score: 1500 }
});
```

---

## Creating a Dream

### Quick Start

1. **Copy Template**

```bash
cd /srv/site/dreams
cp -r _templates/interactive my-dream
cd my-dream
```

2. **Edit `dream.json`**

```json
{
  "dreamId": "my-dream",
  "title": "My Dream Title",
  "domain": "my-dream.reverie.house"
  // ... other config
}
```

3. **Create Your Content**

- Design backdrop in `assets/backdrop.png`
- Write logic in `js/my-dream.js`
- Style in `style.css`

4. **Test Locally**

```bash
# From /srv
python3 -m http.server 8080
# Visit: http://localhost:8080/site/dreams/my-dream/
```

5. **Deploy**

- Add domain to Caddy configuration
- Update DNS if using subdomain
- Add quest triggers if needed

### Best Practices

**Do:**
- ✅ Keep dreams self-contained (all assets local)
- ✅ Test both authenticated and anonymous modes
- ✅ Use semantic HTML for accessibility
- ✅ Provide keyboard navigation
- ✅ Document your dream in README.md
- ✅ Use progressive enhancement

**Don't:**
- ❌ Require authentication unless necessary
- ❌ Store sensitive data in localStorage
- ❌ Hardcode user-specific data
- ❌ Break the back button
- ❌ Assume screen size or input method

---

## Shortcomings & Challenges

### Technical Challenges

#### 1. **PDS Collection Namespace Collision**

**Problem:** Custom lexicon collections like `house.reverie.dream.*` are not officially registered. Other services might use the same namespace.

**Mitigation:**
- Register lexicons properly via DID documentation
- Use longer, more specific namespaces
- Provide migration path if collision occurs

#### 2. **Data Consistency Across Layers**

**Problem:** State can be stored in localStorage, PDS, and reverie.db. These can get out of sync.

**Mitigation:**
- Establish clear "source of truth" for each data type
- Implement conflict resolution strategies
- Version dream state records

#### 3. **Authentication Flow Complexity**

**Problem:** Dreams inherit auth from main site but may be accessed directly. Managing OAuth across subdomains is complex.

**Mitigation:**
- Use cookie-based sessions with proper domain config
- Provide OAuth modal within dream if needed
- Allow most dreams to work without auth

#### 4. **Asset Loading & Performance**

**Problem:** Large backdrops or audio files can slow dream loading.

**Mitigation:**
- Implement lazy loading
- Provide loading screens with progress
- Optimize assets (WebP, compressed audio)
- Consider streaming for large media

#### 5. **Cross-Browser Compatibility**

**Problem:** Modern web APIs may not work everywhere.

**Mitigation:**
- Use feature detection
- Provide fallbacks for critical features
- Test on multiple browsers

### Content Challenges

#### 1. **Narrative Coherence**

**Problem:** Dreams created by different people may conflict with established lore.

**Mitigation:**
- Provide lore guidelines in creator docs
- Optional review process for "canon" dreams
- Allow "experimental" vs "canon" classification

#### 2. **Quality Control**

**Problem:** Without curation, low-quality dreams could dilute the experience.

**Mitigation:**
- Featured vs community sections
- Rating/review system
- Community moderation

#### 3. **Discovery & Navigation**

**Problem:** Users may not know which dreams exist or how to find them.

**Mitigation:**
- Dream directory page on main site
- Tags and categories
- Recommendations based on spectrum
- Integration with homepage experience

### Security Challenges

#### 1. **XSS via User Content**

**Problem:** If dreams accept user input and display it, risk of XSS.

**Mitigation:**
- Sanitize all user input
- Use Content Security Policy
- Never use `eval()` or `innerHTML` with user data

#### 2. **Data Privacy**

**Problem:** Dreams have access to user's spectrum and canon data.

**Mitigation:**
- Explicit permission prompts
- Audit logging of data access
- User dashboard to see what dreams accessed their data

#### 3. **Malicious Dreams**

**Problem:** Someone could create a dream that abuses the API or tricks users.

**Mitigation:**
- Rate limiting on API endpoints
- Review process for promoted dreams
- User reporting mechanism

---

## Opportunities & Extensions

### Near-Term Opportunities

#### 1. **Dream Gallery/Directory**

Create a browsable gallery on the main site:

```
/dreams
├── Featured Dreams (curated)
├── By Category
│   ├── Narrative
│   ├── Interactive
│   ├── Minigames
│   └── Experimental
├── By Creator
└── Recently Added
```

#### 2. **Dream Creation Wizard**

Guide users through creating their first dream:

```
1. Choose template (narrative, game, explorable)
2. Upload backdrop
3. Define interaction points with visual editor
4. Write content in markdown
5. Preview & publish
```

#### 3. **Shared Asset Library**

Build a library of reusable assets:

- Background music loops
- Sound effects
- UI elements
- Character sprites
- Environmental assets

#### 4. **Cross-Dream Achievements**

Souvenirs that require completing multiple dreams:

- "Dreamwalker" - Experience 5 different dreams
- "Completionist" - 100% completion in 3 dreams
- "Creator" - Make your own dream

#### 5. **Spectrum-Based Recommendations**

Suggest dreams based on user's spectrum position:

```javascript
// High entropy users get recommended chaotic, experimental dreams
// High adoptive users get social, collaborative dreams
// etc.
```

### Long-Term Extensions

#### 1. **Collaborative Dreams**

Multiple users in the same dream instance:

- Real-time multiplayer experiences
- Shared state via WebSocket
- Collaborative puzzle-solving
- Social spaces within mindscape

**Technical Requirements:**
- WebSocket server
- State synchronization
- Conflict resolution
- Presence system

#### 2. **Procedurally Generated Dreams**

Dreams that create unique experiences per user:

- AI-generated narratives based on user's canon
- Procedural environments based on spectrum
- Personalized challenges

**Technical Requirements:**
- Generation algorithms
- Seeding based on user DID
- Consistency across sessions

#### 3. **Time-Limited / Event Dreams**

Dreams that only exist during certain periods:

- Seasonal dreams (winter solstice, equinox)
- Anniversary events
- Community milestones
- ARG-style timed releases

**Implementation:**
- Availability windows in manifest
- Count-down timers
- Archive mode after expiration

#### 4. **Physical World Integration**

Dreams that bridge digital and physical:

- GPS-based dream activation
- QR codes in physical locations
- Integration with physical books/art
- Real-world scavenger hunts

**Technical Requirements:**
- Geolocation API
- QR code scanning
- Verification mechanisms

#### 5. **Cross-Platform Native Apps**

Extend beyond web to native experiences:

- Mobile apps for dreams
- VR/AR versions
- Desktop applications
- E-ink readers for narrative dreams

#### 6. **Dream Remixing**

Allow users to fork and modify existing dreams:

- Version control for dreams
- Attribution system
- Remix gallery
- Collaborative editing

#### 7. **Economic Layer**

Optional monetization for dream creators:

- Tips/donations to creators
- Premium dreams
- Patronage system
- NFT-based collectibles from dreams (controversial!)

#### 8. **Federation Beyond Reverie**

Allow other communities to host dreams:

- Standard dream protocol
- Cross-instance dream sharing
- Federated dream directory
- Universal achievement/souvenir system

---

## Technical Utilities

### DreamRuntime API Reference

#### Initialization

```javascript
const runtime = new DreamRuntime({
    dreamId: 'string',           // Required: unique identifier
    requireAuth: boolean,         // Default: false
    dataPermissions: Array,       // e.g., ['read:spectrum', 'write:canon']
});

await runtime.init();
```

#### Session & Auth

```javascript
runtime.isAuthenticated()        // Returns: boolean
runtime.checkSession()           // Returns: Promise<void>
runtime.getUserData()            // Returns: Promise<Object|null>
```

#### State Management

```javascript
runtime.getDreamState(key?)      // Returns: any
runtime.saveDreamState(state)    // Returns: Promise<void>
runtime.loadDreamState()         // Returns: Promise<void>
```

#### Data Access

```javascript
runtime.fetchDreamData(path)     // Returns: Promise<any>
runtime.writeCanon(entry)        // Returns: Promise<boolean>
```

#### PDS Integration

```javascript
runtime.writeToCollection(collection, record)  // Returns: Promise<Object>
runtime.readFromCollection(collection, limit)  // Returns: Promise<Array>
```

#### Events

```javascript
runtime.emitEvent(eventName, data)            // Returns: void
runtime.onEvent(eventName, callback)          // Returns: void
```

### DreamUtils API Reference

```javascript
import { DreamUtils } from '../_shared/js/dream-runtime.js';

DreamUtils.generateId()                      // Returns: string
DreamUtils.easeInOut(t)                     // Returns: number (0-1)
DreamUtils.lerp(start, end, t)              // Returns: number
DreamUtils.random(min, max)                 // Returns: number
DreamUtils.formatTimestamp(epoch)           // Returns: string
```

### Backend API Endpoints

Dreams can access these Reverie API endpoints:

```
GET  /api/dreamers              # List all dreamers
GET  /api/dreamers/{did}        # Get specific dreamer
GET  /api/canon                 # Get canon entries
POST /api/canon                 # Create canon entry
GET  /api/souvenirs             # Get souvenir definitions
GET  /api/dreamers/{did}/souvenirs  # Get user's souvenirs
```

### Caddy Configuration for Dreams

Add to `/srv/caddy/Caddyfile`:

```caddyfile
# Main dreams directory
reverie.house {
    handle /dreams/* {
        root * /srv/site
        file_server
    }
}

# Individual dream subdomain
flawed.center {
    root * /srv/site/dreams/flawed.center
    file_server
    try_files {path} {path}/ /index.html
    
    # API proxy for data access
    handle /api/* {
        reverse_proxy localhost:5000
    }
}
```

---

## Examples

### 1. avonlea.town - RPG Game Dream

**Type:** RPG Maker MZ Game  
**Created:** November 13, 2024  
**Author:** did:plc:zlgkqbg37lee3tyxmwiit3ph  
**Reference:** [Original post](https://bsky.app/profile/did:plc:zlgkqbg37lee3tyxmwiit3ph/post/3lndm5kgais26)

**avonlea.town** is a complete RPG Maker MZ game wrapped with Reverie integration. This is the first dream in the system and demonstrates the most complex integration pattern.

**Key Features:**

- **Full game embedding**: Complete RPG Maker MZ game running in browser
- **Save system integration**: Game progress saved to user's PDS
- **Spectrum variables**: User's personality values exposed to game logic (Variables 1-6)
- **Canon recording**: Major game events written to user's story timeline
- **Custom plugins**: `ReverieVariables.js` and `ReverieEvents.js` bridge the game engine
- **Cross-device sync**: Save files portable via AT Protocol

**Technical highlights:**
- RPG Maker MZ core scripts loaded from `/game/` directory
- Custom UI overlay for Reverie menu (doesn't interfere with gameplay)
- Plugin commands in game trigger canon entries: `ReverieIntegration.recordEvent()`
- Game variables 1-6 auto-populated with spectrum values on map load
- Non-intrusive integration - game playable without Reverie account
- Save data includes Reverie metadata for cross-instance recognition

**Implementation Pattern:**

```javascript
// In RPG Maker plugin command
const spectrum = ReverieIntegration.getUserSpectrum();
if (spectrum && spectrum.entropy > 50) {
    // Show high-chaos dialogue
} else {
    // Show low-chaos dialogue
}

// Record event to canon
await ReverieIntegration.recordEvent('completed the quest', {
    location: 'town_square',
    playtime: $gameSystem.playtime()
});
```

**File Structure:**
```
avonlea.town/
├── game/                      # Full RPG Maker MZ export
│   ├── js/plugins/
│   │   ├── ReverieVariables.js  # Spectrum → game variables
│   │   └── ReverieEvents.js     # Canon integration
│   └── data/                  # Game JSON data
└── js/avonlea.js              # Reverie wrapper layer
```

### 2. flawed.center - Interactive Explorable

**Type:** Interactive Explorable  
**Created:** November 21, 2025  
**Author:** reverie.house

**flawed.center** is an interactive exploration of imperfection and entropy. Users navigate a stylized backdrop, discover narrative fragments, and engage with a minigame—all while their personal spectrum data influences the experience.

**Key Features**

1. **Interactive Hotspots**
   - Clickable areas on backdrop
   - Visual feedback on hover
   - Narrative popups on interaction

2. **Personalized Content**
   - Displays user's entropy value
   - Adjusts narrative based on spectrum
   - References user's name and history

3. **Embedded Minigame**
   - "Alignment Puzzle" to restore balance
   - Completion triggers quest event
   - Awards souvenir on finish

4. **Data Integration**
   - Reads spectrum from reverie.db
   - Writes canon entries on discoveries
   - Saves progress to PDS collection

### Implementation Highlights

#### Hotspot System

```javascript
const hotspotDefinitions = [
    {
        id: 'center-portal',
        x: '50%', y: '50%',
        size: '80px',
        label: 'The Center',
        action: () => this.openCenterPortal()
    }
];

hotspotDefinitions.forEach(def => {
    const hotspot = this.createHotspot(def);
    this.interactiveLayer.appendChild(hotspot);
});
```

#### Personalization

```javascript
if (this.userData) {
    content += `<p class="user-note">
        Your spectrum resonates here, ${this.userData.name}. 
        Entropy: ${this.userData.spectrum.entropy}
    </p>`;
}
```

#### Canon Integration

```javascript
await this.runtime.writeCanon({
    event: 'discovered a memory fragment in the flawed center',
    context: { fragmentId: 1 }
});
```

### File Structure

```
flawed.center/
├── index.html              # Entry point
├── style.css               # Dream-specific styles
├── dream.json              # Manifest
├── js/
│   └── flawed-center.js    # Main logic
├── assets/
│   ├── backdrop.png        # Main background
│   ├── fragment-1.png      # Discoverable assets
│   └── ambient.mp3         # Audio
└── data/
    └── fragments.json      # Narrative content
```

### Expansion Ideas

- **Memory System**: Collect all fragments to unlock secret
- **Multiplayer**: See other users' entropy signatures
- **Dynamic Backdrop**: Changes based on time of day
- **Audio Integration**: Ambient soundscape reacts to actions
- **Achievement Tree**: Nested unlockables

---

## Conclusion

The Reverie Dreams system provides a flexible, extensible framework for creating immersive experiences within the mindscape. By combining:

- **Common infrastructure** (DreamRuntime, shared styles)
- **AT Protocol integration** (PDS collections, data sovereignty)
- **Reverie data access** (spectrum, canon, souvenirs)
- **Domain-based identity** (each dream has its own home)

...we enable creators to build rich, personalized, and persistent experiences that seamlessly integrate with the broader Reverie House ecosystem.

### Next Steps

1. **Refine DreamRuntime** - Add more utility functions, improve error handling
2. **Create Templates** - Build starter templates for common dream types
3. **Document Lexicons** - Formalize dream-specific lexicon definitions
4. **Build Directory** - Dream gallery/browser on main site
5. **Quest Integration** - Connect dream events to quest system
6. **Creator Tools** - Visual editor for non-technical creators

---

**The mindscape awaits your dreams.** 🌙✨

*"Every dream is a crack in reality where new light can bleed through."*
