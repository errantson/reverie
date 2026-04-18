/**
 * Patrol — simple walking scene for reverie.house
 *
 * Loads the player's rpg.actor sprite and lets them walk around
 * a grassy field with WASD controls. The game window mirrors the
 * cannon.js stage pattern from rpg.actor.
 */
(function () {
    'use strict';

    // ── Measure actual header height and set CSS variable ─────────
    function measureHeader() {
        const hdr = document.querySelector('.reader-header');
        if (hdr) {
            const h = hdr.getBoundingClientRect().height;
            document.documentElement.style.setProperty('--patrol-header-h', h + 'px');
        }
    }
    measureHeader();
    window.addEventListener('resize', measureHeader);

    const CORRECT_HASH = 'a7549ffef80acae150b5cdd2d653940fe3e2b507e9527dfc60ca3c8f19289ccc';

    // ── DOM refs ──────────────────────────────────────────────────
    const gate      = document.getElementById('patrol-gate');
    const stageWrap = document.getElementById('patrol-stage-wrap');
    const form      = document.getElementById('patrol-lock-form');
    const input     = document.getElementById('patrol-password');
    const errorEl   = document.getElementById('patrol-lock-error');
    const stage     = document.getElementById('patrol-stage');
    const camera    = document.getElementById('patrol-camera');
    const loading   = document.getElementById('patrol-loading');

    // ── Game state ────────────────────────────────────────────────
    let player      = null;
    let controlled  = false;
    let keys        = {};
    let gameRunning = false;
    let initCalled  = false;

    // Walking boundaries relative to stage (fraction of stage dimensions)
    const GROUND_TOP = 0.58;
    const GROUND_BOT = 0.92;

    // ── Password gate ─────────────────────────────────────────────
    if (sessionStorage.getItem('patrol_unlocked') === '1') {
        unlock();
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const value = input.value;
        const hash = await sha256(value);
        if (hash === CORRECT_HASH) {
            sessionStorage.setItem('patrol_unlocked', '1');
            unlock();
        } else {
            errorEl.textContent = 'Incorrect passphrase.';
            input.value = '';
            input.focus();
        }
    });

    async function sha256(message) {
        const data = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function unlock() {
        gate.style.display = 'none';
        stageWrap.style.display = 'block';
        initGame();
    }

    // ── AT Protocol helpers (minimal) ─────────────────────────────
    async function resolveDID(did) {
        try {
            if (did.startsWith('did:web:')) {
                const host = did.replace('did:web:', '');
                const r = await fetch(`https://${host}/.well-known/did.json`);
                const doc = await r.json();
                const svc = doc.service?.find(s => s.id === '#atproto_pds');
                return svc?.serviceEndpoint || null;
            }
            const r = await fetch(`https://plc.directory/${did}`);
            const doc = await r.json();
            const svc = doc.service?.find(s => s.id === '#atproto_pds');
            return svc?.serviceEndpoint || null;
        } catch { return null; }
    }

    async function fetchSprite(did) {
        // Try rpg.actor normalised API first
        try {
            const resp = await fetch(`https://rpg.actor/api/sprite/normalized?did=${encodeURIComponent(did)}`);
            if (resp.ok) {
                const blob = await resp.blob();
                return URL.createObjectURL(blob);
            }
        } catch { /* fall through */ }

        // Fallback: resolve PDS and load from atproto
        try {
            const pds = await resolveDID(did);
            if (!pds) return null;
            const listResp = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=actor.rpg.sprite&limit=1`);
            if (!listResp.ok) return null;
            const listData = await listResp.json();
            const rec = listData.records?.[0]?.value;
            if (!rec) return null;
            const cid = rec.spriteSheet?.ref?.$link;
            if (!cid) return null;
            return `${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
        } catch { return null; }
    }

    function getSession() {
        // Reverie House oauth session
        if (window.oauthManager?.currentSession) {
            const s = window.oauthManager.currentSession;
            return { did: s.did || s.sub, handle: s.handle };
        }
        // Fallback: rpg.actor localStorage session (cross-site won't work, but just in case)
        try {
            const raw = localStorage.getItem('rpg_actor_session');
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    // ── Game initialisation ───────────────────────────────────────
    async function initGame() {
        if (initCalled) return;
        initCalled = true;

        // Wait briefly for oauth to settle
        await new Promise(r => setTimeout(r, 400));
        if (window.oauthManager?.ensureInitialized) {
            try { await window.oauthManager.ensureInitialized(); } catch {}
        }

        const session = getSession();
        if (!session || !session.did) {
            showOverlay('Not Logged In', 'Log in with your Bluesky account to load your character.');
            return;
        }

        const spriteUrl = await fetchSprite(session.did);
        if (!spriteUrl) {
            showOverlay('No Sprite Found', 'Create a sprite on rpg.actor first, then come back!');
            return;
        }

        // Preload sprite image
        await new Promise((resolve) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve;
            img.src = spriteUrl;
        });

        spawnPlayer(spriteUrl, session);
        placeTrees();

        // Dismiss loading
        if (loading) {
            loading.classList.add('done');
            setTimeout(() => loading.remove(), 350);
        }
    }

    function showOverlay(title, message) {
        if (loading) loading.classList.add('done');
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
            background:rgba(0,0,0,0.82);color:#fff;padding:2rem 2.5rem;
            text-align:center;z-index:30;min-width:260px;border-radius:6px;
            border:2px solid rgba(255,255,255,0.2);
        `;
        overlay.innerHTML = `
            <h3 style="font-size:1.2rem;margin-bottom:0.5rem">${title}</h3>
            <p style="font-size:0.9rem;opacity:0.85">${message}</p>
        `;
        stage.appendChild(overlay);
    }

    // ── Scene objects ─────────────────────────────────────────────
    // Camp clearing: dense treeline across back, side walls, camp items + decorations
    // Each entry: src, w/h (native px), x (left), y (base/foot), s (scale)
    const SCENE_OBJECTS = [
        // ── Dense back treeline (bases at horizon ≈ y 184-190) ────
        { src: 'obj_tree_deciduous.png', w: 144, h: 220, x: -25,  y: 186, s: 0.50 },
        { src: 'obj_bush_large.png',     w: 192, h: 176, x: 48,   y: 184, s: 0.48 },
        { src: 'obj_tree_deciduous.png', w: 144, h: 220, x: 125,  y: 189, s: 0.52 },
        { src: 'obj_tree_deciduous.png', w: 144, h: 220, x: 215,  y: 184, s: 0.48 },
        { src: 'obj_bush_large.png',     w: 192, h: 176, x: 298,  y: 187, s: 0.46 },
        { src: 'obj_tree_deciduous.png', w: 144, h: 220, x: 378,  y: 190, s: 0.50 },
        { src: 'obj_tree_deciduous.png', w: 144, h: 220, x: 465,  y: 184, s: 0.52 },
        { src: 'obj_bush_large.png',     w: 192, h: 176, x: 543,  y: 187, s: 0.46 },
        { src: 'obj_tree_deciduous.png', w: 144, h: 220, x: 615,  y: 189, s: 0.50 },

        // ── Left wall (descending toward viewer) ──────────────────
        { src: 'obj_tree_deciduous.png', w: 144, h: 220, x: -35,  y: 215, s: 0.58 },
        { src: 'obj_bush_low.png',       w: 175, h: 133, x: -25,  y: 242, s: 0.55 },
        { src: 'obj_dark_bush.png',      w: 96,  h: 48,  x: 8,    y: 268, s: 0.80 },

        // ── Right wall (descending toward viewer) ─────────────────
        { src: 'obj_tree_deciduous.png', w: 144, h: 220, x: 575,  y: 218, s: 0.58 },
        { src: 'obj_bush_low.png',       w: 175, h: 133, x: 558,  y: 245, s: 0.55 },
        { src: 'obj_dark_bush.png',      w: 96,  h: 48,  x: 572,  y: 270, s: 0.80 },

        // ── Camp furniture ────────────────────────────────────────
        { src: 'obj_log_a.png',          w: 88,  h: 46,  x: 185,  y: 252, s: 0.90 },
        { src: 'obj_stump_a.png',        w: 46,  h: 87,  x: 435,  y: 248, s: 0.72 },
        { src: 'obj_log_c.png',          w: 89,  h: 45,  x: 360,  y: 278, s: 0.85 },
        { src: 'obj_stump_b.png',        w: 48,  h: 96,  x: 110,  y: 232, s: 0.55 },

        // ── Ground decorations ────────────────────────────────────
        { src: 'obj_flowers_red.png',    w: 32,  h: 33,  x: 170,  y: 232, s: 1.0 },
        { src: 'obj_flowers_blue_b.png', w: 45,  h: 34,  x: 460,  y: 240, s: 1.0 },
        { src: 'obj_yellow_flowers.png', w: 40,  h: 37,  x: 315,  y: 285, s: 1.0 },
        { src: 'obj_mushroom_b.png',     w: 43,  h: 48,  x: 92,   y: 268, s: 0.75 },
        { src: 'obj_mushroom_red.png',   w: 42,  h: 29,  x: 510,  y: 275, s: 0.85 },
        { src: 'obj_pebbles.png',        w: 47,  h: 48,  x: 290,  y: 260, s: 0.60 },
        { src: 'obj_fern.png',           w: 93,  h: 48,  x: 498,  y: 222, s: 0.65 },
        { src: 'obj_grass_tuft_a.png',   w: 48,  h: 48,  x: 140,  y: 288, s: 0.65 },
        { src: 'obj_plant_a.png',        w: 31,  h: 31,  x: 248,  y: 226, s: 0.85 },
    ];

    function placeTrees() {
        const basePath = '/assets/patrol/';
        SCENE_OBJECTS.forEach(def => {
            const el = document.createElement('div');
            el.className = 'patrol-tree';
            el.style.backgroundImage = `url(${basePath}${def.src})`;
            const sw = Math.round(def.w * def.s);
            const sh = Math.round(def.h * def.s);
            el.style.width = sw + 'px';
            el.style.height = sh + 'px';
            el.style.backgroundSize = sw + 'px ' + sh + 'px';
            el.style.left = def.x + 'px';
            // Position so object base (bottom) sits at the specified y
            el.style.top = (def.y - sh) + 'px';
            // z-index: further down (higher y) renders in front
            el.style.zIndex = Math.round(def.y);
            camera.appendChild(el);
        });
    }

    // ── Player ────────────────────────────────────────────────────
    function spawnPlayer(spriteUrl, session) {
        const el = document.createElement('div');
        el.className = 'patrol-player dir-down frame-1';
        el.style.backgroundImage = `url(${spriteUrl})`;

        const rect = stage.getBoundingClientRect();
        const startX = rect.width / 2 - 24;
        const startY = rect.height * 0.68;

        player = {
            el,
            x: startX,
            y: startY,
            dir: 'down',
            moving: false,
            speed: 140
        };

        el.style.left = player.x + 'px';
        el.style.top  = player.y + 'px';
        camera.appendChild(el);

        // Input handlers
        stage.addEventListener('click', activate);
        stage.addEventListener('focus', () => {
            controlled = true;
        });
        stage.addEventListener('blur', () => {
            controlled = false;
            keys = {};
            stopWalking();
        });
        stage.addEventListener('keydown', onKeyDown);
        stage.addEventListener('keyup', onKeyUp);

        gameRunning = true;
        requestAnimationFrame(gameLoop);
    }

    function activate() {
        if (!controlled) {
            controlled = true;
            stage.focus();
        }
    }

    // ── Input ─────────────────────────────────────────────────────
    function onKeyDown(e) {
        if (!controlled || !player) return;
        const k = e.key.toLowerCase();
        if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
            e.preventDefault();
            keys[k] = true;
        }
    }

    function onKeyUp(e) {
        const k = e.key.toLowerCase();
        delete keys[k];
        if (!keys.w && !keys.a && !keys.s && !keys.d &&
            !keys.arrowup && !keys.arrowdown && !keys.arrowleft && !keys.arrowright) {
            stopWalking();
        }
    }

    function stopWalking() {
        if (!player) return;
        player.moving = false;
        player.el.classList.remove('walking');
    }

    // ── Game loop ─────────────────────────────────────────────────
    let lastTime = 0;

    function gameLoop(ts) {
        if (!gameRunning) return;
        const dt = lastTime ? (ts - lastTime) / 1000 : 0;
        lastTime = ts;

        if (controlled && player) {
            updateMovement(dt);
        }

        requestAnimationFrame(gameLoop);
    }

    function updateMovement(dt) {
        let dx = 0, dy = 0;
        if (keys.w || keys.arrowup)    dy -= 1;
        if (keys.s || keys.arrowdown)  dy += 1;
        if (keys.a || keys.arrowleft)  dx -= 1;
        if (keys.d || keys.arrowright) dx += 1;

        if (dx === 0 && dy === 0) return;

        // Normalise diagonal
        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
        }

        // Direction
        let newDir;
        if (Math.abs(dx) > Math.abs(dy)) {
            newDir = dx > 0 ? 'right' : 'left';
        } else {
            newDir = dy > 0 ? 'down' : 'up';
        }
        if (newDir !== player.dir) {
            player.dir = newDir;
            player.el.classList.remove('dir-down', 'dir-left', 'dir-right', 'dir-up');
            player.el.classList.add('dir-' + newDir);
        }

        // Move
        const rect = stage.getBoundingClientRect();
        const px = player.x + dx * player.speed * dt;
        const py = player.y + dy * player.speed * dt;

        // Clamp to walkable area
        const minX = 4;
        const maxX = rect.width - 52;
        const minY = rect.height * GROUND_TOP;
        const maxY = rect.height * GROUND_BOT;

        player.x = Math.max(minX, Math.min(maxX, px));
        player.y = Math.max(minY, Math.min(maxY, py));

        player.el.style.left = player.x + 'px';
        player.el.style.top  = player.y + 'px';
        // Z-sort: player's feet (y + 48) determines depth
        player.el.style.zIndex = Math.round(player.y + 48);

        if (!player.moving) {
            player.moving = true;
            player.el.classList.add('walking');
        }
    }
})();
