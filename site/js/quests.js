// quests.js - Quest management interface (unified from quests2.js)

(function() {
    'use strict';
    
    // ============================================================================
    // AUTHENTICATION & AUTHORIZATION
    // ============================================================================
    
    // Helper function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Generate rowstyle dropdown options dynamically from RowStyleRegistry
     * Groups styles by category with descriptions from the registry
     * @param {string} currentValue - Currently selected rowstyle value
     * @returns {string} HTML options for select element
     */
    function generateRowstyleOptions(currentValue = '') {
        if (!window.RowStyleRegistry) {
            console.warn('RowStyleRegistry not loaded, using fallback options');
            return `
                <option value="">Default (auto)</option>
                <option value="user">User</option>
                <option value="user-highlight">User Highlight</option>
                <option value="user-special">User Special</option>
                <option value="unfinished">Unfinished</option>
            `;
        }
        
        const registry = window.RowStyleRegistry;
        const categories = {
            basic: { label: 'Basic Styles', styles: [] },
            special: { label: 'Special Effects', styles: [] },
            souvenir: { label: 'Souvenir Styles', styles: [] },
            role: { label: 'Role Styles', styles: [] },
            octant: { label: 'Octant Styles', styles: [] }
        };
        
        // Group styles by category
        Object.entries(registry).forEach(([name, style]) => {
            if (!style.category || name === 'default') return;
            
            const cat = categories[style.category];
            if (cat) {
                cat.styles.push({
                    value: name,
                    label: style.name,
                    desc: style.description || name
                });
            }
        });
        
        // Build options HTML
        let html = `<option value="" ${currentValue === '' ? 'selected' : ''}>Default (auto)</option>`;
        
        // Add special "octant" option that maps to user's actual octant
        const octantDynamic = {
            value: 'octant',
            label: 'User Octant (Dynamic)',
            desc: "Matches user's current spectrum octant"
        };
        
        Object.entries(categories).forEach(([catKey, cat]) => {
            if (cat.styles.length === 0) return;
            
            html += `<optgroup label="${cat.label}">`;
            
            // For octants, add the dynamic option first
            if (catKey === 'octant') {
                html += `<option value="${octantDynamic.value}" ${currentValue === octantDynamic.value ? 'selected' : ''}>${octantDynamic.label} - ${octantDynamic.desc}</option>`;
            }
            
            cat.styles.forEach(style => {
                const selected = currentValue === style.value ? 'selected' : '';
                // Truncate description if too long
                const shortDesc = style.desc.length > 50 ? style.desc.substring(0, 47) + '...' : style.desc;
                html += `<option value="${style.value}" ${selected}>${style.label.charAt(0).toUpperCase() + style.label.slice(1)} - ${shortDesc}</option>`;
            });
            
            html += `</optgroup>`;
        });
        
        return html;
    }

    // Client-side dry-run simulator for quests (best-effort, mirrors server rules)
    function simulateDryRun(quest, sample) {
        const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? quest.conditions : [quest.conditions]) : [];
        const operator = (quest.condition_operator || 'AND').toUpperCase();
        const evalResults = [];

        function evalCondition(cond) {
            const c = (typeof cond === 'string') ? { condition: cond } : cond || {};
            const type = c.condition || 'any_reply';
            const val = c.value || c.args || null;

            let matched = false;
            let reason = '';

            const text = (sample.text || '').toLowerCase();
            if (type === 'any_reply' || type === 'new_reply') {
                matched = !!sample.text;
                reason = 'Text present';
            } else if (type === 'dreamer_replies') {
                matched = !!sample.handle && !!sample.registered;
                reason = matched ? 'Author is registered' : 'Author not registered or handle missing';
            } else if (type === 'contains_hashtags') {
                const needles = (val || '').toString().split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                matched = needles.some(n => n && text.includes(n.replace('#','')) || text.includes(n));
                reason = 'Hashtag match: ' + needles.join(', ');
            } else if (type === 'contains_mentions') {
                const needles = (val || '').toString().split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                matched = needles.some(n => n && text.includes(n.replace('@','')) || text.includes(n));
                reason = 'Mention match: ' + needles.join(', ');
            } else if (type === 'reply_contains') {
                const needle = (val || '').toString().toLowerCase();
                matched = needle ? text.includes(needle) : false;
                reason = `Contains '${needle}'`;
            } else if (type === 'hasnt_canon') {
                const key = (val || '').toString();
                const hasCanon = !!(sample.has_canon || sample.extra && sample.extra.has_canon);
                matched = !hasCanon;
                reason = hasCanon ? 'User has canon' : 'User has no canon';
            } else {
                // Unknown condition types default to false but record for debugging
                matched = false;
                reason = 'Unknown condition type';
            }

            return { type, matched, reason, raw: c };
        }

        // Evaluate each condition
        for (let i = 0; i < conditions.length; i++) {
            const r = evalCondition(conditions[i]);
            evalResults.push(r);
        }

        let overall = true;
        if (evalResults.length === 0) overall = false;
        else if (operator === 'AND') overall = evalResults.every(r => r.matched);
        else if (operator === 'OR') overall = evalResults.some(r => r.matched);

        // Determine commands that would run
        const commands = (quest.commands && Array.isArray(quest.commands)) ? quest.commands : (quest.commands ? [quest.commands] : []);
        const commandsToRun = overall ? commands.map(c => (typeof c === 'string' ? c : (c.cmd || c.type || c.command || JSON.stringify(c)))) : [];

        return {
            quest: quest.title,
            sample,
            condition_operator: operator,
            conditions_evaluated: evalResults,
            matched: overall,
            commands: commandsToRun
        };
    }
    
    // Check authentication on page load
    console.log('[QuestManager] Initializing quest manager...');
    const adminToken = localStorage.getItem('admin_token');
    console.log('[QuestManager] Admin token present:', !!adminToken);
    
    if (!adminToken) {
        // No token - redirect to login
        console.warn('[QuestManager] No admin token found, redirecting to login');
        window.location.href = '/admin/login.html';
        throw new Error('Not authenticated');
    }
    
    // Helper function to make authenticated API calls
    async function authenticatedFetch(url, options = {}) {
        console.log('[QuestManager] authenticatedFetch:', url, options.method || 'GET');
        const token = localStorage.getItem('admin_token');
        
        if (!token) {
            console.error('[QuestManager] No authentication token available');
            throw new Error('No authentication token');
        }
        
        // Add authorization header
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${token}`;
        
        const response = await fetch(url, options);
        console.log('[QuestManager] Response status:', response.status, url);
        
        // If unauthorized, redirect to login
        if (response.status === 401) {
            console.warn('[QuestManager] Unauthorized, clearing token and redirecting');
            localStorage.removeItem('admin_token');
            window.location.href = '/admin/login.html';
            throw new Error('Session expired');
        }
        
        return response;
    }
    
    // Verify token is still valid and get user info
    console.log('[QuestManager] Verifying admin token...');
    fetch('/api/admin/verify', {
        headers: {
            'Authorization': `Bearer ${adminToken}`
        }
    }).then(response => {
        console.log('[QuestManager] Verify response status:', response.status);
        if (!response.ok) {
            // Token invalid - redirect to login
            console.warn('[QuestManager] Token verification failed, redirecting to login');
            localStorage.removeItem('admin_token');
            window.location.href = '/admin/login.html';
        } else {
            return response.json();
        }
    }).then(data => {
        if (data) {
            console.log('[QuestManager] Admin verified:', data.handle);
            // Create admin session for drawer
            const adminSession = {
                did: data.did,
                handle: data.handle,
                displayName: data.handle,
                isAdmin: true
            };
            
            // Store session data
            sessionStorage.setItem('admin_session', JSON.stringify(adminSession));
            
            // Dispatch login event for drawer
            window.dispatchEvent(new CustomEvent('oauth:login', {
                detail: { session: adminSession }
            }));
            
            // Load quests after successful authentication
            console.log('[QuestManager] Loading quests...');
            loadQuests();
        }
    }).catch(error => {
        console.error('[QuestManager] Auth check failed:', error);
        // On network error, redirect to login
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login.html';
    });
    
    // ============================================================================
    // QUEST MANAGEMENT
    // ============================================================================
    
    let allQuests = [];
    let filteredQuests = [];
    let currentFilter = 'all';
    let selectedQuest = null;
    let questDataMap = {};
    
    // Expose questDataMap globally for compatibility
    window.questDataMap = questDataMap;
    
    async function loadQuests() {
        showLoading();
        
        try {
            const response = await authenticatedFetch('/api/quests/grouped');
            
            if (!response.ok) {
                throw new Error(`Failed to load quests: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.groups || data.groups.length === 0) {
                showError('No quests found.');
                return;
            }
            
            // Flatten quest groups into a single list
            allQuests = [];
            data.groups.forEach(group => {
                group.quests.forEach(quest => {
                    // Parse conditions if needed
                    if (quest.conditions && typeof quest.conditions === 'string') {
                        try {
                            quest.conditions = JSON.parse(quest.conditions);
                        } catch (e) {
                            console.error(`Failed to parse conditions for ${quest.title}:`, e);
                        }
                    }
                    
                    // Add group context
                    quest.group_uri = group.uri;
                    quest.bsky_url = group.bsky_url;
                    
                    allQuests.push(quest);
                });
            });
            
            // Sort quests: enabled first, then by creation date
            allQuests.sort((a, b) => {
                if (a.enabled !== b.enabled) {
                    return b.enabled ? 1 : -1;
                }
                return (b.created_at || 0) - (a.created_at || 0);
            });
            
            // Store in questDataMap for compatibility
            allQuests.forEach(quest => {
                questDataMap[quest.title] = quest;
            });
            
            applyFilter();
            hideLoading();
            
            // Restore previously selected quest from session
            const savedQuestTitle = sessionStorage.getItem('selected_quest_title');
            if (savedQuestTitle && questDataMap[savedQuestTitle]) {
                console.log('[QuestManager] Restoring previously selected quest:', savedQuestTitle);
                selectQuest(questDataMap[savedQuestTitle]);
            }
            
        } catch (err) {
            showError(`Error: ${err.message}`);
            console.error('Failed to load quests:', err);
        }
    };
    
    function showLoading() {
        const questList = document.getElementById('quest-list');
        questList.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div>Loading quests...</div></div>';
    }
    
    function hideLoading() {
        // Loading is replaced by quest list
    }
    
    function showError(message) {
        const questList = document.getElementById('quest-list');
        questList.innerHTML = `<div class="error">${message}</div>`;
    }
    
    function applyFilter() {
        const searchTerm = document.getElementById('quest-search').value.toLowerCase();
        
        // Filter by status
        filteredQuests = allQuests.filter(quest => {
            if (currentFilter === 'enabled') return quest.enabled;
            if (currentFilter === 'disabled') return !quest.enabled;
            return true;
        });
        
        // Filter by search term
        if (searchTerm) {
            filteredQuests = filteredQuests.filter(quest => {
                return quest.title.toLowerCase().includes(searchTerm) ||
                       (quest.description && quest.description.toLowerCase().includes(searchTerm)) ||
                       (quest.trigger_type && quest.trigger_type.toLowerCase().includes(searchTerm));
            });
        }
        
        renderQuestList();
    }
    
    function renderQuestList() {
        const questList = document.getElementById('quest-list');
        
        if (filteredQuests.length === 0) {
            questList.innerHTML = '<div class="empty-state" style="padding: 2rem; text-align: center; color: var(--text-secondary);"><div>No quests found</div></div>';
            return;
        }
        
        const triggerLabels = {
            'bibliohose': 'Reading List',
            'poll': 'Polling',
            'webhook': 'Webhook',
            'cron': 'Scheduled',
            'database_watch': 'DB Watch',
            'bsky_reply': 'Reply Monitor',
            'firehose_phrase': 'Phrase Monitor'
        };
        
        const html = filteredQuests.map(quest => {
            const label = triggerLabels[quest.trigger_type] || quest.trigger_type || 'bsky_reply';
            const statusClass = quest.enabled ? 'enabled' : 'disabled';
            const statusText = quest.enabled ? 'Active' : 'Disabled';
            const isActive = selectedQuest && selectedQuest.title === quest.title;
            
            // Condition types summary and command names (canonical-aware)
            let conditionCount = 0;
            let conditionTypes = [];
            let conditionPreviews = [];
            if (quest.conditions) {
                const condsArray = Array.isArray(quest.conditions) ? quest.conditions : [quest.conditions];
                conditionCount = condsArray.length;
                condsArray.forEach(c => {
                    // Preserve the raw stored representation for accurate display
                    const raw = (typeof c === 'string') ? c : JSON.stringify(c);
                    const t = (typeof c === 'string') ? (c || '') : ((c && c.condition) ? c.condition : '');
                    conditionTypes.push(t);
                    conditionPreviews.push(raw);
                });
            }

            const uniqueCond = Array.from(new Set(conditionTypes)).slice(0,3).join(', ');
            const condPreview = Array.from(new Set(conditionPreviews)).slice(0,3).join(' · ');

            let commandCount = 0;
            let commandNames = [];
            if (quest.commands && Array.isArray(quest.commands)) {
                commandCount = quest.commands.length;
                commandNames = quest.commands.map(cmd => (typeof cmd === 'object' ? (cmd.cmd || '') : String(cmd))).filter(Boolean);
            }

            const cmdPreview = Array.from(new Set(commandNames)).slice(0,3).join(', ');

            return `
                <div class="quest-list-item ${isActive ? 'active' : ''}" data-quest-title="${escapeHtml(quest.title)}">
                    <div class="quest-item-header">
                        <div class="quest-item-title">${escapeHtml(quest.title)}</div>
                        <div class="quest-status-badge ${statusClass}">${statusText}</div>
                    </div>
                    <div class="quest-item-meta">
                        <div class="quest-item-trigger">${label}</div>
                        <div class="quest-item-stats">${conditionCount} cond · ${commandCount} cmd</div>
                    </div>
                    ${condPreview ? `<div style="padding:6px 12px;color:var(--text-dim);font-size:0.8rem;">${escapeHtml(condPreview)}</div>` : ''}
                </div>
            `;
        }).join('');
        
        questList.innerHTML = html;
        
        // Add click handlers
        questList.querySelectorAll('.quest-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const title = item.dataset.questTitle;
                const quest = allQuests.find(q => q.title === title);
                if (quest) {
                    selectQuest(quest);
                }
            });
        });
    }
    
    function selectQuest(quest) {
        console.log('[QuestManager] Selecting quest:', quest.title);
        selectedQuest = quest;
        
        // Save selected quest to session storage
        sessionStorage.setItem('selected_quest_title', quest.title);
        
        renderQuestList(); // Re-render to update active state
        renderQuestDetail(quest);
    }
    
    function renderQuestDetail(quest) {
        console.log('[QuestManager] Rendering quest detail for:', quest.title);
        const container = document.getElementById('quest-detail-container');
        
        const triggerLabels = {
            'bibliohose': 'Reading Activity Monitor',
            'poll': 'API Polling Trigger',
            'webhook': 'HTTP Webhook',
            'cron': 'Time-Based Schedule',
            'database_watch': 'Database Monitor',
            'bsky_reply': 'Bluesky Reply Monitor',
            'firehose_phrase': 'Phrase/Hashtag Monitor'
        };
        
        const label = triggerLabels[quest.trigger_type] || quest.trigger_type || 'Unknown';
        const statusClass = quest.enabled ? 'enabled' : 'disabled';
        
        // Build trigger config display with editable fields
        let triggerConfigHtml = '';
        if (quest.trigger_type === 'bsky_reply') {
            const uri = quest.group_uri || quest.uri || '';
            triggerConfigHtml = `
                <div class="config-item-edit">
                    <label class="config-label">Post URI</label>
                    <input type="text" class="config-input" 
                           data-quest-title="${escapeHtml(quest.title)}" 
                           data-field="uri" 
                           value="${escapeHtml(uri)}" 
                           placeholder="at://did:plc:xxx/app.bsky.feed.post/xxx">
                    <button class="config-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-field="uri">Save URI</button>
                </div>
            `;
        } else if (quest.trigger_type === 'firehose_phrase') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            const phrases = config.phrases || [];
            const caseSensitive = config.case_sensitive || false;
            triggerConfigHtml = `
                <div class="config-item-edit">
                    <label class="config-label">Phrases/Hashtags (one per line)</label>
                    <textarea class="config-textarea" 
                              data-quest-title="${escapeHtml(quest.title)}" 
                              data-field="phrases" 
                              rows="4" 
                              placeholder="#somehashtag\nkeyword\nphrase to match">${escapeHtml(phrases.join('\n'))}</textarea>
                </div>
                <div class="config-item-edit">
                    <label class="config-label">
                        <input type="checkbox" class="config-checkbox" 
                               data-quest-title="${escapeHtml(quest.title)}" 
                               data-field="case_sensitive" 
                               ${caseSensitive ? 'checked' : ''}>
                        Case Sensitive
                    </label>
                </div>
                <button class="config-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-trigger-type="firehose_phrase">Save Configuration</button>
            `;
        } else if (quest.trigger_type === 'poll') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            triggerConfigHtml = `
                <div class="config-item-edit">
                    <label class="config-label">Poll URL</label>
                    <input type="url" class="config-input" 
                           data-quest-title="${escapeHtml(quest.title)}" 
                           data-field="url" 
                           value="${escapeHtml(config.url || '')}" 
                           placeholder="https://api.example.com/endpoint">
                </div>
                <div class="config-item-edit">
                    <label class="config-label">Interval (seconds)</label>
                    <input type="number" class="config-input" 
                           data-quest-title="${escapeHtml(quest.title)}" 
                           data-field="interval" 
                           value="${config.interval || 60}" 
                           min="1" step="1">
                </div>
                <button class="config-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-trigger-type="poll">Save Configuration</button>
            `;
        } else if (quest.trigger_type === 'webhook') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            triggerConfigHtml = `
                <div class="config-item-edit">
                    <label class="config-label">Webhook Path</label>
                    <input type="text" class="config-input" 
                           data-quest-title="${escapeHtml(quest.title)}" 
                           data-field="path" 
                           value="${escapeHtml(config.path || '')}" 
                           placeholder="/webhooks/my-quest">
                </div>
                <div class="config-item-edit">
                    <label class="config-label">Secret (optional)</label>
                    <input type="text" class="config-input" 
                           data-quest-title="${escapeHtml(quest.title)}" 
                           data-field="secret" 
                           value="${escapeHtml(config.secret || '')}" 
                           placeholder="webhook-secret-key">
                </div>
                <button class="config-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-trigger-type="webhook">Save Configuration</button>
            `;
        } else if (quest.trigger_type === 'cron') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            triggerConfigHtml = `
                <div class="config-item-edit">
                    <label class="config-label">Cron Expression</label>
                    <input type="text" class="config-input" 
                           data-quest-title="${escapeHtml(quest.title)}" 
                           data-field="expression" 
                           value="${escapeHtml(config.expression || '')}" 
                           placeholder="0 */6 * * *">
                    <small class="config-help">Format: minute hour day month weekday (e.g., "0 */6 * * *" = every 6 hours)</small>
                </div>
                <button class="config-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-trigger-type="cron">Save Configuration</button>
            `;
        } else if (quest.trigger_type === 'database_watch') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            triggerConfigHtml = `
                <div class="config-item-edit">
                    <label class="config-label">Table Name</label>
                    <input type="text" class="config-input" 
                           data-quest-title="${escapeHtml(quest.title)}" 
                           data-field="table" 
                           value="${escapeHtml(config.table || '')}" 
                           placeholder="table_name">
                </div>
                <div class="config-item-edit">
                    <label class="config-label">Operation</label>
                    <select class="config-select" 
                            data-quest-title="${escapeHtml(quest.title)}" 
                            data-field="operation">
                        <option value="INSERT" ${config.operation === 'INSERT' ? 'selected' : ''}>INSERT</option>
                        <option value="UPDATE" ${config.operation === 'UPDATE' ? 'selected' : ''}>UPDATE</option>
                        <option value="DELETE" ${config.operation === 'DELETE' ? 'selected' : ''}>DELETE</option>
                    </select>
                </div>
                <button class="config-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-trigger-type="database_watch">Save Configuration</button>
            `;
        } else if (quest.trigger_config) {
            // Fallback for unknown trigger types - show raw JSON
            try {
                const config = typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config;
                triggerConfigHtml = Object.entries(config).map(([key, value]) => `
                    <div class="config-item">
                        <label class="config-label">${escapeHtml(key)}</label>
                        <div class="config-value"><code>${escapeHtml(JSON.stringify(value))}</code></div>
                    </div>
                `).join('');
            } catch (e) {
                triggerConfigHtml = `<div class="config-item">
                    <div class="config-value">${escapeHtml(quest.trigger_config)}</div>
                </div>`;
            }
        }
        
        // Build conditions display with editable fields
        let conditionsHtml = '';
        const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? quest.conditions : [quest.conditions]) : [];
        
        if (conditions.length > 0) {
            conditionsHtml = conditions.map((cond, index) => {
                // Preserve raw representation and keep editable fields compatible
                const conditionRaw = (typeof cond === 'string') ? cond : JSON.stringify(cond, null, 2);
                const condObj = (typeof cond === 'string') ? {} : (cond || {});
                const conditionType = (typeof cond === 'string') ? (cond || 'any_reply') : (condObj.condition || 'any_reply');
                let conditionValue = '';
                if (Array.isArray(condObj.args) && condObj.args.length > 0) {
                    conditionValue = condObj.args.join(', ');
                } else if (condObj.value !== undefined && condObj.value !== null) {
                    conditionValue = String(condObj.value);
                }
                
                // Extract condition options
                const condOperator = condObj.operator || 'AND';
                const condOnceOnly = condObj.once_only || false;
                const condDisabled = condObj.disabled || false;
                
                // Condition type descriptions
                const conditionDescriptions = {
                    'any_reply': 'Triggers on any reply to the post',
                    'new_reply': 'Triggers on replies from unregistered users',
                    'dreamer_replies': 'Triggers when a registered dreamer replies',
                    'contains_hashtags': 'Triggers when reply contains specific hashtags',
                    'contains_mentions': 'Triggers when reply mentions specific users',
                    'reply_contains': 'Triggers when reply contains specific text',
                    'has_canon': 'Triggers if user has a specific canon key',
                    'hasnt_canon': 'Triggers if user has no canon entries for key',
                    'count_canon': 'Triggers based on count of canon entries (e.g., >=3)',
                    'user_canon_equals': 'Triggers if canon key equals specific value',
                    'user_canon_not_equals': 'Triggers if canon key does NOT equal value',
                    'user_in_canon_list': 'Triggers if canon key is in list of values',
                    'user_has_souvenir': 'Triggers if user has a specific souvenir',
                    'user_missing_souvenir': 'Triggers if user lacks a souvenir',
                    'souvenir_exists_anywhere': 'Triggers if souvenir exists for any user',
                    'has_read': 'Triggers if user has read a specific book (biblio)',
                    'has_biblio_stamp': 'Triggers if user has a biblio stamp'
                };
                
                return `
                    <div class="condition-card-edit ${condDisabled ? 'condition-disabled' : ''}">
                        <div class="condition-header">
                            <label class="condition-label">Condition Type</label>
                            <select class="condition-select" 
                                    data-quest-title="${escapeHtml(quest.title)}" 
                                    data-index="${index}">
                                <optgroup label="Reply Conditions">
                                    <option value="any_reply" ${conditionType === 'any_reply' ? 'selected' : ''}>Any Reply</option>
                                    <option value="new_reply" ${conditionType === 'new_reply' ? 'selected' : ''}>New Reply (unregistered)</option>
                                    <option value="dreamer_replies" ${conditionType === 'dreamer_replies' ? 'selected' : ''}>Registered Dreamer Replies</option>
                                </optgroup>
                                <optgroup label="Content Match">
                                    <option value="reply_contains" ${conditionType === 'reply_contains' ? 'selected' : ''}>Reply Contains Text</option>
                                    <option value="contains_hashtags" ${conditionType === 'contains_hashtags' ? 'selected' : ''}>Contains Hashtags</option>
                                    <option value="contains_mentions" ${conditionType === 'contains_mentions' ? 'selected' : ''}>Contains Mentions</option>
                                </optgroup>
                                <optgroup label="Canon Checks">
                                    <option value="has_canon" ${conditionType === 'has_canon' ? 'selected' : ''}>Has Canon Key</option>
                                    <option value="hasnt_canon" ${conditionType === 'hasnt_canon' ? 'selected' : ''}>Missing Canon Key</option>
                                    <option value="count_canon" ${conditionType === 'count_canon' ? 'selected' : ''}>Count Canon (>=N)</option>
                                    <option value="user_canon_equals" ${conditionType === 'user_canon_equals' ? 'selected' : ''}>Canon Equals Value</option>
                                    <option value="user_canon_not_equals" ${conditionType === 'user_canon_not_equals' ? 'selected' : ''}>Canon Not Equals</option>
                                    <option value="user_in_canon_list" ${conditionType === 'user_in_canon_list' ? 'selected' : ''}>Canon In List</option>
                                </optgroup>
                                <optgroup label="Souvenirs">
                                    <option value="user_has_souvenir" ${conditionType === 'user_has_souvenir' ? 'selected' : ''}>Has Souvenir</option>
                                    <option value="user_missing_souvenir" ${conditionType === 'user_missing_souvenir' ? 'selected' : ''}>Missing Souvenir</option>
                                    <option value="souvenir_exists_anywhere" ${conditionType === 'souvenir_exists_anywhere' ? 'selected' : ''}>Souvenir Exists Anywhere</option>
                                </optgroup>
                                <optgroup label="Biblio">
                                    <option value="has_read" ${conditionType === 'has_read' ? 'selected' : ''}>Has Read Book</option>
                                    <option value="has_biblio_stamp" ${conditionType === 'has_biblio_stamp' ? 'selected' : ''}>Has Biblio Stamp</option>
                                </optgroup>
                            </select>
                        </div>
                        <div class="condition-options-row">
                            <div class="condition-option">
                                <label class="condition-label">Logic</label>
                                <select class="condition-operator-select" 
                                        data-quest-title="${escapeHtml(quest.title)}" 
                                        data-index="${index}"
                                        onchange="updateConditionOption('${escapeHtml(quest.title)}', ${index}, 'operator', this.value)">
                                    <option value="AND" ${condOperator === 'AND' ? 'selected' : ''}>AND</option>
                                    <option value="OR" ${condOperator === 'OR' ? 'selected' : ''}>OR</option>
                                    <option value="NOT" ${condOperator === 'NOT' ? 'selected' : ''}>NOT</option>
                                </select>
                            </div>
                            <div class="condition-option">
                                <label class="condition-checkbox-label">
                                    <input type="checkbox" 
                                           class="condition-once-only" 
                                           ${condOnceOnly ? 'checked' : ''}
                                           onchange="updateConditionOption('${escapeHtml(quest.title)}', ${index}, 'once_only', this.checked)">
                                    Once Only
                                </label>
                            </div>
                            <div class="condition-option">
                                <label class="condition-checkbox-label">
                                    <input type="checkbox" 
                                           class="condition-disabled" 
                                           ${condDisabled ? 'checked' : ''}
                                           onchange="updateConditionOption('${escapeHtml(quest.title)}', ${index}, 'disabled', this.checked)">
                                    Disabled
                                </label>
                            </div>
                        </div>
                        <div class="condition-description">${conditionDescriptions[conditionType] || ''}</div>
                        <div class="condition-details">Value: <strong>${escapeHtml(String(conditionValue || '—'))}</strong></div>
                        ${['contains_hashtags', 'contains_mentions', 'reply_contains', 'has_canon', 'hasnt_canon', 'count_canon', 'user_canon_equals', 'user_canon_not_equals', 'user_in_canon_list', 'user_has_souvenir', 'user_missing_souvenir', 'souvenir_exists_anywhere', 'has_read', 'has_biblio_stamp'].includes(conditionType) ? `
                        <div class="condition-value-field">
                            <label class="condition-label">${['has_canon', 'hasnt_canon', 'count_canon', 'user_canon_equals', 'user_canon_not_equals', 'user_in_canon_list'].includes(conditionType) ? 'Canon Key/Value' : ['user_has_souvenir', 'user_missing_souvenir', 'souvenir_exists_anywhere'].includes(conditionType) ? 'Souvenir Key' : 'Value'}</label>
                            <input type="text" 
                                   class="condition-input" 
                                   data-quest-title="${escapeHtml(quest.title)}" 
                                   data-index="${index}"
                                   value="${escapeHtml(conditionValue)}" 
                                   placeholder="${
                                    conditionType === 'contains_hashtags' ? '#hashtag1, #hashtag2' : 
                                    conditionType === 'contains_mentions' ? '@username' : 
                                    conditionType === 'has_canon' || conditionType === 'hasnt_canon' ? 'canon_key (e.g., name, origin)' :
                                    conditionType === 'count_canon' ? 'key>=N (e.g., quest>=3)' :
                                    conditionType === 'user_canon_equals' ? 'key=value' :
                                    conditionType === 'user_canon_not_equals' ? 'key=value' :
                                    conditionType === 'user_in_canon_list' ? 'key=val1,val2,val3' :
                                    conditionType === 'user_has_souvenir' || conditionType === 'user_missing_souvenir' || conditionType === 'souvenir_exists_anywhere' ? 'souvenir_key' :
                                    conditionType === 'has_read' ? 'Book Title' :
                                    conditionType === 'has_biblio_stamp' ? 'list_rkey' :
                                    'text to match'
                                   }">
                            <button class="condition-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-index="${index}">Save Value</button>
                        </div>
                        ` : ''}
                        <div class="condition-actions">
                            <button class="condition-btn danger" onclick="deleteCondition('${escapeHtml(quest.title)}', ${index})">Delete</button>
                        </div>
                        <div class="raw-panel condition-raw">
                            <div class="raw-panel-label">Raw JSON</div>
                            <pre class="raw-panel-code">${escapeHtml(conditionRaw)}</pre>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        // Build commands display with editable fields
        let commandsHtml = '';
        if (quest.commands && quest.commands.length > 0) {
            commandsHtml = quest.commands.map((cmd, index) => {
                // Preserve raw command representation (string or object) for accurate display
                const commandRaw = (typeof cmd === 'string') ? cmd : JSON.stringify(cmd, null, 2);
                // Parse command for editable fields
                let commandType = '';
                let commandParams = '';
                if (typeof cmd === 'string') {
                    const parts = cmd.split(':');
                    commandType = parts[0];
                    commandParams = parts.slice(1).join(':');
                } else if (typeof cmd === 'object') {
                    // Canonical format uses cmd.cmd and cmd.args; legacy uses cmd.type and cmd.params
                    commandType = cmd.cmd || cmd.type || '';
                    // Prefer args array (canonical), fall back to params (legacy)
                    if (Array.isArray(cmd.args) && cmd.args.length > 0) {
                        commandParams = cmd.args.join(':');
                    } else if (cmd.params) {
                        commandParams = typeof cmd.params === 'string' ? cmd.params : JSON.stringify(cmd.params);
                    }
                }
                
                // Command type descriptions and parameter info
                const commandInfo = {
                    'name_dreamer': { 
                        desc: 'Names a dreamer in the system', 
                        hasParam: false 
                    },
                    'registration_check': { 
                        desc: 'Checks if user is registered', 
                        hasParam: false 
                    },
                    'register_if_needed': { 
                        desc: 'Registers user if not already registered (legacy)', 
                        hasParam: false 
                    },
                    'add_kindred': { 
                        desc: 'Adds another user as kindred', 
                        hasParam: true,
                        paramLabel: 'Kindred Handle',
                        paramPlaceholder: '@handle.bsky.social'
                    },
                    'like_post': { 
                        desc: 'Likes the triggering post', 
                        hasParam: false 
                    },
                    'add_canon': { 
                        desc: 'Adds an event entry for the user', 
                        hasParam: true,
                        paramLabel: 'Event Parameters',
                        paramPlaceholder: 'key:event:type',
                        hasCanonEditor: true,
                        canonTypes: ['event', 'trait', 'relationship', 'possession', 'memory', 'belief']
                    },
                    'add_name': { 
                        desc: 'Adds a name to the user', 
                        hasParam: true,
                        paramLabel: 'Name',
                        paramPlaceholder: 'Name to add'
                    },
                    'disable_quest': { 
                        desc: 'Disables this quest after execution', 
                        hasParam: false 
                    },
                    'mod_spectrum': { 
                        desc: 'Modifies user spectrum values', 
                        hasParam: true,
                        paramLabel: 'Spectrum Changes',
                        paramPlaceholder: 'octant:value (e.g., 0:10)'
                    },
                    'award_souvenir': { 
                        desc: 'Awards a souvenir to the user', 
                        hasParam: true,
                        paramLabel: 'Souvenir Key',
                        paramPlaceholder: 'Souvenir identifier',
                        hasPreview: true
                    },
                    'reply_origin_spectrum': { 
                        desc: 'Replies with origin spectrum information', 
                        hasParam: false 
                    },
                    'reply_post': { 
                        desc: 'Replies to the triggering post', 
                        hasParam: true,
                        paramLabel: 'Reply Text',
                        paramPlaceholder: 'Text to reply with',
                        hasVariableHints: true,
                        variables: [
                            { name: '{{name}}', source: 'name_dreamer, add_name, registration_check', desc: 'User\'s name' },
                            { name: '{{handle}}', source: 'trigger', desc: 'User\'s Bluesky handle' },
                            { name: '{{post_text}}', source: 'trigger', desc: 'Triggering post text' },
                            { name: '{{kindred_handle}}', source: 'add_kindred', desc: 'Added kindred handle' },
                            { name: '{{souvenir_name}}', source: 'award_souvenir', desc: 'Awarded souvenir name' },
                            { name: '{{origin_spectrum}}', source: 'calculate_origin', desc: 'User origin values' }
                        ]
                    },
                    'paired': { 
                        desc: 'Pairs users together', 
                        hasParam: false 
                    },
                    'check_collaboration_partners': { 
                        desc: 'Checks for collaboration partners', 
                        hasParam: false 
                    },
                    'calculate_origin': { 
                        desc: 'Calculates and stores user origin', 
                        hasParam: false 
                    },
                    'greet_newcomer': { 
                        desc: 'Sends greeting to new user', 
                        hasParam: false,
                        hasPreview: true
                    },
                    'declare_origin': { 
                        desc: 'Declares user origin publicly', 
                        hasParam: false,
                        hasPreview: true
                    }
                };
                
                const info = commandInfo[commandType] || { desc: 'Unknown command', hasParam: false };
                
                // Determine category for color coding
                let category = 'default';
                if (commandType === 'award_souvenir') {
                    category = 'souvenir';
                } else if (['like_post', 'reply_post', 'reply_origin_spectrum'].includes(commandType)) {
                    category = 'bluesky';
                } else if (commandType === 'add_canon') {
                    category = 'heading';
                } else if (['name_dreamer', 'register_if_needed', 'registration_check', 'paired', 'add_kindred'].includes(commandType)) {
                    category = 'registration';
                } else if (['add_name', 'calculate_origin', 'mod_spectrum'].includes(commandType)) {
                    category = 'lore';
                } else if (commandType === 'disable_quest') {
                    category = 'disable';
                } else if (['greet_newcomer', 'declare_origin', 'check_collaboration_partners'].includes(commandType)) {
                    category = 'work';
                }
                
                return `
                    <div class="command-card-edit category-${category}">
                        <div class="command-header">
                            <label class="command-label">Command Type</label>
                            <select class="command-select" 
                                    data-quest-title="${escapeHtml(quest.title)}" 
                                    data-index="${index}">
                                <option value="name_dreamer" ${commandType === 'name_dreamer' ? 'selected' : ''}>Name Dreamer</option>
                                <option value="registration_check" ${commandType === 'registration_check' ? 'selected' : ''}>Registration Check</option>
                                <option value="register_if_needed" ${commandType === 'register_if_needed' ? 'selected' : ''}>Register If Needed (legacy)</option>
                                <option value="add_kindred" ${commandType === 'add_kindred' ? 'selected' : ''}>Add Kindred</option>
                                <option value="like_post" ${commandType === 'like_post' ? 'selected' : ''}>Like Post</option>
                                <option value="add_canon" ${commandType === 'add_canon' ? 'selected' : ''}>Add Canon</option>
                                <option value="add_name" ${commandType === 'add_name' ? 'selected' : ''}>Add Name</option>
                                <option value="disable_quest" ${commandType === 'disable_quest' ? 'selected' : ''}>Disable Quest</option>
                                <option value="mod_spectrum" ${commandType === 'mod_spectrum' ? 'selected' : ''}>Modify Spectrum</option>
                                <option value="award_souvenir" ${commandType === 'award_souvenir' ? 'selected' : ''}>Award Souvenir</option>
                                <option value="reply_origin_spectrum" ${commandType === 'reply_origin_spectrum' ? 'selected' : ''}>Reply Origin Spectrum</option>
                                <option value="reply_post" ${commandType === 'reply_post' ? 'selected' : ''}>Reply to Post</option>
                                <option value="paired" ${commandType === 'paired' ? 'selected' : ''}>Paired</option>
                                <option value="check_collaboration_partners" ${commandType === 'check_collaboration_partners' ? 'selected' : ''}>Check Collaboration Partners</option>
                                <option value="calculate_origin" ${commandType === 'calculate_origin' ? 'selected' : ''}>Calculate Origin</option>
                                <option value="greet_newcomer" ${commandType === 'greet_newcomer' ? 'selected' : ''}>Greet Newcomer</option>
                                <option value="declare_origin" ${commandType === 'declare_origin' ? 'selected' : ''}>Declare Origin</option>
                            </select>
                        </div>
                        <div class="command-description">${info.desc}</div>
                        ${info.hasCanonEditor ? `
                        <div class="canon-editor">
                            <div class="canon-field">
                                <label class="canon-label">Type</label>
                                <select class="canon-type-select" data-quest-title="${escapeHtml(quest.title)}" data-index="${index}">
                                    ${info.canonTypes.map(type => {
                                        const parts = commandParams ? commandParams.split(':') : [];
                                        const currentType = parts[2] || 'event';
                                        const selected = currentType === type ? 'selected' : '';
                                        return `<option value="${type}" ${selected}>${type.charAt(0).toUpperCase() + type.slice(1)}</option>`;
                                    }).join('')}
                                </select>
                            </div>
                            <div class="canon-field">
                                <label class="canon-label">Key</label>
                                <input type="text" 
                                       class="canon-key-input" 
                                       data-quest-title="${escapeHtml(quest.title)}" 
                                       data-index="${index}"
                                       value="${(() => {
                                           if (!commandParams) return '';
                                           const parts = commandParams.split(':');
                                           return escapeHtml(parts[0] || '');
                                       })()}" 
                                       placeholder="e.g., watson, bell, invite">
                            </div>
                            <div class="canon-field">
                                <label class="canon-label">Event Description</label>
                                <input type="text" 
                                       class="canon-event-input" 
                                       data-quest-title="${escapeHtml(quest.title)}" 
                                       data-index="${index}"
                                       value="${(() => {
                                           if (!commandParams) return '';
                                           const parts = commandParams.split(':');
                                           return escapeHtml(parts[1] || '');
                                       })()}" 
                                       placeholder="e.g., answered the call, received a letter">
                            </div>
                            <div class="canon-field">
                                <label class="canon-label">Row Style (optional)</label>
                                <select class="canon-rowstyle-select" data-quest-title="${escapeHtml(quest.title)}" data-index="${index}">
                                    ${(() => {
                                        const parts = commandParams ? commandParams.split(':') : [];
                                        const currentRowstyle = parts[3] || '';
                                        return generateRowstyleOptions(currentRowstyle);
                                    })()}
                                </select>
                            </div>
                            <div class="canon-preview" data-index="${index}">
                                <div class="canon-preview-loading">Configure event to see preview...</div>
                            </div>
                            <button class="canon-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-index="${index}">Save Event Entry</button>
                        </div>
                        ` : info.hasParam ? `
                        <div class="command-param-field">
                            <label class="command-label">${info.paramLabel}</label>
                            <input type="text" 
                                   class="command-input" 
                                   data-quest-title="${escapeHtml(quest.title)}" 
                                   data-index="${index}"
                                   value="${escapeHtml(commandParams)}" 
                                   placeholder="${info.paramPlaceholder}">
                            <button class="command-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-index="${index}">Save Parameters</button>
                            ${info.hasVariableHints ? `
                            <div class="variable-hints">
                                <div class="hints-header">Available variables:</div>
                                <div class="hints-list">
                                    ${info.variables.map(v => `
                                        <div class="hint-item">
                                            <code class="hint-var">${v.name}</code>
                                            <span class="hint-desc">${v.desc}</span>
                                            <span class="hint-source">from: ${v.source}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        ` : ''}
                        ${commandType === 'award_souvenir' && commandParams ? `
                            <div class="souvenir-preview" data-souvenir-key="${escapeHtml(commandParams)}">
                                <div class="souvenir-loading">Loading souvenir preview...</div>
                            </div>
                        ` : ''}
                        ${commandType === 'greet_newcomer' ? `
                        <div class="worker-preview greeter-preview">
                            <div class="worker-loading">Loading greeter info...</div>
                        </div>
                        ` : ''}
                        ${commandType === 'declare_origin' ? `
                        <div class="worker-preview mapper-preview">
                            <div class="worker-loading">Loading mapper info...</div>
                        </div>
                        ` : ''}
                        <div class="command-actions">
                            <button class="command-btn danger" onclick="deleteCommand('${escapeHtml(quest.title)}', ${index})">Delete</button>
                        </div>
                        <div class="raw-panel command-raw">
                            <div class="raw-panel-label">Raw JSON</div>
                            <pre class="raw-panel-code">${escapeHtml(commandRaw)}</pre>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        const html = `
            <div class="quest-detail-header">
                <div class="quest-detail-title-section">
                    <h2 class="quest-detail-title editable" title="Click to edit title">${escapeHtml(quest.title)}</h2>
                    <p class="quest-detail-description editable" title="Click to edit description">${escapeHtml(quest.description || 'Click to add description')}</p>
                </div>
                <div class="quest-detail-actions">
                    <button class="quest-action-btn primary" onclick="toggleQuestStatusFromDetail('${escapeHtml(quest.title)}', ${!quest.enabled})">
                        ${quest.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button class="quest-action-btn danger" onclick="deleteQuestFromDetail('${escapeHtml(quest.title)}')">Delete</button>
                </div>
                <div class="quest-detail-meta">
                    <span>Created: ${quest.created_at ? new Date(quest.created_at * 1000).toLocaleDateString() : 'Unknown'}</span>
                    <span>Status: <strong style="color: var(--${statusClass}-color);">${quest.enabled ? 'Active' : 'Disabled'}</strong></span>
                </div>
            </div>
            
            <div class="quest-section">
                <h3 class="quest-section-title">Trigger Configuration</h3>
                <div class="trigger-config-form">
                    <div class="form-row">
                        <div class="form-group" style="flex: 2;">
                            <label>Trigger Type</label>
                            <select class="trigger-type-dropdown" data-quest-title="${escapeHtml(quest.title)}">
                                <option value="bsky_reply" ${quest.trigger_type === 'bsky_reply' ? 'selected' : ''}>Bluesky Reply Monitor</option>
                                <option value="firehose_phrase" ${quest.trigger_type === 'firehose_phrase' ? 'selected' : ''}>Phrase/Hashtag Monitor</option>
                                <option value="poll" ${quest.trigger_type === 'poll' ? 'selected' : ''}>API Polling</option>
                                <option value="webhook" ${quest.trigger_type === 'webhook' ? 'selected' : ''}>HTTP Webhook</option>
                                <option value="cron" ${quest.trigger_type === 'cron' ? 'selected' : ''}>Time-Based Schedule</option>
                                <option value="database_watch" ${quest.trigger_type === 'database_watch' ? 'selected' : ''}>Database Monitor</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex: 0;">
                            <label>&nbsp;</label>
                            <button class="trigger-reset-btn" onclick="deleteTrigger('${escapeHtml(quest.title)}')" title="Reset trigger configuration">Reset</button>
                        </div>
                    </div>
                    
                    <div class="trigger-config-details">
                        ${triggerConfigHtml || '<div class="no-config-message">Select a trigger type and configure its parameters above</div>'}
                    </div>
                    
                    ${quest.trigger_type === 'bsky_reply' && quest.group_uri ? `
                    <div class="bsky-post-preview" id="bsky-preview-${escapeHtml(quest.title.replace(/\s/g, '-'))}">
                        <div class="preview-loading">Loading post preview...</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="quest-section">
                <h3 class="quest-section-title">Conditions</h3>
                <div class="conditions-list">
                    ${conditionsHtml || '<div style="color: var(--text-secondary); padding: 1rem; text-align: center;">No conditions defined</div>'}
                    <button class="add-condition-btn" onclick="addCondition('${escapeHtml(quest.title)}')">+ Add Condition</button>
                </div>
            </div>
            
            <div class="quest-section">
                <h3 class="quest-section-title">Commands</h3>
                <div class="commands-list">
                    ${commandsHtml || '<div style="color: var(--text-secondary); padding: 1rem; text-align: center;">No commands defined</div>'}
                    <button class="add-command-btn" onclick="addCommand('${escapeHtml(quest.title)}')">+ Add Command</button>
                </div>
            </div>
            
            <div class="quest-section">
                <h3 class="quest-section-title">Dry Run (client-side)</h3>
                <div class="worker-preview" data-dryrun-for="${escapeHtml(quest.title)}">
                    <div class="form-group">
                        <label>Sample Author Handle</label>
                        <input class="form-input dryrun-handle" data-quest-title="${escapeHtml(quest.title)}" placeholder="@example.bsky.social" value="@example.bsky.social">
                    </div>
                    <div class="form-group">
                        <label>Sample Post Text</label>
                        <textarea class="form-input dryrun-text" data-quest-title="${escapeHtml(quest.title)}" rows="3" placeholder="Example reply text..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Additional JSON Payload (optional)</label>
                        <textarea class="form-input dryrun-json" data-quest-title="${escapeHtml(quest.title)}" rows="3" placeholder='{"registered":true,"has_canon":false}'></textarea>
                    </div>
                    <div style="display:flex;gap:0.5rem;align-items:center;"> 
                        <button class="command-btn run-dry-run" data-quest-title="${escapeHtml(quest.title)}">Run Dry Run</button>
                        <button class="quest-action-btn" onclick="loadQuests()">Refresh Quests</button>
                    </div>
                    <pre class="dryrun-result" data-quest-title="${escapeHtml(quest.title)}" style="white-space:pre-wrap;margin-top:1rem;background:#f8fafc;padding:1rem;border:1px solid #e6eefc;max-height:300px;overflow:auto;">Dry run result will appear here</pre>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Attach event listener to trigger type dropdown
        const triggerDropdown = container.querySelector('.trigger-type-dropdown');
        if (triggerDropdown) {
            triggerDropdown.addEventListener('change', async (e) => {
                const newTriggerType = e.target.value;
                console.log('[QuestManager] Trigger type changed to:', newTriggerType);
                await updateTriggerType(quest.title, newTriggerType);
            });
        }
        
        // Attach event listeners to all config inputs for auto-save
        const configInputs = container.querySelectorAll('.config-input, .config-textarea, .config-select, .config-checkbox');
        configInputs.forEach(input => {
            // Remove blur event listeners - we'll use save buttons instead
            // Just keep checkboxes with change for immediate feedback
            if (input.type === 'checkbox') {
                // Checkboxes still auto-save for better UX
                input.addEventListener('change', async (e) => {
                    const questTitle = e.target.dataset.questTitle;
                    const field = e.target.dataset.field;
                    console.log('[QuestManager] Config field changed:', field, 'for quest:', questTitle);
                    await saveTriggerConfigField(questTitle, field, e.target);
                });
            }
        });
        
        // Attach event listeners to save buttons
        const saveBtns = container.querySelectorAll('.config-save-btn');
        saveBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const questTitle = e.target.dataset.questTitle;
                const field = e.target.dataset.field;
                const triggerType = e.target.dataset.triggerType;
                
                console.log('[QuestManager] Save button clicked for quest:', questTitle);
                
                if (field) {
                    // Single field save (e.g., URI for bsky_reply)
                    const input = container.querySelector(`.config-input[data-field="${field}"]`);
                    if (input) {
                        await saveTriggerConfigField(questTitle, field, input);
                    }
                } else if (triggerType) {
                    // Multi-field save (e.g., firehose_phrase, poll, etc.)
                    await saveTriggerConfigFields(questTitle, triggerType, container);
                }
            });
        });
        
        // Attach event listeners to condition selects and inputs
        const conditionSelects = container.querySelectorAll('.condition-select');
        conditionSelects.forEach(select => {
            select.addEventListener('change', async (e) => {
                const questTitle = e.target.dataset.questTitle;
                const index = parseInt(e.target.dataset.index);
                console.log('[QuestManager] Condition type changed:', e.target.value, 'for quest:', questTitle, 'index:', index);
                await updateConditionType(questTitle, index, e.target.value);
            });
        });
        
        // Attach event listeners to condition save buttons (not auto-save on blur anymore)
        const conditionSaveBtns = container.querySelectorAll('.condition-save-btn');
        conditionSaveBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const questTitle = e.target.dataset.questTitle;
                const index = parseInt(e.target.dataset.index);
                const input = container.querySelector(`.condition-input[data-index="${index}"]`);
                if (input) {
                    console.log('[QuestManager] Condition save button clicked:', input.value, 'for quest:', questTitle, 'index:', index);
                    await updateConditionValue(questTitle, index, input.value);
                }
            });
        });
        
        // Attach event listeners to command selects and save buttons
        const commandSelects = container.querySelectorAll('.command-select');
        commandSelects.forEach(select => {
            select.addEventListener('change', async (e) => {
                const questTitle = e.target.dataset.questTitle;
                const index = parseInt(e.target.dataset.index);
                console.log('[QuestManager] Command type changed:', e.target.value, 'for quest:', questTitle, 'index:', index);
                await updateCommandType(questTitle, index, e.target.value);
            });
        });
        
        const commandSaveBtns = container.querySelectorAll('.command-save-btn');
        commandSaveBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const questTitle = e.target.dataset.questTitle;
                const index = parseInt(e.target.dataset.index);
                const input = container.querySelector(`.command-input[data-index="${index}"]`);
                if (input) {
                    console.log('[QuestManager] Command save button clicked:', input.value, 'for quest:', questTitle, 'index:', index);
                    await updateCommandParams(questTitle, index, input.value);
                }
            });
        });
        
        // Canon editor save buttons
        const canonSaveBtns = container.querySelectorAll('.canon-save-btn');
        canonSaveBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const questTitle = e.target.dataset.questTitle;
                const index = parseInt(e.target.dataset.index);
                
                const keyInput = container.querySelector(`.canon-key-input[data-index="${index}"]`);
                const eventInput = container.querySelector(`.canon-event-input[data-index="${index}"]`);
                const typeSelect = container.querySelector(`.canon-type-select[data-index="${index}"]`);
                const rowstyleSelect = container.querySelector(`.canon-rowstyle-select[data-index="${index}"]`);
                
                if (keyInput && eventInput && typeSelect) {
                    // Format as key:event:type[:rowstyle] (rowstyle is optional 4th param)
                    let canonParam = `${keyInput.value}:${eventInput.value}:${typeSelect.value}`;
                    if (rowstyleSelect && rowstyleSelect.value) {
                        canonParam += `:${rowstyleSelect.value}`;
                    }
                    console.log('[QuestManager] Canon save button clicked:', canonParam, 'for quest:', questTitle, 'index:', index);
                    await updateCommandParams(questTitle, index, canonParam);
                }
            });
        });
        
        // Canon editor input listeners for live preview
        const canonInputs = container.querySelectorAll('.canon-key-input, .canon-event-input, .canon-type-select, .canon-rowstyle-select');
        canonInputs.forEach(input => {
            input.addEventListener('input', () => {
                const index = input.dataset.index;
                updateCanonPreview(container, index);
            });
            input.addEventListener('change', () => {
                const index = input.dataset.index;
                updateCanonPreview(container, index);
            });
        });
        
        // Set rowstyle dropdown values from saved command params
        quest.commands.forEach((cmd, index) => {
            if (typeof cmd === 'string' && cmd.startsWith('add_canon:')) {
                const params = cmd.split(':').slice(1); // Remove 'add_canon'
                const rowstyle = params[3] || ''; // 4th param is rowstyle
                const rowstyleSelect = container.querySelector(`.canon-rowstyle-select[data-index="${index}"]`);
                if (rowstyleSelect && rowstyle) {
                    rowstyleSelect.value = rowstyle;
                }
            }
        });
        
        // Initial load of canon previews
        loadCanonPreviews(container);
        
        // Load Bluesky post preview if applicable
        if (quest.trigger_type === 'bsky_reply' && quest.group_uri) {
            loadBskyPostPreview(quest.title, quest.group_uri);
        }
        
        // Load souvenir previews if any award_souvenir commands exist
        if (commandsHtml && commandsHtml.includes('souvenir-preview')) {
            loadSouvenirPreviews();
        }
        
        // Load worker previews if any greeter/mapper commands exist
        if (commandsHtml && (commandsHtml.includes('greeter-preview') || commandsHtml.includes('mapper-preview'))) {
            loadWorkerPreviews();
        }
        
        // Attach click handlers to editable title and description
        const titleEl = container.querySelector('.quest-detail-title');
        const descEl = container.querySelector('.quest-detail-description');
        
        if (titleEl) {
            titleEl.addEventListener('click', () => {
                console.log('[QuestManager] Title clicked for editing');
                const newTitle = prompt('Quest Title:', quest.title);
                if (newTitle && newTitle !== quest.title) {
                    updateQuestMetadata(quest.title, newTitle, quest.description);
                }
            });
        }
        
        if (descEl) {
            descEl.addEventListener('click', () => {
                console.log('[QuestManager] Description clicked for editing');
                const currentDesc = quest.description || '';
                const newDesc = prompt('Quest Description:', currentDesc);
                if (newDesc !== null && newDesc !== currentDesc) {
                    updateQuestMetadata(quest.title, quest.title, newDesc);
                }
            });
        }

        // Attach dry-run handlers (client-side simulation)
        const runDryBtns = container.querySelectorAll('.run-dry-run');
        runDryBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const questTitle = e.target.dataset.questTitle;
                const parent = container.querySelector(`[data-dryrun-for="${escapeHtml(quest.title)}"]`);
                const handleInput = parent.querySelector('.dryrun-handle');
                const textInput = parent.querySelector('.dryrun-text');
                const jsonInput = parent.querySelector('.dryrun-json');
                const resultEl = parent.querySelector('.dryrun-result');

                resultEl.textContent = 'Running dry run (client-side)...';

                const sample = {
                    handle: handleInput ? handleInput.value : '',
                    text: textInput ? textInput.value : ''
                };

                if (jsonInput && jsonInput.value) {
                    try {
                        Object.assign(sample, JSON.parse(jsonInput.value));
                    } catch (err) {
                        resultEl.textContent = 'Invalid JSON payload: ' + err.message;
                        return;
                    }
                }

                try {
                    const sim = simulateDryRun(quest, sample);
                    resultEl.textContent = JSON.stringify(sim, null, 2);
                } catch (err) {
                    console.error('[QuestManager] Dry run simulation error:', err);
                    resultEl.textContent = 'Dry run error: ' + err.message;
                }
            });
        });
    }
    
    async function loadSouvenirPreviews() {
        try {
            const response = await authenticatedFetch('/api/souvenirs');
            if (!response.ok) {
                console.error('[QuestManager] Failed to load souvenirs, status:', response.status);
                return;
            }
            const souvenirs = await response.json();
            console.log('[QuestManager] Loaded souvenirs:', Object.keys(souvenirs).length);
            
            // Find all souvenir preview elements
            document.querySelectorAll('.souvenir-preview[data-souvenir-key]').forEach(element => {
                const key = element.getAttribute('data-souvenir-key');
                const souvenir = souvenirs[key];
                
                if (souvenir) {
                    const keepersCount = souvenir.keepers ? souvenir.keepers.length : 0;
                    const monthsOld = souvenir.epoch ? 
                        Math.floor((Date.now() / 1000 - souvenir.epoch) / (30 * 24 * 60 * 60)) : 0;
                    
                    const phanera = souvenir.phanera || `/souvenirs/${key}/phanera.png`;
                    const icon = souvenir.icon || `/souvenirs/${key}/icon.png`;
                    
                    element.innerHTML = `
                        <div class="souvenir-header">
                            <span class="souvenir-name">${escapeHtml(souvenir.name)}</span>
                            <span class="souvenir-key">(${escapeHtml(key)})</span>
                        </div>
                        <div class="souvenir-description">${escapeHtml(souvenir.description || '')}</div>
                        <a href="/souvenirs?key=${encodeURIComponent(key)}" target="_blank" style="text-decoration: none; color: inherit;">
                            <div class="souvenir-image-container">
                                <img class="souvenir-phanera" src="${phanera}" alt="${escapeHtml(souvenir.name)}" loading="lazy">
                                <div class="souvenir-icon-overlay">
                                    <img src="${icon}" alt="${escapeHtml(souvenir.name)} icon" loading="lazy">
                                </div>
                            </div>
                        </a>
                        <div class="souvenir-keepers">${keepersCount} keeper${keepersCount !== 1 ? 's' : ''} ${monthsOld > 0 ? `of ${monthsOld} month${monthsOld !== 1 ? 's' : ''}` : ''}</div>
                    `;
                } else {
                    element.innerHTML = `
                        <div class="souvenir-key">${escapeHtml(key)}</div>
                        <div style="color: #64748b; font-size: 0.85rem;">Souvenir not found</div>
                    `;
                }
            });
        } catch (err) {
            console.error('[QuestManager] Failed to load souvenir previews:', err);
            document.querySelectorAll('.souvenir-preview[data-souvenir-key]').forEach(element => {
                element.innerHTML = '<div style="color: #64748b; font-size: 0.85rem;">Failed to load souvenir preview</div>';
            });
        }
    }
    
    function updateCanonPreview(container, index) {
        const keyInput = container.querySelector(`.canon-key-input[data-index="${index}"]`);
        const eventInput = container.querySelector(`.canon-event-input[data-index="${index}"]`);
        const typeSelect = container.querySelector(`.canon-type-select[data-index="${index}"]`);
        const rowstyleSelect = container.querySelector(`.canon-rowstyle-select[data-index="${index}"]`);
        const previewDiv = container.querySelector(`.canon-preview[data-index="${index}"]`);
        
        if (!keyInput || !eventInput || !typeSelect || !previewDiv) return;
        
        const key = keyInput.value.trim();
        const event = eventInput.value.trim();
        const type = typeSelect.value;
        const rowstyle = rowstyleSelect ? rowstyleSelect.value : '';
        
        if (!key || !event) {
            previewDiv.innerHTML = '<div class="canon-preview-loading">Configure event to see preview...</div>';
            return;
        }
        
        // Get rowstyle definition from registry if available
        let rowClasses = ['row-entry'];
        let rowStyles = [];
        let rowstyleInfo = null;
        
        if (rowstyle && window.RowStyleRegistry && window.RowStyleRegistry[rowstyle]) {
            rowstyleInfo = window.RowStyleRegistry[rowstyle];
            rowClasses = [...rowstyleInfo.rendering.cssClasses];
            
            // Add CSS variables from rowstyle
            rowstyleInfo.rendering.cssVariables.forEach(varName => {
                const varValue = getComputedStyle(document.documentElement).getPropertyValue(varName);
                if (varValue) {
                    rowStyles.push(`${varName}: ${varValue}`);
                }
            });
        } else if (rowstyle) {
            // Fallback for basic styles if registry not available
            if (rowstyle === 'canon') {
                rowClasses.push('color-user', 'intensity-special', 'event-key-canon');
            } else if (rowstyle === 'userhigh') {
                rowClasses.push('color-user', 'intensity-highlight');
            } else if (rowstyle === 'user') {
                rowClasses.push('color-user', 'intensity-none');
            } else if (rowstyle === 'dream') {
                rowClasses.push('event-key-dream', 'color-user', 'intensity-special');
            }
        } else {
            // Default: user color with highlight
            rowClasses.push('color-user', 'intensity-highlight');
        }
        
        // Add event-key class
        if (key) rowClasses.push(`event-key-${key}`);
        
        // Get current user color from color manager if available
        const userColor = window.colorManager?.color || '#8b7355';
        rowStyles.push(`--user-color: ${userColor}`);
        
        // Build preview matching eventstack.js structure exactly
        const dateStr = '12/12/25 17:30';
        const avatar = '/assets/icon_face.png';
        const name = 'Example User';
        
        const rowStyleAttr = rowStyles.length > 0 ? ` style="${rowStyles.join('; ')}"` : '';
        
        let html = `<div class="canon-preview-label">Preview:</div>`;
        html += `<div class="${rowClasses.join(' ')}"${rowStyleAttr}>`;
        
        // Epoch cell
        html += `<div class="cell epoch">${dateStr}</div>`;
        
        // Thread arrow cell (empty spacer for alignment)
        html += `<div class="cell thread-arrow"></div>`;
        
        // Avatar cell
        const avatarStyle = ` style="margin-left: 12px;"`;
        html += `<div class="cell avatar"${avatarStyle}>`;
        html += `<img src="${avatar}" class="avatar-img" alt="avatar" onerror="this.src='/assets/icon_face.png'">`;
        html += `</div>`;
        
        // Canon cell
        const canonStyle = ` style="padding-left: 12px;"`;
        const nameSpan = `<span style="font-weight: 500;">${name}</span>`;
        const eventSpan = `<span style="font-style: italic; color: var(--text-secondary);">${escapeHtml(event)}</span>`;
        html += `<div class="cell canon"${canonStyle}><span style="white-space: normal;">${nameSpan} ${eventSpan}</span></div>`;
        
        html += `</div>`;
        
        // Add metadata below with rowstyle info
        html += `<div class="canon-preview-meta">`;
        html += `<span>Type: <strong>${type}</strong></span>`;
        html += `<span>Key: <strong>${key}</strong></span>`;
        if (rowstyle) {
            html += `<span>Style: <strong>${rowstyle}</strong></span>`;
            if (rowstyleInfo) {
                html += `<span class="rowstyle-category">${rowstyleInfo.category}</span>`;
            }
        }
        html += `</div>`;
        
        previewDiv.innerHTML = html;
    }
    
    function loadCanonPreviews(container) {
        const canonPreviews = container.querySelectorAll('.canon-preview[data-index]');
        canonPreviews.forEach(previewDiv => {
            const index = previewDiv.dataset.index;
            updateCanonPreview(container, index);
        });
    }
    
    async function loadWorkerPreviews() {
        // Load greeter info
        const greeterElements = document.querySelectorAll('.greeter-preview');
        if (greeterElements.length > 0) {
            try {
                const infoResponse = await authenticatedFetch('/api/work/greeter/info');
                const templatesResponse = await authenticatedFetch('/api/work/greeter/templates');
                
                if (infoResponse.ok && templatesResponse.ok) {
                    const info = await infoResponse.json();
                    const templates = await templatesResponse.json();
                    
                    greeterElements.forEach(element => {
                        const did = info.worker_did;
                        const handle = info.worker_handle || 'Unknown';
                        const status = info.status || 'unknown';
                        const exampleGreeting = templates.length > 0 ? templates[0] : 'Hello and welcome!';
                        
                        element.innerHTML = `
                            <div class="worker-header">
                                <span class="worker-title">Greeter Worker</span>
                                <span class="worker-status ${status === 'active' ? 'status-active' : 'status-inactive'}">${status}</span>
                            </div>
                            <div class="worker-info">
                                <div class="worker-field">
                                    <span class="worker-label">Handle:</span>
                                    <a href="https://bsky.app/profile/${did}" target="_blank" class="worker-handle">@${handle}</a>
                                </div>
                                <div class="worker-field">
                                    <span class="worker-label">Example Greeting:</span>
                                    <div class="worker-example">${escapeHtml(exampleGreeting)}</div>
                                </div>
                            </div>
                        `;
                    });
                } else {
                    greeterElements.forEach(el => {
                        el.innerHTML = '<div class="worker-error">Failed to load greeter info</div>';
                    });
                }
            } catch (err) {
                console.error('[QuestManager] Failed to load greeter info:', err);
                greeterElements.forEach(el => {
                    el.innerHTML = '<div class="worker-error">Error loading greeter info</div>';
                });
            }
        }
        
        // Load mapper info
        const mapperElements = document.querySelectorAll('.mapper-preview');
        if (mapperElements.length > 0) {
            try {
                const response = await authenticatedFetch('/api/work/mapper/info');
                
                if (response.ok) {
                    const info = await response.json();
                    
                    mapperElements.forEach(element => {
                        const did = info.worker_did;
                        const handle = info.worker_handle || 'Unknown';
                        const status = info.status || 'unknown';
                        const exampleCoords = '(3, -2, 5, 1, -4, 0, 2, -1)';
                        
                        element.innerHTML = `
                            <div class="worker-header">
                                <span class="worker-title">Mapper Worker</span>
                                <span class="worker-status ${status === 'active' ? 'status-active' : 'status-inactive'}">${status}</span>
                            </div>
                            <div class="worker-info">
                                <div class="worker-field">
                                    <span class="worker-label">Handle:</span>
                                    <a href="https://bsky.app/profile/${did}" target="_blank" class="worker-handle">@${handle}</a>
                                </div>
                                <div class="worker-field">
                                    <span class="worker-label">Example Coordinates:</span>
                                    <div class="worker-example">${exampleCoords}</div>
                                </div>
                            </div>
                        `;
                    });
                } else {
                    mapperElements.forEach(el => {
                        el.innerHTML = '<div class="worker-error">Failed to load mapper info</div>';
                    });
                }
            } catch (err) {
                console.error('[QuestManager] Failed to load mapper info:', err);
                mapperElements.forEach(el => {
                    el.innerHTML = '<div class="worker-error">Error loading mapper info</div>';
                });
            }
        }
    }
    
    // Global functions for quest management
    window.toggleQuestStatusFromDetail = async function(questTitle, enable) {
        await toggleQuestStatus(questTitle, enable);
        // Reload and reselect
        await loadQuests();
        const quest = allQuests.find(q => q.title === questTitle);
        if (quest) selectQuest(quest);
    };
    
    async function toggleQuestStatus(questTitle, enable) {
        const action = enable ? 'enable' : 'disable';
        console.log(`[QuestManager] Toggling quest ${questTitle} to ${action}`);
        
        try {
            const quest = questDataMap[questTitle];
            if (!quest) {
                alert('Quest not found');
                return;
            }
            
            const payload = {
                enabled: enable,
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                commands: quest.commands,
                description: quest.description
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log(`[QuestManager] Quest ${action}d successfully`);
                // Update in dataMap
                if (questDataMap[questTitle]) {
                    questDataMap[questTitle].enabled = enable;
                }
                
                // Update in allQuests
                const quest = allQuests.find(q => q.title === questTitle);
                if (quest) {
                    quest.enabled = enable;
                }
            } else {
                const result = await response.json();
                console.error(`[QuestManager] Failed to ${action} quest:`, result);
                alert(`Failed to ${action} quest: ` + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error(`[QuestManager] Error ${action}ing quest:`, err);
            alert(`Error ${action}ing quest: ` + err.message);
        }
    }
    
    window.deleteQuestFromDetail = async function(questTitle) {
        await deleteQuest(questTitle);
        // Reload quests
        await loadQuests();
        // Clear detail view
        document.getElementById('quest-detail-container').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-text">Select a quest to view details</div>
            </div>
        `;
        selectedQuest = null;
    };
    
    async function deleteQuest(questTitle) {
        if (!confirm(`Delete quest "${questTitle}"?\n\nThis cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await authenticatedFetch(`/api/quests/delete/${encodeURIComponent(questTitle)}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Remove from arrays
                allQuests = allQuests.filter(q => q.title !== questTitle);
                delete questDataMap[questTitle];
            } else {
                const result = await response.json();
                alert('Failed to delete quest: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            alert('Error deleting quest: ' + err.message);
        }
    }
    
    async function deleteCondition(questTitle, index) {
        console.log('[QuestManager] deleteCondition called for:', questTitle, 'index:', index);
        if (!confirm(`Delete this condition from "${questTitle}"?`)) {
            console.log('[QuestManager] Delete condition cancelled by user');
            return;
        }
        
        try {
            const quest = window.questDataMap[questTitle];
            if (!quest) {
                alert('Quest not found');
                return;
            }
            
            // Support both array and single condition
            if (quest.conditions && Array.isArray(quest.conditions)) {
                quest.conditions.splice(index, 1);
                
                // Update primary condition for backward compatibility
                if (quest.conditions.length === 0) {
                    quest.conditions = null;
                    quest.condition = '';
                } else {
                    const firstCond = quest.conditions[0];
                    quest.condition = typeof firstCond === 'string' ? firstCond : firstCond.condition;
                }
            } else {
                quest.condition = '';
            }
            
            const payload = {
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Condition deleted successfully');
                // Reload and reselect
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to delete condition:', result);
                alert('Failed to delete condition: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error deleting condition:', err);
            alert('Error deleting condition: ' + err.message);
        }
    }

    window.deleteCondition = deleteCondition;

    window.editQuestMetadata = function(questTitle) {
        const quest = questDataMap[questTitle];
        if (!quest) {
            alert('Quest not found');
            return;
        }
        
        const newTitle = prompt('Quest Title:', quest.title);
        if (!newTitle || newTitle === quest.title) return;
        
        const newDescription = prompt('Description:', quest.description || '');
        
        updateQuestMetadata(questTitle, newTitle, newDescription);
    };
    
    async function updateQuestMetadata(oldTitle, newTitle, newDescription) {
        console.log('[QuestManager] Updating quest metadata:', oldTitle, '->', newTitle);
        try {
            const quest = questDataMap[oldTitle];
            if (!quest) {
                console.error('[QuestManager] Quest not found:', oldTitle);
                alert('Quest not found');
                return;
            }
            
            const payload = {
                new_title: newTitle,
                description: newDescription,
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                commands: quest.commands,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending metadata update payload:', payload);
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(oldTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('[QuestManager] Metadata update response:', result);
                
                // Update session storage with new title before reload
                sessionStorage.setItem('selected_quest_title', newTitle);
                
                // The API might return the updated quest data
                if (result.quest) {
                    console.log('[QuestManager] Using quest data from API response:', result.quest.title);
                    // Update local data structures immediately
                    delete questDataMap[oldTitle];
                    questDataMap[newTitle] = result.quest;
                    
                    // Update allQuests array
                    const questIndex = allQuests.findIndex(q => q.title === oldTitle);
                    if (questIndex !== -1) {
                        allQuests[questIndex] = result.quest;
                    }
                    
                    selectQuest(result.quest);
                } else {
                    console.log('[QuestManager] No quest in response, reloading all quests');
                    
                    // Add a small delay to allow backend to commit the change
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    await loadQuests();
                    console.log('[QuestManager] After loadQuests, allQuests titles:', allQuests.map(q => q.title));
                    
                    // Try new title first
                    let updatedQuest = allQuests.find(q => q.title === newTitle);
                    console.log('[QuestManager] Searching for newTitle:', newTitle);
                    
                    // If not found by new title, try old title (backend might not have updated yet)
                    if (!updatedQuest) {
                        console.warn('[QuestManager] New title not found, trying old title:', oldTitle);
                        updatedQuest = allQuests.find(q => q.title === oldTitle);
                    }
                    
                    if (updatedQuest) {
                        console.log('[QuestManager] Found quest:', updatedQuest.title);
                        
                        // If we found it by old title, manually update the local data
                        if (updatedQuest.title === oldTitle && newTitle !== oldTitle) {
                            console.log('[QuestManager] Manually updating quest title in local data');
                            updatedQuest.title = newTitle;
                            delete questDataMap[oldTitle];
                            questDataMap[newTitle] = updatedQuest;
                            
                            // Update in allQuests array
                            const questIndex = allQuests.findIndex(q => q.title === oldTitle);
                            if (questIndex !== -1) {
                                allQuests[questIndex].title = newTitle;
                            }
                        }
                        
                        selectQuest(updatedQuest);
                    } else {
                        console.error('[QuestManager] Quest not found with either title');
                        alert('Warning: Quest was updated but could not be found. Please refresh the page.');
                    }
                }
            } else {
                const result = await response.json();
                console.error('[QuestManager] Metadata update failed:', result);
                alert('Failed to update quest: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating metadata:', err);
            alert('Error updating quest: ' + err.message);
        }
    }
    
    window.editTriggerConfig = function(questTitle) {
        console.log('[QuestManager] editTriggerConfig called for:', questTitle);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found in questDataMap:', questTitle);
            alert('Quest not found');
            return;
        }
        
        console.log('[QuestManager] Opening trigger config modal for:', questTitle);
        showTriggerConfigModal(quest);
    };
    
    async function updateTriggerType(questTitle, newTriggerType) {
        console.log('[QuestManager] Updating trigger type for:', questTitle, 'to:', newTriggerType);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            alert('Quest not found');
            return;
        }
        
        try {
            const payload = {
                trigger_type: newTriggerType,
                trigger_config: null, // Reset config when changing type
                uri: quest.uri || '',
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending trigger type update:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Trigger type updated successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update trigger type:', result);
                alert('Failed to update trigger type: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating trigger type:', err);
            alert('Error updating trigger type: ' + err.message);
        }
    }
    
    async function saveTriggerConfigField(questTitle, field, inputElement) {
        console.log('[QuestManager] Saving trigger config field:', field, 'for quest:', questTitle);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            return;
        }
        
        try {
            // Get current config or initialize empty object
            let config = {};
            if (quest.trigger_config) {
                config = typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config;
            }
            
            // Update the specific field based on trigger type
            if (quest.trigger_type === 'bsky_reply' && field === 'uri') {
                // For bsky_reply, URI is stored separately
                const payload = {
                    uri: inputElement.value,
                    trigger_type: quest.trigger_type,
                    trigger_config: quest.trigger_config,
                    condition: quest.condition || '',
                    conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                    condition_operator: quest.condition_operator || 'AND',
                    commands: quest.commands,
                    description: quest.description,
                    enabled: quest.enabled
                };
                
                const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    console.log('[QuestManager] URI updated successfully');
                    await loadQuests();
                    const updatedQuest = allQuests.find(q => q.title === questTitle);
                    if (updatedQuest) selectQuest(updatedQuest);
                } else {
                    const result = await response.json();
                    console.error('[QuestManager] Failed to update URI:', result);
                    alert('Failed to update URI: ' + (result.error || 'Unknown error'));
                }
            } else {
                // For other trigger types, update the config object
                if (field === 'phrases') {
                    // Special handling for phrases - split by newline
                    const phrases = inputElement.value.split('\n').map(p => p.trim()).filter(p => p);
                    config.phrases = phrases;
                } else if (inputElement.type === 'checkbox') {
                    config[field] = inputElement.checked;
                } else if (inputElement.type === 'number') {
                    config[field] = parseInt(inputElement.value);
                } else {
                    config[field] = inputElement.value;
                }
                
                const payload = {
                    trigger_type: quest.trigger_type,
                    trigger_config: JSON.stringify(config),
                    uri: quest.uri || '',
                    condition: quest.condition || '',
                    conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                    condition_operator: quest.condition_operator || 'AND',
                    commands: quest.commands,
                    description: quest.description,
                    enabled: quest.enabled
                };
                
                console.log('[QuestManager] Sending config update:', payload);
                const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    console.log('[QuestManager] Config field updated successfully');
                    // Reload and reselect to show changes
                    await loadQuests();
                    const updatedQuest = allQuests.find(q => q.title === questTitle);
                    if (updatedQuest) selectQuest(updatedQuest);
                } else {
                    const result = await response.json();
                    console.error('[QuestManager] Failed to update config field:', result);
                    alert('Failed to update configuration: ' + (result.error || 'Unknown error'));
                }
            }
        } catch (err) {
            console.error('[QuestManager] Error saving config field:', err);
            alert('Error saving configuration: ' + err.message);
        }
    }

    async function saveTriggerConfigFields(questTitle, triggerType, container) {
        console.log('[QuestManager] Saving all trigger config fields for:', questTitle, 'type:', triggerType);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            return;
        }
        
        try {
            let config = {};
            
            if (triggerType === 'firehose_phrase') {
                const phrasesInput = container.querySelector('.config-textarea[data-field="phrases"]');
                const caseSensitiveCheckbox = container.querySelector('.config-checkbox[data-field="case_sensitive"]');
                
                const phrases = phrasesInput.value.split('\n').map(p => p.trim()).filter(p => p);
                config = {
                    phrases: phrases,
                    case_sensitive: caseSensitiveCheckbox.checked
                };
            } else if (triggerType === 'poll') {
                const urlInput = container.querySelector('.config-input[data-field="url"]');
                const intervalInput = container.querySelector('.config-input[data-field="interval"]');
                
                config = {
                    url: urlInput.value,
                    interval: parseInt(intervalInput.value)
                };
            } else if (triggerType === 'webhook') {
                const pathInput = container.querySelector('.config-input[data-field="path"]');
                const secretInput = container.querySelector('.config-input[data-field="secret"]');
                
                config = {
                    path: pathInput.value,
                    secret: secretInput.value
                };
            } else if (triggerType === 'cron') {
                const expressionInput = container.querySelector('.config-input[data-field="expression"]');
                
                config = {
                    expression: expressionInput.value
                };
            } else if (triggerType === 'database_watch') {
                const tableInput = container.querySelector('.config-input[data-field="table"]');
                const operationSelect = container.querySelector('.config-select[data-field="operation"]');
                
                config = {
                    table: tableInput.value,
                    operation: operationSelect.value
                };
            }
            
            const payload = {
                trigger_type: quest.trigger_type,
                trigger_config: JSON.stringify(config),
                uri: quest.uri || '',
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending multi-field config update:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Trigger configuration updated successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update trigger configuration:', result);
                alert('Failed to update configuration: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error saving trigger configuration:', err);
            alert('Error saving configuration: ' + err.message);
        }
    }
    
    window.addTrigger = function(questTitle) {
        console.log('[QuestManager] addTrigger called - Note: Quest only supports one trigger');
        alert('Each quest can only have one trigger. Use the dropdown to change the trigger type, or use the trigger configuration in the modal to set parameters.');
    };
    
    window.deleteTrigger = async function(questTitle) {
        console.log('[QuestManager] deleteTrigger called for:', questTitle);
        if (!confirm('Reset trigger configuration?\n\nThis will clear the trigger type and configuration.')) {
            return;
        }
        
        const quest = questDataMap[questTitle];
        if (!quest) {
            alert('Quest not found');
            return;
        }
        
        try {
            const payload = {
                trigger_type: 'bsky_reply',
                trigger_config: null,
                uri: '',
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                alert('Failed to reset trigger: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            alert('Error resetting trigger: ' + err.message);
        }
    };
    
    async function updateConditionType(questTitle, index, newType) {
        console.log('[QuestManager] Updating condition type at index', index, 'to:', newType);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            return;
        }
        
        try {
            const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? [...quest.conditions] : [quest.conditions]) : [];
            
            if (index >= conditions.length) {
                console.error('[QuestManager] Invalid condition index:', index);
                return;
            }
            
            // Preserve existing args/value where possible
            const existing = conditions[index] || {};
            const existingArgs = Array.isArray(existing.args) ? existing.args.slice() : (existing.value !== undefined && existing.value !== null ? [existing.value] : []);

            // Build canonical condition object
            const newCond = {
                condition: newType,
                args: existingArgs,
                operator: existing.operator || 'AND',
                once_only: existing.once_only || false,
                disabled: existing.disabled || false
            };

            // For types that shouldn't carry args, clear them
            if (!['contains_hashtags', 'contains_mentions', 'reply_contains', 'hasnt_canon'].includes(newType)) {
                newCond.args = [];
            }

            conditions[index] = newCond;
            
            const payload = {
                conditions: JSON.stringify(conditions),
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Condition type updated successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update condition type:', result);
                alert('Failed to update condition: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating condition type:', err);
            alert('Error updating condition: ' + err.message);
        }
    }
    
    async function updateConditionValue(questTitle, index, newValue) {
        console.log('[QuestManager] Updating condition value at index', index, 'to:', newValue);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            return;
        }
        
        try {
            const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? [...quest.conditions] : [quest.conditions]) : [];
            
            if (index >= conditions.length) {
                console.error('[QuestManager] Invalid condition index:', index);
                return;
            }
            
            // Update the condition value in canonical `args` form
            const cond = conditions[index] || {};
            if (!cond || typeof cond !== 'object') {
                // If legacy string, convert to object
                conditions[index] = { condition: String(cond || 'any_reply'), args: [] };
            }

            // Decide how to store the new value: split by comma for hashtag lists
            const storing = (newValue || '').toString();
            if (storing.includes(',')) {
                // multiple values
                conditions[index].args = storing.split(',').map(s => s.trim()).filter(Boolean);
            } else if (storing === '') {
                conditions[index].args = [];
            } else {
                conditions[index].args = [storing];
            }
            // Remove legacy `value` key if present
            delete conditions[index].value;
            
            const payload = {
                conditions: JSON.stringify(conditions),
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Condition value updated successfully');
                // Reload and reselect to show changes
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update condition value:', result);
                alert('Failed to update condition: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating condition value:', err);
            alert('Error updating condition: ' + err.message);
        }
    }
    
    async function loadBskyPostPreview(questTitle, uri) {
        console.log('[QuestManager] Loading Bluesky post preview for URI:', uri);
        const previewId = `bsky-preview-${questTitle.replace(/\s/g, '-')}`;
        const previewEl = document.getElementById(previewId);
        
        if (!previewEl) {
            console.warn('[QuestManager] Preview element not found:', previewId);
            return;
        }
        
        try {
            // Extract DID and post ID from AT URI
            // Format: at://did:plc:xxx/app.bsky.feed.post/yyy
            const match = uri.match(/at:\/\/(did:plc:[^\/]+)\/app\.bsky\.feed.post\/([^\/]+)/);
            if (!match) {
                previewEl.innerHTML = '<div class="preview-error">Invalid AT URI format</div>';
                return;
            }
            
            const [, did, postId] = match;
            
            // Fetch post data from Bluesky API
            const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch post');
            }
            
            const data = await response.json();
            const post = data.thread?.post;
            
            if (!post) {
                previewEl.innerHTML = '<div class="preview-error">Post not found</div>';
                return;
            }
            
            // Build preview HTML
            const author = post.author;
            const record = post.record;
            const createdAt = new Date(record.createdAt);
            
            previewEl.innerHTML = `
                <div class="bsky-post-content">
                    <div class="bsky-post-header">
                        <img src="${author.avatar || '/assets/default-avatar.png'}" alt="${author.displayName}" class="bsky-avatar">
                        <div class="bsky-author-info">
                            <div class="bsky-display-name">${escapeHtml(author.displayName || author.handle)}</div>
                            <div class="bsky-handle">@${escapeHtml(author.handle)}</div>
                        </div>
                        <div class="bsky-timestamp">${createdAt.toLocaleDateString()}</div>
                    </div>
                    <div class="bsky-post-text">${escapeHtml(record.text)}</div>
                    <div class="bsky-post-link">
                        <a href="https://bsky.app/profile/${author.did || did}/post/${postId}" target="_blank">View on Bluesky →</a>
                    </div>
                </div>
            `;
        } catch (err) {
            console.error('[QuestManager] Error loading post preview:', err);
            previewEl.innerHTML = `<div class="preview-error">Failed to load post preview: ${err.message}</div>`;
        }
    }
    
    function showTriggerConfigModal(quest) {
        console.log('[QuestManager] Creating trigger config modal for:', quest.title);
        console.log('[QuestManager] Quest trigger_type:', quest.trigger_type);
        console.log('[QuestManager] Quest trigger_config:', quest.trigger_config);
        
        // Create modal HTML
        const modalHtml = `
            <div id="trigger-modal" class="modal-overlay" onclick="if(event.target === this) closeTriggerModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Configure Trigger</h2>
                        <button class="modal-close" onclick="closeTriggerModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Trigger Type</label>
                            <select id="trigger-type-select" onchange="updateTriggerFields()">
                                <option value="bsky_reply" ${quest.trigger_type === 'bsky_reply' ? 'selected' : ''}>Bluesky Reply Monitor</option>
                                <option value="firehose_phrase" ${quest.trigger_type === 'firehose_phrase' ? 'selected' : ''}>Phrase/Hashtag Monitor</option>
                                <option value="poll" ${quest.trigger_type === 'poll' ? 'selected' : ''}>API Polling</option>
                                <option value="webhook" ${quest.trigger_type === 'webhook' ? 'selected' : ''}>HTTP Webhook</option>
                                <option value="cron" ${quest.trigger_type === 'cron' ? 'selected' : ''}>Time-Based Schedule</option>
                                <option value="database_watch" ${quest.trigger_type === 'database_watch' ? 'selected' : ''}>Database Monitor</option>
                            </select>
                        </div>
                        
                        <div id="trigger-fields-container">
                            ${getTriggerFieldsHtml(quest)}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn modal-btn-secondary" onclick="closeTriggerModal()">Cancel</button>
                        <button class="modal-btn modal-btn-primary" onclick="saveTriggerConfig('${escapeHtml(quest.title)}')">Save Configuration</button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('trigger-modal');
        if (existingModal) {
            console.log('[QuestManager] Removing existing modal');
            existingModal.remove();
        }
        
        // Add modal to body
        console.log('[QuestManager] Adding modal to DOM');
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        console.log('[QuestManager] Modal displayed successfully');
    }
    
    function getTriggerFieldsHtml(quest) {
        const triggerType = quest.trigger_type || 'bsky_reply';
        
        if (triggerType === 'bsky_reply') {
            return `
                <div class="form-group">
                    <label>Bluesky Post URI</label>
                    <input type="text" id="bsky-uri" class="form-input" value="${escapeHtml(quest.group_uri || quest.uri || '')}" placeholder="at://did:plc:xxx/app.bsky.feed.post/xxx">
                    <small>The AT Protocol URI of the post to monitor for replies</small>
                </div>
            `;
        } else if (triggerType === 'firehose_phrase') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            return `
                <div class="form-group">
                    <label>Phrases/Hashtags (one per line)</label>
                    <textarea id="phrases" class="form-input" rows="4" placeholder="#reverie\\nreverie house">${escapeHtml((config.phrases || []).join('\\n'))}</textarea>
                    <small>Monitor the firehose for these phrases or hashtags</small>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="case-sensitive" ${config.case_sensitive ? 'checked' : ''}> Case sensitive matching</label>
                </div>
            `;
        } else if (triggerType === 'poll') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            return `
                <div class="form-group">
                    <label>API Endpoint URL</label>
                    <input type="text" id="poll-url" class="form-input" value="${escapeHtml(config.url || '')}" placeholder="https://api.example.com/data">
                </div>
                <div class="form-group">
                    <label>Poll Interval (seconds)</label>
                    <input type="number" id="poll-interval" class="form-input" value="${config.interval || 60}" min="10">
                </div>
            `;
        } else if (triggerType === 'webhook') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            return `
                <div class="form-group">
                    <label>Webhook Path</label>
                    <input type="text" id="webhook-path" class="form-input" value="${escapeHtml(config.path || '')}" placeholder="/webhooks/quest-name">
                    <small>This quest will be triggered when a POST request is made to this path</small>
                </div>
                <div class="form-group">
                    <label>Secret Key (optional)</label>
                    <input type="text" id="webhook-secret" class="form-input" value="${escapeHtml(config.secret || '')}" placeholder="your-secret-key">
                    <small>Validate webhook requests with this secret</small>
                </div>
            `;
        } else if (triggerType === 'cron') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            return `
                <div class="form-group">
                    <label>Cron Expression</label>
                    <input type="text" id="cron-expression" class="form-input" value="${escapeHtml(config.expression || '')}" placeholder="0 */6 * * *">
                    <small>Examples: "0 */6 * * *" (every 6 hours), "0 0 * * *" (daily at midnight)</small>
                </div>
            `;
        } else if (triggerType === 'database_watch') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            return `
                <div class="form-group">
                    <label>Table Name</label>
                    <input type="text" id="db-table" class="form-input" value="${escapeHtml(config.table || '')}" placeholder="dreamers">
                </div>
                <div class="form-group">
                    <label>Watch For</label>
                    <select id="db-operation" class="form-input">
                        <option value="INSERT" ${config.operation === 'INSERT' ? 'selected' : ''}>New Records (INSERT)</option>
                        <option value="UPDATE" ${config.operation === 'UPDATE' ? 'selected' : ''}>Updates (UPDATE)</option>
                        <option value="DELETE" ${config.operation === 'DELETE' ? 'selected' : ''}>Deletions (DELETE)</option>
                    </select>
                </div>
            `;
        }
        
        return '<div style="color: var(--text-secondary); padding: 1rem; text-align: center;">No configuration needed for this trigger type</div>';
    }
    
    window.updateTriggerFields = function() {
        const select = document.getElementById('trigger-type-select');
        const container = document.getElementById('trigger-fields-container');
        const triggerType = select.value;
        
        // Create a mock quest object with the selected trigger type
        const mockQuest = { trigger_type: triggerType };
        container.innerHTML = getTriggerFieldsHtml(mockQuest);
    };
    
    window.closeTriggerModal = function() {
        const modal = document.getElementById('trigger-modal');
        if (modal) {
            modal.remove();
        }
    };
    
    window.saveTriggerConfig = async function(questTitle) {
        console.log('[QuestManager] Saving trigger config for:', questTitle);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            alert('Quest not found');
            return;
        }
        
        const triggerType = document.getElementById('trigger-type-select').value;
        console.log('[QuestManager] Selected trigger type:', triggerType);
        let triggerConfig = {};
        let uri = quest.uri || '';
        
        try {
            if (triggerType === 'bsky_reply') {
                uri = document.getElementById('bsky-uri').value;
            } else if (triggerType === 'firehose_phrase') {
                const phrasesText = document.getElementById('phrases').value;
                const phrases = phrasesText.split('\n').map(p => p.trim()).filter(p => p);
                triggerConfig = {
                    phrases: phrases,
                    case_sensitive: document.getElementById('case-sensitive').checked
                };
            } else if (triggerType === 'poll') {
                triggerConfig = {
                    url: document.getElementById('poll-url').value,
                    interval: parseInt(document.getElementById('poll-interval').value)
                };
            } else if (triggerType === 'webhook') {
                triggerConfig = {
                    path: document.getElementById('webhook-path').value,
                    secret: document.getElementById('webhook-secret').value
                };
            } else if (triggerType === 'cron') {
                triggerConfig = {
                    expression: document.getElementById('cron-expression').value
                };
            } else if (triggerType === 'database_watch') {
                triggerConfig = {
                    table: document.getElementById('db-table').value,
                    operation: document.getElementById('db-operation').value
                };
            }
            
            const payload = {
                trigger_type: triggerType,
                trigger_config: JSON.stringify(triggerConfig),
                uri: uri,
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending update payload:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Trigger config updated successfully');
                closeTriggerModal();
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) {
                    console.log('[QuestManager] Re-selecting updated quest');
                    selectQuest(updatedQuest);
                }
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update trigger config:', result);
                alert('Failed to update trigger configuration: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error saving trigger config:', err);
            alert('Error saving trigger configuration: ' + err.message);
        }
    };
    
    window.addCondition = function(questTitle) {
        console.log('[QuestManager] addCondition called for:', questTitle);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            alert('Quest not found');
            return;
        }
        
        // Add a default any_reply condition
        console.log('[QuestManager] Adding default any_reply condition');
        addConditionToQuest(questTitle, 'any_reply');
    };
    
    async function addConditionToQuest(questTitle, conditionType, conditionValue = '') {
        try {
            const quest = questDataMap[questTitle];
            const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? quest.conditions : [quest.conditions]) : [];
            
            const newCondition = {
                type: 'condition',
                condition: conditionType,
                operator: 'AND'
            };
            
            if (conditionValue) {
                newCondition.value = conditionValue;
            }
            
            conditions.push(newCondition);
            
            const payload = {
                condition: quest.condition || '',
                conditions: JSON.stringify(conditions),
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending add condition payload:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Condition added successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to add condition:', result);
                alert('Failed to add condition: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error adding condition:', err);
            alert('Error adding condition: ' + err.message);
        }
    }
    
    window.editCondition = function(questTitle, index) {
        console.log('[QuestManager] editCondition called for:', questTitle, 'index:', index);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            alert('Quest not found');
            return;
        }
        
        const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? quest.conditions : [quest.conditions]) : [];
        if (index >= conditions.length) {
            console.error('[QuestManager] Condition index out of range:', index);
            alert('Condition not found');
            return;
        }
        
        const currentCondition = typeof conditions[index] === 'string' ? conditions[index] : (conditions[index].condition || JSON.stringify(conditions[index]));
        const newCondition = prompt('Edit condition:', currentCondition);
        if (!newCondition || newCondition === currentCondition) return;
        
        console.log('[QuestManager] Updating condition at index', index, 'to:', newCondition);
        updateCondition(questTitle, index, newCondition);
    };
    
    async function updateCondition(questTitle, index, newConditionText) {
        try {
            const quest = questDataMap[questTitle];
            const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? quest.conditions : [quest.conditions]) : [];
            
            conditions[index] = {
                type: 'condition',
                condition: newConditionText,
                operator: 'AND'
            };
            
            const payload = {
                condition: quest.condition || '',
                conditions: JSON.stringify(conditions),
                condition_operator: quest.condition_operator || 'AND',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending update condition payload:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Condition updated successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update condition:', result);
                alert('Failed to update condition: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating condition:', err);
            alert('Error updating condition: ' + err.message);
        }
    }
    
    // Update a specific option on a condition (operator, once_only, disabled)
    window.updateConditionOption = async function(questTitle, index, optionName, optionValue) {
        console.log('[QuestManager] updateConditionOption called:', questTitle, index, optionName, optionValue);
        try {
            const quest = questDataMap[questTitle];
            if (!quest) {
                console.error('[QuestManager] Quest not found:', questTitle);
                return;
            }
            
            const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? [...quest.conditions] : [quest.conditions]) : [];
            if (index >= conditions.length) {
                console.error('[QuestManager] Condition index out of range:', index);
                return;
            }
            
            // Get condition object (normalize if string)
            let condObj = conditions[index];
            if (typeof condObj === 'string') {
                condObj = { condition: condObj, operator: 'AND' };
            } else {
                condObj = { ...condObj }; // Clone to avoid mutation
            }
            
            // Update the specific option
            condObj[optionName] = optionValue;
            conditions[index] = condObj;
            
            const payload = {
                condition: quest.condition || '',
                conditions: JSON.stringify(conditions),
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending update condition option payload:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Condition option updated successfully');
                // Update local cache
                quest.conditions = conditions;
                // Refresh the display
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update condition option:', result);
                alert('Failed to update condition option: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating condition option:', err);
            alert('Error updating condition option: ' + err.message);
        }
    };
    
    window.addCommand = function(questTitle) {
        console.log('[QuestManager] addCommand called for:', questTitle);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            alert('Quest not found');
            return;
        }
        
        // Add a default like_post command
        console.log('[QuestManager] Adding default like_post command');
        addCommandToQuest(questTitle, 'like_post');
    };
    
    async function addCommandToQuest(questTitle, commandType, commandParams = '') {
        try {
            const quest = questDataMap[questTitle];
            const commands = quest.commands || [];
            
            // Commands use canonical format: {cmd: "type", args: [...]}
            const newCommand = {
                cmd: commandType,
                args: commandParams ? commandParams.split(":") : []
            };
            commands.push(newCommand);
            
            const payload = {
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending add command payload:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Command added successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to add command:', result);
                alert('Failed to add command: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error adding command:', err);
            alert('Error adding command: ' + err.message);
        }
    }
    
    window.editCommand = function(questTitle, index) {
        console.log('[QuestManager] editCommand called for:', questTitle, 'index:', index);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            alert('Quest not found');
            return;
        }
        
        if (!quest.commands || index >= quest.commands.length) {
            console.error('[QuestManager] Command index out of range:', index);
            alert('Command not found');
            return;
        }
        
        const currentCommand = quest.commands[index];
        const newType = prompt('Command type:', currentCommand.type || '');
        if (!newType) return;
        
        const currentParams = currentCommand.params ? JSON.stringify(currentCommand.params, null, 2) : '{}';
        const newParamsStr = prompt('Command parameters (JSON):', currentParams);
        if (!newParamsStr) return;
        
        let newParams = {};
        try {
            newParams = JSON.parse(newParamsStr);
        } catch (e) {
            console.error('[QuestManager] Invalid JSON for params:', e);
            alert('Invalid JSON format for parameters');
            return;
        }
        
        console.log('[QuestManager] Updating command at index', index, 'to:', newType, newParams);
        updateCommand(questTitle, index, newType, newParams);
    };
    
    async function updateCommand(questTitle, index, commandType, params) {
        try {
            const quest = questDataMap[questTitle];
            const commands = [...quest.commands];
            
            commands[index] = {
                type: commandType,
                params: params
            };
            
            const payload = {
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                commands: commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending update command payload:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Command updated successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update command:', result);
                alert('Failed to update command: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating command:', err);
            alert('Error updating command: ' + err.message);
        }
    }
    
    window.deleteCommand = async function(questTitle, index) {
        console.log('[QuestManager] deleteCommand called for:', questTitle, 'index:', index);
        if (!confirm(`Delete this command from "${questTitle}"?`)) {
            console.log('[QuestManager] Delete command cancelled by user');
            return;
        }
        
        try {
            const quest = window.questDataMap[questTitle];
            if (!quest) {
                alert('Quest not found');
                return;
            }
            
            quest.commands.splice(index, 1);
            
            const payload = {
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Command deleted successfully');
                // Reload and reselect
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to delete command:', result);
                alert('Failed to delete command: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error deleting command:', err);
            alert('Error deleting command: ' + err.message);
        }
    };
    
    async function updateCommandType(questTitle, index, newType) {
        console.log('[QuestManager] Updating command type at index', index, 'to:', newType);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            return;
        }
        
        try {
            const commands = [...quest.commands];
            
            if (index >= commands.length) {
                console.error('[QuestManager] Invalid command index:', index);
                return;
            }
            
            // Update the command type; preserve object form when present
            if (typeof commands[index] === 'object' && commands[index] !== null) {
                commands[index].cmd = newType;
                commands[index].args = commands[index].args || [];
            } else {
                // legacy string form
                commands[index] = newType;
            }
            
            const payload = {
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Command type updated successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update command type:', result);
                alert('Failed to update command: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating command type:', err);
            alert('Error updating command: ' + err.message);
        }
    }
    
    async function updateCommandParams(questTitle, index, newParams) {
        console.log('[QuestManager] Updating command params at index', index, 'to:', newParams);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            return;
        }
        
        try {
            const commands = [...quest.commands];
            
            if (index >= commands.length) {
                console.error('[QuestManager] Invalid command index:', index);
                return;
            }
            
            // Update the command with params, preserving object shape if present
            if (typeof commands[index] === 'object' && commands[index] !== null) {
                // Parse params string into array or JSON
                let args = [];
                try {
                    const trimmed = (newParams || '').trim();
                    if (!trimmed) {
                        args = [];
                    } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                        args = JSON.parse(trimmed);
                    } else if (trimmed.includes(':')) {
                        args = trimmed.split(':').map(s => s.trim()).filter(Boolean);
                    } else if (trimmed.includes(',')) {
                        args = trimmed.split(',').map(s => s.trim()).filter(Boolean);
                    } else {
                        args = [trimmed];
                    }
                } catch (e) {
                    // Fallback to raw string as single arg
                    args = [String(newParams)];
                }

                commands[index].args = args;
            } else {
                // legacy string form
                let commandType = '';
                if (typeof commands[index] === 'string') {
                    commandType = commands[index].split(':')[0];
                }
                commands[index] = newParams ? `${commandType}:${newParams}` : commandType;
            }
            
            const payload = {
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Command params updated successfully');
                // Update local cache
                quest.commands = commands;
                // Reload and reselect to show changes
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update command params:', result);
                alert('Failed to update command: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating command params:', err);
            alert('Error updating command: ' + err.message);
        }
    }
    
    // Create quest modal
    window.createBlankQuest = function() {
        console.log('[QuestManager] createBlankQuest called');
        
        const title = prompt('Quest Title:');
        if (!title) {
            console.log('[QuestManager] Quest creation cancelled - no title');
            return;
        }
        
        const description = prompt('Quest Description (optional):');
        
        console.log('[QuestManager] Creating new quest:', title);
        createNewQuest(title, description);
    };
    
    async function createNewQuest(title, description) {
        try {
            const payload = {
                title: title,
                description: description || '',
                trigger_type: 'bsky_reply',
                enabled: false,
                conditions: JSON.stringify([{
                    type: 'condition',
                    condition: 'any_reply',
                    operator: 'AND'
                }]),
                condition_operator: 'AND',
                commands: []
            };
            
            console.log('[QuestManager] Sending create quest payload:', payload);
            const response = await authenticatedFetch('/api/quests/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('[QuestManager] Quest created successfully, response:', result);
                
                // Check if API returned the created quest
                if (result.quest) {
                    console.log('[QuestManager] Using quest data from API response');
                    // Add to local data structures
                    allQuests.push(result.quest);
                    questDataMap[result.quest.title] = result.quest;
                    applyFilter();
                    selectQuest(result.quest);
                } else {
                    // Add delay to allow backend to commit
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    await loadQuests();
                    console.log('[QuestManager] After loadQuests, searching for new quest:', title);
                    const newQuest = allQuests.find(q => q.title === title);
                    if (newQuest) {
                        console.log('[QuestManager] Selecting newly created quest');
                        selectQuest(newQuest);
                    } else {
                        console.error('[QuestManager] Created quest not found:', title);
                        alert('Quest created but not found in list. Please refresh the page.');
                    }
                }
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to create quest:', result);
                alert('Failed to create quest: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error creating quest:', err);
            alert('Error creating quest: ' + err.message);
        }
    }
    
    // Helper function
    if (typeof window.escapeHtml === 'undefined') {
        window.escapeHtml = escapeHtml;
    }
    
    // Initialize filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            applyFilter();
        });
    });
    
    // Initialize search
    document.getElementById('quest-search').addEventListener('input', () => {
        applyFilter();
    });
    
})();
// quests.js - Quest management interface
// Standalone version with built-in authentication

(function() {
    'use strict';
    
    // ============================================================================
    // AUTHENTICATION & AUTHORIZATION
    // ============================================================================
    
    // Helper function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Generate rowstyle dropdown options dynamically from RowStyleRegistry
     * Groups styles by category with descriptions from the registry
     * @param {string} currentValue - Currently selected rowstyle value
     * @returns {string} HTML options for select element
     */
    function generateRowstyleOptions(currentValue = '') {
        if (!window.RowStyleRegistry) {
            console.warn('RowStyleRegistry not loaded, using fallback options');
            return `
                <option value="">Default (auto)</option>
                <option value="user">User</option>
                <option value="user-highlight">User Highlight</option>
                <option value="user-special">User Special</option>
                <option value="unfinished">Unfinished</option>
            `;
        }
        
        const registry = window.RowStyleRegistry;
        const categories = {
            basic: { label: 'Basic Styles', styles: [] },
            special: { label: 'Special Effects', styles: [] },
            souvenir: { label: 'Souvenir Styles', styles: [] },
            role: { label: 'Role Styles', styles: [] },
            octant: { label: 'Octant Styles', styles: [] }
        };
        
        // Group styles by category
        Object.entries(registry).forEach(([name, style]) => {
            if (!style.category || name === 'default') return;
            
            const cat = categories[style.category];
            if (cat) {
                cat.styles.push({
                    value: name,
                    label: style.name,
                    desc: style.description || name
                });
            }
        });
        
        // Build options HTML
        let html = `<option value="" ${currentValue === '' ? 'selected' : ''}>Default (auto)</option>`;
        
        // Add special "octant" option that maps to user's actual octant
        const octantDynamic = {
            value: 'octant',
            label: 'User Octant (Dynamic)',
            desc: "Matches user's current spectrum octant"
        };
        
        Object.entries(categories).forEach(([catKey, cat]) => {
            if (cat.styles.length === 0) return;
            
            html += `<optgroup label="${cat.label}">`;
            
            // For octants, add the dynamic option first
            if (catKey === 'octant') {
                html += `<option value="${octantDynamic.value}" ${currentValue === octantDynamic.value ? 'selected' : ''}>${octantDynamic.label} - ${octantDynamic.desc}</option>`;
            }
            
            cat.styles.forEach(style => {
                const selected = currentValue === style.value ? 'selected' : '';
                // Truncate description if too long
                const shortDesc = style.desc.length > 50 ? style.desc.substring(0, 47) + '...' : style.desc;
                html += `<option value="${style.value}" ${selected}>${style.label.charAt(0).toUpperCase() + style.label.slice(1)} - ${shortDesc}</option>`;
            });
            
            html += `</optgroup>`;
        });
        
        return html;
    }
    
    // Check authentication on page load
    console.log('[QuestManager] Initializing quest manager...');
    const adminToken = localStorage.getItem('admin_token');
    console.log('[QuestManager] Admin token present:', !!adminToken);
    
    if (!adminToken) {
        // No token - redirect to login
        console.warn('[QuestManager] No admin token found, redirecting to login');
        window.location.href = '/admin/login.html';
        throw new Error('Not authenticated');
    }
    
    // Helper function to make authenticated API calls
    async function authenticatedFetch(url, options = {}) {
        console.log('[QuestManager] authenticatedFetch:', url, options.method || 'GET');
        const token = localStorage.getItem('admin_token');
        
        if (!token) {
            console.error('[QuestManager] No authentication token available');
            throw new Error('No authentication token');
        }
        
        // Add authorization header
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${token}`;
        
        const response = await fetch(url, options);
        console.log('[QuestManager] Response status:', response.status, url);
        
        // If unauthorized, redirect to login
        if (response.status === 401) {
            console.warn('[QuestManager] Unauthorized, clearing token and redirecting');
            localStorage.removeItem('admin_token');
            window.location.href = '/admin/login.html';
            throw new Error('Session expired');
        }
        
        return response;
    }
    
    // Verify token is still valid and get user info
    console.log('[QuestManager] Verifying admin token...');
    fetch('/api/admin/verify', {
        headers: {
            'Authorization': `Bearer ${adminToken}`
        }
    }).then(response => {
        console.log('[QuestManager] Verify response status:', response.status);
        if (!response.ok) {
            // Token invalid - redirect to login
            console.warn('[QuestManager] Token verification failed, redirecting to login');
            localStorage.removeItem('admin_token');
            window.location.href = '/admin/login.html';
        } else {
            return response.json();
        }
    }).then(data => {
        if (data) {
            console.log('[QuestManager] Admin verified:', data.handle);
            // Create admin session for drawer
            const adminSession = {
                did: data.did,
                handle: data.handle,
                displayName: data.handle,
                isAdmin: true
            };
            
            // Store session data
            sessionStorage.setItem('admin_session', JSON.stringify(adminSession));
            
            // Dispatch login event for drawer
            window.dispatchEvent(new CustomEvent('oauth:login', {
                detail: { session: adminSession }
            }));
            
            // Load quests after successful authentication
            console.log('[QuestManager] Loading quests...');
            loadQuests();
        }
    }).catch(error => {
        console.error('[QuestManager] Auth check failed:', error);
        // On network error, redirect to login
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login.html';
    });
    
    // ============================================================================
    // QUEST MANAGEMENT
    // ============================================================================
    
    let allQuests = [];
    let filteredQuests = [];
    let currentFilter = 'all';
    let selectedQuest = null;
    let questDataMap = {};
    
    // Expose questDataMap globally for compatibility
    window.questDataMap = questDataMap;
    
    async function loadQuests() {
        showLoading();
        
        try {
            const response = await authenticatedFetch('/api/quests/grouped');
            
            if (!response.ok) {
                throw new Error(`Failed to load quests: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.groups || data.groups.length === 0) {
                showError('No quests found.');
                return;
            }
            
            // Flatten quest groups into a single list
            allQuests = [];
            data.groups.forEach(group => {
                group.quests.forEach(quest => {
                    // Parse conditions if needed
                    if (quest.conditions && typeof quest.conditions === 'string') {
                        try {
                            quest.conditions = JSON.parse(quest.conditions);
                        } catch (e) {
                            console.error(`Failed to parse conditions for ${quest.title}:`, e);
                        }
                    }
                    
                    // Add group context
                    quest.group_uri = group.uri;
                    quest.bsky_url = group.bsky_url;
                    
                    allQuests.push(quest);
                });
            });
            
            // Sort quests: enabled first, then by creation date
            allQuests.sort((a, b) => {
                if (a.enabled !== b.enabled) {
                    return b.enabled ? 1 : -1;
                }
                return (b.created_at || 0) - (a.created_at || 0);
            });
            
            // Store in questDataMap for compatibility
            allQuests.forEach(quest => {
                questDataMap[quest.title] = quest;
            });
            
            applyFilter();
            hideLoading();
            
            // Restore previously selected quest from session
            const savedQuestTitle = sessionStorage.getItem('selected_quest_title');
            if (savedQuestTitle && questDataMap[savedQuestTitle]) {
                console.log('[QuestManager] Restoring previously selected quest:', savedQuestTitle);
                selectQuest(questDataMap[savedQuestTitle]);
            }
            
        } catch (err) {
            showError(`Error: ${err.message}`);
            console.error('Failed to load quests:', err);
        }
    };
    
    function showLoading() {
        const questList = document.getElementById('quest-list');
        questList.innerHTML = '<div class="loading"><div class="loading-spinner"></div><div>Loading quests...</div></div>';
    }
    
    function hideLoading() {
        // Loading is replaced by quest list
    }
    
    function showError(message) {
        const questList = document.getElementById('quest-list');
        questList.innerHTML = `<div class="error">${message}</div>`;
    }
    
    function applyFilter() {
        const searchTerm = document.getElementById('quest-search').value.toLowerCase();
        
        // Filter by status
        filteredQuests = allQuests.filter(quest => {
            if (currentFilter === 'enabled') return quest.enabled;
            if (currentFilter === 'disabled') return !quest.enabled;
            return true;
        });
        
        // Filter by search term
        if (searchTerm) {
            filteredQuests = filteredQuests.filter(quest => {
                return quest.title.toLowerCase().includes(searchTerm) ||
                       (quest.description && quest.description.toLowerCase().includes(searchTerm)) ||
                       (quest.trigger_type && quest.trigger_type.toLowerCase().includes(searchTerm));
            });
        }
        
        renderQuestList();
    }
    
    function renderQuestList() {
        const questList = document.getElementById('quest-list');
        
        if (filteredQuests.length === 0) {
            questList.innerHTML = '<div class="empty-state" style="padding: 2rem; text-align: center; color: var(--text-secondary);"><div>No quests found</div></div>';
            return;
        }
        
        const triggerLabels = {
            'bibliohose': 'Reading List',
            'poll': 'Polling',
            'webhook': 'Webhook',
            'cron': 'Scheduled',
            'database_watch': 'DB Watch',
            'bsky_reply': 'Reply Monitor',
            'firehose_phrase': 'Phrase Monitor'
        };
        
        const html = filteredQuests.map(quest => {
            const label = triggerLabels[quest.trigger_type] || quest.trigger_type || 'bsky_reply';
            const statusClass = quest.enabled ? 'enabled' : 'disabled';
            const statusText = quest.enabled ? 'Active' : 'Disabled';
            const isActive = selectedQuest && selectedQuest.title === quest.title;
            
            // Condition types summary and command names (canonical-aware)
            let conditionCount = 0;
            let conditionTypes = [];
            if (quest.conditions) {
                if (Array.isArray(quest.conditions)) {
                    conditionCount = quest.conditions.length;
                    conditionTypes = quest.conditions.map(c => (typeof c === 'object' ? c.condition : c)).filter(Boolean);
                } else {
                    conditionCount = 1;
                    conditionTypes = [String(quest.conditions)];
                }
            }

            const uniqueCond = Array.from(new Set(conditionTypes)).slice(0,3).join(', ');

            let commandCount = 0;
            let commandNames = [];
            if (quest.commands && Array.isArray(quest.commands)) {
                commandCount = quest.commands.length;
                commandNames = quest.commands.map(cmd => (typeof cmd === 'object' ? (cmd.cmd || '') : String(cmd))).filter(Boolean);
            }

            const cmdPreview = Array.from(new Set(commandNames)).slice(0,3).join(', ');

            return `
                <div class="quest-list-item ${isActive ? 'active' : ''}" data-quest-title="${escapeHtml(quest.title)}">
                    <div class="quest-item-header">
                        <div class="quest-item-title">${escapeHtml(quest.title)}</div>
                        <div class="quest-status-badge ${statusClass}">${statusText}</div>
                    </div>
                    <div class="quest-item-meta">
                        <div class="quest-item-trigger">${label}</div>
                        <div class="quest-item-stats">${conditionCount} cond · ${commandCount} cmd</div>
                    </div>
                </div>
            `;
        }).join('');
        
        questList.innerHTML = html;
        
        // Add click handlers
        questList.querySelectorAll('.quest-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const title = item.dataset.questTitle;
                const quest = allQuests.find(q => q.title === title);
                if (quest) {
                    selectQuest(quest);
                }
            });
        });
    }
    
    function selectQuest(quest) {
        console.log('[QuestManager] Selecting quest:', quest.title);
        selectedQuest = quest;
        
        // Save selected quest to session storage
        sessionStorage.setItem('selected_quest_title', quest.title);
        
        renderQuestList(); // Re-render to update active state
        renderQuestDetail(quest);
    }
    
    function renderQuestDetail(quest) {
        console.log('[QuestManager] Rendering quest detail for:', quest.title);
        const container = document.getElementById('quest-detail-container');
        
        const triggerLabels = {
            'bibliohose': 'Reading Activity Monitor',
            'poll': 'API Polling Trigger',
            'webhook': 'HTTP Webhook',
            'cron': 'Time-Based Schedule',
            'database_watch': 'Database Monitor',
            'bsky_reply': 'Bluesky Reply Monitor',
            'firehose_phrase': 'Phrase/Hashtag Monitor'
        };
        
        const label = triggerLabels[quest.trigger_type] || quest.trigger_type || 'Unknown';
        const statusClass = quest.enabled ? 'enabled' : 'disabled';
        
        // Build trigger config display with editable fields
        let triggerConfigHtml = '';
        if (quest.trigger_type === 'bsky_reply') {
            const uri = quest.group_uri || quest.uri || '';
            triggerConfigHtml = `
                <div class="config-item-edit">
                    <label class="config-label">Post URI</label>
                    <input type="text" class="config-input" 
                           data-quest-title="${escapeHtml(quest.title)}" 
                           data-field="uri" 
                           value="${escapeHtml(uri)}" 
                           placeholder="at://did:plc:xxx/app.bsky.feed.post/xxx">
                    <button class="config-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-field="uri">Save URI</button>
                </div>
            `;
        } else if (quest.trigger_type === 'firehose_phrase') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            const phrases = config.phrases || [];
            const caseSensitive = config.case_sensitive || false;
            triggerConfigHtml = `
                <div class="config-item-edit">
                    <label class="config-label">Phrases/Hashtags (one per line)</label>
                    <textarea class="config-textarea" 
                              data-quest-title="${escapeHtml(quest.title)}" 
                              data-field="phrases" 
                              rows="4" 
                              placeholder="#somehashtag\nkeyword\nphrase to match">${escapeHtml(phrases.join('\n'))}</textarea>
                </div>
                <div class="config-item-edit">
                    <label class="config-label">
                        <input type="checkbox" class="config-checkbox" 
                               data-quest-title="${escapeHtml(quest.title)}" 
                               data-field="case_sensitive" 
                               ${caseSensitive ? 'checked' : ''}>
                        Case Sensitive
                    </label>
                </div>
                <button class="config-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-trigger-type="firehose_phrase">Save Configuration</button>
            `;
        } else if (quest.trigger_type === 'poll') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            triggerConfigHtml = `
                <div class="config-item-edit">
                    <label class="config-label">Poll URL</label>
                    <input type="url" class="config-input" 
                           data-quest-title="${escapeHtml(quest.title)}" 
                           data-field="url" 
                           value="${escapeHtml(config.url || '')}" 
                           placeholder="https://api.example.com/endpoint">
                </div>
                <div class="config-item-edit">
                    <label class="config-label">Interval (seconds)</label>
                    <input type="number" class="config-input" 
                           data-quest-title="${escapeHtml(quest.title)}" 
                           data-field="interval" 
                           value="${config.interval || 60}" 
                           min="1" step="1">
                </div>
                <button class="config-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-trigger-type="poll">Save Configuration</button>
            `;
        } else if (quest.trigger_type === 'webhook') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            triggerConfigHtml = `
                <div class="config-item-edit">
                    <label class="config-label">Webhook Path</label>
                    <input type="text" class="config-input" 
                           data-quest-title="${escapeHtml(quest.title)}" 
                           data-field="path" 
                           value="${escapeHtml(config.path || '')}" 
                           placeholder="/webhooks/my-quest">
                </div>
                <div class="config-item-edit">
                    <label class="config-label">Secret (optional)</label>
                    <input type="text" class="config-input" 
                           data-quest-title="${escapeHtml(quest.title)}" 
                           data-field="secret" 
                           value="${escapeHtml(config.secret || '')}" 
                           placeholder="webhook-secret-key">
                </div>
                <button class="config-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-trigger-type="webhook">Save Configuration</button>
            `;
        } else if (quest.trigger_type === 'cron') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            triggerConfigHtml = `
                <div class="config-item-edit">
                    <label class="config-label">Cron Expression</label>
                    <input type="text" class="config-input" 
                           data-quest-title="${escapeHtml(quest.title)}" 
                           data-field="expression" 
                           value="${escapeHtml(config.expression || '')}" 
                           placeholder="0 */6 * * *">
                    <small class="config-help">Format: minute hour day month weekday (e.g., "0 */6 * * *" = every 6 hours)</small>
                </div>
                <button class="config-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-trigger-type="cron">Save Configuration</button>
            `;
        } else if (quest.trigger_type === 'database_watch') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            triggerConfigHtml = `
                <div class="config-item-edit">
                    <label class="config-label">Table Name</label>
                    <input type="text" class="config-input" 
                           data-quest-title="${escapeHtml(quest.title)}" 
                           data-field="table" 
                           value="${escapeHtml(config.table || '')}" 
                           placeholder="table_name">
                </div>
                <div class="config-item-edit">
                    <label class="config-label">Operation</label>
                    <select class="config-select" 
                            data-quest-title="${escapeHtml(quest.title)}" 
                            data-field="operation">
                        <option value="INSERT" ${config.operation === 'INSERT' ? 'selected' : ''}>INSERT</option>
                        <option value="UPDATE" ${config.operation === 'UPDATE' ? 'selected' : ''}>UPDATE</option>
                        <option value="DELETE" ${config.operation === 'DELETE' ? 'selected' : ''}>DELETE</option>
                    </select>
                </div>
                <button class="config-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-trigger-type="database_watch">Save Configuration</button>
            `;
        } else if (quest.trigger_config) {
            // Fallback for unknown trigger types - show raw JSON
            try {
                const config = typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config;
                triggerConfigHtml = Object.entries(config).map(([key, value]) => `
                    <div class="config-item">
                        <label class="config-label">${escapeHtml(key)}</label>
                        <div class="config-value"><code>${escapeHtml(JSON.stringify(value))}</code></div>
                    </div>
                `).join('');
            } catch (e) {
                triggerConfigHtml = `<div class="config-item">
                    <div class="config-value">${escapeHtml(quest.trigger_config)}</div>
                </div>`;
            }
        }
        
        // Build conditions display with editable fields
        let conditionsHtml = '';
        const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? quest.conditions : [quest.conditions]) : [];
        
        if (conditions.length > 0) {
            conditionsHtml = conditions.map((cond, index) => {
                // Parse condition object - prefer canonical format with args array
                const condObj = typeof cond === 'string' ? { condition: cond } : cond;
                const conditionRaw = (typeof cond === 'string') ? cond : JSON.stringify(cond, null, 2);
                
                // Parse condition type and value
                let conditionType = condObj.condition || 'any_reply';
                let conditionValue = '';
                
                // Prefer args array (canonical), fall back to value (legacy)
                if (Array.isArray(condObj.args) && condObj.args.length > 0) {
                    conditionValue = condObj.args.join(', ');
                } else if (condObj.value !== undefined && condObj.value !== null) {
                    conditionValue = String(condObj.value);
                }
                
                // Check if condition includes a colon (legacy format)
                if (conditionType.includes(':')) {
                    const parts = conditionType.split(':');
                    conditionType = parts[0];
                    conditionValue = parts.slice(1).join(':');
                }
                
                // Extract condition options
                const condOperator = condObj.operator || 'AND';
                const condOnceOnly = condObj.once_only || false;
                const condDisabled = condObj.disabled || false;
                
                // Condition type descriptions
                const conditionDescriptions = {
                    'any_reply': 'Triggers on any reply to the post',
                    'new_reply': 'Triggers on new replies (legacy)',
                    'dreamer_replies': 'Triggers when a registered dreamer replies',
                    'contains_hashtags': 'Triggers when reply contains specific hashtags',
                    'contains_mentions': 'Triggers when reply mentions specific users',
                    'reply_contains': 'Triggers when reply contains specific text',
                    'has_canon': 'Triggers if user has a specific canon key',
                    'hasnt_canon': 'Triggers if user has no canon entries for key',
                    'count_canon': 'Triggers based on count of canon entries (e.g., >=3)',
                    'user_canon_equals': 'Triggers if canon key equals specific value',
                    'user_canon_not_equals': 'Triggers if canon key does NOT equal value',
                    'user_in_canon_list': 'Triggers if canon key is in list of values',
                    'user_has_souvenir': 'Triggers if user has a specific souvenir',
                    'user_missing_souvenir': 'Triggers if user lacks a souvenir',
                    'souvenir_exists_anywhere': 'Triggers if souvenir exists for any user',
                    'has_read': 'Triggers if user has read a specific book (biblio)',
                    'has_biblio_stamp': 'Triggers if user has a biblio stamp'
                };
                
                return `
                    <div class="condition-card-edit ${condDisabled ? 'condition-disabled' : ''}">
                        <div class="condition-header">
                            <label class="condition-label">Condition Type</label>
                            <select class="condition-select" 
                                    data-quest-title="${escapeHtml(quest.title)}" 
                                    data-index="${index}">
                                <optgroup label="Reply Conditions">
                                    <option value="any_reply" ${conditionType === 'any_reply' ? 'selected' : ''}>Any Reply</option>
                                    <option value="new_reply" ${conditionType === 'new_reply' ? 'selected' : ''}>New Reply (legacy)</option>
                                    <option value="dreamer_replies" ${conditionType === 'dreamer_replies' ? 'selected' : ''}>Registered Dreamer Replies</option>
                                </optgroup>
                                <optgroup label="Content Match">
                                    <option value="reply_contains" ${conditionType === 'reply_contains' ? 'selected' : ''}>Reply Contains Text</option>
                                    <option value="contains_hashtags" ${conditionType === 'contains_hashtags' ? 'selected' : ''}>Contains Hashtags</option>
                                    <option value="contains_mentions" ${conditionType === 'contains_mentions' ? 'selected' : ''}>Contains Mentions</option>
                                </optgroup>
                                <optgroup label="Canon Checks">
                                    <option value="has_canon" ${conditionType === 'has_canon' ? 'selected' : ''}>Has Canon Key</option>
                                    <option value="hasnt_canon" ${conditionType === 'hasnt_canon' ? 'selected' : ''}>Missing Canon Key</option>
                                    <option value="count_canon" ${conditionType === 'count_canon' ? 'selected' : ''}>Count Canon (>=N)</option>
                                    <option value="user_canon_equals" ${conditionType === 'user_canon_equals' ? 'selected' : ''}>Canon Equals Value</option>
                                    <option value="user_canon_not_equals" ${conditionType === 'user_canon_not_equals' ? 'selected' : ''}>Canon Not Equals</option>
                                    <option value="user_in_canon_list" ${conditionType === 'user_in_canon_list' ? 'selected' : ''}>Canon In List</option>
                                </optgroup>
                                <optgroup label="Souvenirs">
                                    <option value="user_has_souvenir" ${conditionType === 'user_has_souvenir' ? 'selected' : ''}>Has Souvenir</option>
                                    <option value="user_missing_souvenir" ${conditionType === 'user_missing_souvenir' ? 'selected' : ''}>Missing Souvenir</option>
                                    <option value="souvenir_exists_anywhere" ${conditionType === 'souvenir_exists_anywhere' ? 'selected' : ''}>Souvenir Exists Anywhere</option>
                                </optgroup>
                                <optgroup label="Biblio">
                                    <option value="has_read" ${conditionType === 'has_read' ? 'selected' : ''}>Has Read Book</option>
                                    <option value="has_biblio_stamp" ${conditionType === 'has_biblio_stamp' ? 'selected' : ''}>Has Biblio Stamp</option>
                                </optgroup>
                            </select>
                        </div>
                        <div class="condition-options-row">
                            <div class="condition-option">
                                <label class="condition-label">Logic</label>
                                <select class="condition-operator-select" 
                                        data-quest-title="${escapeHtml(quest.title)}" 
                                        data-index="${index}"
                                        onchange="updateConditionOption('${escapeHtml(quest.title)}', ${index}, 'operator', this.value)">
                                    <option value="AND" ${condOperator === 'AND' ? 'selected' : ''}>AND</option>
                                    <option value="OR" ${condOperator === 'OR' ? 'selected' : ''}>OR</option>
                                    <option value="NOT" ${condOperator === 'NOT' ? 'selected' : ''}>NOT</option>
                                </select>
                            </div>
                            <div class="condition-option">
                                <label class="condition-checkbox-label">
                                    <input type="checkbox" 
                                           class="condition-once-only" 
                                           ${condOnceOnly ? 'checked' : ''}
                                           onchange="updateConditionOption('${escapeHtml(quest.title)}', ${index}, 'once_only', this.checked)">
                                    Once Only
                                </label>
                            </div>
                            <div class="condition-option">
                                <label class="condition-checkbox-label">
                                    <input type="checkbox" 
                                           class="condition-disabled" 
                                           ${condDisabled ? 'checked' : ''}
                                           onchange="updateConditionOption('${escapeHtml(quest.title)}', ${index}, 'disabled', this.checked)">
                                    Disabled
                                </label>
                            </div>
                        </div>
                        <div class="condition-description">${conditionDescriptions[conditionType] || ''}</div>
                        <div class="condition-details">Value: <strong>${escapeHtml(String(conditionValue || '—'))}</strong></div>
                        ${['contains_hashtags', 'contains_mentions', 'reply_contains', 'has_canon', 'hasnt_canon', 'count_canon', 'user_canon_equals', 'user_canon_not_equals', 'user_in_canon_list', 'user_has_souvenir', 'user_missing_souvenir', 'souvenir_exists_anywhere', 'has_read', 'has_biblio_stamp'].includes(conditionType) ? `
                        <div class="condition-value-field">
                            <label class="condition-label">${['has_canon', 'hasnt_canon', 'count_canon', 'user_canon_equals', 'user_canon_not_equals', 'user_in_canon_list'].includes(conditionType) ? 'Canon Key/Value' : ['user_has_souvenir', 'user_missing_souvenir', 'souvenir_exists_anywhere'].includes(conditionType) ? 'Souvenir Key' : 'Value'}</label>
                            <input type="text" 
                                   class="condition-input" 
                                   data-quest-title="${escapeHtml(quest.title)}" 
                                   data-index="${index}"
                                   value="${escapeHtml(conditionValue)}" 
                                   placeholder="${
                                    conditionType === 'contains_hashtags' ? '#hashtag1, #hashtag2' : 
                                    conditionType === 'contains_mentions' ? '@username' : 
                                    conditionType === 'has_canon' || conditionType === 'hasnt_canon' ? 'canon_key (e.g., name, origin)' :
                                    conditionType === 'count_canon' ? 'key>=N (e.g., quest>=3)' :
                                    conditionType === 'user_canon_equals' ? 'key=value' :
                                    conditionType === 'user_canon_not_equals' ? 'key=value' :
                                    conditionType === 'user_in_canon_list' ? 'key=val1,val2,val3' :
                                    conditionType === 'user_has_souvenir' || conditionType === 'user_missing_souvenir' || conditionType === 'souvenir_exists_anywhere' ? 'souvenir_key' :
                                    conditionType === 'has_read' ? 'Book Title' :
                                    conditionType === 'has_biblio_stamp' ? 'list_rkey' :
                                    'text to match'
                                   }">
                            <button class="condition-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-index="${index}">Save Value</button>
                        </div>
                        ` : ''}
                        <div class="condition-actions">
                            <button class="condition-btn danger" onclick="deleteCondition('${escapeHtml(quest.title)}', ${index})">Delete</button>
                        </div>
                        <div class="raw-panel condition-raw">
                            <div class="raw-panel-label">Raw JSON</div>
                            <pre class="raw-panel-code">${escapeHtml(conditionRaw)}</pre>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        // Build commands display with editable fields
        let commandsHtml = '';
        if (quest.commands && quest.commands.length > 0) {
            commandsHtml = quest.commands.map((cmd, index) => {
                // Parse command - can be string "command_type" or "command_type:param" or object {cmd, args}
                // Preserve raw command representation for display
                const commandRaw = (typeof cmd === 'string') ? cmd : JSON.stringify(cmd, null, 2);
                
                let commandType = '';
                let commandParams = '';
                
                if (typeof cmd === 'string') {
                    const parts = cmd.split(':');
                    commandType = parts[0];
                    commandParams = parts.slice(1).join(':');
                } else if (typeof cmd === 'object') {
                    // Canonical format uses cmd.cmd and cmd.args; legacy uses cmd.type and cmd.params
                    commandType = cmd.cmd || cmd.type || '';
                    // Prefer args array (canonical), fall back to params (legacy)
                    if (Array.isArray(cmd.args) && cmd.args.length > 0) {
                        commandParams = cmd.args.join(':');
                    } else if (cmd.params) {
                        commandParams = typeof cmd.params === 'string' ? cmd.params : JSON.stringify(cmd.params);
                    }
                }
                
                // Command type descriptions and parameter info
                const commandInfo = {
                    'name_dreamer': { 
                        desc: 'Names a dreamer in the system', 
                        hasParam: false 
                    },
                    'registration_check': { 
                        desc: 'Checks if user is registered', 
                        hasParam: false 
                    },
                    'register_if_needed': { 
                        desc: 'Registers user if not already registered (legacy)', 
                        hasParam: false 
                    },
                    'add_kindred': { 
                        desc: 'Adds another user as kindred', 
                        hasParam: true,
                        paramLabel: 'Kindred Handle',
                        paramPlaceholder: '@handle.bsky.social'
                    },
                    'like_post': { 
                        desc: 'Likes the triggering post', 
                        hasParam: false 
                    },
                    'add_canon': { 
                        desc: 'Adds an event entry for the user', 
                        hasParam: true,
                        paramLabel: 'Event Parameters',
                        paramPlaceholder: 'key:event:type',
                        hasCanonEditor: true,
                        canonTypes: ['event', 'trait', 'relationship', 'possession', 'memory', 'belief']
                    },
                    'add_name': { 
                        desc: 'Adds a name to the user', 
                        hasParam: true,
                        paramLabel: 'Name',
                        paramPlaceholder: 'Name to add'
                    },
                    'disable_quest': { 
                        desc: 'Disables this quest after execution', 
                        hasParam: false 
                    },
                    'mod_spectrum': { 
                        desc: 'Modifies user spectrum values', 
                        hasParam: true,
                        paramLabel: 'Spectrum Changes',
                        paramPlaceholder: 'octant:value (e.g., 0:10)'
                    },
                    'award_souvenir': { 
                        desc: 'Awards a souvenir to the user', 
                        hasParam: true,
                        paramLabel: 'Souvenir Key',
                        paramPlaceholder: 'Souvenir identifier',
                        hasPreview: true
                    },
                    'reply_origin_spectrum': { 
                        desc: 'Replies with origin spectrum information', 
                        hasParam: false 
                    },
                    'reply_post': { 
                        desc: 'Replies to the triggering post', 
                        hasParam: true,
                        paramLabel: 'Reply Text',
                        paramPlaceholder: 'Text to reply with',
                        hasVariableHints: true,
                        variables: [
                            { name: '{{name}}', source: 'name_dreamer, add_name, registration_check', desc: 'User\'s name' },
                            { name: '{{handle}}', source: 'trigger', desc: 'User\'s Bluesky handle' },
                            { name: '{{post_text}}', source: 'trigger', desc: 'Triggering post text' },
                            { name: '{{kindred_handle}}', source: 'add_kindred', desc: 'Added kindred handle' },
                            { name: '{{souvenir_name}}', source: 'award_souvenir', desc: 'Awarded souvenir name' },
                            { name: '{{origin_spectrum}}', source: 'calculate_origin', desc: 'User origin values' }
                        ]
                    },
                    'paired': { 
                        desc: 'Pairs users together', 
                        hasParam: false 
                    },
                    'check_collaboration_partners': { 
                        desc: 'Checks for collaboration partners', 
                        hasParam: false 
                    },
                    'calculate_origin': { 
                        desc: 'Calculates and stores user origin', 
                        hasParam: false 
                    },
                    'greet_newcomer': { 
                        desc: 'Sends greeting to new user', 
                        hasParam: false,
                        hasPreview: true
                    },
                    'declare_origin': { 
                        desc: 'Declares user origin publicly', 
                        hasParam: false,
                        hasPreview: true
                    }
                };
                
                const info = commandInfo[commandType] || { desc: 'Unknown command', hasParam: false };
                
                // Determine category for color coding
                let category = 'default';
                if (commandType === 'award_souvenir') {
                    category = 'souvenir';
                } else if (['like_post', 'reply_post', 'reply_origin_spectrum'].includes(commandType)) {
                    category = 'bluesky';
                } else if (commandType === 'add_canon') {
                    category = 'heading';
                } else if (['name_dreamer', 'register_if_needed', 'registration_check', 'paired', 'add_kindred'].includes(commandType)) {
                    category = 'registration';
                } else if (['add_name', 'calculate_origin', 'mod_spectrum'].includes(commandType)) {
                    category = 'lore';
                } else if (commandType === 'disable_quest') {
                    category = 'disable';
                } else if (['greet_newcomer', 'declare_origin', 'check_collaboration_partners'].includes(commandType)) {
                    category = 'work';
                }
                
                return `
                    <div class="command-card-edit category-${category}">
                        <div class="command-header">
                            <label class="command-label">Command Type</label>
                            <select class="command-select" 
                                    data-quest-title="${escapeHtml(quest.title)}" 
                                    data-index="${index}">
                                <option value="name_dreamer" ${commandType === 'name_dreamer' ? 'selected' : ''}>Name Dreamer</option>
                                <option value="registration_check" ${commandType === 'registration_check' ? 'selected' : ''}>Registration Check</option>
                                <option value="register_if_needed" ${commandType === 'register_if_needed' ? 'selected' : ''}>Register If Needed (legacy)</option>
                                <option value="add_kindred" ${commandType === 'add_kindred' ? 'selected' : ''}>Add Kindred</option>
                                <option value="like_post" ${commandType === 'like_post' ? 'selected' : ''}>Like Post</option>
                                <option value="add_canon" ${commandType === 'add_canon' ? 'selected' : ''}>Add Event</option>
                                <option value="add_name" ${commandType === 'add_name' ? 'selected' : ''}>Add Name</option>
                                <option value="disable_quest" ${commandType === 'disable_quest' ? 'selected' : ''}>Disable Quest</option>
                                <option value="mod_spectrum" ${commandType === 'mod_spectrum' ? 'selected' : ''}>Modify Spectrum</option>
                                <option value="award_souvenir" ${commandType === 'award_souvenir' ? 'selected' : ''}>Award Souvenir</option>
                                <option value="reply_origin_spectrum" ${commandType === 'reply_origin_spectrum' ? 'selected' : ''}>Reply Origin Spectrum</option>
                                <option value="reply_post" ${commandType === 'reply_post' ? 'selected' : ''}>Reply to Post</option>
                                <option value="paired" ${commandType === 'paired' ? 'selected' : ''}>Paired</option>
                                <option value="check_collaboration_partners" ${commandType === 'check_collaboration_partners' ? 'selected' : ''}>Check Collaboration Partners</option>
                                <option value="calculate_origin" ${commandType === 'calculate_origin' ? 'selected' : ''}>Calculate Origin</option>
                                <option value="greet_newcomer" ${commandType === 'greet_newcomer' ? 'selected' : ''}>Greet Newcomer</option>
                                <option value="declare_origin" ${commandType === 'declare_origin' ? 'selected' : ''}>Declare Origin</option>
                            </select>
                        </div>
                        <div class="command-description">${info.desc}</div>
                        ${info.hasCanonEditor ? `
                        <div class="canon-editor">
                            <div class="canon-field-row">
                                <div class="canon-field">
                                    <label class="canon-label">Key</label>
                                    <select class="canon-key-select" data-quest-title="${escapeHtml(quest.title)}" data-index="${index}">
                                        ${(() => {
                                            const parts = commandParams ? commandParams.split(':') : [];
                                            const currentKey = parts[0] || '';
                                            const knownKeys = ['bell', 'origin', 'prepare', 'invite', 'ansible', 'watson', 'name'];
                                            const isCustomKey = currentKey && !knownKeys.includes(currentKey);
                                            
                                            let options = '<option value="">Select a key...</option>';
                                            options += knownKeys.map(key => {
                                                const selected = currentKey === key ? 'selected' : '';
                                                return `<option value="${key}" ${selected}>${key}</option>`;
                                            }).join('');
                                            
                                            if (isCustomKey) {
                                                options += `<option value="${escapeHtml(currentKey)}" selected>${escapeHtml(currentKey)}</option>`;
                                            }
                                            
                                            options += '<option value="__custom__">Other (enter custom)...</option>';
                                            return options;
                                        })()}
                                    </select>
                                    <input type="text" 
                                           class="canon-key-custom" 
                                           data-quest-title="${escapeHtml(quest.title)}" 
                                           data-index="${index}"
                                           style="display: none;"
                                           placeholder="Enter custom key">
                                </div>
                                <div class="canon-field">
                                    <label class="canon-label">Type</label>
                                    <select class="canon-type-select" data-quest-title="${escapeHtml(quest.title)}" data-index="${index}">
                                        ${(() => {
                                            const parts = commandParams ? commandParams.split(':') : [];
                                            const currentType = parts[2] || 'event';
                                            const knownTypes = ['event', 'arrival', 'souvenir', 'nightmare', 'trait', 'relationship', 'possession', 'memory', 'belief'];
                                            const isCustomType = currentType && !knownTypes.includes(currentType);
                                            
                                            let options = knownTypes.map(type => {
                                                const selected = currentType === type ? 'selected' : '';
                                                return `<option value="${type}" ${selected}>${type.charAt(0).toUpperCase() + type.slice(1)}</option>`;
                                            }).join('');
                                            
                                            if (isCustomType) {
                                                options += `<option value="${escapeHtml(currentType)}" selected>${escapeHtml(currentType)}</option>`;
                                            }
                                            
                                            options += '<option value="__custom__">Other (enter custom)...</option>';
                                            return options;
                                        })()}
                                    </select>
                                    <input type="text" 
                                           class="canon-type-custom" 
                                           data-quest-title="${escapeHtml(quest.title)}" 
                                           data-index="${index}"
                                           style="display: none;"
                                           placeholder="Enter custom type">
                                </div>
                            </div>
                            <div class="canon-field">
                                <label class="canon-label">Event Description</label>
                                <input type="text" 
                                       class="canon-event-input" 
                                       data-quest-title="${escapeHtml(quest.title)}" 
                                       data-index="${index}"
                                       value="${(() => {
                                           if (!commandParams) return '';
                                           const parts = commandParams.split(':');
                                           return escapeHtml(parts[1] || '');
                                       })()}" 
                                       placeholder="e.g., answered the call, received a letter">
                            </div>
                            <div class="canon-field">
                                <label class="canon-label">Row Style (optional)</label>
                                <select class="canon-rowstyle-select" data-quest-title="${escapeHtml(quest.title)}" data-index="${index}">
                                    ${(() => {
                                        const parts = commandParams ? commandParams.split(':') : [];
                                        const currentRowstyle = parts[3] || '';
                                        return generateRowstyleOptions(currentRowstyle);
                                    })()}
                                </select>
                            </div>
                            <div class="canon-preview" data-index="${index}">
                                <div class="canon-preview-loading">Configure event to see preview...</div>
                            </div>
                            <button class="canon-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-index="${index}">Save Event Entry</button>
                        </div>
                        ` : info.hasParam ? `
                        <div class="command-param-field">
                            <label class="command-label">${info.paramLabel}</label>
                            <input type="text" 
                                   class="command-input" 
                                   data-quest-title="${escapeHtml(quest.title)}" 
                                   data-index="${index}"
                                   value="${escapeHtml(commandParams)}" 
                                   placeholder="${info.paramPlaceholder}">
                            <button class="command-save-btn" data-quest-title="${escapeHtml(quest.title)}" data-index="${index}">Save Parameters</button>
                            ${info.hasVariableHints ? `
                            <div class="variable-hints">
                                <div class="hints-header">Available variables:</div>
                                <div class="hints-list">
                                    ${info.variables.map(v => `
                                        <div class="hint-item">
                                            <code class="hint-var">${v.name}</code>
                                            <span class="hint-desc">${v.desc}</span>
                                            <span class="hint-source">from: ${v.source}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        ` : ''}
                        ${commandType === 'award_souvenir' && commandParams ? `
                        <div class="souvenir-preview" data-souvenir-key="${escapeHtml(commandParams)}">
                            <div class="souvenir-loading">Loading souvenir preview...</div>
                        </div>
                        ` : ''}
                        ${commandType === 'greet_newcomer' ? `
                        <div class="greeter-preview" data-loading="true">
                            <div class="greeter-loading">Loading greeter info...</div>
                        </div>
                        ` : ''}
                        ${commandType === 'declare_origin' ? `
                        <div class="mapper-preview" data-loading="true">
                            <div class="mapper-loading">Loading mapper info...</div>
                        </div>
                        ` : ''}
                        <div class="command-actions">
                            <button class="command-btn danger" onclick="deleteCommand('${escapeHtml(quest.title)}', ${index})">Delete</button>
                        </div>
                        <div class="raw-panel command-raw">
                            <div class="raw-panel-label">Raw JSON</div>
                            <pre class="raw-panel-code">${escapeHtml(commandRaw)}</pre>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        const html = `
            <div class="quest-detail-header">
                <div class="quest-detail-title-section">
                    <h2 class="quest-detail-title editable" title="Click to edit title">${escapeHtml(quest.title)}</h2>
                    <p class="quest-detail-description editable" title="Click to edit description">${escapeHtml(quest.description || 'Click to add description')}</p>
                </div>
                <div class="quest-detail-actions">
                    <button class="quest-action-btn primary" onclick="toggleQuestStatusFromDetail('${escapeHtml(quest.title)}', ${!quest.enabled})">
                        ${quest.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button class="quest-action-btn danger" onclick="deleteQuestFromDetail('${escapeHtml(quest.title)}')">Delete</button>
                </div>
                <div class="quest-detail-meta">
                    <span>Created: ${quest.created_at ? new Date(quest.created_at * 1000).toLocaleDateString() : 'Unknown'}</span>
                    <span>Status: <strong style="color: var(--${statusClass}-color);">${quest.enabled ? 'Active' : 'Disabled'}</strong></span>
                </div>
            </div>
            
            <div class="quest-section">
                <h3 class="quest-section-title">Trigger Configuration</h3>
                <div class="trigger-config-form">
                    <div class="form-row">
                        <div class="form-group" style="flex: 2;">
                            <label>Trigger Type</label>
                            <select class="trigger-type-dropdown" data-quest-title="${escapeHtml(quest.title)}">
                                <option value="bsky_reply" ${quest.trigger_type === 'bsky_reply' ? 'selected' : ''}>Bluesky Reply Monitor</option>
                                <option value="firehose_phrase" ${quest.trigger_type === 'firehose_phrase' ? 'selected' : ''}>Phrase/Hashtag Monitor</option>
                                <option value="poll" ${quest.trigger_type === 'poll' ? 'selected' : ''}>API Polling</option>
                                <option value="webhook" ${quest.trigger_type === 'webhook' ? 'selected' : ''}>HTTP Webhook</option>
                                <option value="cron" ${quest.trigger_type === 'cron' ? 'selected' : ''}>Time-Based Schedule</option>
                                <option value="database_watch" ${quest.trigger_type === 'database_watch' ? 'selected' : ''}>Database Monitor</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex: 0;">
                            <label>&nbsp;</label>
                            <button class="trigger-reset-btn" onclick="deleteTrigger('${escapeHtml(quest.title)}')" title="Reset trigger configuration">Reset</button>
                        </div>
                    </div>
                    
                    <div class="trigger-config-details">
                        ${triggerConfigHtml || '<div class="no-config-message">Select a trigger type and configure its parameters above</div>'}
                    </div>
                    
                    ${quest.trigger_type === 'bsky_reply' && quest.group_uri ? `
                    <div class="bsky-post-preview" id="bsky-preview-${escapeHtml(quest.title.replace(/\s/g, '-'))}">
                        <div class="preview-loading">Loading post preview...</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="quest-section">
                <div class="quest-section-header">
                    <h3 class="quest-section-title">Conditions</h3>
                    <button class="add-condition-btn-header" onclick="addCondition('${escapeHtml(quest.title)}')">+ Add</button>
                </div>
                <div class="conditions-list">
                    ${conditionsHtml || '<div style="color: var(--text-secondary); padding: 1rem; text-align: center;">No conditions defined</div>'}
                    <button class="add-condition-btn" onclick="addCondition('${escapeHtml(quest.title)}')">+ Add Condition</button>
                </div>
            </div>
            
            <div class="quest-section">
                <div class="quest-section-header">
                    <h3 class="quest-section-title">Commands</h3>
                    <button class="add-command-btn-header" onclick="addCommand('${escapeHtml(quest.title)}')">+ Add</button>
                </div>
                <div class="commands-list">
                    ${commandsHtml || '<div style="color: var(--text-secondary); padding: 1rem; text-align: center;">No commands defined</div>'}
                    <button class="add-command-btn" onclick="addCommand('${escapeHtml(quest.title)}')">+ Add Command</button>
                </div>
            </div>
            
            <div class="quest-section">
                <h3 class="quest-section-title">Dry Run</h3>
                <div class="worker-preview" data-dryrun-for="${escapeHtml(quest.title)}">
                    <div class="form-group">
                        <label>Sample Author Handle</label>
                        <input class="form-input dryrun-handle" data-quest-title="${escapeHtml(quest.title)}" placeholder="@example.bsky.social" value="@example.bsky.social">
                    </div>
                    <div class="form-group">
                        <label>Sample Post Text</label>
                        <textarea class="form-input dryrun-text" data-quest-title="${escapeHtml(quest.title)}" rows="3" placeholder="Example reply text...">${escapeHtml('')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Additional JSON Payload (optional)</label>
                        <textarea class="form-input dryrun-json" data-quest-title="${escapeHtml(quest.title)}" rows="3" placeholder='{"extra": "value"}'></textarea>
                    </div>
                    <div style="display:flex;gap:0.5rem;align-items:center;">
                        <button class="command-btn run-dry-run" data-quest-title="${escapeHtml(quest.title)}">Run Dry Run</button>
                        <button class="quest-action-btn" onclick="loadQuests()">Refresh Quests</button>
                    </div>
                    <pre class="dryrun-result" data-quest-title="${escapeHtml(quest.title)}" style="white-space:pre-wrap;margin-top:1rem;background:#f8fafc;padding:1rem;border:1px solid #e6eefc;max-height:300px;overflow:auto;">Dry run result will appear here</pre>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Attach event listener to trigger type dropdown
        const triggerDropdown = container.querySelector('.trigger-type-dropdown');
        if (triggerDropdown) {
            triggerDropdown.addEventListener('change', async (e) => {
                const newTriggerType = e.target.value;
                console.log('[QuestManager] Trigger type changed to:', newTriggerType);
                await updateTriggerType(quest.title, newTriggerType);
            });
        }
        
        // Attach event listeners to all config inputs for auto-save
        const configInputs = container.querySelectorAll('.config-input, .config-textarea, .config-select, .config-checkbox');
        configInputs.forEach(input => {
            // Remove blur event listeners - we'll use save buttons instead
            // Just keep checkboxes with change for immediate feedback
            if (input.type === 'checkbox') {
                // Checkboxes still auto-save for better UX
                input.addEventListener('change', async (e) => {
                    const questTitle = e.target.dataset.questTitle;
                    const field = e.target.dataset.field;
                    console.log('[QuestManager] Config field changed:', field, 'for quest:', questTitle);
                    await saveTriggerConfigField(questTitle, field, e.target);
                });
            }
        });
        
        // Attach event listeners to save buttons
        const saveBtns = container.querySelectorAll('.config-save-btn');
        saveBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const questTitle = e.target.dataset.questTitle;
                const field = e.target.dataset.field;
                const triggerType = e.target.dataset.triggerType;
                
                console.log('[QuestManager] Save button clicked for quest:', questTitle);
                
                if (field) {
                    // Single field save (e.g., URI for bsky_reply)
                    const input = container.querySelector(`.config-input[data-field="${field}"]`);
                    if (input) {
                        await saveTriggerConfigField(questTitle, field, input);
                    }
                } else if (triggerType) {
                    // Multi-field save (e.g., firehose_phrase, poll, etc.)
                    await saveTriggerConfigFields(questTitle, triggerType, container);
                }
            });
        });
        
        // Attach event listeners to condition selects and inputs
        const conditionSelects = container.querySelectorAll('.condition-select');
        conditionSelects.forEach(select => {
            select.addEventListener('change', async (e) => {
                const questTitle = e.target.dataset.questTitle;
                const index = parseInt(e.target.dataset.index);
                console.log('[QuestManager] Condition type changed:', e.target.value, 'for quest:', questTitle, 'index:', index);
                await updateConditionType(questTitle, index, e.target.value);
            });
        });
        
        // Attach event listeners to condition save buttons (not auto-save on blur anymore)
        const conditionSaveBtns = container.querySelectorAll('.condition-save-btn');
        conditionSaveBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const questTitle = e.target.dataset.questTitle;
                const index = parseInt(e.target.dataset.index);
                const input = container.querySelector(`.condition-input[data-index="${index}"]`);
                if (input) {
                    console.log('[QuestManager] Condition save button clicked:', input.value, 'for quest:', questTitle, 'index:', index);
                    await updateConditionValue(questTitle, index, input.value);
                }
            });
        });
        
        // Attach event listeners to command selects and save buttons
        const commandSelects = container.querySelectorAll('.command-select');
        commandSelects.forEach(select => {
            select.addEventListener('change', async (e) => {
                const questTitle = e.target.dataset.questTitle;
                const index = parseInt(e.target.dataset.index);
                console.log('[QuestManager] Command type changed:', e.target.value, 'for quest:', questTitle, 'index:', index);
                await updateCommandType(questTitle, index, e.target.value);
            });
        });
        
        const commandSaveBtns = container.querySelectorAll('.command-save-btn');
        commandSaveBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const questTitle = e.target.dataset.questTitle;
                const index = parseInt(e.target.dataset.index);
                const input = container.querySelector(`.command-input[data-index="${index}"]`);
                if (input) {
                    console.log('[QuestManager] Command save button clicked:', input.value, 'for quest:', questTitle, 'index:', index);
                    await updateCommandParams(questTitle, index, input.value);
                }
            });
        });
        
        // Canon editor save buttons
        const canonSaveBtns = container.querySelectorAll('.canon-save-btn');
        canonSaveBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const questTitle = e.target.dataset.questTitle;
                const index = parseInt(e.target.dataset.index);
                
                const keySelect = container.querySelector(`.canon-key-select[data-index="${index}"]`);
                const keyCustom = container.querySelector(`.canon-key-custom[data-index="${index}"]`);
                const eventInput = container.querySelector(`.canon-event-input[data-index="${index}"]`);
                const typeSelect = container.querySelector(`.canon-type-select[data-index="${index}"]`);
                const typeCustom = container.querySelector(`.canon-type-custom[data-index="${index}"]`);
                const rowstyleSelect = container.querySelector(`.canon-rowstyle-select[data-index="${index}"]`);
                
                if (keySelect && eventInput && typeSelect) {
                    // Get key value (from dropdown or custom input)
                    let keyValue = keySelect.value;
                    if (keyValue === '__custom__' && keyCustom) {
                        keyValue = keyCustom.value;
                    }
                    
                    // Get type value (from dropdown or custom input)
                    let typeValue = typeSelect.value;
                    if (typeValue === '__custom__' && typeCustom) {
                        typeValue = typeCustom.value;
                    }
                    
                    // Format as key:event:type[:rowstyle] (rowstyle is optional 4th param)
                    let canonParam = `${keyValue}:${eventInput.value}:${typeValue}`;
                    if (rowstyleSelect && rowstyleSelect.value) {
                        canonParam += `:${rowstyleSelect.value}`;
                    }
                    console.log('[QuestManager] Canon save button clicked:', canonParam, 'for quest:', questTitle, 'index:', index);
                    await updateCommandParams(questTitle, index, canonParam);
                }
            });
        });
        
        // Canon dropdown change listeners to show/hide custom inputs
        const canonKeySelects = container.querySelectorAll('.canon-key-select');
        canonKeySelects.forEach(select => {
            select.addEventListener('change', (e) => {
                const index = e.target.dataset.index;
                const customInput = container.querySelector(`.canon-key-custom[data-index="${index}"]`);
                if (customInput) {
                    customInput.style.display = e.target.value === '__custom__' ? 'block' : 'none';
                    if (e.target.value === '__custom__') {
                        customInput.focus();
                    }
                }
                updateCanonPreview(container, index);
            });
        });
        
        const canonTypeSelects = container.querySelectorAll('.canon-type-select');
        canonTypeSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                const index = e.target.dataset.index;
                const customInput = container.querySelector(`.canon-type-custom[data-index="${index}"]`);
                if (customInput) {
                    customInput.style.display = e.target.value === '__custom__' ? 'block' : 'none';
                    if (e.target.value === '__custom__') {
                        customInput.focus();
                    }
                }
                updateCanonPreview(container, index);
            });
        });
        
        // Canon editor input listeners for live preview
        const canonInputs = container.querySelectorAll('.canon-key-select, .canon-key-custom, .canon-event-input, .canon-type-select, .canon-type-custom, .canon-rowstyle-select');
        canonInputs.forEach(input => {
            input.addEventListener('input', () => {
                const index = input.dataset.index;
                updateCanonPreview(container, index);
            });
            input.addEventListener('change', () => {
                const index = input.dataset.index;
                updateCanonPreview(container, index);
            });
        });
        
        // Set rowstyle dropdown values from saved command params
        quest.commands.forEach((cmd, index) => {
            if (typeof cmd === 'string' && cmd.startsWith('add_canon:')) {
                const params = cmd.split(':').slice(1); // Remove 'add_canon'
                const rowstyle = params[3] || ''; // 4th param is rowstyle
                const rowstyleSelect = container.querySelector(`.canon-rowstyle-select[data-index="${index}"]`);
                if (rowstyleSelect && rowstyle) {
                    rowstyleSelect.value = rowstyle;
                }
            }
        });
        
        // Initial load of canon previews
        loadCanonPreviews(container);
        
        // Load Bluesky post preview if applicable
        if (quest.trigger_type === 'bsky_reply' && quest.group_uri) {
            loadBskyPostPreview(quest.title, quest.group_uri);
        }
        
        // Load souvenir previews if any award_souvenir commands exist
        if (commandsHtml && commandsHtml.includes('souvenir-preview')) {
            loadSouvenirPreviews();
        }
        
        // Load worker previews if any greeter/mapper commands exist
        if (commandsHtml && (commandsHtml.includes('greeter-preview') || commandsHtml.includes('mapper-preview'))) {
            loadWorkerPreviews();
        }
        
        // Attach click handlers to editable title and description
        const titleEl = container.querySelector('.quest-detail-title');
        const descEl = container.querySelector('.quest-detail-description');
        
        if (titleEl) {
            titleEl.addEventListener('click', () => {
                console.log('[QuestManager] Title clicked for editing');
                const newTitle = prompt('Quest Title:', quest.title);
                if (newTitle && newTitle !== quest.title) {
                    updateQuestMetadata(quest.title, newTitle, quest.description);
                }
            });
        }
        
        if (descEl) {
            descEl.addEventListener('click', () => {
                console.log('[QuestManager] Description clicked for editing');
                const currentDesc = quest.description || '';
                const newDesc = prompt('Quest Description:', currentDesc);
                if (newDesc !== null && newDesc !== currentDesc) {
                    updateQuestMetadata(quest.title, quest.title, newDesc);
                }
            });
        }

        // Attach dry-run handlers
        const runDryBtns = container.querySelectorAll('.run-dry-run');
        runDryBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const questTitle = e.target.dataset.questTitle;
                const parent = container.querySelector(`[data-dryrun-for="${escapeHtml(quest.title)}"]`);
                const handleInput = parent.querySelector('.dryrun-handle');
                const textInput = parent.querySelector('.dryrun-text');
                const jsonInput = parent.querySelector('.dryrun-json');
                const resultEl = parent.querySelector('.dryrun-result');

                resultEl.textContent = 'Running dry run...';

                const sample = {
                    handle: handleInput ? handleInput.value : '',
                    text: textInput ? textInput.value : ''
                };

                if (jsonInput && jsonInput.value) {
                    try {
                        sample.extra = JSON.parse(jsonInput.value);
                    } catch (err) {
                        resultEl.textContent = 'Invalid JSON payload: ' + err.message;
                        return;
                    }
                }

                try {
                    const payload = { title: quest.title, quest: quest, sample };
                    const response = await authenticatedFetch('/api/quests/dry_run', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const body = await response.text();
                        resultEl.textContent = `Dry run failed: ${response.status} ${body}`;
                        return;
                    }

                    const data = await response.json();
                    resultEl.textContent = JSON.stringify(data, null, 2);
                } catch (err) {
                    console.error('[QuestManager] Dry run error:', err);
                    resultEl.textContent = 'Dry run error: ' + err.message;
                }
            });
        });
    }
    
    async function loadSouvenirPreviews() {
        try {
            const response = await authenticatedFetch('/api/souvenirs');
            if (!response.ok) {
                console.error('[QuestManager] Failed to load souvenirs, status:', response.status);
                return;
            }
            const souvenirs = await response.json();
            console.log('[QuestManager] Loaded souvenirs:', Object.keys(souvenirs).length);
            
            // Find all souvenir preview elements
            document.querySelectorAll('.souvenir-preview[data-souvenir-key]').forEach(element => {
                const key = element.getAttribute('data-souvenir-key');
                const souvenir = souvenirs[key];
                
                if (souvenir) {
                    const keepersCount = souvenir.keepers ? souvenir.keepers.length : 0;
                    const monthsOld = souvenir.epoch ? 
                        Math.floor((Date.now() / 1000 - souvenir.epoch) / (30 * 24 * 60 * 60)) : 0;
                    
                    const phanera = souvenir.phanera || `/souvenirs/${key}/phanera.png`;
                    const icon = souvenir.icon || `/souvenirs/${key}/icon.png`;
                    
                    element.innerHTML = `
                        <div class="souvenir-header">
                            <span class="souvenir-name">${escapeHtml(souvenir.name)}</span>
                            <span class="souvenir-key">(${escapeHtml(key)})</span>
                        </div>
                        <div class="souvenir-description">${escapeHtml(souvenir.description || '')}</div>
                        <a href="/souvenirs?key=${encodeURIComponent(key)}" target="_blank" style="text-decoration: none; color: inherit;">
                            <div class="souvenir-image-container">
                                <img class="souvenir-phanera" src="${phanera}" alt="${escapeHtml(souvenir.name)}" loading="lazy">
                                <div class="souvenir-icon-overlay">
                                    <img src="${icon}" alt="${escapeHtml(souvenir.name)} icon" loading="lazy">
                                </div>
                            </div>
                        </a>
                        <div class="souvenir-keepers">${keepersCount} keeper${keepersCount !== 1 ? 's' : ''} ${monthsOld > 0 ? `of ${monthsOld} month${monthsOld !== 1 ? 's' : ''}` : ''}</div>
                    `;
                } else {
                    element.innerHTML = `
                        <div class="souvenir-key">${escapeHtml(key)}</div>
                        <div style="color: #64748b; font-size: 0.85rem;">Souvenir not found</div>
                    `;
                }
            });
        } catch (err) {
            console.error('[QuestManager] Failed to load souvenir previews:', err);
            document.querySelectorAll('.souvenir-preview[data-souvenir-key]').forEach(element => {
                element.innerHTML = '<div style="color: #64748b; font-size: 0.85rem;">Failed to load souvenir preview</div>';
            });
        }
    }
    
    function updateCanonPreview(container, index) {
        const keySelect = container.querySelector(`.canon-key-select[data-index="${index}"]`);
        const keyCustom = container.querySelector(`.canon-key-custom[data-index="${index}"]`);
        const eventInput = container.querySelector(`.canon-event-input[data-index="${index}"]`);
        const typeSelect = container.querySelector(`.canon-type-select[data-index="${index}"]`);
        const typeCustom = container.querySelector(`.canon-type-custom[data-index="${index}"]`);
        const rowstyleSelect = container.querySelector(`.canon-rowstyle-select[data-index="${index}"]`);
        const previewDiv = container.querySelector(`.canon-preview[data-index="${index}"]`);
        
        if (!keySelect || !eventInput || !typeSelect || !previewDiv) return;
        
        // Get key value (from dropdown or custom input)
        let key = keySelect.value;
        if (key === '__custom__' && keyCustom) {
            key = keyCustom.value.trim();
        }
        
        // Get type value (from dropdown or custom input)
        let type = typeSelect.value;
        if (type === '__custom__' && typeCustom) {
            type = typeCustom.value.trim();
        }
        
        const event = eventInput.value.trim();
        const rowstyle = rowstyleSelect ? rowstyleSelect.value : '';
        
        if (!key || !event || key === '__custom__' || type === '__custom__') {
            previewDiv.innerHTML = '<div class="canon-preview-loading">Configure event to see preview...</div>';
            return;
        }
        
        // Get rowstyle definition from registry if available
        let rowClasses = ['row-entry'];
        let rowStyles = [];
        let rowstyleInfo = null;
        
        if (rowstyle && window.RowStyleRegistry && window.RowStyleRegistry[rowstyle]) {
            rowstyleInfo = window.RowStyleRegistry[rowstyle];
            rowClasses = [...rowstyleInfo.rendering.cssClasses];
            
            // Add CSS variables from rowstyle
            rowstyleInfo.rendering.cssVariables.forEach(varName => {
                const varValue = getComputedStyle(document.documentElement).getPropertyValue(varName);
                if (varValue) {
                    rowStyles.push(`${varName}: ${varValue}`);
                }
            });
        } else if (rowstyle) {
            // Fallback for basic styles if registry not available
            if (rowstyle === 'canon') {
                rowClasses.push('color-user', 'intensity-special', 'event-key-canon');
            } else if (rowstyle === 'userhigh') {
                rowClasses.push('color-user', 'intensity-highlight');
            } else if (rowstyle === 'user') {
                rowClasses.push('color-user', 'intensity-none');
            } else if (rowstyle === 'dream') {
                rowClasses.push('event-key-dream', 'color-user', 'intensity-special');
            }
        } else {
            // Default: user color with highlight
            rowClasses.push('color-user', 'intensity-highlight');
        }
        
        // Add event-key class
        if (key) rowClasses.push(`event-key-${key}`);
        
        // Get current user color from color manager if available
        const userColor = window.colorManager?.color || '#8b7355';
        rowStyles.push(`--user-color: ${userColor}`);
        
        // Build preview matching eventstack.js structure exactly
        const dateStr = '12/12/25 17:30';
        const avatar = '/assets/icon_face.png';
        const name = 'Example User';
        
        const rowStyleAttr = rowStyles.length > 0 ? ` style="${rowStyles.join('; ')}"` : '';
        
        let html = `<div class="canon-preview-label">Preview:</div>`;
        html += `<div class="${rowClasses.join(' ')}"${rowStyleAttr}>`;
        
        // Epoch cell
        html += `<div class="cell epoch">${dateStr}</div>`;
        
        // Thread arrow cell (empty spacer for alignment)
        html += `<div class="cell thread-arrow"></div>`;
        
        // Avatar cell
        const avatarStyle = ` style="margin-left: 12px;"`;
        html += `<div class="cell avatar"${avatarStyle}>`;
        html += `<img src="${avatar}" class="avatar-img" alt="avatar" onerror="this.src='/assets/icon_face.png'">`;
        html += `</div>`;
        
        // Canon cell
        const canonStyle = ` style="padding-left: 12px;"`;
        const nameSpan = `<span style="font-weight: 500;">${name}</span>`;
        const eventSpan = `<span style="font-style: italic; color: var(--text-secondary);">${escapeHtml(event)}</span>`;
        html += `<div class="cell canon"${canonStyle}><span style="white-space: normal;">${nameSpan} ${eventSpan}</span></div>`;
        
        html += `</div>`;
        
        // Add metadata below with rowstyle info
        html += `<div class="canon-preview-meta">`;
        html += `<span>Type: <strong>${type}</strong></span>`;
        html += `<span>Key: <strong>${key}</strong></span>`;
        if (rowstyle) {
            html += `<span>Style: <strong>${rowstyle}</strong></span>`;
            if (rowstyleInfo) {
                html += `<span class="rowstyle-category">${rowstyleInfo.category}</span>`;
            }
        }
        html += `</div>`;
        
        previewDiv.innerHTML = html;
    }
    
    function loadCanonPreviews(container) {
        const canonPreviews = container.querySelectorAll('.canon-preview[data-index]');
        canonPreviews.forEach(previewDiv => {
            const index = previewDiv.dataset.index;
            updateCanonPreview(container, index);
        });
    }
    
    async function loadWorkerPreviews() {
        // Load greeter status (using same endpoint as work.html)
        const greeterElements = document.querySelectorAll('.greeter-preview[data-loading="true"]');
        if (greeterElements.length > 0) {
            try {
                const response = await authenticatedFetch('/api/work/greeter/status');
                const statusData = response.ok ? await response.json() : null;
                
                // Access workers from role_info like work.html does
                const workers = statusData?.role_info?.workers || [];
                const currentWorker = workers[0];
                
                greeterElements.forEach(async element => {
                    if (currentWorker && currentWorker.did) {
                        // Fetch greeter's profile, templates, and recent greetings in parallel
                        try {
                            const [dreamerResponse, templatesResponse, canonResponse] = await Promise.all([
                                authenticatedFetch(`/api/dreamers/${currentWorker.did}`),
                                authenticatedFetch('/api/work/greeter/templates'),
                                authenticatedFetch('/api/canon')
                            ]);
                            
                            const dreamer = dreamerResponse.ok ? await dreamerResponse.json() : null;
                            const templatesData = templatesResponse.ok ? await templatesResponse.json() : null;
                            const allEvents = canonResponse.ok ? await canonResponse.json() : [];
                            
                            const workerStatus = currentWorker.status || 'working';
                            
                            // Get a random greeting template
                            let greetingExample = 'Welcome, @dreamer.reverie.house!';
                            if (templatesData?.templates?.length > 0) {
                                const randomTemplate = templatesData.templates[Math.floor(Math.random() * templatesData.templates.length)];
                                greetingExample = randomTemplate.replace(/@\{handle\}/g, '@dreamer.reverie.house');
                            }
                            
                            // Get recent greeting events (greeter or name key)
                            const greetingEvents = allEvents
                                .filter(e => (e.key === 'greeter' || e.key === 'name') && !e.reaction_to)
                                .slice(0, 3);
                            
                            const guestbookHtml = greetingEvents.length > 0 ? `
                                <div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(255, 255, 255, 0.15); border-radius: 4px; max-height: 100px; overflow-y: auto;">
                                    <div style="font-size: 0.65rem; font-weight: 600; color: #5d4e3a; margin-bottom: 0.35rem; text-transform: uppercase; letter-spacing: 0.5px;">Recent Greetings</div>
                                    ${greetingEvents.map(e => `
                                        <div style="font-size: 0.65rem; color: #3d2e1a; padding: 0.25rem 0; border-bottom: 1px solid rgba(93, 78, 58, 0.1);">
                                            <div style="color: #7d6e5a;">${new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                            <div style="margin-top: 0.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.value}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : '';
                            
                            if (dreamer) {
                                element.innerHTML = `
                                    <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: rgba(255, 255, 255, 0.3); border-radius: 6px; border: 1px solid rgba(93, 78, 58, 0.2);">
                                        <img src="${dreamer.avatar || '/assets/icon.png'}" 
                                             alt="${dreamer.handle}"
                                             style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid rgba(93, 78, 58, 0.3);">
                                        <div style="flex: 1; min-width: 0;">
                                            <div style="font-size: 0.85rem; font-weight: 600; color: #3d2e1a; margin-bottom: 0.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                                @${dreamer.handle}
                                            </div>
                                            <div style="font-size: 0.7rem; color: #5d4e3a; text-transform: uppercase; letter-spacing: 0.5px;">
                                                ${workerStatus}
                                            </div>
                                        </div>
                                    </div>
                                    <div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(255, 255, 255, 0.2); border-radius: 4px; font-size: 0.7rem; color: #3d2e1a; line-height: 1.4;">
                                        ${greetingExample}
                                    </div>
                                    ${guestbookHtml}
                                `;
                            } else {
                                element.innerHTML = `
                                    <div style="padding: 0.75rem; background: rgba(255, 255, 255, 0.2); border-radius: 6px; border: 1px solid rgba(93, 78, 58, 0.2); color: #5d4e3a; font-size: 0.75rem; text-align: center;">
                                        Active greeter: ${currentWorker.did.substring(0, 20)}...
                                    </div>
                                `;
                            }
                        } catch (err) {
                            console.warn('Failed to load greeter data:', err);
                            element.innerHTML = `<div style="padding: 0.75rem; background: rgba(255, 255, 255, 0.2); border-radius: 6px; border: 1px solid rgba(200, 100, 100, 0.3); color: #8d5e5a; font-size: 0.75rem; text-align: center;">Greeter configured but profile unavailable</div>`;
                        }
                    } else {
                        element.innerHTML = `
                            <div style="padding: 1rem; background: rgba(255, 255, 255, 0.15); border-radius: 6px; border: 1px dashed rgba(93, 78, 58, 0.3); text-align: center;">
                                <div style="font-size: 0.8rem; font-weight: 600; color: #7d6e5a; margin-bottom: 0.25rem;">Position Vacant</div>
                                <div style="font-size: 0.65rem; color: #9d8e7a;">No active greeter assigned</div>
                            </div>
                        `;
                    }
                    
                    element.removeAttribute('data-loading');
                });
            } catch (err) {
                console.warn('Failed to load greeter data:', err);
                greeterElements.forEach(element => {
                    element.innerHTML = `<div style="color: #5d4e3a; font-size: 0.75rem;">Failed to load greeter info</div>`;
                    element.removeAttribute('data-loading');
                });
            }
        }
        
        // Load mapper status (using same endpoint as work.html)
        const mapperElements = document.querySelectorAll('.mapper-preview[data-loading="true"]');
        if (mapperElements.length > 0) {
            try {
                const response = await authenticatedFetch('/api/work/mapper/status');
                const statusData = response.ok ? await response.json() : null;
                
                // Access workers from role_info like work.html does
                const workers = statusData?.role_info?.workers || [];
                const currentWorker = workers[0];
                
                mapperElements.forEach(async element => {
                    if (currentWorker && currentWorker.did) {
                        // Fetch mapper's profile and recent origin events
                        try {
                            const [dreamerResponse, canonResponse] = await Promise.all([
                                authenticatedFetch(`/api/dreamers/${currentWorker.did}`),
                                authenticatedFetch('/api/canon')
                            ]);
                            
                            const dreamer = dreamerResponse.ok ? await dreamerResponse.json() : null;
                            const allEvents = canonResponse.ok ? await canonResponse.json() : [];
                            const workerStatus = currentWorker.status || 'working';
                            
                            // Get recent origin events (key === 'origin')
                            const originEvents = allEvents
                                .filter(e => e.key === 'origin' && !e.reaction_to)
                                .slice(0, 3);
                            
                            // Extract coordinates from event values (format: "O22 A11 S05 R88 L63 E71")
                            const recentOriginsHtml = originEvents.length > 0 ? `
                                <div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(255, 255, 255, 0.15); border-radius: 4px;">
                                    <div style="font-size: 0.65rem; font-weight: 600; color: #5d4e3a; margin-bottom: 0.35rem; text-transform: uppercase; letter-spacing: 0.5px;">Recent Mappings</div>
                                    ${originEvents.map(e => `
                                        <div style="font-size: 0.65rem; padding: 0.25rem 0; border-bottom: 1px solid rgba(93, 78, 58, 0.1);">
                                            <div style="color: #7d6e5a;">${new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                            <div style="font-family: 'Courier New', monospace; letter-spacing: 1px; color: #3d2e1a; margin-top: 0.1rem; font-size: 0.7rem;">
                                                ${e.value}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : '';
                            
                            if (dreamer) {
                                element.innerHTML = `
                                    <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: rgba(255, 255, 255, 0.3); border-radius: 6px; border: 1px solid rgba(93, 78, 58, 0.2);">
                                        <img src="${dreamer.avatar || '/assets/icon.png'}" 
                                             alt="${dreamer.handle}"
                                             style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid rgba(93, 78, 58, 0.3);">
                                        <div style="flex: 1; min-width: 0;">
                                            <div style="font-size: 0.85rem; font-weight: 600; color: #3d2e1a; margin-bottom: 0.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                                @${dreamer.handle}
                                            </div>
                                            <div style="font-size: 0.7rem; color: #5d4e3a; text-transform: uppercase; letter-spacing: 0.5px;">
                                                ${workerStatus}
                                            </div>
                                        </div>
                                    </div>
                                    <div style="margin-top: 0.5rem; padding: 0.6rem; background: rgba(255, 255, 255, 0.2); border-radius: 4px; text-align: center;">
                                        <div style="font-family: 'Courier New', monospace; letter-spacing: 1.5px; font-weight: 600; font-size: 0.8rem; color: #3d2e1a;">
                                            O22 A11 S05 R88 L63 E71
                                        </div>
                                        <div style="font-size: 0.6rem; color: #7d6e5a; margin-top: 0.25rem; letter-spacing: 0.5px;">OASRLE Format</div>
                                    </div>
                                    ${recentOriginsHtml}
                                `;
                            } else {
                                element.innerHTML = `
                                    <div style="padding: 0.75rem; background: rgba(255, 255, 255, 0.2); border-radius: 6px; border: 1px solid rgba(93, 78, 58, 0.2); color: #5d4e3a; font-size: 0.75rem; text-align: center;">
                                        Active mapper: ${currentWorker.did.substring(0, 20)}...
                                    </div>
                                `;
                            }
                        } catch (err) {
                            console.warn('Failed to load mapper data:', err);
                            element.innerHTML = `<div style="padding: 0.75rem; background: rgba(255, 255, 255, 0.2); border-radius: 6px; border: 1px solid rgba(200, 100, 100, 0.3); color: #8d5e5a; font-size: 0.75rem; text-align: center;">Mapper configured but profile unavailable</div>`;
                        }
                    } else {
                        element.innerHTML = `
                            <div style="padding: 1rem; background: rgba(255, 255, 255, 0.15); border-radius: 6px; border: 1px dashed rgba(93, 78, 58, 0.3); text-align: center;">
                                <div style="font-size: 0.8rem; font-weight: 600; color: #7d6e5a; margin-bottom: 0.5rem;">Position Vacant</div>
                                <div style="font-family: 'Courier New', monospace; letter-spacing: 1.5px; font-weight: 600; font-size: 0.75rem; color: #9d8e7a; opacity: 0.6;">
                                    O22 A11 S05 R88 L63 E71
                                </div>
                                <div style="font-size: 0.65rem; color: #9d8e7a; margin-top: 0.35rem;">
                                    No active mapper assigned
                                </div>
                            </div>
                        `;
                    }
                    
                    element.removeAttribute('data-loading');
                });
            } catch (err) {
                console.warn('Failed to load mapper data:', err);
                mapperElements.forEach(element => {
                    element.innerHTML = `
                        <div style="color: #5d4e3a; font-size: 0.75rem; font-weight: 600; text-align: center;">Position Vacant</div>
                        <div class="greeter-example" style="font-family: 'Courier New', monospace; letter-spacing: 1.5px; font-weight: 600; margin-top: 0.5rem; text-align: center; font-size: 0.8rem;">O22 A11 S05 R88 L63 E71</div>
                        <div style="font-size: 0.65rem; color: #5d4e3a; font-style: italic; margin-top: 0.25rem; text-align: center;">
                            Posts origin spectrum coordinates (OASRLE format)
                        </div>
                    `;
                    element.removeAttribute('data-loading');
                });
            }
        }
    }
    
    // Global functions for quest management
    window.toggleQuestStatusFromDetail = async function(questTitle, enable) {
        await toggleQuestStatus(questTitle, enable);
        // Reload and reselect
        await loadQuests();
        const quest = allQuests.find(q => q.title === questTitle);
        if (quest) selectQuest(quest);
    };
    
    async function toggleQuestStatus(questTitle, enable) {
        const action = enable ? 'enable' : 'disable';
        console.log(`[QuestManager] Toggling quest ${questTitle} to ${action}`);
        
        try {
            const quest = questDataMap[questTitle];
            if (!quest) {
                alert('Quest not found');
                return;
            }
            
            const payload = {
                enabled: enable,
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                commands: quest.commands,
                description: quest.description
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log(`[QuestManager] Quest ${action}d successfully`);
                // Update in dataMap
                if (questDataMap[questTitle]) {
                    questDataMap[questTitle].enabled = enable;
                }
                
                // Update in allQuests
                const quest = allQuests.find(q => q.title === questTitle);
                if (quest) {
                    quest.enabled = enable;
                }
            } else {
                const result = await response.json();
                console.error(`[QuestManager] Failed to ${action} quest:`, result);
                alert(`Failed to ${action} quest: ` + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error(`[QuestManager] Error ${action}ing quest:`, err);
            alert(`Error ${action}ing quest: ` + err.message);
        }
    }
    
    window.deleteQuestFromDetail = async function(questTitle) {
        await deleteQuest(questTitle);
        // Reload quests
        await loadQuests();
        // Clear detail view
        document.getElementById('quest-detail-container').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-text">Select a quest to view details</div>
            </div>
        `;
        selectedQuest = null;
    };
    
    async function deleteQuest(questTitle) {
        if (!confirm(`Delete quest "${questTitle}"?\n\nThis cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await authenticatedFetch(`/api/quests/delete/${encodeURIComponent(questTitle)}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Remove from arrays
                allQuests = allQuests.filter(q => q.title !== questTitle);
                delete questDataMap[questTitle];
            } else {
                const result = await response.json();
                alert('Failed to delete quest: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            alert('Error deleting quest: ' + err.message);
        }
    }
    
    async function deleteCondition(questTitle, index) {
        console.log('[QuestManager] deleteCondition called for:', questTitle, 'index:', index);
        if (!confirm(`Delete this condition from "${questTitle}"?`)) {
            console.log('[QuestManager] Delete condition cancelled by user');
            return;
        }
        
        try {
            const quest = window.questDataMap[questTitle];
            if (!quest) {
                alert('Quest not found');
                return;
            }
            
            // Support both array and single condition
            if (quest.conditions && Array.isArray(quest.conditions)) {
                quest.conditions.splice(index, 1);
                
                // Update primary condition for backward compatibility
                if (quest.conditions.length === 0) {
                    quest.conditions = null;
                    quest.condition = '';
                } else {
                    const firstCond = quest.conditions[0];
                    quest.condition = typeof firstCond === 'string' ? firstCond : firstCond.condition;
                }
            } else {
                quest.condition = '';
            }
            
            const payload = {
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Condition deleted successfully');
                // Reload and reselect
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to delete condition:', result);
                alert('Failed to delete condition: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error deleting condition:', err);
            alert('Error deleting condition: ' + err.message);
        }
    }

    window.deleteCondition = deleteCondition;

    window.editQuestMetadata = function(questTitle) {
        const quest = questDataMap[questTitle];
        if (!quest) {
            alert('Quest not found');
            return;
        }
        
        const newTitle = prompt('Quest Title:', quest.title);
        if (!newTitle || newTitle === quest.title) return;
        
        const newDescription = prompt('Description:', quest.description || '');
        
        updateQuestMetadata(questTitle, newTitle, newDescription);
    };
    
    async function updateQuestMetadata(oldTitle, newTitle, newDescription) {
        console.log('[QuestManager] Updating quest metadata:', oldTitle, '->', newTitle);
        console.log('[QuestManager] Old title:', JSON.stringify(oldTitle));
        console.log('[QuestManager] New title:', JSON.stringify(newTitle));
        console.log('[QuestManager] Are they equal?', oldTitle === newTitle);
        
        try {
            const quest = questDataMap[oldTitle];
            if (!quest) {
                console.error('[QuestManager] Quest not found:', oldTitle);
                alert('Quest not found');
                return;
            }
            
            const payload = {
                new_title: newTitle,
                description: newDescription,
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                commands: quest.commands,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending metadata update payload:', payload);
            console.log('[QuestManager] Payload new_title:', JSON.stringify(payload.new_title));
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(oldTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('[QuestManager] Metadata update response:', result);
                
                // Update session storage with new title before reload
                sessionStorage.setItem('selected_quest_title', newTitle);
                
                // The API might return the updated quest data
                if (result.quest) {
                    console.log('[QuestManager] Using quest data from API response:', result.quest.title);
                    // Update local data structures immediately
                    delete questDataMap[oldTitle];
                    questDataMap[newTitle] = result.quest;
                    
                    // Update allQuests array
                    const questIndex = allQuests.findIndex(q => q.title === oldTitle);
                    if (questIndex !== -1) {
                        allQuests[questIndex] = result.quest;
                    }
                    
                    selectQuest(result.quest);
                } else {
                    console.log('[QuestManager] No quest in response, reloading all quests');
                    
                    // Add a small delay to allow backend to commit the change
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    await loadQuests();
                    console.log('[QuestManager] After loadQuests, allQuests titles:', allQuests.map(q => q.title));
                    
                    // Try new title first
                    let updatedQuest = allQuests.find(q => q.title === newTitle);
                    console.log('[QuestManager] Searching for newTitle:', newTitle);
                    
                    // If not found by new title, try old title (backend might not have updated yet)
                    if (!updatedQuest) {
                        console.warn('[QuestManager] New title not found, trying old title:', oldTitle);
                        updatedQuest = allQuests.find(q => q.title === oldTitle);
                    }
                    
                    if (updatedQuest) {
                        console.log('[QuestManager] Found quest:', updatedQuest.title);
                        
                        // If we found it by old title, manually update the local data
                        if (updatedQuest.title === oldTitle && newTitle !== oldTitle) {
                            console.log('[QuestManager] Manually updating quest title in local data');
                            updatedQuest.title = newTitle;
                            delete questDataMap[oldTitle];
                            questDataMap[newTitle] = updatedQuest;
                            
                            // Update in allQuests array
                            const questIndex = allQuests.findIndex(q => q.title === oldTitle);
                            if (questIndex !== -1) {
                                allQuests[questIndex].title = newTitle;
                            }
                        }
                        
                        selectQuest(updatedQuest);
                    } else {
                        console.error('[QuestManager] Quest not found with either title');
                        alert('Warning: Quest was updated but could not be found. Please refresh the page.');
                    }
                }
            } else {
                const result = await response.json();
                console.error('[QuestManager] Metadata update failed:', result);
                alert('Failed to update quest: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating metadata:', err);
            alert('Error updating quest: ' + err.message);
        }
    }
    
    window.editTriggerConfig = function(questTitle) {
        console.log('[QuestManager] editTriggerConfig called for:', questTitle);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found in questDataMap:', questTitle);
            alert('Quest not found');
            return;
        }
        
        console.log('[QuestManager] Opening trigger config modal for:', questTitle);
        showTriggerConfigModal(quest);
    };
    
    async function updateTriggerType(questTitle, newTriggerType) {
        console.log('[QuestManager] Updating trigger type for:', questTitle, 'to:', newTriggerType);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            alert('Quest not found');
            return;
        }
        
        try {
            const payload = {
                trigger_type: newTriggerType,
                trigger_config: null, // Reset config when changing type
                uri: quest.uri || '',
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending trigger type update:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Trigger type updated successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update trigger type:', result);
                alert('Failed to update trigger type: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating trigger type:', err);
            alert('Error updating trigger type: ' + err.message);
        }
    }
    
    async function saveTriggerConfigField(questTitle, field, inputElement) {
        console.log('[QuestManager] Saving trigger config field:', field, 'for quest:', questTitle);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            return;
        }
        
        try {
            // Get current config or initialize empty object
            let config = {};
            if (quest.trigger_config) {
                config = typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config;
            }
            
            // Update the specific field based on trigger type
            if (quest.trigger_type === 'bsky_reply' && field === 'uri') {
                // For bsky_reply, URI is stored separately
                const payload = {
                    uri: inputElement.value,
                    trigger_type: quest.trigger_type,
                    trigger_config: quest.trigger_config,
                    condition: quest.condition || '',
                    conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                    condition_operator: quest.condition_operator || 'AND',
                    commands: quest.commands,
                    description: quest.description,
                    enabled: quest.enabled
                };
                
                const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    console.log('[QuestManager] URI updated successfully');
                    await loadQuests();
                    const updatedQuest = allQuests.find(q => q.title === questTitle);
                    if (updatedQuest) selectQuest(updatedQuest);
                } else {
                    const result = await response.json();
                    console.error('[QuestManager] Failed to update URI:', result);
                    alert('Failed to update URI: ' + (result.error || 'Unknown error'));
                }
            } else {
                // For other trigger types, update the config object
                if (field === 'phrases') {
                    // Special handling for phrases - split by newline
                    const phrases = inputElement.value.split('\n').map(p => p.trim()).filter(p => p);
                    config.phrases = phrases;
                } else if (inputElement.type === 'checkbox') {
                    config[field] = inputElement.checked;
                } else if (inputElement.type === 'number') {
                    config[field] = parseInt(inputElement.value);
                } else {
                    config[field] = inputElement.value;
                }
                
                const payload = {
                    trigger_type: quest.trigger_type,
                    trigger_config: JSON.stringify(config),
                    uri: quest.uri || '',
                    condition: quest.condition || '',
                    conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                    condition_operator: quest.condition_operator || 'AND',
                    commands: quest.commands,
                    description: quest.description,
                    enabled: quest.enabled
                };
                
                console.log('[QuestManager] Sending config update:', payload);
                const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    console.log('[QuestManager] Config field updated successfully');
                    // Reload and reselect to show changes
                    await loadQuests();
                    const updatedQuest = allQuests.find(q => q.title === questTitle);
                    if (updatedQuest) selectQuest(updatedQuest);
                } else {
                    const result = await response.json();
                    console.error('[QuestManager] Failed to update config field:', result);
                    alert('Failed to update configuration: ' + (result.error || 'Unknown error'));
                }
            }
        } catch (err) {
            console.error('[QuestManager] Error saving config field:', err);
            alert('Error saving configuration: ' + err.message);
        }
    }
    
    async function saveTriggerConfigFields(questTitle, triggerType, container) {
        console.log('[QuestManager] Saving all trigger config fields for:', questTitle, 'type:', triggerType);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            return;
        }
        
        try {
            let config = {};
            
            if (triggerType === 'firehose_phrase') {
                const phrasesInput = container.querySelector('.config-textarea[data-field="phrases"]');
                const caseSensitiveCheckbox = container.querySelector('.config-checkbox[data-field="case_sensitive"]');
                
                const phrases = phrasesInput.value.split('\n').map(p => p.trim()).filter(p => p);
                config = {
                    phrases: phrases,
                    case_sensitive: caseSensitiveCheckbox.checked
                };
            } else if (triggerType === 'poll') {
                const urlInput = container.querySelector('.config-input[data-field="url"]');
                const intervalInput = container.querySelector('.config-input[data-field="interval"]');
                
                config = {
                    url: urlInput.value,
                    interval: parseInt(intervalInput.value)
                };
            } else if (triggerType === 'webhook') {
                const pathInput = container.querySelector('.config-input[data-field="path"]');
                const secretInput = container.querySelector('.config-input[data-field="secret"]');
                
                config = {
                    path: pathInput.value,
                    secret: secretInput.value
                };
            } else if (triggerType === 'cron') {
                const expressionInput = container.querySelector('.config-input[data-field="expression"]');
                
                config = {
                    expression: expressionInput.value
                };
            } else if (triggerType === 'database_watch') {
                const tableInput = container.querySelector('.config-input[data-field="table"]');
                const operationSelect = container.querySelector('.config-select[data-field="operation"]');
                
                config = {
                    table: tableInput.value,
                    operation: operationSelect.value
                };
            }
            
            const payload = {
                trigger_type: quest.trigger_type,
                trigger_config: JSON.stringify(config),
                uri: quest.uri || '',
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending multi-field config update:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Trigger configuration updated successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update trigger configuration:', result);
                alert('Failed to update configuration: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error saving trigger configuration:', err);
            alert('Error saving configuration: ' + err.message);
        }
    }
    
    window.addTrigger = function(questTitle) {
        console.log('[QuestManager] addTrigger called - Note: Quest only supports one trigger');
        alert('Each quest can only have one trigger. Use the dropdown to change the trigger type, or use the trigger configuration in the modal to set parameters.');
    };
    
    window.deleteTrigger = async function(questTitle) {
        console.log('[QuestManager] deleteTrigger called for:', questTitle);
        if (!confirm('Reset trigger configuration?\n\nThis will clear the trigger type and configuration.')) {
            return;
        }
        
        const quest = questDataMap[questTitle];
        if (!quest) {
            alert('Quest not found');
            return;
        }
        
        try {
            const payload = {
                trigger_type: 'bsky_reply',
                trigger_config: null,
                uri: '',
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                alert('Failed to reset trigger: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            alert('Error resetting trigger: ' + err.message);
        }
    };
    
    async function updateConditionType(questTitle, index, newType) {
        console.log('[QuestManager] Updating condition type at index', index, 'to:', newType);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            return;
        }
        
        try {
            const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? [...quest.conditions] : [quest.conditions]) : [];
            
            if (index >= conditions.length) {
                console.error('[QuestManager] Invalid condition index:', index);
                return;
            }
            
            // Update the condition type
            conditions[index] = {
                type: 'condition',
                condition: newType,
                operator: conditions[index].operator || 'AND'
            };
            
            // Clear value if new type doesn't need it
            if (!['contains_hashtags', 'contains_mentions', 'reply_contains'].includes(newType)) {
                delete conditions[index].value;
            }
            
            const payload = {
                conditions: JSON.stringify(conditions),
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Condition type updated successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update condition type:', result);
                alert('Failed to update condition: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating condition type:', err);
            alert('Error updating condition: ' + err.message);
        }
    }
    
    async function updateConditionValue(questTitle, index, newValue) {
        console.log('[QuestManager] Updating condition value at index', index, 'to:', newValue);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            return;
        }
        
        try {
            const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? [...quest.conditions] : [quest.conditions]) : [];
            
            if (index >= conditions.length) {
                console.error('[QuestManager] Invalid condition index:', index);
                return;
            }
            
            // Update the condition value
            conditions[index].value = newValue;
            
            const payload = {
                conditions: JSON.stringify(conditions),
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Condition value updated successfully');
                // Reload and reselect to show changes
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update condition value:', result);
                alert('Failed to update condition: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating condition value:', err);
            alert('Error updating condition: ' + err.message);
        }
    }
    
    async function loadBskyPostPreview(questTitle, uri) {
        console.log('[QuestManager] Loading Bluesky post preview for URI:', uri);
        const previewId = `bsky-preview-${questTitle.replace(/\s/g, '-')}`;
        const previewEl = document.getElementById(previewId);
        
        if (!previewEl) {
            console.warn('[QuestManager] Preview element not found:', previewId);
            return;
        }
        
        try {
            // Extract DID and post ID from AT URI
            // Format: at://did:plc:xxx/app.bsky.feed.post/yyy
            const match = uri.match(/at:\/\/(did:plc:[^\/]+)\/app\.bsky\.feed\.post\/([^\/]+)/);
            if (!match) {
                previewEl.innerHTML = '<div class="preview-error">Invalid AT URI format</div>';
                return;
            }
            
            const [, did, postId] = match;
            
            // Fetch post data from Bluesky API
            const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch post');
            }
            
            const data = await response.json();
            const post = data.thread?.post;
            
            if (!post) {
                previewEl.innerHTML = '<div class="preview-error">Post not found</div>';
                return;
            }
            
            // Build preview HTML
            const author = post.author;
            const record = post.record;
            const createdAt = new Date(record.createdAt);
            
            previewEl.innerHTML = `
                <div class="bsky-post-content">
                    <div class="bsky-post-header">
                        <img src="${author.avatar || '/assets/default-avatar.png'}" alt="${author.displayName}" class="bsky-avatar">
                        <div class="bsky-author-info">
                            <div class="bsky-display-name">${escapeHtml(author.displayName || author.handle)}</div>
                            <div class="bsky-handle">@${escapeHtml(author.handle)}</div>
                        </div>
                        <div class="bsky-timestamp">${createdAt.toLocaleDateString()}</div>
                    </div>
                    <div class="bsky-post-text">${escapeHtml(record.text)}</div>
                    <div class="bsky-post-link">
                        <a href="https://bsky.app/profile/${author.did || did}/post/${postId}" target="_blank">View on Bluesky →</a>
                    </div>
                </div>
            `;
        } catch (err) {
            console.error('[QuestManager] Error loading post preview:', err);
            previewEl.innerHTML = `<div class="preview-error">Failed to load post preview: ${err.message}</div>`;
        }
    }
    
    function showTriggerConfigModal(quest) {
        console.log('[QuestManager] Creating trigger config modal for:', quest.title);
        console.log('[QuestManager] Quest trigger_type:', quest.trigger_type);
        console.log('[QuestManager] Quest trigger_config:', quest.trigger_config);
        
        // Create modal HTML
        const modalHtml = `
            <div id="trigger-modal" class="modal-overlay" onclick="if(event.target === this) closeTriggerModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Configure Trigger</h2>
                        <button class="modal-close" onclick="closeTriggerModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Trigger Type</label>
                            <select id="trigger-type-select" onchange="updateTriggerFields()">
                                <option value="bsky_reply" ${quest.trigger_type === 'bsky_reply' ? 'selected' : ''}>Bluesky Reply Monitor</option>
                                <option value="firehose_phrase" ${quest.trigger_type === 'firehose_phrase' ? 'selected' : ''}>Phrase/Hashtag Monitor</option>
                                <option value="poll" ${quest.trigger_type === 'poll' ? 'selected' : ''}>API Polling</option>
                                <option value="webhook" ${quest.trigger_type === 'webhook' ? 'selected' : ''}>HTTP Webhook</option>
                                <option value="cron" ${quest.trigger_type === 'cron' ? 'selected' : ''}>Time-Based Schedule</option>
                                <option value="database_watch" ${quest.trigger_type === 'database_watch' ? 'selected' : ''}>Database Monitor</option>
                            </select>
                        </div>
                        
                        <div id="trigger-fields-container">
                            ${getTriggerFieldsHtml(quest)}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn modal-btn-secondary" onclick="closeTriggerModal()">Cancel</button>
                        <button class="modal-btn modal-btn-primary" onclick="saveTriggerConfig('${escapeHtml(quest.title)}')">Save Configuration</button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('trigger-modal');
        if (existingModal) {
            console.log('[QuestManager] Removing existing modal');
            existingModal.remove();
        }
        
        // Add modal to body
        console.log('[QuestManager] Adding modal to DOM');
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        console.log('[QuestManager] Modal displayed successfully');
    }
    
    function getTriggerFieldsHtml(quest) {
        const triggerType = quest.trigger_type || 'bsky_reply';
        
        if (triggerType === 'bsky_reply') {
            return `
                <div class="form-group">
                    <label>Bluesky Post URI</label>
                    <input type="text" id="bsky-uri" class="form-input" value="${escapeHtml(quest.group_uri || quest.uri || '')}" placeholder="at://did:plc:xxx/app.bsky.feed.post/xxx">
                    <small>The AT Protocol URI of the post to monitor for replies</small>
                </div>
            `;
        } else if (triggerType === 'firehose_phrase') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            return `
                <div class="form-group">
                    <label>Phrases/Hashtags (one per line)</label>
                    <textarea id="phrases" class="form-input" rows="4" placeholder="#reverie\\nreverie house">${escapeHtml((config.phrases || []).join('\\n'))}</textarea>
                    <small>Monitor the firehose for these phrases or hashtags</small>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="case-sensitive" ${config.case_sensitive ? 'checked' : ''}> Case sensitive matching</label>
                </div>
            `;
        } else if (triggerType === 'poll') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            return `
                <div class="form-group">
                    <label>API Endpoint URL</label>
                    <input type="text" id="poll-url" class="form-input" value="${escapeHtml(config.url || '')}" placeholder="https://api.example.com/data">
                </div>
                <div class="form-group">
                    <label>Poll Interval (seconds)</label>
                    <input type="number" id="poll-interval" class="form-input" value="${config.interval || 60}" min="10">
                </div>
            `;
        } else if (triggerType === 'webhook') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            return `
                <div class="form-group">
                    <label>Webhook Path</label>
                    <input type="text" id="webhook-path" class="form-input" value="${escapeHtml(config.path || '')}" placeholder="/webhooks/quest-name">
                    <small>This quest will be triggered when a POST request is made to this path</small>
                </div>
                <div class="form-group">
                    <label>Secret Key (optional)</label>
                    <input type="text" id="webhook-secret" class="form-input" value="${escapeHtml(config.secret || '')}" placeholder="your-secret-key">
                    <small>Validate webhook requests with this secret</small>
                </div>
            `;
        } else if (triggerType === 'cron') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            return `
                <div class="form-group">
                    <label>Cron Expression</label>
                    <input type="text" id="cron-expression" class="form-input" value="${escapeHtml(config.expression || '')}" placeholder="0 */6 * * *">
                    <small>Examples: "0 */6 * * *" (every 6 hours), "0 0 * * *" (daily at midnight)</small>
                </div>
            `;
        } else if (triggerType === 'database_watch') {
            const config = quest.trigger_config ? (typeof quest.trigger_config === 'string' ? JSON.parse(quest.trigger_config) : quest.trigger_config) : {};
            return `
                <div class="form-group">
                    <label>Table Name</label>
                    <input type="text" id="db-table" class="form-input" value="${escapeHtml(config.table || '')}" placeholder="dreamers">
                </div>
                <div class="form-group">
                    <label>Watch For</label>
                    <select id="db-operation" class="form-input">
                        <option value="INSERT" ${config.operation === 'INSERT' ? 'selected' : ''}>New Records (INSERT)</option>
                        <option value="UPDATE" ${config.operation === 'UPDATE' ? 'selected' : ''}>Updates (UPDATE)</option>
                        <option value="DELETE" ${config.operation === 'DELETE' ? 'selected' : ''}>Deletions (DELETE)</option>
                    </select>
                </div>
            `;
        }
        
        return '<div style="color: var(--text-secondary); padding: 1rem; text-align: center;">No configuration needed for this trigger type</div>';
    }
    
    window.updateTriggerFields = function() {
        const select = document.getElementById('trigger-type-select');
        const container = document.getElementById('trigger-fields-container');
        const triggerType = select.value;
        
        // Create a mock quest object with the selected trigger type
        const mockQuest = { trigger_type: triggerType };
        container.innerHTML = getTriggerFieldsHtml(mockQuest);
    };
    
    window.closeTriggerModal = function() {
        const modal = document.getElementById('trigger-modal');
        if (modal) {
            modal.remove();
        }
    };
    
    window.saveTriggerConfig = async function(questTitle) {
        console.log('[QuestManager] Saving trigger config for:', questTitle);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            alert('Quest not found');
            return;
        }
        
        const triggerType = document.getElementById('trigger-type-select').value;
        console.log('[QuestManager] Selected trigger type:', triggerType);
        let triggerConfig = {};
        let uri = quest.uri || '';
        
        try {
            if (triggerType === 'bsky_reply') {
                uri = document.getElementById('bsky-uri').value;
            } else if (triggerType === 'firehose_phrase') {
                const phrasesText = document.getElementById('phrases').value;
                const phrases = phrasesText.split('\\n').map(p => p.trim()).filter(p => p);
                triggerConfig = {
                    phrases: phrases,
                    case_sensitive: document.getElementById('case-sensitive').checked
                };
            } else if (triggerType === 'poll') {
                triggerConfig = {
                    url: document.getElementById('poll-url').value,
                    interval: parseInt(document.getElementById('poll-interval').value)
                };
            } else if (triggerType === 'webhook') {
                triggerConfig = {
                    path: document.getElementById('webhook-path').value,
                    secret: document.getElementById('webhook-secret').value
                };
            } else if (triggerType === 'cron') {
                triggerConfig = {
                    expression: document.getElementById('cron-expression').value
                };
            } else if (triggerType === 'database_watch') {
                triggerConfig = {
                    table: document.getElementById('db-table').value,
                    operation: document.getElementById('db-operation').value
                };
            }
            
            const payload = {
                trigger_type: triggerType,
                trigger_config: JSON.stringify(triggerConfig),
                uri: uri,
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending update payload:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Trigger config updated successfully');
                closeTriggerModal();
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) {
                    console.log('[QuestManager] Re-selecting updated quest');
                    selectQuest(updatedQuest);
                }
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update trigger config:', result);
                alert('Failed to update trigger configuration: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error saving trigger config:', err);
            alert('Error saving trigger configuration: ' + err.message);
        }
    };
    
    window.addCondition = function(questTitle) {
        console.log('[QuestManager] addCondition called for:', questTitle);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            alert('Quest not found');
            return;
        }
        
        // Add a default any_reply condition
        console.log('[QuestManager] Adding default any_reply condition');
        addConditionToQuest(questTitle, 'any_reply');
    };
    
    async function addConditionToQuest(questTitle, conditionType, conditionValue = '') {
        try {
            const quest = questDataMap[questTitle];
            const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? quest.conditions : [quest.conditions]) : [];
            
            const newCondition = {
                type: 'condition',
                condition: conditionType,
                operator: 'AND'
            };
            
            if (conditionValue) {
                newCondition.value = conditionValue;
            }
            
            conditions.push(newCondition);
            
            const payload = {
                condition: quest.condition || '',
                conditions: JSON.stringify(conditions),
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending add condition payload:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Condition added successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to add condition:', result);
                alert('Failed to add condition: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error adding condition:', err);
            alert('Error adding condition: ' + err.message);
        }
    }
    
    window.editCondition = function(questTitle, index) {
        console.log('[QuestManager] editCondition called for:', questTitle, 'index:', index);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            alert('Quest not found');
            return;
        }
        
        const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? quest.conditions : [quest.conditions]) : [];
        if (index >= conditions.length) {
            console.error('[QuestManager] Condition index out of range:', index);
            alert('Condition not found');
            return;
        }
        
        const currentCondition = typeof conditions[index] === 'string' ? conditions[index] : (conditions[index].condition || JSON.stringify(conditions[index]));
        const newCondition = prompt('Edit condition:', currentCondition);
        if (!newCondition || newCondition === currentCondition) return;
        
        console.log('[QuestManager] Updating condition at index', index, 'to:', newCondition);
        updateCondition(questTitle, index, newCondition);
    };
    
    async function updateCondition(questTitle, index, newConditionText) {
        try {
            const quest = questDataMap[questTitle];
            const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? quest.conditions : [quest.conditions]) : [];
            
            conditions[index] = {
                type: 'condition',
                condition: newConditionText,
                operator: 'AND'
            };
            
            const payload = {
                condition: quest.condition || '',
                conditions: JSON.stringify(conditions),
                condition_operator: quest.condition_operator || 'AND',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending update condition payload:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Condition updated successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update condition:', result);
                alert('Failed to update condition: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating condition:', err);
            alert('Error updating condition: ' + err.message);
        }
    }
    
    // Update a specific option on a condition (operator, once_only, disabled)
    window.updateConditionOption = async function(questTitle, index, optionName, optionValue) {
        console.log('[QuestManager] updateConditionOption called:', questTitle, index, optionName, optionValue);
        try {
            const quest = questDataMap[questTitle];
            if (!quest) {
                console.error('[QuestManager] Quest not found:', questTitle);
                return;
            }
            
            const conditions = quest.conditions ? (Array.isArray(quest.conditions) ? [...quest.conditions] : [quest.conditions]) : [];
            if (index >= conditions.length) {
                console.error('[QuestManager] Condition index out of range:', index);
                return;
            }
            
            // Get condition object (normalize if string)
            let condObj = conditions[index];
            if (typeof condObj === 'string') {
                condObj = { condition: condObj, operator: 'AND' };
            } else {
                condObj = { ...condObj }; // Clone to avoid mutation
            }
            
            // Update the specific option
            condObj[optionName] = optionValue;
            conditions[index] = condObj;
            
            const payload = {
                condition: quest.condition || '',
                conditions: JSON.stringify(conditions),
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending update condition option payload:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Condition option updated successfully');
                // Update local cache
                quest.conditions = conditions;
                // Refresh the display
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update condition option:', result);
                alert('Failed to update condition option: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating condition option:', err);
            alert('Error updating condition option: ' + err.message);
        }
    };
    
    window.addCommand = function(questTitle) {
        console.log('[QuestManager] addCommand called for:', questTitle);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            alert('Quest not found');
            return;
        }
        
        // Add a default like_post command
        console.log('[QuestManager] Adding default like_post command');
        addCommandToQuest(questTitle, 'like_post');
    };
    
    async function addCommandToQuest(questTitle, commandType, commandParams = '') {
        try {
            const quest = questDataMap[questTitle];
            const commands = quest.commands || [];
            
            // Commands use canonical format: {cmd: "type", args: [...]}
            const newCommand = {
                cmd: commandType,
                args: commandParams ? commandParams.split(":") : []
            };
            commands.push(newCommand);
            
            const payload = {
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending add command payload:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Command added successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to add command:', result);
                alert('Failed to add command: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error adding command:', err);
            alert('Error adding command: ' + err.message);
        }
    }
    
    window.editCommand = function(questTitle, index) {
        console.log('[QuestManager] editCommand called for:', questTitle, 'index:', index);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            alert('Quest not found');
            return;
        }
        
        if (!quest.commands || index >= quest.commands.length) {
            console.error('[QuestManager] Command index out of range:', index);
            alert('Command not found');
            return;
        }
        
        const currentCommand = quest.commands[index];
        const newType = prompt('Command type:', currentCommand.type || '');
        if (!newType) return;
        
        const currentParams = currentCommand.params ? JSON.stringify(currentCommand.params, null, 2) : '{}';
        const newParamsStr = prompt('Command parameters (JSON):', currentParams);
        if (!newParamsStr) return;
        
        let newParams = {};
        try {
            newParams = JSON.parse(newParamsStr);
        } catch (e) {
            console.error('[QuestManager] Invalid JSON for params:', e);
            alert('Invalid JSON format for parameters');
            return;
        }
        
        console.log('[QuestManager] Updating command at index', index, 'to:', newType, newParams);
        updateCommand(questTitle, index, newType, newParams);
    };
    
    async function updateCommand(questTitle, index, commandType, params) {
        try {
            const quest = questDataMap[questTitle];
            const commands = [...quest.commands];
            
            commands[index] = {
                type: commandType,
                params: params
            };
            
            const payload = {
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                commands: commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            console.log('[QuestManager] Sending update command payload:', payload);
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Command updated successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update command:', result);
                alert('Failed to update command: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating command:', err);
            alert('Error updating command: ' + err.message);
        }
    }
    
    window.deleteCommand = async function(questTitle, index) {
        console.log('[QuestManager] deleteCommand called for:', questTitle, 'index:', index);
        if (!confirm(`Delete this command from "${questTitle}"?`)) {
            console.log('[QuestManager] Delete command cancelled by user');
            return;
        }
        
        try {
            const quest = window.questDataMap[questTitle];
            if (!quest) {
                alert('Quest not found');
                return;
            }
            
            quest.commands.splice(index, 1);
            
            const payload = {
                condition: quest.condition || '',
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: quest.commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Command deleted successfully');
                // Reload and reselect
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to delete command:', result);
                alert('Failed to delete command: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error deleting command:', err);
            alert('Error deleting command: ' + err.message);
        }
    };
    
    async function updateCommandType(questTitle, index, newType) {
        console.log('[QuestManager] Updating command type at index', index, 'to:', newType);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            return;
        }
        
        try {
            const commands = [...quest.commands];
            
            if (index >= commands.length) {
                console.error('[QuestManager] Invalid command index:', index);
                return;
            }
            
            // Update the command type, clear params
            commands[index] = newType;
            
            const payload = {
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Command type updated successfully');
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update command type:', result);
                alert('Failed to update command: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating command type:', err);
            alert('Error updating command: ' + err.message);
        }
    }
    
    async function updateCommandParams(questTitle, index, newParams) {
        console.log('[QuestManager] Updating command params at index', index, 'to:', newParams);
        const quest = questDataMap[questTitle];
        if (!quest) {
            console.error('[QuestManager] Quest not found:', questTitle);
            return;
        }
        
        try {
            const commands = [...quest.commands];
            
            if (index >= commands.length) {
                console.error('[QuestManager] Invalid command index:', index);
                return;
            }
            
            // Get the command type
            let commandType = '';
            if (typeof commands[index] === 'string') {
                commandType = commands[index].split(':')[0];
            }
            
            // Update the command with params
            commands[index] = newParams ? `${commandType}:${newParams}` : commandType;
            
            const payload = {
                conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                condition_operator: quest.condition_operator || 'AND',
                trigger_type: quest.trigger_type,
                trigger_config: quest.trigger_config,
                uri: quest.uri || '',
                commands: commands,
                description: quest.description,
                enabled: quest.enabled
            };
            
            const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[QuestManager] Command params updated successfully');
                // Update local cache
                quest.commands = commands;
                // Reload and reselect to show changes
                await loadQuests();
                const updatedQuest = allQuests.find(q => q.title === questTitle);
                if (updatedQuest) selectQuest(updatedQuest);
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to update command params:', result);
                alert('Failed to update command: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error updating command params:', err);
            alert('Error updating command: ' + err.message);
        }
    }
    
    // Create quest modal
    window.createBlankQuest = function() {
        console.log('[QuestManager] createBlankQuest called');
        
        const title = prompt('Quest Title:');
        if (!title) {
            console.log('[QuestManager] Quest creation cancelled - no title');
            return;
        }
        
        const description = prompt('Quest Description (optional):');
        
        console.log('[QuestManager] Creating new quest:', title);
        createNewQuest(title, description);
    };
    
    async function createNewQuest(title, description) {
        try {
            const payload = {
                title: title,
                description: description || '',
                trigger_type: 'bsky_reply',
                enabled: false,
                conditions: JSON.stringify([{
                    type: 'condition',
                    condition: 'any_reply',
                    operator: 'AND'
                }]),
                condition_operator: 'AND',
                commands: []
            };
            
            console.log('[QuestManager] Sending create quest payload:', payload);
            const response = await authenticatedFetch('/api/quests/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('[QuestManager] Quest created successfully, response:', result);
                
                // Check if API returned the created quest
                if (result.quest) {
                    console.log('[QuestManager] Using quest data from API response');
                    // Add to local data structures
                    allQuests.push(result.quest);
                    questDataMap[result.quest.title] = result.quest;
                    applyFilter();
                    selectQuest(result.quest);
                } else {
                    // Add delay to allow backend to commit
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    await loadQuests();
                    console.log('[QuestManager] After loadQuests, searching for new quest:', title);
                    const newQuest = allQuests.find(q => q.title === title);
                    if (newQuest) {
                        console.log('[QuestManager] Selecting newly created quest');
                        selectQuest(newQuest);
                    } else {
                        console.error('[QuestManager] Created quest not found:', title);
                        alert('Quest created but not found in list. Please refresh the page.');
                    }
                }
            } else {
                const result = await response.json();
                console.error('[QuestManager] Failed to create quest:', result);
                alert('Failed to create quest: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[QuestManager] Error creating quest:', err);
            alert('Error creating quest: ' + err.message);
        }
    }
    
    // Helper function
    if (typeof window.escapeHtml === 'undefined') {
        window.escapeHtml = escapeHtml;
    }
    
    // Initialize filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            applyFilter();
        });
    });
    
    // Initialize search
    document.getElementById('quest-search').addEventListener('input', () => {
        applyFilter();
    });
    
})();


// ============================================================================
// FIREHOSE SERVICE STATUS MONITOR
// ============================================================================

(function() {
    'use strict';
    
    function escapeHtmlLocal(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async function loadServiceStatus() {
        const container = document.getElementById('service-status-items');
        if (!container) return;
        
        try {
            const response = await fetch('/api/firehose-status');
            if (!response.ok) throw new Error('Failed to fetch status');
            
            const data = await response.json();
            
            let html = '';
            if (data.services) {
                for (const [key, service] of Object.entries(data.services)) {
                    const dotClass = service.running ? 'running' : 'stopped';
                    const uptime = service.status || 'stopped';
                    html += '<div class="service-item" title="' + escapeHtmlLocal(service.description || '') + '">' +
                        '<span class="service-dot ' + dotClass + '"></span>' +
                        '<span class="service-name">' + escapeHtmlLocal(service.name) + '</span>' +
                        '<span style="color: #94a3b8; font-size: 0.65rem;">' + escapeHtmlLocal(uptime) + '</span>' +
                        '</div>';
                }
            }
            
            container.innerHTML = html || '<div class="service-item"><span class="service-dot stopped"></span><span class="service-name">No services</span></div>';
            
        } catch (err) {
            console.warn('Could not load service status:', err);
            container.innerHTML = '<div class="service-item"><span class="service-dot stopped"></span><span class="service-name">Status unavailable</span></div>';
        }
    }
    
    // Load service status on page load and refresh every 30 seconds
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadServiceStatus);
    } else {
        loadServiceStatus();
    }
    setInterval(loadServiceStatus, 30000);
    
})();
