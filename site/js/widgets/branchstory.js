/**
 * branchstory.js — In-page Branch Story compose widget for reverie.house
 *
 * Opens a reverie.house-styled modal that lets a logged-in dreamer write and
 * publish an ink.branchline.bud record directly from the /story page, without
 * leaving to branchline.ink.
 *
 * Requires: window.oauthManager (oauth-manager.js)
 * Scope needed: atproto transition:generic  (already declared in client-metadata.json)
 */

class BranchStoryWidget {
    constructor() {
        this.LORE_FARM_API = 'https://lore.farm';
        this._overlay = null;
        this._editor = null;
        this._titleInput = null;
        this._errorEl = null;
        this._successEl = null;
        this._publishBtn = null;
        this._cancelBtn = null;
        this._charEl = null;
        this._parentUri = null;
        this._parentCid = null;
        this._parentTitle = null;
        this._parentAuthor = null;
        this._publishing = false;
    }

    // ── Public API ───────────────────────────────────────────────────

    /**
     * Open the compose modal.
     * @param {string} parentUri   - AT URI of the parent bud record
     * @param {string} parentCid   - CID of the parent bud record
     * @param {string} parentTitle - Display title of the parent (may be empty)
     * @param {string} parentAuthor - Handle/display name of the parent author
     */
    open(parentUri, parentCid, parentTitle, parentAuthor) {
        this._parentUri    = parentUri    || '';
        this._parentCid    = parentCid    || '';
        this._parentTitle  = parentTitle  || 'Untitled Story';
        this._parentAuthor = parentAuthor || '';

        if (!this._overlay) {
            this._build();
        }

        this._reset();
        this._populateParentStrip();
        this._overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this._overlay.classList.add('visible');
                this._titleInput.focus();
            });
        });

        document.body.style.overflow = 'hidden';
    }

    close() {
        if (!this._overlay) return;
        this._overlay.classList.remove('visible');
        setTimeout(() => {
            this._overlay.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }

    async canOpen() {
        if (!window.oauthManager) {
            this.promptLogin();
            return false;
        }

        try {
            if (typeof window.oauthManager.ensureInitialized === 'function') {
                await window.oauthManager.ensureInitialized();
            }
        } catch (initErr) {
            console.warn('⚠️ [BranchStory] OAuth initialization failed before open:', initErr);
        }

        const session = window.oauthManager.getSession();
        if (session) {
            return true;
        }

        this.promptLogin();
        return false;
    }

    promptLogin() {
        if (window.loginWidget && typeof window.loginWidget.showLoginPopup === 'function') {
            window.loginWidget.showLoginPopup();
            return;
        }

        console.warn('⚠️ [BranchStory] Login widget not ready; falling back to alert');
        alert('Please sign in to branch this story.');
    }

    // ── Build DOM ────────────────────────────────────────────────────

    _build() {
        const overlay = document.createElement('div');
        overlay.className = 'branchstory-overlay';
        overlay.style.display = 'none';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });

        // Get user session for header
        const session = window.oauthManager ? window.oauthManager.getSession() : null;
        const handle = session ? (session.handle || session.sub || '') : '';

        overlay.innerHTML = `
            <div class="branchstory-box" role="dialog" aria-modal="true" aria-label="Branch Story">

                <!-- Header -->
                <div class="branchstory-header">
                    <div class="branchstory-header-text">
                        <div class="branchstory-header-title">Branch Story</div>
                        <div class="branchstory-header-sub">${this._esc(handle ? '@' + handle : 'dreamer')}</div>
                    </div>
                    <button class="branchstory-close" aria-label="Close">×</button>
                </div>

                <!-- Parent strip -->
                <div class="branchstory-parent" id="branchstory-parent-strip">
                    <div class="branchstory-parent-label">Branching from</div>
                    <div class="branchstory-parent-title" id="branchstory-parent-title"></div>
                    <div class="branchstory-parent-author" id="branchstory-parent-author"></div>
                </div>

                <!-- Fields -->
                <div class="branchstory-content">
                    <div class="branchstory-title-row">
                        <label class="branchstory-label" for="branchstory-title-input">Story Branch Title</label>
                        <input  class="branchstory-title-input"
                                id="branchstory-title-input"
                                type="text"
                                placeholder="Name this Story Branch"
                                maxlength="200"
                                autocomplete="off">
                    </div>

                    <div class="branchstory-editor-row">
                        <label class="branchstory-label" for="branchstory-editor">Your Branch</label>
                        <div class="branchstory-editor"
                             id="branchstory-editor"
                             contenteditable="true"
                             role="textbox"
                             aria-multiline="true"
                             aria-label="Story branch text"
                             data-placeholder="Continue the story…"></div>
                        <div class="branchstory-format-hint">
                            Ctrl+B bold &nbsp;·&nbsp; Ctrl+I italic &nbsp;·&nbsp; Ctrl+U underline
                        </div>
                    </div>

                    <div class="branchstory-meta">
                        <span class="branchstory-charcount" id="branchstory-charcount">0 / 500 words</span>
                    </div>
                </div>

                <!-- Error / Success -->
                <div class="branchstory-error" id="branchstory-error"></div>
                <div class="branchstory-success" id="branchstory-success"></div>

                <!-- Actions -->
                <div class="branchstory-actions">
                    <button class="branchstory-btn secondary" id="branchstory-cancel">Cancel</button>
                    <button class="branchstory-btn primary" id="branchstory-publish">Publish Branch</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this._overlay = overlay;

        // Wire refs
        this._editor     = overlay.querySelector('#branchstory-editor');
        this._titleInput = overlay.querySelector('#branchstory-title-input');
        this._errorEl    = overlay.querySelector('#branchstory-error');
        this._successEl  = overlay.querySelector('#branchstory-success');
        this._publishBtn = overlay.querySelector('#branchstory-publish');
        this._cancelBtn  = overlay.querySelector('#branchstory-cancel');
        this._charEl     = overlay.querySelector('#branchstory-charcount');

        // Events
        overlay.querySelector('.branchstory-close').addEventListener('click', () => this.close());
        this._cancelBtn.addEventListener('click', () => this.close());
        this._publishBtn.addEventListener('click', () => this._publish());
        this._editor.addEventListener('input', () => this._updateCount());
        this._editor.addEventListener('keydown', (e) => this._onEditorKey(e));
        this._titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this._editor.focus(); }
        });

        // Escape key
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });
    }

    _populateParentStrip() {
        const titleEl  = this._overlay.querySelector('#branchstory-parent-title');
        const authorEl = this._overlay.querySelector('#branchstory-parent-author');
        titleEl.textContent  = this._parentTitle;
        authorEl.textContent = this._parentAuthor ? '@' + this._parentAuthor : '';
    }

    _reset() {
        this._publishing = false;
        this._titleInput.value = '';
        this._editor.innerHTML = '';
        this._hideError();
        this._hideSuccess();
        this._updateCount();
        this._setPublishing(false);
    }

    // ── Editor helpers ───────────────────────────────────────────────

    _onEditorKey(e) {
        if (!(e.ctrlKey || e.metaKey)) return;
        const key = e.key.toLowerCase();
        if (key === 'b') { e.preventDefault(); document.execCommand('bold'); }
        else if (key === 'i') { e.preventDefault(); document.execCommand('italic'); }
        else if (key === 'u') { e.preventDefault(); document.execCommand('underline'); }
    }

    _updateCount() {
        const text = this._getPlainText();
        const words = this._countWords(text);
        this._charEl.textContent = `${words} / 500 words`;
        this._charEl.className = 'branchstory-charcount';
        if (words > 500) this._charEl.classList.add('over');
        else if (words > 450) this._charEl.classList.add('warning');
    }

    _countWords(text) {
        if (!text) return 0;
        const trimmed = text.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).filter(Boolean).length;
    }

    /** Walk the contenteditable DOM and return plain text. */
    _getPlainText() {
        return this._walkNode(this._editor).text;
    }

    /**
     * Walk the editor DOM tree and return { text, formatting }.
     * Produces UTF-16 code-unit offsets (JS string indices) which match
     * how the Branchline schema counts characters in JS environments.
     */
    _extractPayload() {
        const result = this._walkNode(this._editor);
        const text = result.text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\u00a0/g, ' ');
        return {
            text,
            formatting: this._mergeFormatting(result.formatting)
        };
    }

    _walkNode(root) {
        let text = '';
        const rawRanges = [];

        const walk = (node, boldActive, italicActive, underlineActive) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const start = text.length;
                // Convert &nbsp; to regular space at walk time too
                const chunk = (node.textContent || '').replace(/\u00a0/g, ' ');
                text += chunk;
                const end = text.length;
                if (chunk.length > 0) {
                    if (boldActive)      rawRanges.push({ start, end, type: 'bold' });
                    if (italicActive)    rawRanges.push({ start, end, type: 'italic' });
                    if (underlineActive) rawRanges.push({ start, end, type: 'underline' });
                }
                return;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) return;

            const tag = node.tagName.toUpperCase();

            // Block-level elements add a newline before their content
            const isBlock = ['DIV', 'P', 'BR'].includes(tag);
            if (isBlock && text.length > 0) {
                if (tag === 'BR') {
                    text += '\n';
                    return;
                }
                // DIV/P — add newline before if previous char isn't already one
                if (text[text.length - 1] !== '\n') {
                    text += '\n';
                }
            }

            const isBold      = boldActive      || tag === 'B' || tag === 'STRONG';
            const isItalic    = italicActive    || tag === 'I' || tag === 'EM';
            const isUnderline = underlineActive || tag === 'U';

            for (const child of node.childNodes) {
                walk(child, isBold, isItalic, isUnderline);
            }
        };

        walk(root, false, false, false);

        // Trim trailing newlines added by the browser
        const trimmed = text.replace(/\n+$/, '');
        const trimDiff = text.length - trimmed.length;
        const clippedRanges = trimDiff > 0
            ? rawRanges.filter(r => r.start < trimmed.length).map(r => ({ ...r, end: Math.min(r.end, trimmed.length) }))
            : rawRanges;

        return { text: trimmed, formatting: clippedRanges };
    }

    /** Collapse adjacent/overlapping ranges of the same type. */
    _mergeFormatting(ranges) {
        const byType = {};
        for (const r of ranges) {
            if (!byType[r.type]) byType[r.type] = [];
            byType[r.type].push({ start: r.start, end: r.end });
        }

        const merged = [];
        for (const [type, list] of Object.entries(byType)) {
            list.sort((a, b) => a.start - b.start);
            let cur = null;
            for (const r of list) {
                if (!cur) { cur = { ...r, type }; continue; }
                if (r.start <= cur.end) {
                    cur.end = Math.max(cur.end, r.end);
                } else {
                    if (cur.start < cur.end) merged.push(cur);
                    cur = { ...r, type };
                }
            }
            if (cur && cur.start < cur.end) merged.push(cur);
        }

        return merged.sort((a, b) => a.start - b.start || a.end - b.end);
    }

    // ── Publish ──────────────────────────────────────────────────────

    async _publish() {
        if (this._publishing) return;

        this._hideError();
        this._hideSuccess();

        const title = this._titleInput.value.trim();
        if (!title) {
            this._showError('Please name this Story Branch before publishing.');
            this._titleInput.focus();
            return;
        }

        const { text, formatting } = this._extractPayload();
        if (!text.trim()) {
            this._showError('Write your branch story before publishing.');
            this._editor.focus();
            return;
        }

        const wordCount = this._countWords(text);
        if (wordCount > 500) {
            this._showError('Keep your branch to 500 words or fewer.');
            this._editor.focus();
            return;
        }

        if (!window.oauthManager) {
            this._showError('Not connected to your account. Please log in again.');
            return;
        }

        try {
            if (typeof window.oauthManager.ensureInitialized === 'function') {
                await window.oauthManager.ensureInitialized();
            }
        } catch (initErr) {
            console.warn('⚠️ [BranchStory] OAuth initialization failed:', initErr);
        }

        const session = window.oauthManager.getSession();
        if (!session) {
            this._showError('You need to be logged in to publish a Story Branch.');
            return;
        }

        this._publishing = true;
        this._setPublishing(true);

        const record = {
            text,
            title,
            createdAt: new Date().toISOString(),
            ...(formatting.length > 0 ? { formatting } : {}),
            ...(this._parentUri ? {
                parent: {
                    uri: this._parentUri,
                    ...(this._parentCid ? { cid: this._parentCid } : {})
                }
            } : {})
        };

        try {
            const postResult = await window.oauthManager.createRecord('ink.branchline.bud', record);

            let loreRecordLinked = false;
            let loreResult = null;
            if (postResult?.uri && postResult?.cid) {
                try {
                    loreResult = await window.oauthManager.createRecord('farm.lore.content', {
                        subject: {
                            uri: postResult.uri,
                            cid: postResult.cid
                        },
                        world: 'reverie.house',
                        createdAt: new Date().toISOString()
                    });
                    loreRecordLinked = true;
                } catch (loreErr) {
                    console.warn('⚠️ [BranchStory] Branch published but lore linkage failed:', loreErr);
                }
            }

            // Hint lore.farm indexer immediately for fast propagation.
            const notifyUris = [postResult?.uri, loreResult?.uri].filter(Boolean);
            if (notifyUris.length > 0) {
                await Promise.all(notifyUris.map(async (uri) => {
                    try {
                        await fetch(`${this.LORE_FARM_API}/api/notify`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ uri })
                        });
                    } catch (notifyErr) {
                        console.warn('⚠️ [BranchStory] Notify hint failed (record will sync via Jetstream):', notifyErr);
                    }
                }));
            }

            if (loreRecordLinked) {
                this._showSuccess('Story Branch published and added to Reverie House lore.');
            } else {
                this._showSuccess('Story Branch published. Lore linkage could not be confirmed.');
            }

            window.dispatchEvent(new CustomEvent('branchstory:success', {
                detail: {
                    post: postResult,
                    lore: loreResult,
                    linked: loreRecordLinked
                }
            }));

            this._setPublishing(false);
            this._publishing = false;
            // Auto-close after a moment
            setTimeout(() => this.close(), 2800);
        } catch (err) {
            this._publishing = false;
            this._setPublishing(false);
            const msg = err?.message || 'Unknown error';

            // oauth-manager already dispatches oauth:logout when a real OAuth session
            // is deleted/expired. Only surface the expiry message for that case.
            if (msg.includes('Your session has expired')) {
                this._showError('Your session has expired. Please sign in again.');
            } else if (msg.includes('Not logged in')) {
                this._showError('Your account session is not ready yet. Please try again in a moment.');
            } else if (msg.includes('401') || msg.includes('unauthorized')) {
                this._showError('Not authorized to write Branchline records. Please sign out and back in.');
            } else {
                this._showError('Failed to publish: ' + msg);
            }
        }
    }

    // ── UI state ─────────────────────────────────────────────────────

    _setPublishing(active) {
        this._publishBtn.disabled = active;
        this._cancelBtn.disabled  = active;
        this._titleInput.disabled = active;
        this._editor.contentEditable = active ? 'false' : 'true';
        this._publishBtn.innerHTML = active
                ? `<svg class="branchstory-spinner" width="15" height="15" viewBox="0 0 24 24" fill="none">
                   <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
                   <path d="M12 2a10 10 0 0 1 10 10" stroke="white" stroke-width="3" stroke-linecap="round"/>
                    </svg> Publishing…`
                : `Publish Branch`;
    }

    _showError(msg) {
        this._errorEl.textContent = msg;
        this._errorEl.classList.add('visible');
        // Re-trigger animation
        this._errorEl.style.animation = 'none';
        void this._errorEl.offsetWidth;
        this._errorEl.style.animation = '';
    }

    _hideError() {
        this._errorEl.classList.remove('visible');
    }

    _showSuccess(msg) {
        this._successEl.textContent = msg;
        this._successEl.classList.add('visible');
    }

    _hideSuccess() {
        this._successEl.classList.remove('visible');
    }

    // ── Utilities ────────────────────────────────────────────────────

    _esc(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

// Singleton
window.branchStoryWidget = new BranchStoryWidget();

/**
 * Global entry-point called by the Branch Story button's onclick.
 * @param {string} parentUri
 * @param {string} parentCid
 * @param {string} parentTitle
 * @param {string} parentAuthor
 */
async function openBranchStory(parentUri, parentCid, parentTitle, parentAuthor) {
    if (!window.branchStoryWidget) return;
    const canOpen = await window.branchStoryWidget.canOpen();
    if (!canOpen) return;
    window.branchStoryWidget.open(parentUri, parentCid, parentTitle, parentAuthor);
}
