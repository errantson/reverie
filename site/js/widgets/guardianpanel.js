/**
 * Guardian Panel Widget
 * 
 * A popup modal for viewing and managing a guardian's approved/barred lists.
 * If the current user is the guardian, they can add/remove items from their lists.
 */

class GuardianPanel {
    constructor() {
        this.modal = null;
        this.guardianDid = null;
        this.guardianName = null;
        this.isOwner = false;
        this.lists = {
            approvedDreamers: [],
            barredDreamers: [],
            approvedDreams: [],
            barredDreams: []
        };
        this.postCache = new Map(); // Cache for fetched post data
        this.loadDependencies();
    }
    
    /**
     * Load required dependencies
     */
    loadDependencies() {
        // Load showpost.js for viewing posts
        if (!document.querySelector('script[src*="js/widgets/showpost.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/widgets/showpost.js?v=2';
            document.head.appendChild(script);
        }
    }

    /**
     * Open the guardian panel for a specific guardian
     * @param {string} guardianDid - The DID of the guardian
     * @param {string} guardianName - Display name of the guardian
     * @param {object} options - Optional settings (selfModeration: boolean)
     */
    async open(guardianDid, guardianName, options = {}) {
        this.guardianDid = guardianDid;
        this.guardianName = guardianName;
        this.selfModeration = options.selfModeration || false;
        
        // Check if current user is this guardian
        const currentUserDid = this.getCurrentUserDid();
        this.isOwner = currentUserDid && currentUserDid === guardianDid;
        
        // Check if user is an actual guardian (has stewardship role)
        this.isActualGuardian = false;
        if (this.isOwner) {
            try {
                const token = localStorage.getItem('oauth_token') || localStorage.getItem('admin_token');
                const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
                const response = await fetch('/api/work/guardian/status', { headers });
                if (response.ok) {
                    const data = await response.json();
                    this.isActualGuardian = data.is_worker === true;
                }
            } catch (e) {
                console.warn('Could not check guardian status:', e);
            }
        }
        
        this.render();
        await this.loadLists();
    }

    /**
     * Get current user's DID
     */
    getCurrentUserDid() {
        if (window.oauthManager) {
            const session = window.oauthManager.getSession();
            return session?.did;
        }
        return null;
    }

    /**
     * Validate a DID string
     */
    validateDid(input) {
        if (!input || typeof input !== 'string') return false;
        const trimmed = input.trim();
        // Must start with did: and have at least method:identifier
        if (!trimmed.startsWith('did:')) return false;
        const parts = trimmed.split(':');
        if (parts.length < 3) return false;
        // Common methods: plc, web
        const method = parts[1];
        if (!['plc', 'web'].includes(method)) return false;
        // For did:plc, the identifier should be base32 encoded
        if (method === 'plc') {
            const identifier = parts[2];
            if (identifier.length < 20 || identifier.length > 30) return false;
            // Check for valid base32 characters
            if (!/^[a-z2-7]+$/.test(identifier)) return false;
        }
        return true;
    }

    /**
     * Validate an AT URI string
     */
    validateAtUri(input) {
        if (!input || typeof input !== 'string') return false;
        const trimmed = input.trim();
        // Must start with at://
        if (!trimmed.startsWith('at://')) return false;
        // Parse: at://did/collection/rkey
        const withoutScheme = trimmed.slice(5);
        const parts = withoutScheme.split('/');
        if (parts.length < 3) return false;
        const [did, collection, rkey] = parts;
        // Validate DID part
        if (!did.startsWith('did:')) return false;
        // Validate collection (should be like app.bsky.feed.post)
        if (!collection || !collection.includes('.')) return false;
        // Validate rkey exists
        if (!rkey || rkey.length === 0) return false;
        return true;
    }

    /**
     * Validate input as either DID or AT URI
     */
    validateInput(input) {
        const trimmed = (input || '').trim();
        if (this.validateDid(trimmed)) {
            return { valid: true, type: 'did', value: trimmed };
        }
        if (this.validateAtUri(trimmed)) {
            return { valid: true, type: 'uri', value: trimmed };
        }
        return { valid: false, type: null, value: trimmed };
    }

    /**
     * Render the modal
     */
    render() {
        // Remove existing modal
        this.close();

        this.modal = document.createElement('div');
        this.modal.id = 'guardian-panel-modal';
        this.modal.className = 'guardian-panel-overlay';
        
        // Stop all events from propagating to elements below (like drawer)
        this.modal.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close only if clicking the overlay itself
            if (e.target === this.modal) {
                this.close();
            }
        });
        this.modal.addEventListener('mousedown', (e) => e.stopPropagation());
        this.modal.addEventListener('mouseup', (e) => e.stopPropagation());
        this.modal.addEventListener('touchstart', (e) => e.stopPropagation());
        this.modal.addEventListener('touchend', (e) => e.stopPropagation());

        const ownerControls = this.isOwner ? `
            <div class="guardian-panel-add-section">
                <div class="guardian-panel-add-row">
                    <div class="guardian-panel-input-wrapper">
                        <input type="text" 
                               id="guardian-panel-input" 
                               class="guardian-panel-input" 
                               placeholder="DID or AT URI..."
                               autocomplete="off">
                        <div id="guardian-panel-autocomplete" class="guardian-panel-autocomplete"></div>
                    </div>
                    <select id="guardian-panel-list-select" class="guardian-panel-select">
                        <option value="barred_users">Bar User</option>
                        <option value="barred_content">Bar Content</option>
                        <option value="allowed_users">Allow User</option>
                        <option value="allowed_content">Allow Content</option>
                    </select>
                    <button id="guardian-panel-add-btn" class="guardian-panel-add-btn">ADD</button>
                </div>
                <div id="guardian-panel-input-error" class="guardian-panel-input-error"></div>
            </div>
        ` : '';

        // Determine panel title based on context
        const panelTitle = this.selfModeration ? 'Moderation Settings' : `<strong>Guardian:</strong> ${this.guardianName}`;
        
        // Only show stewardship tab if user is an actual guardian
        const stewardshipTab = this.isActualGuardian ? `<button class="guardian-panel-tab" data-tab="stewardship">STEWARDSHIP</button>` : '';

        this.modal.innerHTML = `
            <div class="guardian-panel-content">
                <div class="guardian-panel-header">
                    <span class="guardian-panel-title">${panelTitle}</span>
                    <button class="guardian-panel-close" onclick="window.guardianPanel.close()">X</button>
                </div>
                
                ${ownerControls}
                
                <div class="guardian-panel-tabs">
                    <button class="guardian-panel-tab active" data-tab="barred">BARRED</button>
                    <button class="guardian-panel-tab" data-tab="allowed">ALLOWED</button>
                    ${stewardshipTab}
                </div>
                
                <div class="guardian-panel-lists">
                    <!-- Barred tab -->
                    <div id="guardian-panel-barred" class="guardian-panel-tab-content active">
                        <div class="guardian-panel-list-section">
                            <div class="guardian-panel-list-header">DREAMERS</div>
                            <div id="guardian-panel-barred-users" class="guardian-panel-list">
                                <div class="guardian-panel-loading">Loading...</div>
                            </div>
                        </div>
                        <div class="guardian-panel-list-section">
                            <div class="guardian-panel-list-header">DREAMS</div>
                            <div id="guardian-panel-barred-content" class="guardian-panel-list">
                                <div class="guardian-panel-loading">Loading...</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Allowed tab -->
                    <div id="guardian-panel-allowed" class="guardian-panel-tab-content">
                        <div class="guardian-panel-list-section">
                            <div class="guardian-panel-list-header">DREAMERS</div>
                            <div id="guardian-panel-allowed-users" class="guardian-panel-list">
                                <div class="guardian-panel-loading">Loading...</div>
                            </div>
                        </div>
                        <div class="guardian-panel-list-section">
                            <div class="guardian-panel-list-header">DREAMS</div>
                            <div id="guardian-panel-allowed-content" class="guardian-panel-list">
                                <div class="guardian-panel-loading">Loading...</div>
                            </div>
                        </div>
                    </div>
                    
                    ${this.isActualGuardian ? `
                    <!-- Stewardship tab -->
                    <div id="guardian-panel-stewardship" class="guardian-panel-tab-content">
                        <div class="guardian-panel-list-section">
                            <div class="guardian-panel-list-header stewardship-header ward-header">
                                <svg class="stewardship-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                                </svg>
                                WARDS
                            </div>
                            <div id="guardian-panel-wards" class="guardian-panel-list">
                                <div class="guardian-panel-loading">Loading...</div>
                            </div>
                        </div>
                        <div class="guardian-panel-list-section">
                            <div class="guardian-panel-list-header stewardship-header charge-header">
                                <svg class="stewardship-header-icon" viewBox="0 0 20 20" fill="currentColor">
                                    <polygon points="17.17,15.76 20,18.59 18.59,20 15.76,17.17 14.35,18.59 12.93,17.17 14.35,15.76 10,10.98 5.65,15.76 7.07,17.17 5.65,18.59 4.24,17.17 1.41,20 0,18.59 2.83,15.76 1.41,14.35 2.83,12.93 4.24,14.35 9.06,9.96 0,0 10,9.1 20,0 10.94,9.96 15.76,14.35 17.17,12.93 18.59,14.35"/>
                                </svg>
                                CHARGES
                            </div>
                            <div id="guardian-panel-charges" class="guardian-panel-list">
                                <div class="guardian-panel-loading">Loading...</div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);
        this.injectStyles();
        this.setupListeners();
        
        // Animate in
        setTimeout(() => this.modal.classList.add('active'), 10);
    }

    /**
     * Setup event listeners
     */
    setupListeners() {
        // Tab switching
        const tabs = this.modal.querySelectorAll('.guardian-panel-tab');
        tabs.forEach(tab => {
            tab.onclick = (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            };
        });

        if (this.isOwner) {
            // Add button
            const addBtn = this.modal.querySelector('#guardian-panel-add-btn');
            if (addBtn) {
                addBtn.onclick = () => this.handleAdd();
            }

            // Input with autocomplete
            const input = this.modal.querySelector('#guardian-panel-input');
            if (input) {
                input.oninput = () => {
                    this.validateInputField();
                    this.handleAutocomplete(input.value);
                };
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.hideAutocomplete();
                        this.handleAdd();
                    } else if (e.key === 'Escape') {
                        this.hideAutocomplete();
                    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        this.navigateAutocomplete(e.key === 'ArrowDown' ? 1 : -1);
                    }
                };
                input.onblur = () => {
                    // Delay to allow click on autocomplete item
                    setTimeout(() => this.hideAutocomplete(), 150);
                };
            }
        }

        // Escape to close
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this.escapeHandler);
    }

    /**
     * Handle autocomplete search
     */
    async handleAutocomplete(query) {
        const autocompleteEl = this.modal.querySelector('#guardian-panel-autocomplete');
        if (!autocompleteEl) return;

        const trimmed = query.trim();
        if (trimmed.length < 2) {
            this.hideAutocomplete();
            return;
        }

        // Don't autocomplete if it looks like a complete DID or URI
        if (this.validateDid(trimmed) || this.validateAtUri(trimmed)) {
            this.hideAutocomplete();
            return;
        }

        try {
            const results = await this.searchUsers(trimmed);
            if (results.length === 0) {
                this.hideAutocomplete();
                return;
            }

            autocompleteEl.innerHTML = results.slice(0, 8).map((user, index) => `
                <div class="guardian-panel-autocomplete-item${index === 0 ? ' selected' : ''}" 
                     data-did="${user.did}" 
                     data-display="${user.displayName || user.handle}">
                    ${user.avatar ? `<img src="${user.avatar}" class="guardian-panel-autocomplete-avatar" alt="">` : ''}
                    <div class="guardian-panel-autocomplete-info">
                        <span class="guardian-panel-autocomplete-name">${user.displayName || user.handle}</span>
                        <span class="guardian-panel-autocomplete-handle">@${user.handle}</span>
                    </div>
                </div>
            `).join('');

            autocompleteEl.style.display = 'block';

            // Attach click handlers
            autocompleteEl.querySelectorAll('.guardian-panel-autocomplete-item').forEach(item => {
                item.onclick = () => {
                    const input = this.modal.querySelector('#guardian-panel-input');
                    if (input) {
                        input.value = item.dataset.did;
                        this.validateInputField();
                    }
                    this.hideAutocomplete();
                };
            });

        } catch (error) {
            console.error('Autocomplete search failed:', error);
            this.hideAutocomplete();
        }
    }

    /**
     * Search users from local DB and Bluesky
     */
    async searchUsers(query) {
        const results = [];
        const seen = new Set();

        // Search local database first (name, pseudonym)
        try {
            const localRes = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=5`);
            if (localRes.ok) {
                const localData = await localRes.json();
                for (const user of (localData.users || [])) {
                    if (!seen.has(user.did)) {
                        seen.add(user.did);
                        results.push({
                            did: user.did,
                            handle: user.handle || user.name,
                            displayName: user.display_name || user.pseudonym || user.name,
                            avatar: user.avatar
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('Local user search failed:', e);
        }

        // Search Bluesky for handles
        if (results.length < 5) {
            try {
                const bskyRes = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(query)}&limit=5`);
                if (bskyRes.ok) {
                    const bskyData = await bskyRes.json();
                    for (const actor of (bskyData.actors || [])) {
                        if (!seen.has(actor.did)) {
                            seen.add(actor.did);
                            results.push({
                                did: actor.did,
                                handle: actor.handle,
                                displayName: actor.displayName || actor.handle,
                                avatar: actor.avatar
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn('Bluesky search failed:', e);
            }
        }

        return results;
    }

    /**
     * Navigate autocomplete with arrow keys
     */
    navigateAutocomplete(direction) {
        const autocompleteEl = this.modal.querySelector('#guardian-panel-autocomplete');
        if (!autocompleteEl || autocompleteEl.style.display === 'none') return;

        const items = autocompleteEl.querySelectorAll('.guardian-panel-autocomplete-item');
        if (items.length === 0) return;

        let currentIndex = -1;
        items.forEach((item, index) => {
            if (item.classList.contains('selected')) {
                currentIndex = index;
            }
        });

        items.forEach(item => item.classList.remove('selected'));

        let newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = items.length - 1;
        if (newIndex >= items.length) newIndex = 0;

        items[newIndex].classList.add('selected');
        items[newIndex].scrollIntoView({ block: 'nearest' });

        // Update input with selected item
        const input = this.modal.querySelector('#guardian-panel-input');
        if (input) {
            input.value = items[newIndex].dataset.did;
        }
    }

    /**
     * Hide autocomplete dropdown
     */
    hideAutocomplete() {
        const autocompleteEl = this.modal.querySelector('#guardian-panel-autocomplete');
        if (autocompleteEl) {
            autocompleteEl.style.display = 'none';
            autocompleteEl.innerHTML = '';
        }
    }

    /**
     * Validate input field and show error, also update dropdown options
     */
    validateInputField() {
        const input = this.modal.querySelector('#guardian-panel-input');
        const errorEl = this.modal.querySelector('#guardian-panel-input-error');
        const addBtn = this.modal.querySelector('#guardian-panel-add-btn');
        const listSelect = this.modal.querySelector('#guardian-panel-list-select');
        
        if (!input || !errorEl || !addBtn || !listSelect) return;

        const value = input.value.trim();
        if (!value) {
            errorEl.textContent = '';
            addBtn.disabled = false;
            // Reset to all options when empty
            this.updateDropdownOptions(listSelect, 'all');
            return;
        }

        const result = this.validateInput(value);
        if (result.valid) {
            errorEl.textContent = '';
            addBtn.disabled = false;
            // Update dropdown based on input type
            this.updateDropdownOptions(listSelect, result.type);
        } else {
            errorEl.textContent = 'Enter a valid DID (did:plc:...) or AT URI (at://...)';
            addBtn.disabled = true;
            this.updateDropdownOptions(listSelect, 'all');
        }
    }

    /**
     * Update dropdown options based on input type
     */
    updateDropdownOptions(select, inputType) {
        if (!select) return;
        
        const currentValue = select.value;
        
        if (inputType === 'did') {
            // Only show user options for DIDs
            select.innerHTML = `
                <option value="barred_users">Bar User</option>
                <option value="allowed_users">Allow User</option>
            `;
            // Preserve selection if still valid
            if (currentValue === 'barred_users' || currentValue === 'allowed_users') {
                select.value = currentValue;
            }
        } else if (inputType === 'uri') {
            // Only show content options for URIs
            select.innerHTML = `
                <option value="barred_content">Bar Content</option>
                <option value="allowed_content">Allow Content</option>
            `;
            // Preserve selection if still valid
            if (currentValue === 'barred_content' || currentValue === 'allowed_content') {
                select.value = currentValue;
            }
        } else {
            // Show all options
            select.innerHTML = `
                <option value="barred_users">Bar User</option>
                <option value="barred_content">Bar Content</option>
                <option value="allowed_users">Allow User</option>
                <option value="allowed_content">Allow Content</option>
            `;
            // Try to preserve current selection
            if (['barred_users', 'barred_content', 'allowed_users', 'allowed_content'].includes(currentValue)) {
                select.value = currentValue;
            }
        }
    }

    /**
     * Handle adding a new item
     */
    async handleAdd() {
        const input = this.modal.querySelector('#guardian-panel-input');
        const errorEl = this.modal.querySelector('#guardian-panel-input-error');
        const addBtn = this.modal.querySelector('#guardian-panel-add-btn');
        const listSelect = this.modal.querySelector('#guardian-panel-list-select');
        
        if (!input || !addBtn || !listSelect) return;

        const value = input.value.trim();
        const listName = listSelect.value; // barred_users, barred_content, allowed_users, allowed_content
        
        const validation = this.validateInput(value);
        if (!validation.valid) {
            if (errorEl) errorEl.textContent = 'Enter a valid DID or AT URI';
            return;
        }

        // Validate: users need DIDs, content needs URIs
        if (listName.includes('_users') && validation.type !== 'did') {
            if (errorEl) errorEl.textContent = 'User lists require a DID (did:plc:...)';
            return;
        }
        if (listName.includes('_content') && validation.type !== 'uri') {
            if (errorEl) errorEl.textContent = 'Content lists require an AT URI (at://...)';
            return;
        }
        
        addBtn.disabled = true;
        addBtn.textContent = 'ADDING...';

        try {
            const token = localStorage.getItem('oauth_token') || localStorage.getItem('admin_token');
            const response = await fetch('/api/guardian/add', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    list: listName,
                    value: validation.value
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to add item');
            }

            // Clear input and reload
            input.value = '';
            if (errorEl) errorEl.textContent = '';
            await this.loadLists();

        } catch (error) {
            console.error('Failed to add to guardian list:', error);
            if (errorEl) errorEl.textContent = error.message;
        } finally {
            addBtn.disabled = false;
            addBtn.textContent = 'ADD';
        }
    }

    /**
     * Handle removing an item
     */
    async handleRemove(listName, value) {
        if (!this.isOwner) return;

        try {
            const token = localStorage.getItem('oauth_token') || localStorage.getItem('admin_token');
            const response = await fetch('/api/guardian/remove', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    list: listName,
                    value: value
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to remove item');
            }

            // Reload lists
            await this.loadLists();

        } catch (error) {
            console.error('Failed to remove from guardian list:', error);
            alert('Failed to remove: ' + error.message);
        }
    }

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        const tabs = this.modal.querySelectorAll('.guardian-panel-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        const contents = this.modal.querySelectorAll('.guardian-panel-tab-content');
        contents.forEach(content => {
            const contentTab = content.id.replace('guardian-panel-', '');
            content.classList.toggle('active', contentTab === tabName);
        });
    }

    /**
     * Load the guardian's lists from API
     */
    async loadLists() {
        try {
            const response = await fetch(`/api/guardian/${encodeURIComponent(this.guardianDid)}/lists`);
            if (!response.ok) throw new Error('Failed to load lists');
            
            const data = await response.json();
            
            this.lists = {
                barred_users: data.barred_users || [],
                barred_content: data.barred_content || [],
                allowed_users: data.allowed_users || [],
                allowed_content: data.allowed_content || [],
                wards: data.wards || [],
                charges: data.charges || []
            };

            await this.renderLists();

        } catch (error) {
            console.error('Failed to load guardian lists:', error);
            this.renderError();
        }
    }

    /**
     * Render the lists
     */
    async renderLists() {
        this.renderUserList('guardian-panel-barred-users', this.lists.barred_users, 'barred_users');
        await this.renderContentList('guardian-panel-barred-content', this.lists.barred_content, 'barred_content');
        this.renderUserList('guardian-panel-allowed-users', this.lists.allowed_users, 'allowed_users');
        await this.renderContentList('guardian-panel-allowed-content', this.lists.allowed_content, 'allowed_content');
        this.renderStewardshipList('guardian-panel-wards', this.lists.wards, 'ward');
        this.renderStewardshipList('guardian-panel-charges', this.lists.charges, 'charge');
    }

    /**
     * Render a stewardship list (wards or charges)
     */
    renderStewardshipList(containerId, items, type) {
        const container = this.modal.querySelector(`#${containerId}`);
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = `<div class="guardian-panel-empty">No ${type}s yet</div>`;
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="guardian-panel-item stewardship-item ${type}-item">
                <img src="${item.avatar || '/assets/default-avatar.png'}" 
                     class="guardian-panel-avatar" 
                     alt="${item.displayName || item.handle}"
                     onerror="this.src='/assets/default-avatar.png'">
                <div class="guardian-panel-item-info">
                    <span class="guardian-panel-item-name">${item.displayName || item.handle}</span>
                    <span class="guardian-panel-item-handle">@${item.handle}</span>
                </div>
            </div>
        `).join('');
    }

    /**
     * Render a user list
     */
    renderUserList(containerId, items, listName) {
        const container = this.modal.querySelector(`#${containerId}`);
        if (!container) return;

        if (!items || items.length === 0) {
            container.innerHTML = '<div class="guardian-panel-empty">None</div>';
            return;
        }

        const html = items.map(item => {
            const displayName = item.displayName || item.handle || 'Unknown';
            const handle = item.handle || 'unknown';
            const rawValue = item.did;
            
            const removeBtn = this.isOwner 
                ? `<button class="guardian-panel-remove-btn" data-list="${listName}" data-value="${rawValue}">X</button>`
                : '';

            return `
                <div class="guardian-panel-item">
                    <img src="${item.avatar || '/assets/default-avatar.png'}" 
                         class="guardian-panel-avatar" 
                         alt="${displayName}"
                         onerror="this.src='/assets/default-avatar.png'">
                    <div class="guardian-panel-item-info">
                        <span class="guardian-panel-item-name">${displayName}</span>
                        <span class="guardian-panel-item-handle">@${handle}</span>
                    </div>
                    ${removeBtn}
                </div>
            `;
        }).join('');

        container.innerHTML = html;

        // Attach remove handlers
        if (this.isOwner) {
            container.querySelectorAll('.guardian-panel-remove-btn').forEach(btn => {
                btn.onclick = () => {
                    this.handleRemove(btn.dataset.list, btn.dataset.value);
                };
            });
        }
    }

    /**
     * Render a content list
     */
    async renderContentList(containerId, items, listName) {
        const container = this.modal.querySelector(`#${containerId}`);
        if (!container) return;

        if (!items || items.length === 0) {
            container.innerHTML = '<div class="guardian-panel-empty">None</div>';
            return;
        }

        // Show loading state
        container.innerHTML = '<div class="guardian-panel-loading">Loading posts...</div>';

        // Fetch post data for all items
        const postDataPromises = items.map(async (item) => {
            const uri = item.uri || item;
            
            // Check cache first
            if (this.postCache.has(uri)) {
                return { uri, ...this.postCache.get(uri) };
            }
            
            try {
                // Extract rkey from URI (at://did/collection/rkey)
                const parts = uri.replace('at://', '').split('/');
                const did = parts[0];
                const rkey = parts[2] || '';
                
                // Fetch post from public API
                const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`);
                if (response.ok) {
                    const data = await response.json();
                    const post = data.posts?.[0];
                    if (post) {
                        // Format timestamp
                        let timestamp = '';
                        if (post.record?.createdAt) {
                            const date = new Date(post.record.createdAt);
                            timestamp = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        }
                        const result = {
                            avatar: post.author.avatar || '/souvenirs/dream/strange/icon.png',
                            displayName: post.author.displayName || post.author.handle,
                            handle: post.author.handle,
                            rkey: rkey,
                            timestamp: timestamp
                        };
                        this.postCache.set(uri, result);
                        return { uri, ...result };
                    }
                }
                // Fallback if fetch fails
                return { uri, avatar: '/souvenirs/dream/strange/icon.png', displayName: 'Unknown', handle: did, rkey: rkey, timestamp: '' };
            } catch (e) {
                console.warn('Failed to fetch post data for', uri, e);
                const parts = uri.replace('at://', '').split('/');
                return { uri, avatar: '/souvenirs/dream/strange/icon.png', displayName: 'Unknown', handle: parts[0], rkey: parts[2] || '', timestamp: '' };
            }
        });

        const postData = await Promise.all(postDataPromises);

        const html = postData.map(item => {
            const removeBtn = this.isOwner 
                ? `<button class="guardian-panel-remove-btn" data-list="${listName}" data-value="${item.uri}">X</button>`
                : '';

            return `
                <div class="guardian-panel-item guardian-panel-content-item" data-uri="${item.uri}">
                    <img class="guardian-panel-content-avatar" src="${item.avatar}" alt="" onerror="this.src='/souvenirs/dream/strange/icon.png'">
                    <div class="guardian-panel-content-left">
                        <span class="guardian-panel-content-name">${item.displayName}</span>
                        <span class="guardian-panel-content-handle">@${item.handle}</span>
                    </div>
                    <div class="guardian-panel-content-right">
                        <span class="guardian-panel-content-timestamp">${item.timestamp}</span>
                        <span class="guardian-panel-content-rkey">${item.rkey}</span>
                    </div>
                    ${removeBtn}
                </div>
            `;
        }).join('');

        container.innerHTML = html;

        // Attach click handlers to view posts
        container.querySelectorAll('.guardian-panel-content-item').forEach(el => {
            el.onclick = (e) => {
                // Don't trigger if clicking remove button
                if (e.target.classList.contains('guardian-panel-remove-btn')) return;
                this.showPost(el.dataset.uri);
            };
        });

        // Attach remove handlers
        if (this.isOwner) {
            container.querySelectorAll('.guardian-panel-remove-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation(); // Prevent triggering the item click
                    this.handleRemove(btn.dataset.list, btn.dataset.value);
                };
            });
        }
    }

    /**
     * Show a post in a popup
     */
    showPost(uri) {
        // Use the ShowPost widget if available
        if (window.ShowPost) {
            const showPost = new ShowPost();
            showPost.show(uri);
        } else if (window.showPostWidget) {
            window.showPostWidget.show(uri);
        } else {
            // Fallback: open in new tab
            const parts = uri.replace('at://', '').split('/');
            const did = parts[0];
            const rkey = parts[2];
            window.open(`https://bsky.app/profile/${did}/post/${rkey}`, '_blank');
        }
    }

    /**
     * Render error state
     */
    renderError() {
        const containers = ['guardian-panel-barred-users', 'guardian-panel-barred-content', 'guardian-panel-allowed-users', 'guardian-panel-allowed-content'];
        containers.forEach(id => {
            const el = this.modal.querySelector(`#${id}`);
            if (el) el.innerHTML = '<div class="guardian-panel-error">Failed to load</div>';
        });
    }

    /**
     * Close the modal
     */
    close() {
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
        }
        if (this.modal) {
            this.modal.classList.remove('active');
            setTimeout(() => {
                this.modal?.remove();
                this.modal = null;
            }, 200);
        }
    }

    /**
     * Inject styles
     */
    injectStyles() {
        if (document.getElementById('guardian-panel-styles')) return;

        const style = document.createElement('style');
        style.id = 'guardian-panel-styles';
        style.textContent = `
            .guardian-panel-overlay {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 10500;
                align-items: center;
                justify-content: center;
            }
            
            .guardian-panel-overlay.active {
                display: flex;
            }
            
            .guardian-panel-content {
                background: #f5f5f5;
                border: 3px solid #333;
                box-shadow: 0 0 0 1px #666, 0 4px 20px rgba(0,0,0,0.3);
                width: 90%;
                max-width: 500px;
                height: 480px;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            
            .guardian-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.75rem 1rem;
                background: #e0e0e0;
                border-bottom: 2px solid #333;
                flex-shrink: 0;
            }
            
            .guardian-panel-title {
                font-family: 'Courier New', monospace;
                font-weight: 400;
                font-size: 0.95rem;
                color: #333;
            }
            
            .guardian-panel-title strong {
                font-weight: 700;
            }
            
            .guardian-panel-close {
                background: none;
                border: none;
                font-family: 'Courier New', monospace;
                font-size: 1rem;
                font-weight: 700;
                color: #666;
                cursor: pointer;
                padding: 0.25rem 0.5rem;
            }
            
            .guardian-panel-close:hover {
                color: #333;
            }
            
            /* Add section for owner */
            .guardian-panel-add-section {
                padding: 0.75rem 1rem;
                background: #eaeaea;
                border-bottom: 1px solid #ccc;
                flex-shrink: 0;
            }
            
            .guardian-panel-add-row {
                display: flex;
                gap: 0.5rem;
                align-items: center;
            }
            
            .guardian-panel-input-wrapper {
                flex: 1;
                position: relative;
            }
            
            .guardian-panel-input {
                width: 100%;
                padding: 0.5rem 0.75rem;
                border: 2px solid #888;
                background: #fff;
                font-family: 'Courier New', monospace;
                font-size: 0.8rem;
                box-sizing: border-box;
            }
            
            .guardian-panel-input:focus {
                outline: none;
                border-color: #444;
            }
            
            /* Autocomplete dropdown */
            .guardian-panel-autocomplete {
                display: none;
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: #fff;
                border: 2px solid #444;
                border-top: none;
                max-height: 200px;
                overflow-y: auto;
                z-index: 10;
            }
            
            .guardian-panel-autocomplete-item {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 0.75rem;
                cursor: pointer;
                border-bottom: 1px solid #eee;
            }
            
            .guardian-panel-autocomplete-item:last-child {
                border-bottom: none;
            }
            
            .guardian-panel-autocomplete-item:hover,
            .guardian-panel-autocomplete-item.selected {
                background: #f0f0f0;
            }
            
            .guardian-panel-autocomplete-avatar {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                object-fit: cover;
            }
            
            .guardian-panel-autocomplete-info {
                display: flex;
                flex-direction: column;
                min-width: 0;
            }
            
            .guardian-panel-autocomplete-name {
                font-family: 'Courier New', monospace;
                font-size: 0.75rem;
                font-weight: 600;
                color: #333;
            }
            
            .guardian-panel-autocomplete-handle {
                font-family: 'Courier New', monospace;
                font-size: 0.65rem;
                color: #888;
            }
            
            .guardian-panel-select {
                padding: 0.5rem 0.6rem;
                border: 2px solid #888;
                background: #fff;
                font-family: 'Courier New', monospace;
                font-size: 0.7rem;
                color: #333;
                cursor: pointer;
            }
            
            .guardian-panel-select:focus {
                outline: none;
                border-color: #444;
            }
            
            .guardian-panel-toggle {
                display: flex;
                gap: 0;
            }
            
            .guardian-panel-toggle-btn {
                padding: 0.5rem 0.6rem;
                border: 2px solid #888;
                background: #ddd;
                font-family: 'Courier New', monospace;
                font-size: 0.65rem;
                font-weight: 700;
                color: #666;
                cursor: pointer;
            }
            
            .guardian-panel-toggle-btn:first-child {
                border-right: none;
            }
            
            .guardian-panel-toggle-btn.active {
                background: #444;
                color: #fff;
                border-color: #444;
            }
            
            .guardian-panel-add-btn {
                padding: 0.5rem 1rem;
                border: 2px solid #444;
                background: #444;
                color: #fff;
                font-family: 'Courier New', monospace;
                font-size: 0.75rem;
                font-weight: 700;
                cursor: pointer;
            }
            
            .guardian-panel-add-btn:hover {
                background: #555;
            }
            
            .guardian-panel-add-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .guardian-panel-input-error {
                font-size: 0.7rem;
                color: #a33;
                margin-top: 0.25rem;
                min-height: 1rem;
            }
            
            /* Tabs */
            .guardian-panel-tabs {
                display: flex;
                border-bottom: 2px solid #444;
                flex-shrink: 0;
            }
            
            .guardian-panel-tab {
                flex: 1;
                padding: 0.6rem 1rem;
                background: #ddd;
                border: none;
                font-family: 'Courier New', monospace;
                font-size: 0.8rem;
                font-weight: 700;
                color: #666;
                cursor: pointer;
            }
            
            .guardian-panel-tab.active {
                background: #f5f5f5;
                color: #333;
            }
            
            .guardian-panel-tab:not(:last-child) {
                border-right: 1px solid #ccc;
            }
            
            /* Lists container */
            .guardian-panel-lists {
                flex: 1;
                overflow-y: auto;
                min-height: 0;
            }
            
            .guardian-panel-tab-content {
                display: none;
                height: 100%;
            }
            
            .guardian-panel-tab-content.active {
                display: flex;
                flex-direction: column;
            }
            
            .guardian-panel-list-section {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-height: 0;
                border-bottom: 1px solid #ddd;
            }
            
            .guardian-panel-list-section:last-child {
                border-bottom: none;
            }
            
            .guardian-panel-list-header {
                padding: 0.5rem 1rem;
                background: #e8e8e8;
                font-family: 'Courier New', monospace;
                font-size: 0.75rem;
                font-weight: 700;
                color: #555;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                flex-shrink: 0;
            }
            
            .guardian-panel-list {
                flex: 1;
                overflow-y: auto;
                min-height: 80px;
                max-height: 160px;
                overflow-y: auto;
            }
            
            .guardian-panel-item {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 1rem;
                border-bottom: 1px solid #eee;
            }
            
            .guardian-panel-item:last-child {
                border-bottom: none;
            }
            
            .guardian-panel-avatar {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                object-fit: cover;
                flex-shrink: 0;
            }
            
            .guardian-panel-item-info {
                display: flex;
                flex-direction: column;
                flex: 1;
                min-width: 0;
                text-align: left;
            }
            
            .guardian-panel-item-name {
                font-family: 'Courier New', monospace;
                font-size: 0.75rem;
                font-weight: 600;
                color: #333;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .guardian-panel-item-handle {
                font-family: 'Courier New', monospace;
                font-size: 0.65rem;
                color: #888;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .guardian-panel-item-text {
                flex: 1;
                font-family: 'Courier New', monospace;
                font-size: 0.75rem;
                color: #333;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .guardian-panel-remove-btn {
                padding: 0.25rem 0.5rem;
                border: 1px solid #999;
                background: #f0f0f0;
                font-family: 'Courier New', monospace;
                font-size: 0.6rem;
                font-weight: 700;
                color: #666;
                cursor: pointer;
                flex-shrink: 0;
                margin-left: auto;
            }
            
            .guardian-panel-remove-btn:hover {
                background: #ddd;
                color: #333;
            }
            
            /* Content item styles (posts/dreams) */
            .guardian-panel-content-item {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                cursor: pointer;
                transition: background 0.15s;
            }
            
            .guardian-panel-content-item:hover {
                background: #f0f0f0;
            }
            
            .guardian-panel-content-avatar {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                object-fit: cover;
                flex-shrink: 0;
                align-self: flex-start;
                margin-top: 2px;
            }
            
            .guardian-panel-content-left {
                display: flex;
                flex-direction: column;
                min-width: 0;
                flex: 1;
            }
            
            .guardian-panel-content-right {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                flex-shrink: 0;
                margin-left: auto;
            }
            
            .guardian-panel-content-name {
                font-family: 'Courier New', monospace;
                font-size: 0.75rem;
                font-weight: 600;
                color: #333;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .guardian-panel-content-handle {
                font-family: 'Courier New', monospace;
                font-size: 0.65rem;
                color: #888;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .guardian-panel-content-timestamp {
                font-family: 'Courier New', monospace;
                font-size: 0.6rem;
                color: #999;
                white-space: nowrap;
            }
            
            .guardian-panel-content-rkey {
                font-family: 'Courier New', monospace;
                font-size: 0.65rem;
                color: #666;
                white-space: nowrap;
            }
            
            .guardian-panel-empty,
            .guardian-panel-loading,
            .guardian-panel-error {
                padding: 1rem;
                text-align: center;
                font-family: 'Courier New', monospace;
                font-size: 0.75rem;
                color: #888;
            }
            
            .guardian-panel-error {
                color: #a33;
            }
            
            /* Stewardship tab styles */
            .stewardship-header {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .stewardship-header-icon {
                width: 14px;
                height: 14px;
            }
            
            .stewardship-header.ward-header {
                color: #555;
            }
            
            .stewardship-header.ward-header .stewardship-header-icon {
                color: #555;
            }
            
            .stewardship-header.charge-header {
                color: #444;
            }
            
            .stewardship-header.charge-header .stewardship-header-icon {
                color: #444;
            }
            
            .stewardship-item {
                background: #fafafa;
            }
            
            .stewardship-item.ward-item {
                border-left: 3px solid #888;
            }
            
            .stewardship-item.charge-item {
                border-left: 3px solid #444;
            }
            
            .guardian-panel-handle {
                font-size: 0.65rem;
                color: #888;
                margin-left: 0.5rem;
            }
        `;

        document.head.appendChild(style);
    }
}

// Global instance
window.guardianPanel = new GuardianPanel();
