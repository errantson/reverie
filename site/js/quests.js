        // AUTHENTICATION & AUTHORIZATION
        // ============================================================================
        
        // Helper function to escape HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Check authentication on page load
        const adminToken = localStorage.getItem('admin_token');
        
        if (!adminToken) {
            // No token - redirect to login
            window.location.href = '/admin/login.html';
        } else {
            // Verify token is still valid and get user info
            fetch('/api/admin/verify', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                }
            }).then(response => {
                if (!response.ok) {
                    // Token invalid - redirect to login
                    localStorage.removeItem('admin_token');
                    window.location.href = '/admin/login.html';
                } else {
                    return response.json();
                }
            }).then(data => {
                if (data) {
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
                    loadQuests();
                }
            }).catch(error => {
                console.error('Auth check failed:', error);
                // On network error, redirect to login
                localStorage.removeItem('admin_token');
                window.location.href = '/admin/login.html';
            });
        }
        
        // Helper function to make authenticated API calls
        async function authenticatedFetch(url, options = {}) {
            const token = localStorage.getItem('admin_token');
            
            if (!token) {
                throw new Error('No authentication token');
            }
            
            // Add authorization header
            options.headers = options.headers || {};
            options.headers['Authorization'] = `Bearer ${token}`;
            
            const response = await fetch(url, options);
            
            // If unauthorized, redirect to login
            if (response.status === 401) {
                localStorage.removeItem('admin_token');
                window.location.href = '/admin/login.html';
                throw new Error('Session expired');
            }
            
            return response;
        }
        
        // Logout function
        function logout() {
            const token = localStorage.getItem('admin_token');
            
            // Clear session data
            sessionStorage.removeItem('admin_session');
            
            // Dispatch logout event for drawer
            window.dispatchEvent(new CustomEvent('oauth:logout'));
            
            if (token) {
                fetch('/api/admin/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }).finally(() => {
                    localStorage.removeItem('admin_token');
                    window.location.href = '/admin/login.html';
                });
            } else {
                localStorage.removeItem('admin_token');
                window.location.href = '/admin/login.html';
            }
        }
        
        // ============================================================================
        // QUEST MANAGEMENT
        // ============================================================================
        
        let questGroups = [];
        let currentGroupIndex = 0;
        let postCache = {};
        let loadedGroups = new Set();  // Track which groups have been loaded

        // DOM elements
        const carouselTrack = document.getElementById('carousel-track');
        const carouselSlider = document.getElementById('carousel-slider');
        const carouselNotch = document.getElementById('carousel-notch');
        const carouselMiniPreviews = document.getElementById('carousel-mini-previews');
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        
        // Store quest data for editing
        let questDataMap = {};

        async function loadQuests() {
            const createBtn = document.getElementById('create-quest-btn-top');
            loading.style.display = 'flex';
            loading.innerHTML = '<div class="loading-spinner"></div><div>Loading quests...</div>';
            error.style.display = 'none';
            if (createBtn) createBtn.style.display = 'none';

            try {
                const response = await authenticatedFetch('/api/quests/grouped');

                if (!response.ok) {
                    throw new Error(`Failed to load quests: ${response.status}`);
                }

                const data = await response.json();
                loading.style.display = 'none';
                if (createBtn) createBtn.style.display = 'block';

                if (!data.groups || data.groups.length === 0) {
                    error.style.display = 'block';
                    error.textContent = 'No quests found.';
                    return;
                }

                questGroups = data.groups;
                
                // Parse conditions field if it's a JSON string
                questGroups.forEach(group => {
                    group.quests.forEach(quest => {
                        if (quest.conditions && typeof quest.conditions === 'string') {
                            try {
                                quest.conditions = JSON.parse(quest.conditions);
                                console.log(`Parsed conditions for ${quest.title}:`, quest.conditions);
                            } catch (e) {
                                console.error(`Failed to parse conditions for ${quest.title}:`, e);
                            }
                        }
                    });
                });
                
                // Sort by activity (active quests count), then by newest creation timestamp
                questGroups.sort((a, b) => {
                    const aActive = a.quests.filter(q => q.enabled).length;
                    const bActive = b.quests.filter(q => q.enabled).length;
                    
                    if (aActive !== bActive) {
                        return bActive - aActive;  // More active first
                    }
                    
                    // If same activity, sort by newest created_at
                    const aTime = Math.max(...a.quests.map(q => q.created_at || 0));
                    const bTime = Math.max(...b.quests.map(q => q.created_at || 0));
                    return bTime - aTime;
                });

                // Build slider
                await buildSlider();
                
                // Restore previously viewed quest group from localStorage, or show first
                const savedIndex = localStorage.getItem('quests_current_group_index');
                const initialIndex = savedIndex ? parseInt(savedIndex, 10) : 0;
                const validIndex = (initialIndex >= 0 && initialIndex < questGroups.length) ? initialIndex : 0;
                
                await showGroupWithBuffer(validIndex);

            } catch (err) {
                loading.style.display = 'none';
                error.style.display = 'block';
                error.textContent = `Error: ${err.message}`;
                console.error('Failed to load quests:', err);
            }
        }

        async function loadBiblioListInfo(listUri) {
            if (!listUri || !listUri.trim()) return;
            
            const titleEl = document.getElementById('biblio-list-title');
            if (!titleEl) return;
            
            try {
                // Parse AT URI: at://did:plc:xxx/biblio.bond.list/rkey
                const uri = listUri.trim();
                if (!uri.startsWith('at://')) {
                    titleEl.textContent = '⚠️ Invalid URI format - must start with at://';
                    titleEl.style.color = '#dc2626';
                    return;
                }
                
                titleEl.textContent = 'Loading list details...';
                titleEl.style.color = '#6b7280';
                
                const parts = uri.replace('at://', '').split('/');
                if (parts.length !== 3) {
                    titleEl.textContent = '⚠️ Invalid URI format';
                    titleEl.style.color = '#dc2626';
                    return;
                }
                
                const [did, collection, rkey] = parts;
                
                if (collection !== 'biblio.bond.list') {
                    titleEl.textContent = '⚠️ Must be a biblio.bond.list URI';
                    titleEl.style.color = '#dc2626';
                    return;
                }
                
                // Fetch list details from our API endpoint
                const encodedUri = encodeURIComponent(uri);
                const response = await fetch(`/api/biblio/list/${encodedUri}/details`);
                
                if (response.ok) {
                    const listData = await response.json();
                    
                    if (listData.available) {
                        // Successfully fetched full list data
                        const title = listData.title || 'Untitled List';
                        const description = listData.description || '';
                        const books = listData.books || [];
                        const duedate = listData.duedate || '';
                        
                        // Calculate days until/overdue
                        let dueDateStr = '';
                        let daysInfo = '';
                        let dueColor = '#6b7280';
                        if (duedate) {
                            const dueDateObj = new Date(duedate);
                            const now = new Date();
                            const daysUntil = Math.floor((dueDateObj - now) / (1000 * 60 * 60 * 24));
                            dueDateStr = dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            
                            if (daysUntil < 0) {
                                dueColor = '#dc2626';
                                daysInfo = `${Math.abs(daysUntil)} days overdue`;
                            } else if (daysUntil < 30) {
                                dueColor = '#ea580c';
                                daysInfo = `${daysUntil} days remaining`;
                            } else {
                                dueColor = '#059669';
                                daysInfo = `${daysUntil} days remaining`;
                            }
                        }
                        
                        // Build simple clean layout - no nested containers
                        let html = `<div style="font-weight: 700; color: #4c1d95; margin-bottom: 0.5rem; font-family: Arial, sans-serif;">${title}</div>`;
                        
                        // Stats inline
                        html += `<div style="font-size: 0.65rem; color: #6b7280; font-family: monospace; margin-bottom: 0.75rem;">`;
                        if (duedate) {
                            html += `<span style="color: ${dueColor}; font-weight: 600;">${dueDateStr}</span> · ${daysInfo} · `;
                        }
                        html += `${books.length} book${books.length !== 1 ? 's' : ''}</div>`;
                        
                        // Description
                        if (description) {
                            html += `<div style="color: #6b7280; font-size: 0.65rem; margin-bottom: 0.75rem; font-family: Arial, sans-serif;">${description}</div>`;
                        }
                        
                        // Books table
                        if (books.length > 0) {
                            html += `<table style="width: 100%; border-collapse: collapse; font-size: 0.65rem; font-family: Arial, sans-serif;">`;
                            html += `<thead><tr style="border-bottom: 1px solid #e5e7eb;">`;
                            html += `<th style="text-align: left; padding: 0.4rem 0; color: #9ca3af; text-transform: uppercase; font-size: 0.6rem; font-weight: 600; font-family: monospace;">Title</th>`;
                            html += `<th style="text-align: left; padding: 0.4rem 0; color: #9ca3af; text-transform: uppercase; font-size: 0.6rem; font-weight: 600; font-family: monospace;">Author</th>`;
                            html += `</tr></thead><tbody>`;
                            
                            books.forEach((book) => {
                                const bookTitle = book.title || 'Untitled';
                                const bookAuthor = book.author || 'Unknown';
                                html += `<tr><td style="padding: 0.4rem 0; color: #171717;">${bookTitle}</td><td style="padding: 0.4rem 0; color: #6b7280;">${bookAuthor}</td></tr>`;
                            });
                            
                            html += `</tbody></table>`;
                        }
                        
                        titleEl.innerHTML = html;
                        return;
                    } else {
                        // Fallback when PDS not accessible
                        titleEl.innerHTML = `
                            <div style="font-size: 0.85rem; font-weight: 600; color: #4c1d95; margin-bottom: 0.5rem;">
                                📋 Reading List
                            </div>
                            <div style="font-size: 0.7rem; color: #6b7280; margin-bottom: 0.4rem; line-height: 1.4;">
                                Monitoring completion stamps for:
                            </div>
                            <div style="font-size: 0.65rem; color: #9333ea; font-family: monospace; background: rgba(147, 51, 234, 0.1); padding: 0.35rem 0.5rem; border-radius: 4px; word-break: break-all; line-height: 1.3; margin-bottom: 0.5rem;">
                                ${rkey}
                            </div>
                            <div style="font-size: 0.65rem; color: #6b7280; padding: 0.5rem; background: rgba(107, 33, 168, 0.08); border: 1px solid rgba(147, 51, 234, 0.2); border-radius: 6px; line-height: 1.4;">
                                � ${listData.status || 'Bibliohose monitor ready'}
                            </div>
                        `;
                    }
                } else {
                    throw new Error(`API returned ${response.status}`);
                }
                
            } catch (err) {
                console.error('Error loading biblio list:', err);
                titleEl.innerHTML = `<div style="color: #dc2626; font-size: 0.75rem;">⚠️ Error loading list details</div>`;
            }
        }

        async function fetchBiblioListStats(did, rkey, containerEl) {
            try {
                // Fetch list statistics from our API
                const response = await fetch(`/api/biblio/list/${rkey}/stats`);
                
                const statsContainer = containerEl.querySelector('#list-stats-loading');
                if (!statsContainer) return;
                
                // biblio.bond PDS is not yet operational - show honest status
                if (!response.ok) {
                    statsContainer.innerHTML = `
                        <div style="padding: 0.75rem; background: rgba(107, 33, 168, 0.08); border: 1px solid rgba(147, 51, 234, 0.2); border-radius: 6px;">
                            <div style="font-size: 0.7rem; color: #6b21a8; font-weight: 600; margin-bottom: 0.5rem;">📚 Bibliohose Ready</div>
                            <div style="font-size: 0.65rem; color: #6b7280; line-height: 1.5; margin-bottom: 0.5rem;">
                                The bibliohose monitor is <strong>active and running</strong>, checking every 5 minutes for biblio.bond activity on the AT Protocol network.
                            </div>
                            <div style="font-size: 0.65rem; color: #4c1d95; line-height: 1.5; padding: 0.4rem; background: rgba(147,51,234,0.05); border-radius: 4px;">
                                <strong>Current Status:</strong> Monitoring list <code style="font-family: monospace; background: rgba(0,0,0,0.1); padding: 0.1rem 0.3rem; border-radius: 2px;">${rkey}</code>
                            </div>
                            <div style="font-size: 0.65rem; color: #6b7280; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(0,0,0,0.1); font-style: italic;">
                                When biblio.bond stamps are issued for this list, this quest will trigger automatically.
                            </div>
                        </div>`;
                    return;
                }
                
                const data = await response.json();
                
                // Show honest message if data isn't available yet
                if (data.available === false) {
                    statsContainer.innerHTML = `
                        <div style="padding: 0.75rem; background: rgba(107, 33, 168, 0.08); border: 1px solid rgba(147, 51, 234, 0.2); border-radius: 6px;">
                            <div style="font-size: 0.7rem; color: #6b21a8; font-weight: 600; margin-bottom: 0.5rem;">📚 Bibliohose Ready</div>
                            <div style="font-size: 0.65rem; color: #6b7280; line-height: 1.5; margin-bottom: 0.5rem;">
                                ${data.status || 'The bibliohose monitor is active and ready to process biblio.bond records.'}
                            </div>
                            <div style="font-size: 0.65rem; color: #4c1d95; line-height: 1.5; padding: 0.4rem; background: rgba(147,51,234,0.05); border-radius: 4px;">
                                <strong>Monitoring:</strong> <code style="font-family: monospace; background: rgba(0,0,0,0.1); padding: 0.1rem 0.3rem; border-radius: 2px;">${rkey}</code>
                            </div>
                        </div>`;
                    return;
                }
                
                // If we get here, real data is available - show it
                let html = `
                    <div style="background: linear-gradient(135deg, rgba(147, 51, 234, 0.08), rgba(107, 33, 168, 0.05)); border: 1px solid rgba(147, 51, 234, 0.2); border-radius: 6px; padding: 0.75rem;">
                        ${data.list_name ? `
                            <div style="font-size: 0.85rem; font-weight: 700; color: #6b21a8; margin-bottom: 0.5rem; line-height: 1.3;">
                                ${data.list_name}
                            </div>
                        ` : ''}
                        
                        ${data.description ? `
                            <div style="font-size: 0.7rem; color: #4c1d95; margin-bottom: 0.75rem; line-height: 1.4; font-style: italic;">
                                ${data.description}
                            </div>
                        ` : ''}
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem;">
                            <div style="background: white; padding: 0.4rem; border-radius: 4px; text-align: center;">
                                <div style="font-size: 1.2rem; font-weight: 700; color: #9333ea;">${data.book_count || 0}</div>
                                <div style="font-size: 0.6rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px;">Books</div>
                            </div>
                            <div style="background: white; padding: 0.4rem; border-radius: 4px; text-align: center;">
                                <div style="font-size: 1.2rem; font-weight: 700; color: #059669;">${data.stamps_issued || 0}</div>
                                <div style="font-size: 0.6rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px;">Stamps Issued</div>
                            </div>
                        </div>
                        
                        ${data.books && data.books.length > 0 ? `
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(147, 51, 234, 0.2);">
                                <div style="font-size: 0.65rem; font-weight: 700; color: #6b21a8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.4rem;">📖 Books</div>
                                <div style="max-height: 150px; overflow-y: auto; font-size: 0.65rem;">
                                    ${data.books.map(book => `
                                        <div style="padding: 0.3rem 0.4rem; margin-bottom: 0.25rem; background: rgba(255,255,255,0.5); border-radius: 3px; line-height: 1.3;">
                                            <div style="font-weight: 600; color: #4c1d95;">${book.title || 'Untitled'}</div>
                                            ${book.author ? `<div style="color: #6b7280; font-size: 0.6rem;">by ${book.author}</div>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${data.recent_completions && data.recent_completions.length > 0 ? `
                            <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(147, 51, 234, 0.2);">
                                <div style="font-size: 0.65rem; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.4rem;">✅ Recent Completions</div>
                                <div style="font-size: 0.6rem; line-height: 1.4;">
                                    ${data.recent_completions.map(completion => `
                                        <div style="padding: 0.25rem 0; color: #6b7280;">
                                            <strong style="color: #4c1d95;">@${completion.handle || 'unknown'}</strong> · ${completion.date || 'recently'}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
                
                statsContainer.innerHTML = html;
                
            } catch (err) {
                console.error('Error fetching biblio list stats:', err);
                const statsContainer = containerEl.querySelector('#list-stats-loading');
                if (statsContainer) {
                    statsContainer.innerHTML = `
                        <div style="font-size: 0.65rem; color: #6b7280; padding: 0.5rem; background: rgba(0,0,0,0.02); border-radius: 4px; line-height: 1.4;">
                            📊 Bibliohose monitor is active. List statistics will appear when biblio.bond records are available.
                        </div>`;
                }
            }
        }

        async function fetchPostData(uri) {
            if (postCache[uri]) {
                return postCache[uri];
            }
            
            // Return null for empty/missing URIs
            if (!uri || uri.trim() === '') {
                return null;
            }

            try {
                const parts = uri.replace('at://', '').split('/');
                if (parts.length < 3) {
                    console.warn('Invalid URI format:', uri);
                    return null;
                }
                
                const did = parts[0];
                const postId = parts[2];
                
                const response = await fetch(
                    `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`,
                    { headers: { 'Accept': 'application/json' } }
                );
                
                if (!response.ok) {
                    console.warn(`Failed to fetch post for ${uri}: ${response.status}`);
                    // Cache the failure so we don't retry repeatedly
                    postCache[uri] = null;
                    return null;
                }
                
                const data = await response.json();
                const post = data.thread?.post;
                
                if (!post) {
                    postCache[uri] = null;
                    return null;
                }
                
                const postData = {
                    author: {
                        displayName: post.author.displayName || post.author.handle,
                        handle: post.author.handle,
                        avatar: post.author.avatar
                    },
                    text: post.record.text || '',
                    images: post.embed?.images || [],
                    createdAt: post.record.createdAt,
                    url: `https://bsky.app/profile/${did}/post/${postId}`
                };
                
                postCache[uri] = postData;
                return postData;
            } catch (err) {
                console.warn('Error fetching post:', uri, err.message);
                // Cache the failure
                postCache[uri] = null;
                return null;
            }
        }

        async function buildSlider() {
            // Build mini preview cards
            carouselMiniPreviews.innerHTML = '';
            
            for (let i = 0; i < questGroups.length; i++) {
                const group = questGroups[i];
                const card = document.createElement('div');
                card.className = 'origin-mini-card';
                card.dataset.index = i;
                if (i === 0) card.classList.add('active');
                
                // Determine trigger type from first quest in group
                const firstQuest = group.quests[0];
                const triggerType = firstQuest?.trigger_type || 'bsky_reply';
                
                // Create preview
                const preview = document.createElement('div');
                preview.className = 'origin-mini-preview';
                
                // For bsky_reply quests with URI, fetch post data
                if (triggerType === 'bsky_reply' && group.uri) {
                    const postData = await fetchPostData(group.uri);
                    
                    if (postData && postData.images && postData.images.length > 0) {
                        const img = document.createElement('img');
                        img.src = postData.images[0].thumb || postData.images[0].fullsize;
                        img.alt = 'Post';
                        preview.appendChild(img);
                    } else if (postData && postData.author.avatar) {
                        const img = document.createElement('img');
                        img.src = postData.author.avatar;
                        img.alt = 'Avatar';
                        preview.appendChild(img);
                    } else {
                        preview.textContent = '📝';
                        preview.style.fontSize = '2rem';
                    }
                } else {
                    // Non-bsky trigger - show trigger type icon
                    const triggerIcons = {
                        'bibliohose': '📚',
                        'poll': '🔄',
                        'webhook': '🪝',
                        'cron': '⏰',
                        'database_watch': '👁️',
                        'bsky_reply': '💬',
                        'firehose_phrase': '🔍'
                    };
                    preview.textContent = triggerIcons[triggerType] || '⚡';
                    preview.style.fontSize = '2rem';
                }
                
                // Create info
                const info = document.createElement('div');
                info.className = 'origin-mini-info';
                
                if (triggerType === 'bsky_reply' && group.uri) {
                    const postData = await fetchPostData(group.uri);
                    if (postData) {
                        const handle = document.createElement('div');
                        handle.className = 'origin-mini-handle';
                        handle.textContent = `@${postData.author.handle}`;
                        info.appendChild(handle);
                        
                        if (postData.text) {
                            const text = document.createElement('div');
                            text.className = 'origin-mini-text';
                            text.textContent = postData.text;
                            info.appendChild(text);
                        }
                    }
                } else {
                    // Show trigger type label with better trigger-specific info
                    const triggerIcons = {
                        'bibliohose': '📚',
                        'poll': '🔄',
                        'webhook': '🪝',
                        'cron': '⏰',
                        'database_watch': '👁️',
                        'firehose_phrase': '🔍'
                    };
                    
                    const triggerLabels = {
                        'bibliohose': 'Reading Activity',
                        'poll': 'API Polling',
                        'webhook': 'HTTP Webhook',
                        'cron': 'Time Schedule',
                        'database_watch': 'Data Monitor',
                        'firehose_phrase': 'Phrase Monitor'
                    };
                    
                    const icon = document.createElement('div');
                    icon.className = 'origin-mini-handle';
                    icon.style.fontWeight = '600';
                    icon.textContent = `${triggerIcons[triggerType] || '⚡'} ${triggerLabels[triggerType] || triggerType}`;
                    info.appendChild(icon);
                    
                    // Show trigger-specific metadata
                    const text = document.createElement('div');
                    text.className = 'origin-mini-text';
                    
                    // Get trigger config
                    let triggerConfig = {};
                    try {
                        if (firstQuest.trigger_config) {
                            triggerConfig = JSON.parse(firstQuest.trigger_config);
                        }
                    } catch (e) {
                        // Invalid JSON, ignore
                    }
                    
                    // Build trigger-specific subtitle
                    if (triggerType === 'bibliohose') {
                        let listRkey = triggerConfig.list_rkey || group.trigger_config?.list_rkey;
                        
                        // Fallback: extract from conditions
                        if (!listRkey) {
                            const conditions = firstQuest.conditions || [];
                            for (const cond of conditions) {
                                const condStr = typeof cond === 'object' ? cond.condition : cond;
                                if (condStr && condStr.includes('has_biblio_stamp:')) {
                                    listRkey = condStr.split(':')[1];
                                    break;
                                }
                            }
                        }
                        
                        if (listRkey) {
                            text.textContent = `List: ${listRkey.slice(0, 10)}...`;
                        } else {
                            text.textContent = 'Monitoring stamps';
                        }
                    } else if (triggerType === 'poll') {
                        const interval = triggerConfig.interval_seconds || 300;
                        const minutes = Math.floor(interval / 60);
                        text.textContent = minutes > 0 ? `Every ${minutes}min` : 'Continuous';
                    } else if (triggerType === 'cron') {
                        text.textContent = triggerConfig.schedule || triggerConfig.expression || '* * * * *';
                    } else if (triggerType === 'webhook') {
                        text.textContent = triggerConfig.endpoint || 'HTTP trigger';
                    } else if (triggerType === 'database_watch') {
                        const table = triggerConfig.table || 'unknown';
                        text.textContent = `Watching: ${table}`;
                    } else {
                        text.textContent = firstQuest.title || 'Untitled Quest';
                    }
                    
                    if (group.quests.length > 1) {
                        text.textContent += ` (${group.quests.length} quests)`;
                    }
                    info.appendChild(text);
                }
                
                card.appendChild(preview);
                card.appendChild(info);
                
                // Click handler
                card.onclick = () => showGroupWithBuffer(i);
                
                carouselMiniPreviews.appendChild(card);
            }
            
            // Initialize notch position
            updateNotchPosition(0);
            
            // Add slider interaction
            let isDragging = false;
            
            carouselSlider.addEventListener('mousedown', startDrag);
            carouselSlider.addEventListener('touchstart', startDrag);
            
            function startDrag(e) {
                isDragging = true;
                updateFromPosition(e);
                document.addEventListener('mousemove', onDrag);
                document.addEventListener('mouseup', stopDrag);
                document.addEventListener('touchmove', onDrag);
                document.addEventListener('touchend', stopDrag);
            }
            
            function onDrag(e) {
                if (!isDragging) return;
                e.preventDefault();
                updateFromPosition(e);
            }
            
            function stopDrag() {
                isDragging = false;
                document.removeEventListener('mousemove', onDrag);
                document.removeEventListener('mouseup', stopDrag);
                document.removeEventListener('touchmove', onDrag);
                document.removeEventListener('touchend', stopDrag);
            }
            
            function updateFromPosition(e) {
                const rect = carouselSlider.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const x = clientX - rect.left;
                const percent = Math.max(0, Math.min(1, x / rect.width));
                const index = Math.round(percent * (questGroups.length - 1));
                
                if (index !== currentGroupIndex) {
                    showGroupWithBuffer(index);
                }
            }
        }
        
        function updateNotchPosition(index) {
            const percent = questGroups.length > 1 ? index / (questGroups.length - 1) : 0;
            const sliderWidth = carouselSlider.offsetWidth;
            const x = 10 + (sliderWidth - 20) * percent;
            carouselNotch.style.left = `${x}px`;
        }
        
        async function showGroupWithBuffer(index) {
            if (index < 0 || index >= questGroups.length) return;
            
            currentGroupIndex = index;
            
            // Save current index to localStorage for session persistence
            localStorage.setItem('quests_current_group_index', index.toString());
            
            updateNotchPosition(index);
            
            // Update active state on mini cards
            document.querySelectorAll('.origin-mini-card').forEach((card, i) => {
                card.classList.toggle('active', i === index);
            });
            
            // Load current group
            if (!loadedGroups.has(index)) {
                await loadGroup(index);
            }
            
            // Preload buffer (previous and next 2 groups)
            const bufferIndices = [
                index - 2, index - 1, index + 1, index + 2
            ].filter(i => i >= 0 && i < questGroups.length && !loadedGroups.has(i));
            
            // Load buffer in background
            bufferIndices.forEach(i => {
                setTimeout(() => loadGroup(i), 100);
            });
            
            // Display current group
            await displayGroup(index);
        }
        
        async function loadGroup(index) {
            if (loadedGroups.has(index)) return;
            
            const group = questGroups[index];
            
            // Only fetch post data for bsky_reply quests with URIs
            const firstQuest = group.quests[0];
            const triggerType = firstQuest?.trigger_type || 'bsky_reply';
            
            if (triggerType === 'bsky_reply' && group.uri) {
                await fetchPostData(group.uri);  // Ensure post data is cached
            }
            
            loadedGroups.add(index);
        }
        
        async function displayGroup(index) {
            const group = questGroups[index];
            
            // Load post preview
            await loadPostPreview(group.uri, group.bsky_url, group.quests);
            
            // Load quest cards
            loadQuestCards(group);
            
            // Show quest section
            document.getElementById('quest-cards').style.display = 'flex';
        }

        async function loadPostPreview(uri, bskyUrl, quests) {
            const artContainer = document.getElementById('post-preview-art');
            const detailsContainer = document.getElementById('post-preview-details');
            
            detailsContainer.innerHTML = '<div class="loading">Loading...</div>';
            
            // Determine trigger type from first quest (all in group should have same trigger)
            const firstQuest = quests[0];
            const triggerType = firstQuest?.trigger_type || 'bsky_reply';
            const questTitle = firstQuest?.title || 'Untitled Quest';
            const questDescription = firstQuest?.description || '';
            const questEnabled = firstQuest?.enabled;
            
            // For non-bsky triggers, show editable trigger config
            if (triggerType !== 'bsky_reply' || !uri) {
                const triggerIcons = {
                    'bibliohose': '📚',
                    'poll': '🔄',
                    'webhook': '🪝',
                    'cron': '⏰',
                    'database_watch': '👁️',
                    'bsky_reply': '💬',
                    'firehose_phrase': '🔍'
                };
                
                const triggerLabels = {
                    'bibliohose': 'Reading Activity Monitor',
                    'poll': 'API Polling Trigger',
                    'webhook': 'HTTP Webhook',
                    'cron': 'Time-Based Schedule',
                    'database_watch': 'Database Monitor',
                    'bsky_reply': 'Bluesky Reply Monitor',
                    'firehose_phrase': 'Phrase/Hashtag Monitor'
                };
                
                const triggerDescriptions = {
                    'bibliohose': 'Monitors biblio.bond for reading activity. Triggers when dreamers stamp books on the specified reading list. Configure the list_rkey in the trigger config below.',
                    'poll': 'Periodically polls an API endpoint. Configure interval and source in the trigger config. Useful for checking external data sources.',
                    'webhook': 'Receives HTTP POST requests from external services. Configure endpoint path and authentication in trigger config.',
                    'cron': 'Runs on a time-based schedule using cron expressions. Perfect for daily check-ins, weekly summaries, or timed events.',
                    'database_watch': 'Watches for changes to database tables. Triggers when specified table events occur (insert, update, delete).',
                    'bsky_reply': 'Monitors Bluesky firehose for replies to a specific post. Enter the post URI above.',
                    'firehose_phrase': 'Monitors the public Bluesky firehose for posts containing specific hashtags or phrases. Perfect for tracking mentions, community events, or automated responses.'
                };
                
                // Enhanced art container with gradient background matching trigger type
                const triggerColors = {
                    'bibliohose': 'linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%)',
                    'poll': 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    'webhook': 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                    'cron': 'linear-gradient(135deg, #e7e5e4 0%, #d6d3d1 100%)',
                    'database_watch': 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)',
                    'bsky_reply': 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    'firehose_phrase': 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)'
                };
                
                artContainer.style.background = triggerColors[triggerType] || 'var(--hover-bg)';
                
                // Build the art panel content with stats at the bottom
                let artContent = `
                    <div style="text-align: center; padding: 1.5rem; display: flex; flex-direction: column; height: 100%; justify-content: space-between;">
                        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                            <div style="font-size: 4rem; margin-bottom: 0.75rem; line-height: 1;">${triggerIcons[triggerType] || '⚡'}</div>
                            <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.75rem;">${triggerLabels[triggerType] || triggerType}</div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4; padding: 0 1rem; margin-bottom: 0.75rem;">${triggerDescriptions[triggerType] || 'Custom trigger type'}</div>
                            
                            <!-- Status badges -->
                            <div style="display: flex; gap: 0.5rem; justify-content: center; margin-bottom: 0.75rem;">
                                <div style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; ${questEnabled ? 'background: #dcfce7; color: #166534;' : 'background: #fee2e2; color: #991b1b;'}">${questEnabled ? '✓ Active' : '✕ Inactive'}</div>
                                <div style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(0,0,0,0.05); color: var(--text-secondary);">${triggerLabels[triggerType] || triggerType}</div>
                            </div>`;
                
                // For bibliohose, show comprehensive monitoring details
                if (triggerType === 'bibliohose') {
                    let config = {};
                    try {
                        if (firstQuest.trigger_config) {
                            config = JSON.parse(firstQuest.trigger_config);
                        }
                    } catch (e) {
                        config = {};
                    }
                    
                    const listUri = config.list_rkey || '';  // Will now be full URI
                    const bookTitle = config.book_title || '';
                    const collections = config.collections || [];
                    
                    // Determine what's being monitored
                    const hasStamps = collections.length === 0 || collections.includes('biblio.bond.stamps');
                    const hasBooks = collections.length === 0 || collections.includes('biblio.bond.book');
                    const hasLists = collections.length === 0 || collections.includes('biblio.bond.list');
                    
                    artContent += `
                        <div id="biblio-monitor-details" style="margin-top: 0.5rem; padding: 0.75rem; background: rgba(255,255,255,0.9); border-radius: 6px; text-align: left; font-size: 0.7rem;">`;
                    
                    // Explain what this quest monitors
                    artContent += `
                        <div style="margin-bottom: 0.75rem; padding: 0.75rem; background: linear-gradient(135deg, rgba(147, 51, 234, 0.1), rgba(107, 33, 168, 0.05)); border-left: 3px solid #9333ea; border-radius: 4px;">
                            <div style="font-weight: 700; color: #6b21a8; margin-bottom: 0.4rem; font-size: 0.75rem;">📚 BIBLIOHOSE MONITOR</div>
                            <div style="color: #4c1d95; font-size: 0.7rem; line-height: 1.5;">
                                This quest watches the biblio.bond firehose for reading activity across the network.
                                ${listUri ? 'It triggers when specific list completion stamps are issued.' : 'Configure filters below to specify what to monitor.'}
                            </div>
                        </div>`;
                    
                    if (listUri) {
                        artContent += `
                            <div id="biblio-list-title" style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(0,0,0,0.1); font-size: 0.7rem; color: #6b7280;">Loading list details...</div>`;
                    }
                    
                    artContent += `
                        <div style="margin-bottom: 0.75rem;">
                            <div style="font-weight: 700; color: #6b21a8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem; font-size: 0.7rem;">🔔 TRIGGERS WHEN</div>`;
                    
                    if (hasStamps) {
                        artContent += `
                            <div style="display: flex; align-items: start; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0.4rem; background: rgba(5, 150, 105, 0.05); border-radius: 4px;">
                                <span style="color: #059669; font-size: 1.1rem;">✅</span>
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: #065f46; font-size: 0.75rem; margin-bottom: 0.2rem;">Completion Stamps Issued</div>
                                    <div style="color: #6b7280; font-size: 0.65rem; line-height: 1.4;">
                                        ${listUri ? 
                                            `<strong>Anyone</strong> completes the reading list above and libre.reverie.house issues them a completion stamp. This quest will trigger <strong>for each dreamer</strong> who completes it.` : 
                                            `<strong>Anyone</strong> completes <strong>any</strong> reading list and receives a stamp from libre.reverie.house.`
                                        }
                                    </div>
                                </div>
                            </div>`;
                    }
                    
                    if (hasBooks) {
                        artContent += `
                            <div style="display: flex; align-items: start; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0.4rem; background: rgba(37, 99, 235, 0.05); border-radius: 4px;">
                                <span style="color: #2563eb; font-size: 1.1rem;">📖</span>
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: #1e40af; font-size: 0.75rem; margin-bottom: 0.2rem;">Book Reading Records</div>
                                    <div style="color: #6b7280; font-size: 0.65rem; line-height: 1.4;">
                                        Dreamers post biblio.bond.book records${bookTitle ? ` for books matching "<strong>${bookTitle}</strong>"` : ` for <strong>any book</strong>`}.
                                    </div>
                                </div>
                            </div>`;
                    }
                    
                    if (hasLists) {
                        artContent += `
                            <div style="display: flex; align-items: start; gap: 0.5rem; padding: 0.4rem; background: rgba(147, 51, 234, 0.05); border-radius: 4px;">
                                <span style="color: #9333ea; font-size: 1.1rem;">📋</span>
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: #6b21a8; font-size: 0.75rem; margin-bottom: 0.2rem;">Reading List Creation</div>
                                    <div style="color: #6b7280; font-size: 0.65rem; line-height: 1.4;">
                                        New reading lists are created via biblio.bond.list records.
                                    </div>
                                </div>
                            </div>`;
                    }
                    
                    if (!hasStamps && !hasBooks && !hasLists) {
                        artContent += `
                            <div style="color: #b45309; font-size: 0.7rem; padding: 0.5rem; background: rgba(180, 83, 9, 0.1); border-radius: 4px;">
                                ⚠️ <strong>Monitoring all biblio.bond activity</strong> - Select specific record types in the configuration panel →
                            </div>`;
                    }
                    
                    artContent += `
                        </div>`;
                    
                    if (bookTitle) {
                        artContent += `
                            <div style="padding-top: 0.75rem; border-top: 1px solid rgba(0,0,0,0.1);">
                                <div style="font-weight: 700; color: #6b21a8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.4rem; font-size: 0.7rem;">📚 BOOK FILTER</div>
                                <div style="padding: 0.4rem; background: rgba(37, 99, 235, 0.05); border-radius: 4px;">
                                    <div style="color: #1e40af; font-weight: 600; font-size: 0.75rem; margin-bottom: 0.2rem;">"${bookTitle}"</div>
                                    <div style="color: #6b7280; font-size: 0.65rem;">Only triggers for books with titles containing this text (case-insensitive)</div>
                                </div>
                            </div>`;
                    }
                    
                    artContent += `
                        </div>`;
                    
                    // Trigger list info fetch after rendering
                    if (listUri) {
                        setTimeout(() => loadBiblioListInfo(listUri), 100);
                    }
                }
                
                // Add monitoring stats for bibliohose
                let statsHtml = '';
                
                if (triggerType === 'bibliohose') {
                    // For bibliohose, show detailed monitoring stats
                    const enabledCount = quests.filter(q => q.enabled).length;
                    const listRkeys = new Set();
                    const bookFilters = new Set();
                    
                    quests.forEach(q => {
                        // Check trigger config for lists
                        if (q.trigger_config) {
                            try {
                                const config = JSON.parse(q.trigger_config);
                                if (config.list_rkey) {
                                    const rkey = config.list_rkey.split('/').pop();
                                    listRkeys.add(rkey);
                                }
                                if (config.book_title) {
                                    bookFilters.add(config.book_title);
                                }
                            } catch (e) {}
                        }
                        
                        // Check conditions for has_biblio_stamp
                        const conditions = q.conditions || [];
                        conditions.forEach(c => {
                            const cond = typeof c === 'object' ? c.condition : c;
                            if (cond && cond.includes('has_biblio_stamp:')) {
                                const rkey = cond.split(':')[1];
                                listRkeys.add(rkey);
                            }
                        });
                    });
                    
                    statsHtml = `
                        <div style="font-size: 0.7rem; font-weight: 600; color: #6b21a8; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">📊 Monitor Status</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <div style="background: rgba(255,255,255,0.5); padding: 0.4rem; border-radius: 4px; text-align: center;">
                                <div style="font-size: 1.1rem; font-weight: 700; color: ${enabledCount > 0 ? '#059669' : '#6b7280'};">${enabledCount}</div>
                                <div style="font-size: 0.6rem; color: #6b7280; text-transform: uppercase;">Active Quests</div>
                            </div>
                            <div style="background: rgba(255,255,255,0.5); padding: 0.4rem; border-radius: 4px; text-align: center;">
                                <div style="font-size: 1.1rem; font-weight: 700; color: #9333ea;">${listRkeys.size}</div>
                                <div style="font-size: 0.6rem; color: #6b7280; text-transform: uppercase;">Lists Tracked</div>
                            </div>
                        </div>
                        ${bookFilters.size > 0 ? `
                            <div style="font-size: 0.65rem; color: #6b7280; padding: 0.4rem; background: rgba(37,99,235,0.05); border-radius: 3px; margin-top: 0.5rem;">
                                📚 Book filters active: ${Array.from(bookFilters).join(', ')}
                            </div>
                        ` : ''}
                        <div style="margin-top: 0.5rem; padding: 0.4rem; background: ${enabledCount > 0 ? 'rgba(5,150,105,0.1)' : 'rgba(107,114,128,0.1)'}; border-radius: 4px; text-align: center;">
                            <div style="font-size: 0.65rem; color: ${enabledCount > 0 ? '#065f46' : '#6b7280'}; font-weight: 600;">
                                ${enabledCount > 0 ? '🟢 Bibliohose monitoring active' : '⚪ No active quests'}
                            </div>
                        </div>
                    `;
                } else {
                    // For other trigger types, show simple stats
                    statsHtml = `
                        <div style="margin-bottom: 0.3rem;"><strong>Quest Count:</strong> ${quests.length}</div>
                        <div><strong>Active:</strong> ${quests.filter(q => q.enabled).length} enabled</div>
                    `;
                }
                
                artContent += `
                        </div>
                        
                        <!-- Stats section at bottom -->
                        <div style="padding: 0.75rem; background: rgba(0,0,0,0.05); border-radius: 6px; font-size: 0.75rem; color: var(--text-secondary); text-align: left;">
                            ${statsHtml}
                        </div>
                    </div>
                `;
                
                artContainer.innerHTML = artContent;
                
                let html = `<div style="display: flex; flex-direction: column; gap: 1rem;">`;
                
                // Title and Description (editable) - compact description
                html += `<div style="border-bottom: 1px solid var(--card-border); padding-bottom: 0.75rem;">`;
                html += `<input type="text" id="preview-quest-title" value="${questTitle}" 
                         placeholder="Quest Title"
                         oninput="updatePreviewDisplay()"
                         style="width: 100%; font-size: 1.2rem; font-weight: 700; border: 1px solid var(--card-border); padding: 0.5rem; border-radius: 4px; font-family: Arial, sans-serif; ${!questEnabled ? 'color: #dc2626;' : ''}" />`;
                html += `<input type="text" id="preview-quest-description" placeholder="Brief description (optional)"
                         value="${questDescription}"
                         oninput="updatePreviewDisplay()"
                         style="width: 100%; margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-secondary); border: 1px solid var(--card-border); padding: 0.4rem 0.5rem; border-radius: 3px; font-family: Arial, sans-serif;" />`;
                html += `</div>`;
                
                // Trigger Configuration Section
                html += `<div style="padding: 0.75rem; background: linear-gradient(135deg, rgba(115, 75, 161, 0.03) 0%, rgba(115, 75, 161, 0.08) 100%); border-left: 4px solid #734ba1; border-radius: 4px;">`;
                html += `<div style="font-size: 0.7rem; font-weight: 700; color: #734ba1; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">TRIGGER CONFIGURATION</div>`;
                
                // Trigger type selector (full width)
                html += `<div style="margin-bottom: 0.75rem;">`;
                html += `<label style="font-size: 0.7rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.25rem;">Trigger Type:</label>`;
                html += `<select id="preview-trigger-type" onchange="updatePreviewTriggerFields()" style="width: 100%; padding: 0.4rem 0.6rem; background: white; border: 1px solid #cbd5e1; border-radius: 3px; font-family: monospace; font-size: 0.75rem; color: #64748b;">`;
                html += `<option value="bsky_reply" ${triggerType === 'bsky_reply' ? 'selected' : ''}>Bluesky Reply</option>`;
                html += `<option value="bibliohose" ${triggerType === 'bibliohose' ? 'selected' : ''}>Bibliohose</option>`;
                html += `<option value="firehose_phrase" ${triggerType === 'firehose_phrase' ? 'selected' : ''}>Phrase Monitor</option>`;
                html += `<option value="poll" ${triggerType === 'poll' ? 'selected' : ''}>Polling</option>`;
                html += `<option value="webhook" ${triggerType === 'webhook' ? 'selected' : ''}>Webhook</option>`;
                html += `<option value="cron" ${triggerType === 'cron' ? 'selected' : ''}>Scheduled</option>`;
                html += `<option value="database_watch" ${triggerType === 'database_watch' ? 'selected' : ''}>Database Watch</option>`;
                html += `</select>`;
                html += `</div>`;
                
                // Container for dynamic fields
                html += `<div id="preview-trigger-fields">`;
                
                // URI field for bsky_reply
                if (triggerType === 'bsky_reply') {
                    html += `<div style="margin-bottom: 0.5rem;">`;
                    html += `<label style="font-size: 0.75rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.25rem;">URI:</label>`;
                    html += `<input type="text" id="preview-trigger-uri" value="${uri || ''}" placeholder="at://did:plc:.../app.bsky.feed.post/..."
                             style="width: 100%; padding: 0.4rem 0.6rem; background: white; border: 1px solid #cbd5e1; border-radius: 3px; font-family: monospace; font-size: 0.7rem; color: #64748b;" />`;
                    html += `</div>`;
                }
                
                // Bibliohose-specific fields
                else if (triggerType === 'bibliohose') {
                    let config = {};
                    try {
                        config = firstQuest.trigger_config ? JSON.parse(firstQuest.trigger_config) : {};
                    } catch (e) {
                        config = {};
                    }
                    
                    const listRkey = config.list_rkey || '';
                    const bookTitle = config.book_title || '';
                    const collections = config.collections || [];
                    
                    const hasStamps = collections.length === 0 || collections.includes('biblio.bond.stamps') || collections.includes('biblio.bond.completion');
                    const hasBook = collections.length === 0 || collections.includes('biblio.bond.book') || collections.includes('biblio.bond.record');
                    const hasList = collections.length === 0 || collections.includes('biblio.bond.list');
                    
                    // Explanatory header
                    html += `<div style="margin-bottom: 0.75rem; padding: 0.5rem; background: rgba(147, 51, 234, 0.08); border-left: 3px solid #9333ea; border-radius: 3px;">
                        <div style="font-size: 0.7rem; color: #6b21a8; line-height: 1.5;">
                            <strong>Bibliohose monitors biblio.bond activity across the network.</strong><br>
                            Configure what to watch below. Most common: monitor stamps for a specific reading list.
                        </div>
                    </div>`;
                    
                    // Two-column layout for list URI and book filters
                    html += `<div style="margin-bottom: 0.5rem;">`;
                    
                    // List URI field (full width - needs the complete AT URI)
                    html += `<div style="margin-bottom: 0.75rem;">`;
                    html += `<label style="font-size: 0.7rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.25rem;">📋 Reading List URI (Optional):</label>`;
                    html += `<input type="text" id="biblio-list-uri" value="${listRkey}" placeholder="at://did:plc:d5fnxwskloett4pb7dicp6c6/biblio.bond.list/3m6723l4dj22c"
                             style="width: 100%; padding: 0.35rem 0.5rem; background: white; border: 1px solid #cbd5e1; border-radius: 3px; font-family: monospace; font-size: 0.65rem; color: #64748b;"
                             oninput="updateBiblioMonitorPanel()"
                             onblur="if(this.value && this.value.trim() && this.value.startsWith('at://')) loadBiblioListInfo(this.value)" />`;
                    html += `<div style="font-size: 0.65rem; color: #6b7280; margin-top: 0.3rem; line-height: 1.4;">
                        <strong>For stamp monitoring:</strong> Paste the full AT URI of the reading list (e.g., at://did:plc:xxx/biblio.bond.list/3m6723l4dj22c).<br>
                        Leave empty to trigger on stamps for <em>any</em> reading list.
                    </div>`;
                    html += `</div>`;
                    
                    // Book title filter
                    html += `<div>`;
                    html += `<label style="font-size: 0.7rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.25rem;">Book Title Filter:</label>`;
                    html += `<input type="text" id="biblio-book-title" value="${bookTitle}" placeholder="The Dispossessed"
                             style="width: 100%; padding: 0.35rem 0.5rem; background: white; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 0.7rem; color: #64748b;"
                             oninput="updateBiblioMonitorPanel()" />`;
                    html += `<div style="font-size: 0.65rem; color: #6b7280; margin-top: 0.2rem;">Optional: Only trigger for books matching this title (partial match)</div>`;
                    html += `</div>`;
                    
                    html += `</div>`;
                    
                    // Record type checkboxes (full width)
                    html += `<div style="margin-bottom: 0.5rem;">`;
                    html += `<label style="font-size: 0.7rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.4rem;">🔔 Trigger When These Records Appear:</label>`;
                    html += `<div style="display: flex; flex-direction: column; gap: 0.35rem; padding: 0.5rem; background: rgba(0,0,0,0.02); border-radius: 4px; border: 1px solid rgba(0,0,0,0.05);">`;
                    
                    html += `<label style="display: flex; align-items: start; gap: 0.5rem; font-size: 0.7rem; cursor: pointer; padding: 0.3rem; border-radius: 3px; transition: background 0.15s;" 
                                    onmouseover="this.style.background='rgba(5,150,105,0.05)'" 
                                    onmouseout="this.style.background='transparent'">
                                <input type="checkbox" id="biblio-coll-stamps" ${hasStamps ? 'checked' : ''} style="cursor: pointer; margin-top: 0.15rem;" onchange="updateBiblioMonitorPanel()">
                                <div>
                                    <div style="font-weight: 600; color: #065f46;">✅ Completion Stamps</div>
                                    <div style="font-size: 0.65rem; color: #6b7280; line-height: 1.3; margin-top: 0.1rem;">
                                        Triggers when <strong>anyone</strong> completes ${listRkey ? 'the specified list' : 'any list'} and libre.reverie.house issues them a stamp
                                    </div>
                                </div>
                             </label>`;
                    
                    html += `<label style="display: flex; align-items: start; gap: 0.5rem; font-size: 0.7rem; cursor: pointer; padding: 0.3rem; border-radius: 3px; transition: background 0.15s;" 
                                    onmouseover="this.style.background='rgba(37,99,235,0.05)'" 
                                    onmouseout="this.style.background='transparent'">
                                <input type="checkbox" id="biblio-coll-book" ${hasBook ? 'checked' : ''} style="cursor: pointer; margin-top: 0.15rem;" onchange="updateBiblioMonitorPanel()">
                                <div>
                                    <div style="font-weight: 600; color: #1e40af;">📖 Reading Records</div>
                                    <div style="font-size: 0.65rem; color: #6b7280; line-height: 1.3; margin-top: 0.1rem;">
                                        Triggers when dreamers post biblio.bond.book records${bookTitle ? ' matching book filter' : ''}
                                    </div>
                                </div>
                             </label>`;
                    
                    html += `<label style="display: flex; align-items: start; gap: 0.5rem; font-size: 0.7rem; cursor: pointer; padding: 0.3rem; border-radius: 3px; transition: background 0.15s;" 
                                    onmouseover="this.style.background='rgba(147,51,234,0.05)'" 
                                    onmouseout="this.style.background='transparent'">
                                <input type="checkbox" id="biblio-coll-list" ${hasList ? 'checked' : ''} style="cursor: pointer; margin-top: 0.15rem;" onchange="updateBiblioMonitorPanel()">
                                <div>
                                    <div style="font-weight: 600; color: #6b21a8;">📋 List Creation</div>
                                    <div style="font-size: 0.65rem; color: #6b7280; line-height: 1.3; margin-top: 0.1rem;">
                                        Triggers when new biblio.bond.list records are created
                                    </div>
                                </div>
                             </label>`;
                    
                    html += `</div>`;
                    html += `<div style="font-size: 0.65rem; color: #b45309; background: rgba(180,83,9,0.05); padding: 0.3rem 0.4rem; border-radius: 3px; margin-top: 0.3rem;">
                        ℹ️ If <strong>none</strong> are checked, all biblio.bond record types will trigger this quest
                    </div>`;
                    html += `</div>`;
                }
                
                // Firehose phrase-specific fields
                else if (triggerType === 'firehose_phrase') {
                    let config = {};
                    try {
                        config = firstQuest.trigger_config ? JSON.parse(firstQuest.trigger_config) : {};
                    } catch (e) {
                        config = {};
                    }
                    
                    const phrases = config.phrases || [];
                    const phrasesText = Array.isArray(phrases) ? phrases.join(', ') : phrases;
                    const caseSensitive = config.case_sensitive || false;
                    const matchWholeWords = config.match_whole_words || false;
                    const excludeReposts = config.exclude_reposts !== false; // default true
                    
                    // Phrases field
                    html += `<div style="margin-bottom: 0.5rem;">`;
                    html += `<label style="font-size: 0.7rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.25rem;">Phrases to Monitor:</label>`;
                    html += `<input type="text" id="phrase-phrases" value="${phrasesText}" placeholder="#flawedcenter, flawed.center, welcome to"
                             style="width: 100%; padding: 0.35rem 0.5rem; background: white; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 0.7rem; color: #64748b;" />`;
                    html += `<div style="font-size: 0.65rem; color: #6b7280; margin-top: 0.2rem;">Comma-separated list of phrases, hashtags, or keywords to watch for</div>`;
                    html += `</div>`;
                    
                    // Options checkboxes
                    html += `<div style="margin-bottom: 0.5rem;">`;
                    html += `<label style="font-size: 0.7rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.25rem;">Options:</label>`;
                    html += `<div style="display: flex; flex-direction: column; gap: 0.25rem; padding: 0.4rem 0.5rem; background: rgba(0,0,0,0.02); border-radius: 3px;">`;
                    
                    html += `<label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; cursor: pointer;">
                                <input type="checkbox" id="phrase-case-sensitive" ${caseSensitive ? 'checked' : ''} style="cursor: pointer;">
                                <span>Case Sensitive - Match exact capitalization</span>
                             </label>`;
                    
                    html += `<label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; cursor: pointer;">
                                <input type="checkbox" id="phrase-whole-words" ${matchWholeWords ? 'checked' : ''} style="cursor: pointer;">
                                <span>Match Whole Words - Require word boundaries</span>
                             </label>`;
                    
                    html += `<label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; cursor: pointer;">
                                <input type="checkbox" id="phrase-exclude-reposts" ${excludeReposts ? 'checked' : ''} style="cursor: pointer;">
                                <span>Exclude Reposts - Only match original posts</span>
                             </label>`;
                    
                    html += `</div>`;
                    html += `</div>`;
                }
                
                // Generic config field for other trigger types
                else if (triggerType !== 'bsky_reply') {
                    const configValue = firstQuest.trigger_config ? JSON.stringify(JSON.parse(firstQuest.trigger_config), null, 2) : '';
                    const placeholders = {
                        'poll': '{"interval_seconds": 300}',
                        'webhook': '{"endpoint": "/webhook/quest-name"}',
                        'cron': '{"expression": "0 0 * * *"}',
                        'database_watch': '{"table": "table_name"}'
                    };
                    
                    html += `<div>`;
                    html += `<label style="font-size: 0.75rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.25rem;">Config (JSON):</label>`;
                    html += `<textarea id="preview-trigger-config" placeholder="${placeholders[triggerType] || '{}'}"
                             style="width: 100%; padding: 0.5rem; background: white; border: 1px solid #cbd5e1; border-radius: 3px; font-family: monospace; font-size: 0.7rem; color: #64748b; min-height: 80px; resize: vertical;">${configValue}</textarea>`;
                    html += `</div>`;
                }
                
                html += `</div>`;
                
                html += `</div>`;
                
                // Quest control buttons
                html += `<div class="quest-controls" style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">`;
                
                // Save button
                html += `<button class="quest-control-btn save" onclick="saveQuestFromPreview('${firstQuest.title}')"
                         style="flex: 1; padding: 0.5rem; background: #10b981; color: white; border: 1px solid #059669; border-radius: 4px; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; cursor: pointer; transition: all 0.2s;"
                         onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
                    Save
                </button>`;
                
                // Toggle button (Active/Inactive)
                const isActive = firstQuest.enabled;
                const toggleClass = isActive ? 'active' : 'inactive';
                const toggleBg = isActive ? '#3b82f6' : '#e5e7eb';
                const toggleColor = isActive ? 'white' : '#6b7280';
                const toggleBorder = isActive ? '#2563eb' : '#d1d5db';
                const toggleText = isActive ? 'Active' : 'Inactive';
                html += `<button class="quest-control-btn toggle ${toggleClass}" onclick="toggleQuestStatusFromPreview('${firstQuest.title}', ${!isActive})"
                         style="padding: 0.5rem 1rem; background: ${toggleBg}; color: ${toggleColor}; border: 1px solid ${toggleBorder}; border-radius: 4px; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; cursor: pointer; transition: all 0.2s;">
                    ${toggleText}
                </button>`;
                
                // Delete button
                html += `<button class="quest-control-btn delete" onclick="deleteQuestFromPreview('${firstQuest.title}')"
                         style="padding: 0.5rem 1rem; background: #ef4444; color: white; border: 1px solid #dc2626; border-radius: 4px; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; cursor: pointer; transition: all 0.2s;"
                         onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
                    Delete
                </button>`;
                
                html += `</div>`;
                
                html += `</div>`;
                
                detailsContainer.innerHTML = html;
                return;
            }
            
            // For bsky_reply triggers, load post data as before
            const postData = await fetchPostData(uri);
            
            if (!postData) {
                artContainer.innerHTML = '<div class="no-image">⚠️</div>';
                
                // Show fallback info with URI details
                const uriParts = uri ? uri.replace('at://', '').split('/') : [];
                const did = uriParts[0] || 'Unknown';
                const postId = uriParts[2] || 'Unknown';
                
                let html = '<div class="error-message">Could not load post from Bluesky</div>';
                html += '<div class="post-meta-grid">';
                html += `<div class="post-meta-label">URI:</div><div class="post-meta-value">${uri || 'None'}</div>`;
                if (uriParts.length >= 3) {
                    html += `<div class="post-meta-label">DID:</div><div class="post-meta-value">${did}</div>`;
                    html += `<div class="post-meta-label">Post ID:</div><div class="post-meta-value">${postId}</div>`;
                }
                html += '<div class="post-meta-label">Status:</div><div class="post-meta-value">Post may have been deleted or is not accessible</div>';
                html += '</div>';
                
                detailsContainer.innerHTML = html;
                return;
            }
            
            // Update art - use contained images
            if (postData.images.length > 0) {
                artContainer.innerHTML = `<img src="${postData.images[0].fullsize}" alt="Post image">`;
            } else if (postData.author.avatar) {
                // Use avatar as fallback
                artContainer.innerHTML = `<img src="${postData.author.avatar}" alt="Avatar" style="object-fit: cover;">`;
            } else {
                artContainer.innerHTML = '<div class="no-image">📝</div>';
            }
            
            // Extract URI parts
            const uriParts = uri.replace('at://', '').split('/');
            const did = uriParts[0];
            const postId = uriParts[2];
            
            // Helper function for time ago
            function timeAgo(dateString) {
                const date = new Date(dateString);
                const now = new Date();
                const seconds = Math.floor((now - date) / 1000);
                
                if (seconds < 60) return `${seconds}s ago`;
                const minutes = Math.floor(seconds / 60);
                if (minutes < 60) return `${minutes}m ago`;
                const hours = Math.floor(minutes / 60);
                if (hours < 24) return `${hours}h ago`;
                const days = Math.floor(hours / 24);
                if (days < 30) return `${days}d ago`;
                const months = Math.floor(days / 30);
                if (months < 12) return `${months}mo ago`;
                const years = Math.floor(months / 12);
                return `${years}y ago`;
            }
            
            // Build details
            let html = '';
            
            // Author row
            html += '<div class="post-author-row">';
            if (postData.author.avatar) {
                html += `<img src="${postData.author.avatar}" class="post-author-avatar" alt="Avatar">`;
            }
            html += `
                <div class="post-author-info">
                    <div class="post-author-handle">@${postData.author.handle}</div>
                    <div class="post-author-date">${timeAgo(postData.createdAt)}</div>
                </div>
            </div>`;
            
            // Text preview
            if (postData.text) {
                html += `<div class="post-text-preview">${postData.text}</div>`;
            }
            
            // Stats row (likes, reposts, etc)
            if (postData.likeCount !== undefined || postData.repostCount !== undefined || postData.replyCount !== undefined) {
                html += '<div class="post-stats-row">';
                if (postData.likeCount !== undefined) {
                    html += `<div class="post-stat"><span class="post-stat-value">${postData.likeCount}</span> likes</div>`;
                }
                if (postData.repostCount !== undefined) {
                    html += `<div class="post-stat"><span class="post-stat-value">${postData.repostCount}</span> reposts</div>`;
                }
                if (postData.replyCount !== undefined) {
                    html += `<div class="post-stat"><span class="post-stat-value">${postData.replyCount}</span> replies</div>`;
                }
                html += '</div>';
            }
            
            // URL
            html += `<a href="${postData.url}" target="_blank" class="post-url">${postData.url}</a>`;
            
            // Quest counters
            const totalQuests = quests.length;
            const activeQuests = quests.filter(q => q.enabled).length;
            const inactiveQuests = totalQuests - activeQuests;
            
            html += '<div class="quest-counter">';
            html += `<div class="quest-counter-item"><span class="quest-counter-value active">${activeQuests}</span> active quests</div>`;
            html += `<div class="quest-counter-item"><span class="quest-counter-value inactive">${inactiveQuests}</span> inactive</div>`;
            html += '</div>';
            
            detailsContainer.innerHTML = html;
        }

        function loadQuestCards(group) {
            console.log('=== LOAD QUEST CARDS ===');
            console.log('Group:', group);
            
            const questCards = document.getElementById('quest-cards');
            
            questCards.innerHTML = '';
            
            // Sort quests: enabled (active) first by last edit (most recent first), then disabled at the end
            const sortedQuests = [...group.quests].sort((a, b) => {
                // First sort by enabled status - disabled quests go to the end
                if (a.enabled !== b.enabled) {
                    return b.enabled ? 1 : -1; // enabled quests first
                }
                
                // For enabled quests, sort by last edit time (newest first)
                // For disabled quests, also sort by last edit time
                const aTime = a.updated_at || a.created_at || 0;
                const bTime = b.updated_at || b.created_at || 0;
                return bTime - aTime;
            });
            
            sortedQuests.forEach(quest => {
                console.log(`Processing quest ${quest.title}, conditions type:`, typeof quest.conditions, quest.conditions);
                
                // Parse conditions if it's a JSON string
                if (quest.conditions && typeof quest.conditions === 'string') {
                    try {
                        quest.conditions = JSON.parse(quest.conditions);
                        console.log(`✅ Parsed conditions for ${quest.title}:`, quest.conditions);
                    } catch (e) {
                        console.error(`❌ Failed to parse conditions for ${quest.title}:`, e);
                        quest.conditions = null; // Set to null on parse error
                    }
                }
                
                // Handle null or invalid conditions
                if (quest.conditions === null || quest.conditions === undefined || quest.conditions === '') {
                    quest.conditions = [];
                }
                
                // Store quest data for editing functions
                questDataMap[quest.title] = quest;
                
                // Determine trigger type early for conditional rendering
                const triggerType = quest.trigger_type || 'bsky_reply';
                
                const card = document.createElement('div');
                card.className = 'quest-card';
                
                // Add red border for disabled quests
                if (!quest.enabled) {
                    card.style.border = '2px solid #ef4444';
                    card.style.opacity = '0.85';
                }
                
                // Details section - two column layout (CONDITIONS and COMMANDS)
                const details = document.createElement('div');
                details.className = 'quest-details';
                
                // LEFT: Conditions Section
                const conditionsSection = document.createElement('div');
                conditionsSection.className = 'quest-trigger-section';
                
                const conditionsTitle = document.createElement('div');
                conditionsTitle.className = 'quest-section-title';
                conditionsTitle.textContent = 'CONDITIONS';
                conditionsSection.appendChild(conditionsTitle);
                
                // Add Condition button
                const addConditionBtn = document.createElement('button');
                addConditionBtn.className = 'add-item-btn';
                addConditionBtn.innerHTML = '<span>+</span><span>Add Condition</span>';
                addConditionBtn.style.position = 'relative';
                addConditionBtn.onclick = (e) => {
                    e.stopPropagation();
                    showConditionDropdown(addConditionBtn, quest.title);
                };
                conditionsSection.appendChild(addConditionBtn);
                
                // Support both old single condition and new conditions array
                const conditionsToRender = [];
                if (quest.conditions && Array.isArray(quest.conditions) && quest.conditions.length > 0) {
                    conditionsToRender.push(...quest.conditions);
                } else if (quest.condition) {
                    // Create a proper condition object for rendering
                    const condObj = { type: 'condition', condition: quest.condition, operator: 'AND' };
                    conditionsToRender.push(condObj);
                    // Update quest.conditions only if it doesn't exist yet (don't keep overwriting)
                    if (!quest.conditions || quest.conditions.length === 0) {
                        quest.conditions = [condObj];
                    }
                }
                
                conditionsToRender.forEach((condItem, condIndex) => {
                    // Skip null or invalid condition items
                    if (!condItem) {
                        console.warn(`Skipping null condition at index ${condIndex} for quest ${quest.title}`);
                        return;
                    }
                    
                    // Handle both old string format and new object format
                    let condString, condOperator;
                    if (typeof condItem === 'string') {
                        condString = condItem;
                        condOperator = 'AND';
                    } else {
                        condString = condItem.condition;
                        condOperator = condItem.operator || 'AND';
                    }
                    
                    // Skip if no condition string
                    if (!condString) {
                        console.warn(`Skipping condition with no condition string at index ${condIndex} for quest ${quest.title}`);
                        return;
                    }
                    
                    const condContainer = document.createElement('div');
                    condContainer.className = 'quest-condition-item';
                    condContainer.draggable = false;
                    condContainer.dataset.type = 'condition';
                    condContainer.dataset.questTitle = quest.title;
                    condContainer.dataset.conditionIndex = condIndex;
                    
                    // Create gripper zone with notches
                    const gripperZone = document.createElement('div');
                    gripperZone.className = 'drag-handle-zone';
                    gripperZone.draggable = true;
                    for (let i = 0; i < 3; i++) {
                        const notch = document.createElement('div');
                        notch.className = 'drag-notch';
                        gripperZone.appendChild(notch);
                    }
                    
                    // Show operator selector (except for first condition)
                    if (condIndex > 0) {
                        const operatorRow = document.createElement('div');
                        operatorRow.style.cssText = 'text-align: center; margin: 0.5rem 0; padding: 0.25rem; background: rgba(0,0,0,0.1); border-radius: 4px; max-width: 140px; margin-left: auto; margin-right: auto;';
                        
                        const operatorSelect = document.createElement('select');
                        operatorSelect.className = 'quest-item-input';
                        operatorSelect.style.cssText = 'width: auto; padding: 0.25rem 0.5rem; display: inline-block; font-size: 0.7rem; font-weight: bold;';
                        operatorSelect.dataset.questTitle = quest.title;
                        operatorSelect.dataset.conditionIndex = condIndex;
                        operatorSelect.innerHTML = `
                            <option value="AND" ${condOperator === 'AND' ? 'selected' : ''}>AND</option>
                            <option value="OR" ${condOperator === 'OR' ? 'selected' : ''}>OR</option>
                            <option value="AND_NOT" ${condOperator === 'AND_NOT' ? 'selected' : ''}>AND NOT</option>
                            <option value="OR_NOT" ${condOperator === 'OR_NOT' ? 'selected' : ''}>OR NOT</option>
                        `;
                        operatorSelect.onchange = function() {
                            saveConditionOperator(quest.title, condIndex, this.value);
                        };
                        
                        operatorRow.appendChild(operatorSelect);
                        condContainer.appendChild(operatorRow);
                    }
                    
                    // Build content div
                    const condContentDiv = document.createElement('div');
                    
                    let condHTML = `<code>${condString}</code>`;
                    
                    if (condString.startsWith('reply_contains:')) {
                        const searchText = condString.split(':').slice(1).join(':');
                        const words = searchText.split(',').map(w => w.trim());
                        condHTML = `<div style="text-align: center;">
                                        <code>reply_contains:</code>
                                        <input type="text" 
                                            class="quest-item-input" 
                                            value="${words.join(', ')}" 
                                            data-quest-title="${quest.title}"
                                            data-condition-index="${condIndex}"
                                            onblur="saveReplyContains(this)"
                                            placeholder="word1, word2, word3"
                                            style="width: 85%; margin-top: 0.5rem; display: block; margin-left: auto; margin-right: auto;">
                                    </div>`;
                    } else if (condString === 'any_reply') {
                        condHTML += '<br>Triggers on any reply to this post';
                    } else if (condString === 'new_reply') {
                        condHTML += '<br>Only new dreamers (not yet registered)';
                    } else if (condString === 'dreamer_replies') {
                        condHTML += '<br>Only registered dreamers';
                    } else if (condString === 'contains_hashtags') {
                        condHTML += '<br>Reply must contain #hashtags';
                    } else if (condString === 'contains_mentions') {
                        condHTML += '<br>Reply must contain @mentions';
                    } else if (condString.startsWith('has_canon:')) {
                        const key = condString.split(':')[1];
                        condHTML += `<br>User must have canon key: <strong>${key}</strong>`;
                    } else if (condString.startsWith('hasnt_canon:')) {
                        const key = condString.split(':')[1];
                        condHTML += `<br>User must NOT have canon key: <strong>${key}</strong>`;
                    } else if (condString.startsWith('user_canon_equals:')) {
                        const keyValue = condString.split(':')[1];
                        const [key, value] = keyValue.split('=');
                        condHTML += `<br>User canon <strong>${key}</strong> must equal <strong>${value}</strong>`;
                    } else if (condString.startsWith('user_canon_not_equals:')) {
                        const keyValue = condString.split(':')[1];
                        const [key, value] = keyValue.split('=');
                        condHTML += `<br>User canon <strong>${key}</strong> must NOT equal <strong>${value}</strong>`;
                    } else if (condString.startsWith('user_in_canon_list:')) {
                        const keyValues = condString.split(':')[1];
                        const [key, valuesList] = keyValues.split('=');
                        const values = valuesList.split(',');
                        condHTML += `<br>User canon <strong>${key}</strong> must be in: <strong>${values.join(', ')}</strong>`;
                    }
                    
                    condContentDiv.innerHTML = condHTML;
                    condContainer.appendChild(condContentDiv);
                    
                    // Add controls row at bottom (only for object format)
                    if (typeof condItem === 'object') {
                        const controlsRow = document.createElement('div');
                        controlsRow.style.cssText = 'display: flex; gap: 0.75rem; align-items: center; padding-top: 0.5rem; border-top: 1px solid rgba(0,0,0,0.15); margin-top: 0.5rem; padding-left: 24px;';
                        
                        // Self-destruct toggle
                        const selfDestructLabel = document.createElement('label');
                        selfDestructLabel.style.cssText = 'display: flex; align-items: center; gap: 0.35rem; cursor: pointer; font-size: 0.7rem; font-weight: 600; color: #dc2626;';
                        
                        const selfDestructCheckbox = document.createElement('input');
                        selfDestructCheckbox.type = 'checkbox';
                        selfDestructCheckbox.checked = condItem.once_only || false;
                        selfDestructCheckbox.style.cssText = 'cursor: pointer; width: 13px; height: 13px;';
                        selfDestructCheckbox.onchange = function() {
                            toggleConditionOnceOnly(quest.title, condIndex, this.checked);
                        };
                        
                        const selfDestructText = document.createElement('span');
                        selfDestructText.textContent = 'Self Destruct';
                        selfDestructText.title = 'After triggering once, this condition will disable itself';
                        
                        selfDestructLabel.appendChild(selfDestructCheckbox);
                        selfDestructLabel.appendChild(selfDestructText);
                        controlsRow.appendChild(selfDestructLabel);
                        
                        // Show disabled badge if condition is disabled
                        if (condItem.disabled) {
                            const disabledBadge = document.createElement('span');
                            disabledBadge.style.cssText = 'font-size: 0.65rem; padding: 0.2rem 0.5rem; background: #6b7280; color: white; border-radius: 3px; font-weight: 600; margin-left: auto;';
                            disabledBadge.textContent = '⏸ DISABLED';
                            controlsRow.appendChild(disabledBadge);
                            
                            // Add re-enable button
                            const reEnableBtn = document.createElement('button');
                            reEnableBtn.style.cssText = 'padding: 0.2rem 0.6rem; font-size: 0.65rem; background: #10b981; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: 600;';
                            reEnableBtn.textContent = '↻ Re-enable';
                            reEnableBtn.onclick = function() {
                                reEnableCondition(quest.title, condIndex);
                            };
                            controlsRow.appendChild(reEnableBtn);
                        }
                        
                        condContainer.appendChild(controlsRow);
                    }
                    
                    // Add delete button
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-item-btn';
                    deleteBtn.innerHTML = '×';
                    deleteBtn.title = 'Delete condition';
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation();
                        deleteCondition(quest.title, condIndex);
                    };
                    condContainer.appendChild(deleteBtn);
                    
                    condContainer.insertBefore(gripperZone, condContainer.firstChild);
                    setupDragAndDrop(condContainer, gripperZone);
                    
                    conditionsSection.appendChild(condContainer);
                });
                
                details.appendChild(conditionsSection);
                
                // RIGHT: Commands Section
                const actionsSection = document.createElement('div');
                actionsSection.className = 'quest-actions-section';
                
                const actionsTitle = document.createElement('div');
                actionsTitle.className = 'quest-section-title';
                actionsTitle.textContent = 'COMMANDS';
                actionsSection.appendChild(actionsTitle);
                
                // Add Command button
                const addCommandBtn = document.createElement('button');
                addCommandBtn.className = 'add-item-btn';
                addCommandBtn.innerHTML = '<span>+</span><span>Add Command</span>';
                addCommandBtn.style.position = 'relative';
                addCommandBtn.onclick = (e) => {
                    e.stopPropagation();
                    showCommandDropdown(addCommandBtn, quest.title);
                };
                actionsSection.appendChild(addCommandBtn);
                
                if (quest.commands && quest.commands.length > 0) {
                    quest.commands.forEach((cmd, index) => {
                        const cmdItem = document.createElement('div');
                        cmdItem.className = 'quest-command-item';
                        cmdItem.draggable = false; // Only draggable from handle zone
                        cmdItem.dataset.type = 'command';
                        cmdItem.dataset.questTitle = quest.title;
                        cmdItem.dataset.commandIndex = index;
                        
                        // Create gripper zone with notches
                        const gripperZone = document.createElement('div');
                        gripperZone.className = 'drag-handle-zone';
                        gripperZone.draggable = true;
                        for (let i = 0; i < 3; i++) {
                            const notch = document.createElement('div');
                            notch.className = 'drag-notch';
                            gripperZone.appendChild(notch);
                        }
                        
                        // Determine category for color coding
                        let category = 'default';
                        if (cmd.startsWith('award_souvenir')) {
                            category = 'souvenir';
                        } else if (cmd === 'like_post' || cmd === 'reply_post' || cmd.startsWith('reply_post:') || cmd === 'reply_origin_spectrum') {
                            category = 'bluesky';
                        } else if (cmd.startsWith('add_canon')) {
                            category = 'heading';
                        } else if (cmd === 'name_dreamer' || cmd === 'register_if_needed' || cmd === 'registration_check' || cmd === 'paired' || cmd === 'add_kindred') {
                            category = 'registration';
                        } else if (cmd.startsWith('add_name') || cmd === 'calculate_origin' || cmd.startsWith('mod_spectrum')) {
                            category = 'lore';
                        } else if (cmd === 'disable_quest') {
                            category = 'disable';
                        } else if (cmd === 'greet_newcomer' || cmd === 'declare_origin') {
                            category = 'work';
                        }
                        
                        if (category !== 'default') {
                            cmdItem.classList.add(`category-${category}`);
                        }
                        
                        const cmdHeader = document.createElement('div');
                        cmdHeader.className = 'quest-command-header';
                        
                        // Parse command details
                        let display = cmd;
                        let details = '';
                        let extraHTML = '';
                        
                        if (cmd === 'like_post') {
                            display = 'like_post';
                            details = 'Like the triggering post on Bluesky';
                        } else if (cmd === 'name_dreamer') {
                            display = 'name_dreamer';
                            details = 'Hear and assign dreamer name, handle, and first canons';
                        } else if (cmd === 'register_if_needed' || cmd === 'registration_check') {
                            display = 'register_new';
                            details = 'Register as dreamer in database if new';
                        } else if (cmd.startsWith('award_souvenir:')) {
                            const souvenirKey = cmd.split(':')[1];
                            display = 'award_souvenir';
                            details = '';
                            // Fetch and show souvenir with images - will be populated async
                            extraHTML = `<div class="souvenir-preview" data-souvenir-key="${souvenirKey}">
                                <div class="souvenir-loading">Loading souvenir...</div>
                            </div>`;
                        } else if (cmd.startsWith('add_canon:')) {
                            const parts = cmd.split(':').slice(1);
                            const key = parts[0] || '';
                            const event = parts[1] || quest.canon_event || 'Event recorded';
                            const type = parts[2] || 'event';
                            display = 'add_canon';
                            details = '';
                            
                            // Check if type is custom
                            const predefinedTypes = ['event', 'souvenir', 'milestone', 'memory', 'lore'];
                            const isCustomType = !predefinedTypes.includes(type);
                            
                            // Stacked editable format
                            extraHTML = `<div class="canon-preview">
                                <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
                                    <select class="canon-type-select" data-quest-title="${quest.title}" data-current-type="${type}" onchange="saveCanonType(this)">
                                        <option value="event" ${type === 'event' ? 'selected' : ''}>event</option>
                                        <option value="souvenir" ${type === 'souvenir' ? 'selected' : ''}>souvenir</option>
                                        <option value="milestone" ${type === 'milestone' ? 'selected' : ''}>milestone</option>
                                        <option value="memory" ${type === 'memory' ? 'selected' : ''}>memory</option>
                                        <option value="lore" ${type === 'lore' ? 'selected' : ''}>lore</option>
                                        <option value="__custom__" ${isCustomType ? 'selected' : ''}>+ custom type</option>
                                    </select>
                                    <input type="text" class="canon-type-custom quest-item-input" data-quest-title="${quest.title}" value="${isCustomType ? type : ''}" onblur="saveCanonTypeCustom(this)" placeholder="enter custom type" style="${isCustomType ? '' : 'display: none;'} width: 150px;">
                                    <input type="text" class="canon-key-input quest-item-input" data-quest-title="${quest.title}" value="${key}" onblur="saveCanonKey(this)" placeholder="canon key">
                                </div>
                                <input type="text" class="quest-item-input" data-quest-title="${quest.title}" value="${event}" onblur="saveCanonEvent(this)" placeholder="event description" style="width: 100%; margin-top: 0.5rem;">
                            </div>`;
                        } else if (cmd.startsWith('reply_post:')) {
                            display = 'reply_post';
                            const replyText = cmd.split(':').slice(1).join(':');
                            details = 'Send automated reply on Bluesky';
                            // Show which commands expose variables
                            let varHints = '';
                            if (replyText.includes('{{name}}')) {
                                varHints = '<div style="color: #8b5cf6; font-size: 0.7rem; margin-top: 0.25rem;">💡 {{name}} exposed by: name_dreamer, add_name</div>';
                            }
                            extraHTML = `<div style="margin-top: 0.5rem;"><input type="text" class="quest-item-input reply-post-input" data-quest-title="${quest.title}" data-command-index="${index}" value="${replyText}" onblur="saveReplyPost('${quest.title}', ${index}, this)" placeholder="Reply text (use {{name}} for variables)" style="width: 100%;">${varHints}</div>`;
                        } else if (cmd === 'reply_origin_spectrum') {
                            display = 'reply_origin_spectrum';
                            details = 'Calculate and reply with origin spectrum values';
                        } else if (cmd === 'disable_quest') {
                            display = 'disable_quest';
                            details = 'Disable the entire quest after completion';
                        } else if (cmd === 'paired') {
                            display = 'paired';
                            details = 'Establish Dream Pair bond (mutual 1:1 exclusive)';
                        } else if (cmd === 'add_kindred') {
                            display = 'add_kindred';
                            details = 'Add mentioned dreamers to kindred network';
                        } else if (cmd.startsWith('add_name:')) {
                            const name = cmd.split(':')[1] || '';
                            display = 'add_name';
                            details = '';
                            extraHTML = `<input type="text" class="quest-item-input" data-quest-title="${quest.title}" value="${name}" onblur="saveAddName(this)" placeholder="name to grant" style="width: 100%; margin-top: 0.5rem;">`;
                        } else if (cmd.startsWith('mod_spectrum:')) {
                            const multiplier = cmd.split(':')[1] || '0';
                            display = 'mod_spectrum';
                            details = '';
                            extraHTML = `<input type="text" class="quest-item-input" data-quest-title="${quest.title}" data-command-index="${index}" value="${multiplier}" onblur="saveModSpectrum(this)" placeholder="modifier (e.g., +1.5 or -0.5)" style="width: 100%; margin-top: 0.5rem;">`;
                        } else if (cmd === 'calculate_origin') {
                            display = 'calculate_origin';
                            details = 'Calculate origin spectrum for dreamer';
                        } else if (cmd === 'check_collaboration_partners') {
                            display = 'check_collaboration_partners';
                            details = 'Update collaboration partnerships';
                        } else if (cmd === 'greet_newcomer') {
                            display = 'greet_newcomer';
                            details = 'Post automated greeting from active greeter (if working)';
                            // Show greeter info and example message - will be populated async
                            extraHTML = `<div class="greeter-preview" data-loading="true">
                                <div class="greeter-loading">Loading greeter info...</div>
                            </div>`;
                        } else if (cmd === 'declare_origin') {
                            display = 'declare_origin';
                            details = 'Post origin spectrum coordinates from active mapper (if working)';
                            // Show mapper info and example coordinates - will be populated async
                            extraHTML = `<div class="mapper-preview" data-loading="true">
                                <div class="mapper-loading">Loading mapper info...</div>
                            </div>`;
                        }
                        
                        cmdHeader.innerHTML = `<code>${display}</code>`;
                        cmdItem.appendChild(cmdHeader);
                        
                        if (details) {
                            const detailsDiv = document.createElement('div');
                            detailsDiv.className = 'quest-command-details';
                            detailsDiv.textContent = details;
                            cmdItem.appendChild(detailsDiv);
                        }
                        
                        if (extraHTML) {
                            const extraDiv = document.createElement('div');
                            extraDiv.innerHTML = extraHTML;
                            cmdItem.appendChild(extraDiv);
                        }
                        
                        // Add delete button
                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'delete-item-btn';
                        deleteBtn.innerHTML = '×';
                        deleteBtn.title = 'Delete command';
                        deleteBtn.onclick = (e) => {
                            e.stopPropagation();
                            deleteCommand(quest.title, index);
                        };
                        cmdItem.appendChild(deleteBtn);
                        
                        cmdItem.insertBefore(gripperZone, cmdItem.firstChild);
                        setupDragAndDrop(cmdItem, gripperZone);
                        actionsSection.appendChild(cmdItem);
                    });
                }
                
                details.appendChild(actionsSection);
                
                card.appendChild(details);
                questCards.appendChild(card);
            });
            
            // Load souvenir data for all award_souvenir commands
            loadSouvenirData();
            
            // Load greeter data for all greet_newcomer commands
            loadGreeterData();
            
            // Load mapper data for all declare_origin commands
            loadMapperData();
        }
        
        async function loadSouvenirData() {
            try {
                const response = await fetch('/api/souvenirs');
                const souvenirs = await response.json();
                
                // Find all souvenir preview elements and populate them
                document.querySelectorAll('.souvenir-preview[data-souvenir-key]').forEach(element => {
                    const key = element.getAttribute('data-souvenir-key');
                    const souvenir = souvenirs[key];
                    
                    if (souvenir) {
                        const keepersCount = souvenir.keepers.length;
                        const monthsOld = souvenir.epoch ? Math.floor((Date.now() / 1000 - souvenir.epoch) / (30 * 24 * 60 * 60)) : 0;
                        
                        // Use the phanera and icon paths directly from the API data
                        const phanera = souvenir.phanera || `/souvenirs/${key}/phanera.png`;
                        const icon = souvenir.icon || `/souvenirs/${key}/icon.png`;
                        
                        element.innerHTML = `
                            <div>
                                <span class="souvenir-name">${souvenir.name}</span>
                                <span class="souvenir-key">(${key})</span>
                            </div>
                            <div class="souvenir-description">${souvenir.description || ''}</div>
                            <a href="/souvenirs?key=${key}" target="_blank" style="text-decoration: none; color: inherit;">
                                <div class="souvenir-image-container">
                                    <img class="souvenir-phanera" src="${phanera}" alt="${souvenir.name}">
                                    <div class="souvenir-icon-overlay">
                                        <img src="${icon}" alt="${souvenir.name} icon">
                                    </div>
                                </div>
                            </a>
                            <div class="souvenir-keepers">${keepersCount} keeper${keepersCount !== 1 ? 's' : ''} ${monthsOld > 0 ? `of ${monthsOld} month${monthsOld !== 1 ? 's' : ''}` : ''}</div>
                        `;
                    } else {
                        element.innerHTML = `<div class="souvenir-key">${key}</div><div style="color: #64748b; font-size: 0.85rem;">Souvenir not found</div>`;
                    }
                });
            } catch (err) {
                console.warn('Failed to load souvenir data:', err);
            }
        }
        
        async function loadGreeterData() {
            try {
                // Load greeter work info
                const greeterResponse = await fetch('/api/work/greeter/info');
                if (!greeterResponse.ok) {
                    throw new Error('Failed to load greeter info');
                }
                const greeterInfo = await greeterResponse.json();
                
                // Load greeting templates
                const templatesResponse = await fetch('/api/work/greeter/templates');
                if (!templatesResponse.ok) {
                    throw new Error('Failed to load greeting templates');
                }
                const templatesData = await templatesResponse.json();
                const templates = templatesData.templates || [];
                
                // Find all greeter preview elements and populate them
                document.querySelectorAll('.greeter-preview[data-loading="true"]').forEach(async element => {
                    const hasGreeter = greeterInfo.workers && greeterInfo.workers.length > 0;
                    
                    if (hasGreeter) {
                        const greeter = greeterInfo.workers[0];
                        
                        // Fetch greeter's profile
                        try {
                            const dreamerResponse = await fetch(`/api/dreamers/${greeter.did}`);
                            if (dreamerResponse.ok) {
                                const dreamer = await dreamerResponse.json();
                                const exampleTemplate = templates[0] || 'Welcome, @{handle}!';
                                const exampleText = exampleTemplate.replace(/@\{handle\}/g, '@alice.reverie.house');
                                
                                element.innerHTML = `
                                    <div class="greeter-info">
                                        <img class="greeter-avatar" src="${dreamer.avatar || '/assets/icon.png'}" alt="${dreamer.handle}">
                                        <span class="greeter-handle">@${dreamer.handle}</span>
                                        <span style="color: #5d4e3a;">(${greeter.status || 'working'})</span>
                                    </div>
                                    <div class="greeter-example">${exampleText}</div>
                                    <div style="font-size: 0.65rem; color: #5d4e3a; font-style: italic; margin-top: 0.25rem;">
                                        Posts ${templates.length} random greeting${templates.length !== 1 ? 's' : ''} from greeter
                                    </div>
                                `;
                            } else {
                                element.innerHTML = `
                                    <div class="greeter-info" style="color: #5d4e3a;">
                                        Active greeter: ${greeter.did.substring(0, 20)}...
                                    </div>
                                `;
                            }
                        } catch (err) {
                            console.warn('Failed to load greeter profile:', err);
                            element.innerHTML = `<div style="color: #5d4e3a; font-size: 0.75rem;">Greeter configured but profile unavailable</div>`;
                        }
                    } else {
                        element.innerHTML = `<div style="color: #5d4e3a; font-size: 0.75rem; font-weight: 600;">Position Vacant</div>`;
                    }
                    
                    element.removeAttribute('data-loading');
                });
            } catch (err) {
                console.warn('Failed to load greeter data:', err);
                // Update any loading elements to show error
                document.querySelectorAll('.greeter-preview[data-loading="true"]').forEach(element => {
                    element.innerHTML = `<div style="color: #5d4e3a; font-size: 0.75rem;">Failed to load greeter info</div>`;
                    element.removeAttribute('data-loading');
                });
            }
        }
        
        async function loadMapperData() {
            try {
                // Load mapper work info using the generic work info endpoint
                const mapperResponse = await fetch('/api/work/mapper/info');
                if (!mapperResponse.ok) {
                    throw new Error('Failed to load mapper info');
                }
                const mapperInfo = await mapperResponse.json();
                
                // Find all mapper preview elements and populate them
                document.querySelectorAll('.mapper-preview[data-loading="true"]').forEach(async element => {
                    const hasMapper = mapperInfo.workers && mapperInfo.workers.length > 0;
                    
                    if (hasMapper) {
                        const mapper = mapperInfo.workers[0];
                        
                        // Fetch mapper's profile
                        try {
                            const dreamerResponse = await fetch(`/api/dreamers/${mapper.did}`);
                            if (dreamerResponse.ok) {
                                const dreamer = await dreamerResponse.json();
                                
                                element.innerHTML = `
                                    <div class="greeter-info">
                                        <img class="greeter-avatar" src="${dreamer.avatar || '/assets/icon.png'}" alt="${dreamer.handle}">
                                        <span class="greeter-handle">@${dreamer.handle}</span>
                                        <span style="color: #5d4e3a;">(${mapper.status || 'working'})</span>
                                    </div>
                                    <div class="greeter-example" style="font-family: 'Courier New', monospace; letter-spacing: 1.5px; font-weight: 600; text-align: center; font-size: 0.8rem;">O22 A11 S05 R88 L63 E71</div>
                                    <div style="font-size: 0.65rem; color: #5d4e3a; font-style: italic; margin-top: 0.25rem; text-align: center;">
                                        Posts origin spectrum coordinates (OASRLE format)
                                    </div>
                                `;
                            } else {
                                element.innerHTML = `
                                    <div class="greeter-info" style="color: #5d4e3a;">
                                        Active mapper: ${mapper.did.substring(0, 20)}...
                                    </div>
                                `;
                            }
                        } catch (err) {
                            console.warn('Failed to load mapper profile:', err);
                            element.innerHTML = `<div style="color: #5d4e3a; font-size: 0.75rem;">Mapper configured but profile unavailable</div>`;
                        }
                    } else {
                        element.innerHTML = `<div style="color: #5d4e3a; font-size: 0.75rem; font-weight: 600;">Position Vacant</div>`;
                    }
                    
                    element.removeAttribute('data-loading');
                });
            } catch (err) {
                console.warn('Failed to load mapper data:', err);
                // Update any loading elements to show error or default
                document.querySelectorAll('.mapper-preview[data-loading="true"]').forEach(element => {
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
        
        // Quest editing functions
        async function saveReplyContains(input) {
            const questTitle = input.getAttribute('data-quest-title');
            const newWords = input.value.trim();
            
            console.log('=== SAVING REPLY_CONTAINS ===');
            console.log('Quest title:', questTitle);
            console.log('New words:', newWords);
            
            if (!newWords) {
                alert('Please enter at least one word');
                return;
            }
            
            // Get the quest data to preserve commands
            const quest = questDataMap[questTitle];
            if (!quest) {
                console.error('Quest not found in data map:', questTitle);
                alert('Error: Quest data not found');
                return;
            }
            
            const newCondition = `reply_contains:${newWords}`;
            console.log('New condition:', newCondition);
            
            const url = `/api/quests/update/${encodeURIComponent(questTitle)}`;
            console.log('Update URL:', url);
            
            const payload = {
                condition: newCondition,
                commands: quest.commands,  // Include existing commands
                description: quest.description,  // Preserve description
                enabled: quest.enabled  // Preserve enabled status
            };
            console.log('Payload:', JSON.stringify(payload, null, 2));
            
            try {
                console.log('Sending POST request...');
                
                const response = await authenticatedFetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                
                console.log('Response status:', response.status);
                
                const responseData = await response.json();
                console.log('Response data:', responseData);
                
                if (response.ok) {
                    console.log('✅ Update successful!');
                    
                    // Visual feedback
                    input.style.transition = 'all 0.3s ease';
                    input.style.borderColor = '#22c55e';
                    input.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.5)';
                    
                    // Show success message
                    const successMsg = document.createElement('div');
                    successMsg.textContent = '✓ Words saved';
                    successMsg.style.cssText = 'position: absolute; background: #22c55e; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px; z-index: 1000; animation: fadeOut 2s forwards;';
                    input.parentElement.insertBefore(successMsg, input.nextSibling);
                    
                    setTimeout(() => {
                        input.style.borderColor = '';
                        input.style.boxShadow = '';
                        successMsg.remove();
                    }, 2000);
                } else {
                    console.error('❌ Update failed:', responseData);
                    alert('Failed to update quest: ' + (responseData.error || 'Unknown error'));
                    input.style.borderColor = '#ef4444';
                    setTimeout(() => {
                        input.style.borderColor = '';
                    }, 2000);
                }
            } catch (err) {
                console.error('❌ Error updating quest:', err);
                console.error('Error type:', typeof err);
                console.error('Error name:', err.name);
                console.error('Error message:', err.message);
                if (err.stack) console.error('Error stack:', err.stack);
                
                if (err.name === 'TypeError' && err.message.includes('NetworkError')) {
                    alert('Network error: The server may need to be restarted to enable editing.\n\nThe /api/quests/update endpoint was just added and requires a server restart.');
                } else {
                    alert('Error updating quest: ' + err.message);
                }
                input.style.borderColor = '#ef4444';
            }
        }
        
        async function saveQuestTitle(oldTitle, newTitle) {
            if (!newTitle || newTitle === oldTitle) {
                return;
            }
            
            try {
                const quest = questDataMap[oldTitle];
                if (!quest) {
                    alert('Quest not found');
                    return;
                }
                
                const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(oldTitle)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: newTitle,
                        condition: quest.condition,
                        commands: quest.commands,
                        description: quest.description,
                        enabled: quest.enabled
                    })
                });
                
                if (response.ok) {
                    // Update in data structures
                    quest.title = newTitle;
                    questDataMap[newTitle] = quest;
                    delete questDataMap[oldTitle];
                    
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === oldTitle);
                    if (groupQuest) {
                        groupQuest.title = newTitle;
                    }
                    
                    // Refresh display (stay in place)
                    loadQuestCards(currentGroup);
                } else {
                    const result = await response.json();
                    alert('Failed to update title: ' + (result.error || 'Unknown error'));
                    loadQuestCards(questGroups[currentGroupIndex]);
                }
            } catch (err) {
                alert('Error updating title: ' + err.message);
                loadQuestCards(questGroups[currentGroupIndex]);
            }
        }
        
        async function saveQuestDescription(questTitle, newDescription) {
            try {
                const quest = questDataMap[questTitle];
                if (!quest) {
                    alert('Quest not found');
                    return;
                }
                
                quest.description = newDescription;
                
                const payload = {
                    uri: quest.uri,
                    condition: quest.condition,
                    conditions: quest.conditions,
                    condition_operator: quest.condition_operator || 'AND',
                    commands: quest.commands,
                    description: newDescription,
                    enabled: quest.enabled
                };
                
                const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.description = newDescription;
                    }
                    
                    // Refresh display (stay in place)
                    loadQuestCards(currentGroup);
                } else {
                    const result = await response.json();
                    alert('Failed to update description: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error updating description: ' + err.message);
            }
        }
        
        async function saveQuestUri(questTitle, newUri) {
            try {
                const quest = questDataMap[questTitle];
                if (!quest) {
                    alert('Quest not found');
                    return;
                }
                
                quest.uri = newUri;
                
                const payload = {
                    uri: newUri,
                    condition: quest.condition,
                    conditions: quest.conditions,
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
                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.uri = newUri;
                    }
                    console.log(`Quest URI updated: ${newUri}`);
                } else {
                    const result = await response.json();
                    alert('Failed to update URI: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error updating URI: ' + err.message);
            }
        }
        
        function updatePreviewTriggerFields() {
            const triggerType = document.getElementById('preview-trigger-type')?.value;
            const fieldsContainer = document.getElementById('preview-trigger-fields');
            const artContainer = document.getElementById('post-preview-art');
            if (!fieldsContainer || !triggerType) return;
            
            // Preserve existing values
            const existingUri = document.getElementById('preview-trigger-uri')?.value || '';
            const existingConfig = document.getElementById('preview-trigger-config')?.value || '';
            
            let html = '';
            
            if (triggerType === 'bsky_reply') {
                html += `<div style="margin-bottom: 0.5rem;">`;
                html += `<label style="font-size: 0.75rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.25rem;">URI (AT or bsky.app URL):</label>`;
                html += `<input type="text" id="preview-trigger-uri" value="${existingUri}" placeholder="at://did:plc:.../app.bsky.feed.post/... or bsky.app URL"
                         style="width: 100%; padding: 0.4rem 0.6rem; background: white; border: 1px solid #cbd5e1; border-radius: 3px; font-family: monospace; font-size: 0.7rem; color: #64748b;"
                         onblur="handleUriInput(this)" />`;
                html += `</div>`;
            } else if (triggerType === 'bibliohose') {
                // Parse existing config for bibliohose
                let config = {};
                try {
                    config = existingConfig ? JSON.parse(existingConfig) : {};
                } catch (e) {
                    config = {};
                }
                
                const listRkey = config.list_rkey || '';
                const bookTitle = config.book_title || '';
                const collections = config.collections || [];
                
                const hasStamps = collections.length === 0 || collections.includes('biblio.bond.stamps') || collections.includes('biblio.bond.completion');
                const hasBook = collections.length === 0 || collections.includes('biblio.bond.book') || collections.includes('biblio.bond.record');
                const hasList = collections.length === 0 || collections.includes('biblio.bond.list');
                
                html += `<div style="margin-bottom: 0.5rem;">`;
                
                // List URI field (full width - needs the complete AT URI)
                html += `<div style="margin-bottom: 0.5rem;">`;
                html += `<label style="font-size: 0.7rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.25rem;">Reading List URI:</label>`;
                html += `<input type="text" id="biblio-list-uri" value="${listRkey}" placeholder="at://did:plc:d5fnxwskloett4pb7dicp6c6/biblio.bond.list/3m6723l4dj22c"
                         style="width: 100%; padding: 0.35rem 0.5rem; background: white; border: 1px solid #cbd5e1; border-radius: 3px; font-family: monospace; font-size: 0.65rem; color: #64748b;"
                         oninput="updateBiblioMonitorPanel()"
                         onblur="if(this.value && this.value.trim() && this.value.startsWith('at://')) loadBiblioListInfo(this.value)" />`;
                html += `<div style="font-size: 0.65rem; color: #6b7280; margin-top: 0.2rem;">Full AT URI of list to monitor (leave empty to match all lists)</div>`;
                html += `</div>`;
                
                // Book title filter
                html += `<div>`;
                html += `<label style="font-size: 0.7rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.25rem;">Book Title:</label>`;
                html += `<input type="text" id="biblio-book-title" value="${bookTitle}" placeholder="The Dispossessed"
                         style="width: 100%; padding: 0.35rem 0.5rem; background: white; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 0.7rem; color: #64748b;"
                         oninput="updateBiblioMonitorPanel()" />`;
                html += `</div>`;
                
                html += `</div>`;
                
                // Record type checkboxes (full width)
                html += `<div>`;
                html += `<label style="font-size: 0.7rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.25rem;">Monitor:</label>`;
                html += `<div style="display: flex; flex-direction: column; gap: 0.25rem; padding: 0.4rem 0.5rem; background: rgba(0,0,0,0.02); border-radius: 3px;">`;
                
                html += `<label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; cursor: pointer;">
                            <input type="checkbox" id="biblio-coll-stamps" ${hasStamps ? 'checked' : ''} style="cursor: pointer;" onchange="updateBiblioMonitorPanel()">
                            <span>Stamps (libre issues badge)</span>
                         </label>`;
                html += `<label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; cursor: pointer;">
                            <input type="checkbox" id="biblio-coll-book" ${hasBook ? 'checked' : ''} style="cursor: pointer;" onchange="updateBiblioMonitorPanel()">
                            <span>Book Records (user creates)</span>
                         </label>`;
                html += `<label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; cursor: pointer;">
                            <input type="checkbox" id="biblio-coll-list" ${hasList ? 'checked' : ''} style="cursor: pointer;" onchange="updateBiblioMonitorPanel()">
                            <span>List Creation</span>
                         </label>`;
                
                html += `</div>`;
                html += `</div>`;
            } else if (triggerType === 'firehose_phrase') {
                // Parse existing config for firehose_phrase
                let config = {};
                try {
                    config = existingConfig ? JSON.parse(existingConfig) : {};
                } catch (e) {
                    config = {};
                }
                
                const phrases = config.phrases || [];
                const phrasesText = Array.isArray(phrases) ? phrases.join(', ') : phrases;
                const caseSensitive = config.case_sensitive || false;
                const matchWholeWords = config.match_whole_words || false;
                const excludeReposts = config.exclude_reposts !== false; // default true
                
                // Phrases field
                html += `<div style="margin-bottom: 0.5rem;">`;
                html += `<label style="font-size: 0.7rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.25rem;">Phrases to Monitor:</label>`;
                html += `<input type="text" id="phrase-phrases" value="${phrasesText}" placeholder="#flawedcenter, flawed.center, welcome to"
                         style="width: 100%; padding: 0.35rem 0.5rem; background: white; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 0.7rem; color: #64748b;" />`;
                html += `<div style="font-size: 0.65rem; color: #6b7280; margin-top: 0.2rem;">Comma-separated list of phrases, hashtags, or keywords to watch for</div>`;
                html += `</div>`;
                
                // Options checkboxes
                html += `<div style="margin-bottom: 0.5rem;">`;
                html += `<label style="font-size: 0.7rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.25rem;">Options:</label>`;
                html += `<div style="display: flex; flex-direction: column; gap: 0.25rem; padding: 0.4rem 0.5rem; background: rgba(0,0,0,0.02); border-radius: 3px;">`;
                
                html += `<label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; cursor: pointer;">
                            <input type="checkbox" id="phrase-case-sensitive" ${caseSensitive ? 'checked' : ''} style="cursor: pointer;">
                            <span>Case Sensitive - Match exact capitalization</span>
                         </label>`;
                
                html += `<label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; cursor: pointer;">
                            <input type="checkbox" id="phrase-whole-words" ${matchWholeWords ? 'checked' : ''} style="cursor: pointer;">
                            <span>Match Whole Words - Require word boundaries</span>
                         </label>`;
                
                html += `<label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; cursor: pointer;">
                            <input type="checkbox" id="phrase-exclude-reposts" ${excludeReposts ? 'checked' : ''} style="cursor: pointer;">
                            <span>Exclude Reposts - Only match original posts</span>
                         </label>`;
                
                html += `</div>`;
                html += `</div>`;
            } else {
                // Generic config for other trigger types
                const placeholders = {
                    'poll': '{"interval_seconds": 300, "source": "api_name"}',
                    'webhook': '{"endpoint": "/webhook/quest-name"}',
                    'cron': '{"schedule": "0 0 * * *"}',
                    'database_watch': '{"table": "table_name", "event": "insert"}'
                };
                
                html += `<div>`;
                html += `<label style="font-size: 0.75rem; color: #4c1d95; font-weight: 600; display: block; margin-bottom: 0.25rem;">Config (JSON):</label>`;
                html += `<textarea id="preview-trigger-config" placeholder="${placeholders[triggerType] || '{}'}"
                         style="width: 100%; padding: 0.5rem; background: white; border: 1px solid #cbd5e1; border-radius: 3px; font-family: monospace; font-size: 0.7rem; color: #64748b; min-height: 80px; resize: vertical;">${existingConfig}</textarea>`;
                html += `</div>`;
            }
            
            fieldsContainer.innerHTML = html;
            
            // Update art panel to match trigger type
            updateArtPanelForTriggerType(triggerType, artContainer);
            
            // Update mini-card icon
            updateMiniCardForTriggerType(triggerType);
            
            // If switching to bibliohose, immediately update the monitor panel
            if (triggerType === 'bibliohose') {
                setTimeout(() => updateBiblioMonitorPanel(), 100);
            }
        }
        
        async function saveQuestTriggerType(questTitle, newTriggerType) {
            try {
                const quest = questDataMap[questTitle];
                if (!quest) {
                    alert('Quest not found');
                    return;
                }
                
                quest.trigger_type = newTriggerType;
                
                const payload = {
                    uri: quest.uri,
                    conditions: quest.conditions,
                    condition_operator: quest.condition_operator || 'AND',
                    commands: quest.commands,
                    description: quest.description,
                    enabled: quest.enabled,
                    trigger_type: newTriggerType,
                    trigger_config: quest.trigger_config || null
                };
                
                const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.trigger_type = newTriggerType;
                    }
                    console.log(`Quest trigger type updated: ${newTriggerType}`);
                    
                    // Reload the quest cards to update UI
                    loadQuestCards(currentGroup);
                } else {
                    const result = await response.json();
                    alert('Failed to update trigger type: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error updating trigger type: ' + err.message);
            }
        }
        
        async function saveQuestTriggerConfig(questTitle, newConfig) {
            try {
                const quest = questDataMap[questTitle];
                if (!quest) {
                    alert('Quest not found');
                    return;
                }
                
                // Validate JSON
                let configJson = null;
                if (newConfig) {
                    try {
                        configJson = JSON.parse(newConfig);
                    } catch (e) {
                        alert('Invalid JSON configuration: ' + e.message);
                        return;
                    }
                }
                
                quest.trigger_config = newConfig;
                
                const payload = {
                    uri: quest.uri,
                    conditions: quest.conditions,
                    condition_operator: quest.condition_operator || 'AND',
                    commands: quest.commands,
                    description: quest.description,
                    enabled: quest.enabled,
                    trigger_type: quest.trigger_type || 'bsky_reply',
                    trigger_config: newConfig || null
                };
                
                const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.trigger_config = newConfig;
                    }
                    console.log(`Quest trigger config updated`);
                } else {
                    const result = await response.json();
                    alert('Failed to update trigger config: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error updating trigger config: ' + err.message);
            }
        }
        
        async function handleUriInput(input) {
            let uri = input.value.trim();
            if (!uri) return;
            
            // Convert bsky.app URL to AT URI
            if (uri.startsWith('https://bsky.app/profile/')) {
                // Extract did/handle and post ID from URL
                // Format: https://bsky.app/profile/{did|handle}/post/{postId}
                const match = uri.match(/bsky\.app\/profile\/([^\/]+)\/post\/([^\/\?]+)/);
                if (match) {
                    const identifier = match[1];
                    const postId = match[2];
                    
                    // If identifier is a DID, use it directly
                    if (identifier.startsWith('did:')) {
                        uri = `at://${identifier}/app.bsky.feed.post/${postId}`;
                    } else {
                        // It's a handle - need to resolve to DID
                        try {
                            const response = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${identifier}`);
                            if (response.ok) {
                                const data = await response.json();
                                uri = `at://${data.did}/app.bsky.feed.post/${postId}`;
                            }
                        } catch (e) {
                            console.warn('Failed to resolve handle:', e);
                        }
                    }
                    
                    // Update input with AT URI
                    input.value = uri;
                }
            }
            
            // Refresh post preview in art panel
            await refreshPostPreview(uri);
        }
        
        async function refreshPostPreview(uri) {
            const artContainer = document.getElementById('post-preview-art');
            if (!artContainer || !uri) return;
            
            // Show loading
            artContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%;"><div style="color: var(--text-dim);">Loading post...</div></div>';
            
            try {
                const postData = await fetchPostData(uri);
                
                if (postData) {
                    // Show post image or avatar
                    if (postData.images && postData.images.length > 0) {
                        artContainer.innerHTML = `<img src="${postData.images[0].fullsize || postData.images[0].thumb}" style="width: 100%; height: 100%; object-fit: cover;" alt="Post image">`;
                    } else if (postData.author && postData.author.avatar) {
                        artContainer.innerHTML = `<img src="${postData.author.avatar}" style="width: 100%; height: 100%; object-fit: cover;" alt="Author avatar">`;
                    } else {
                        artContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 4rem;">📝</div>';
                    }
                } else {
                    artContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 4rem; color: var(--text-dim);">⚠️</div>';
                }
            } catch (e) {
                console.error('Error refreshing post preview:', e);
                artContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 4rem; color: var(--text-dim);">⚠️</div>';
            }
        }
        
        // Simple save wrapper for the Save button
        function saveQuest(questTitle) {
            saveQuestFromPreview(questTitle);
        }
        
        async function saveQuestFromPreview(questTitle) {
            const saveBtn = document.getElementById('preview-save-btn');
            if (!saveBtn) return;
            
            // Show saving state
            saveBtn.disabled = true;
            saveBtn.textContent = '💾 Saving...';
            saveBtn.style.background = '#6b7280';
            
            try {
                const quest = questDataMap[questTitle];
                if (!quest) {
                    alert('Quest not found: ' + questTitle);
                    saveBtn.disabled = false;
                    saveBtn.textContent = '💾 Save Quest Configuration';
                    saveBtn.style.background = '#10b981';
                    return;
                }
                
                // Get values from preview inputs
                const newTitle = document.getElementById('preview-quest-title')?.value?.trim() || questTitle;
                const newDescription = document.getElementById('preview-quest-description')?.value?.trim() || '';
                const newTriggerType = document.getElementById('preview-trigger-type')?.value || 'bsky_reply';
                const newTriggerUri = document.getElementById('preview-trigger-uri')?.value?.trim() || '';
                
                // Build trigger config based on trigger type
                let newTriggerConfig = '';
                
                if (newTriggerType === 'bibliohose') {
                    // Collect bibliohose-specific fields
                    const listUri = document.getElementById('biblio-list-uri')?.value?.trim() || '';
                    const bookTitle = document.getElementById('biblio-book-title')?.value?.trim() || '';
                    const checkStamps = document.getElementById('biblio-coll-stamps')?.checked || false;
                    const checkBook = document.getElementById('biblio-coll-book')?.checked || false;
                    const checkList = document.getElementById('biblio-coll-list')?.checked || false;
                    
                    const config = {};
                    
                    if (listUri) config.list_rkey = listUri;  // Store full URI as list_rkey
                    if (bookTitle) config.book_title = bookTitle;
                    
                    // Only add collections array if at least one is checked
                    const collections = [];
                    if (checkStamps) {
                        collections.push('biblio.bond.stamps');
                        collections.push('biblio.bond.completion');
                    }
                    if (checkBook) {
                        collections.push('biblio.bond.book');
                        collections.push('biblio.bond.record');
                    }
                    if (checkList) {
                        collections.push('biblio.bond.list');
                    }
                    
                    if (collections.length > 0) {
                        config.collections = collections;
                    }
                    
                    newTriggerConfig = Object.keys(config).length > 0 ? JSON.stringify(config) : '';
                } else if (newTriggerType === 'firehose_phrase') {
                    // Collect firehose_phrase-specific fields
                    const phrasesInput = document.getElementById('phrase-phrases')?.value?.trim() || '';
                    const caseSensitive = document.getElementById('phrase-case-sensitive')?.checked || false;
                    const wholeWords = document.getElementById('phrase-whole-words')?.checked || false;
                    const excludeReposts = document.getElementById('phrase-exclude-reposts')?.checked || false;
                    
                    // Parse phrases (comma-separated)
                    const phrases = phrasesInput.split(',').map(p => p.trim()).filter(p => p);
                    
                    const config = {
                        phrases: phrases,
                        case_sensitive: caseSensitive,
                        match_whole_words: wholeWords,
                        exclude_reposts: excludeReposts
                    };
                    
                    newTriggerConfig = JSON.stringify(config);
                } else if (newTriggerType !== 'bsky_reply') {
                    // Use raw JSON textarea for other trigger types
                    newTriggerConfig = document.getElementById('preview-trigger-config')?.value?.trim() || '';
                }
                
                // Validate trigger config JSON if present
                if (newTriggerConfig) {
                    try {
                        JSON.parse(newTriggerConfig);
                    } catch (e) {
                        alert('Invalid JSON configuration: ' + e.message);
                        saveBtn.disabled = false;
                        saveBtn.textContent = '💾 Save Quest Configuration';
                        saveBtn.style.background = '#10b981';
                        return;
                    }
                }
                
                console.log('Saving quest:', {
                    questTitle,
                    newTitle,
                    newTriggerType,
                    newTriggerUri,
                    newTriggerConfig
                });
                
                // Build payload
                const payload = {
                    description: newDescription,
                    trigger_type: newTriggerType,
                    conditions: quest.conditions,
                    condition_operator: quest.condition_operator || 'AND',
                    commands: quest.commands,
                    enabled: quest.enabled
                };
                
                // Only include title if it changed
                if (newTitle !== questTitle) {
                    payload.title = newTitle;
                }
                
                // Handle URI and trigger_config based on trigger type
                if (newTriggerType === 'bsky_reply') {
                    payload.uri = newTriggerUri || null;
                    payload.trigger_config = null;  // Clear config for bsky_reply
                } else {
                    payload.uri = null;  // Clear URI for non-bsky triggers
                    payload.trigger_config = newTriggerConfig || null;
                }
                
                console.log('Payload:', payload);
                
                const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    // Update quest data in memory
                    const targetQuest = newTitle !== questTitle ? questDataMap[questTitle] : quest;
                    
                    if (newTitle !== questTitle) {
                        questDataMap[newTitle] = targetQuest;
                        delete questDataMap[questTitle];
                        targetQuest.title = newTitle;
                    }
                    
                    targetQuest.description = newDescription;
                    targetQuest.trigger_type = newTriggerType;
                    
                    if (newTriggerType === 'bsky_reply') {
                        targetQuest.uri = newTriggerUri;
                        targetQuest.trigger_config = '';
                    } else {
                        targetQuest.uri = '';
                        targetQuest.trigger_config = newTriggerConfig;
                    }
                    
                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === (newTitle !== questTitle ? questTitle : newTitle));
                    if (groupQuest) {
                        if (newTitle !== questTitle) groupQuest.title = newTitle;
                        groupQuest.description = newDescription;
                        groupQuest.trigger_type = newTriggerType;
                        if (newTriggerType === 'bsky_reply') {
                            groupQuest.uri = newTriggerUri;
                            groupQuest.trigger_config = '';
                        } else {
                            groupQuest.uri = '';
                            groupQuest.trigger_config = newTriggerConfig;
                        }
                    }
                    
                    // Show success
                    saveBtn.textContent = '✅ Saved!';
                    saveBtn.style.background = '#10b981';
                    setTimeout(() => {
                        saveBtn.disabled = false;
                        saveBtn.textContent = '💾 Save Quest Configuration';
                    }, 1500);
                    
                    // Refresh display - this rebuilds quest groups and slider
                    await loadQuests();
                    // Re-show the current group to rebuild slider thumbnails
                    await buildSlider();
                    await showGroupWithBuffer(currentGroupIndex);
                } else {
                    const result = await response.json();
                    alert('Failed to save: ' + (result.error || 'Unknown error'));
                    saveBtn.disabled = false;
                    saveBtn.textContent = '💾 Save Quest Configuration';
                    saveBtn.style.background = '#10b981';
                }
            } catch (err) {
                alert('Error saving: ' + err.message);
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Save Quest Configuration';
                saveBtn.style.background = '#10b981';
            }
        }
        
        async function saveCanonType(select) {
            const questTitle = select.getAttribute('data-quest-title');
            const newType = select.value;
            
            console.log('=== SAVING CANON TYPE ===');
            console.log('Quest title:', questTitle);
            console.log('New type:', newType);
            
            // Show/hide custom type input
            const customInput = select.parentElement.querySelector('.canon-type-custom');
            if (newType === '__custom__') {
                customInput.style.display = '';
                customInput.focus();
                return; // Don't save yet, wait for custom input
            } else {
                customInput.style.display = 'none';
                customInput.value = '';
            }
            
            try {
                const quest = questDataMap[questTitle];
                if (!quest) {
                    alert('Quest not found');
                    return;
                }
                
                // Find the add_canon command and update its type part
                const commands = [...quest.commands];
                let updated = false;
                for (let i = 0; i < commands.length; i++) {
                    if (commands[i].startsWith('add_canon:')) {
                        const parts = commands[i].split(':');
                        if (parts.length >= 3) {
                            // Update: add_canon:key:event:type
                            commands[i] = `add_canon:${parts[1]}:${parts[2]}:${newType}`;
                            updated = true;
                            break;
                        }
                    }
                }
                
                if (!updated) {
                    console.error('No add_canon command found to update');
                    return;
                }
                
                quest.commands = commands;
                
                const payload = {
                    uri: quest.uri,
                    condition: quest.condition,
                    conditions: quest.conditions,
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
                    // Visual feedback - pulse animation
                    select.style.transition = 'all 0.3s ease';
                    select.style.borderColor = '#22c55e';
                    select.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.5)';
                    
                    // Show success message
                    const successMsg = document.createElement('div');
                    successMsg.textContent = '✓ Type saved';
                    successMsg.style.cssText = 'position: absolute; background: #22c55e; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px; animation: fadeOut 2s forwards;';
                    select.parentElement.insertBefore(successMsg, select.nextSibling);
                    
                    setTimeout(() => {
                        select.style.borderColor = '';
                        select.style.boxShadow = '';
                        successMsg.remove();
                    }, 2000);
                    
                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.commands = commands;
                    }
                } else {
                    const result = await response.json();
                    alert('Failed to save canon type: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error saving canon type: ' + err.message);
            }
        }
        
        async function saveCanonTypeCustom(input) {
            const questTitle = input.getAttribute('data-quest-title');
            const customType = input.value.trim();
            
            if (!customType) return;
            
            console.log('=== SAVING CUSTOM CANON TYPE ===');
            console.log('Quest title:', questTitle);
            console.log('Custom type:', customType);
            
            try {
                const quest = questDataMap[questTitle];
                if (!quest) {
                    alert('Quest not found');
                    return;
                }
                
                // Find the add_canon command and update its type part
                const commands = [...quest.commands];
                let updated = false;
                for (let i = 0; i < commands.length; i++) {
                    if (commands[i].startsWith('add_canon:')) {
                        const parts = commands[i].split(':');
                        if (parts.length >= 3) {
                            // Update: add_canon:key:event:type
                            commands[i] = `add_canon:${parts[1]}:${parts[2]}:${customType}`;
                            updated = true;
                            break;
                        }
                    }
                }
                
                if (!updated) {
                    console.error('No add_canon command found to update');
                    return;
                }
                
                quest.commands = commands;
                
                const payload = {
                    uri: quest.uri,
                    condition: quest.condition,
                    conditions: quest.conditions,
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
                    // Visual feedback
                    input.style.transition = 'all 0.3s ease';
                    input.style.borderColor = '#22c55e';
                    input.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.5)';
                    
                    // Show success message
                    const successMsg = document.createElement('div');
                    successMsg.textContent = `✓ Custom type "${customType}" saved`;
                    successMsg.style.cssText = 'position: absolute; background: #22c55e; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px; z-index: 1000; animation: fadeOut 2s forwards;';
                    input.parentElement.insertBefore(successMsg, input.nextSibling);
                    
                    setTimeout(() => {
                        input.style.borderColor = '';
                        input.style.boxShadow = '';
                        successMsg.remove();
                    }, 2000);
                    
                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.commands = commands;
                    }
                } else {
                    const result = await response.json();
                    alert('Failed to save custom type: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error saving custom type: ' + err.message);
            }
        }
        
        async function saveCanonKey(input) {
            const questTitle = input.getAttribute('data-quest-title');
            const newKey = input.value.trim();
            
            console.log('=== SAVING CANON KEY ===');
            console.log('Quest title:', questTitle);
            console.log('New key:', newKey);
            
            if (!newKey) return;
            
            try {
                const quest = questDataMap[questTitle];
                if (!quest) {
                    alert('Quest not found');
                    return;
                }
                
                // Find the add_canon command and update its key part
                const commands = [...quest.commands];
                let updated = false;
                for (let i = 0; i < commands.length; i++) {
                    if (commands[i].startsWith('add_canon:')) {
                        const parts = commands[i].split(':');
                        if (parts.length >= 3) {
                            // Update: add_canon:key:event:type
                            commands[i] = `add_canon:${newKey}:${parts[2]}:${parts[3] || 'event'}`;
                            updated = true;
                            break;
                        }
                    }
                }
                
                if (!updated) {
                    console.error('No add_canon command found to update');
                    return;
                }
                
                quest.commands = commands;
                
                const payload = {
                    uri: quest.uri,
                    condition: quest.condition,
                    conditions: quest.conditions,
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
                    // Visual feedback
                    input.style.transition = 'all 0.3s ease';
                    input.style.borderColor = '#22c55e';
                    input.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.5)';
                    
                    // Show success message
                    const successMsg = document.createElement('div');
                    successMsg.textContent = `✓ Key saved: ${newKey}`;
                    successMsg.style.cssText = 'position: absolute; background: #22c55e; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px; z-index: 1000; animation: fadeOut 2s forwards;';
                    input.parentElement.insertBefore(successMsg, input.nextSibling);
                    
                    setTimeout(() => {
                        input.style.borderColor = '';
                        input.style.boxShadow = '';
                        successMsg.remove();
                    }, 2000);
                    
                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.commands = commands;
                    }
                } else {
                    const result = await response.json();
                    alert('Failed to save canon key: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error saving canon key: ' + err.message);
            }
        }
        
        async function saveCanonEvent(input) {
            const questTitle = input.getAttribute('data-quest-title');
            const newEvent = input.value.trim();
            
            console.log('=== SAVING CANON EVENT ===');
            console.log('Quest title:', questTitle);
            console.log('New event:', newEvent);
            
            if (!newEvent) return;
            
            try {
                const quest = questDataMap[questTitle];
                if (!quest) {
                    alert('Quest not found');
                    return;
                }
                
                // Find the add_canon command and update its event part
                const commands = [...quest.commands];
                let updated = false;
                for (let i = 0; i < commands.length; i++) {
                    if (commands[i].startsWith('add_canon:')) {
                        const parts = commands[i].split(':');
                        if (parts.length >= 3) {
                            // Update: add_canon:key:event:type
                            commands[i] = `add_canon:${parts[1]}:${newEvent}:${parts[3] || 'event'}`;
                            updated = true;
                            break;
                        }
                    }
                }
                
                if (!updated) {
                    console.error('No add_canon command found to update');
                    return;
                }
                
                quest.commands = commands;
                
                const payload = {
                    uri: quest.uri,
                    condition: quest.condition,
                    conditions: quest.conditions,
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
                    // Visual feedback
                    input.style.transition = 'all 0.3s ease';
                    input.style.borderColor = '#22c55e';
                    input.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.5)';
                    
                    // Show success message
                    const successMsg = document.createElement('div');
                    successMsg.textContent = `✓ Event saved`;
                    successMsg.style.cssText = 'position: absolute; background: #22c55e; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px; z-index: 1000; animation: fadeOut 2s forwards;';
                    input.parentElement.insertBefore(successMsg, input.nextSibling);
                    
                    setTimeout(() => {
                        input.style.borderColor = '';
                        input.style.boxShadow = '';
                        successMsg.remove();
                    }, 2000);
                    
                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.commands = commands;
                    }
                } else {
                    const result = await response.json();
                    alert('Failed to save canon event: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error saving canon event: ' + err.message);
            }
        }
        
        async function saveAddName(input) {
            const questTitle = input.getAttribute('data-quest-title');
            const newName = input.value.trim();
            
            console.log('=== SAVING ADD_NAME ===');
            console.log('Quest title:', questTitle);
            console.log('New name:', newName);
            
            if (!newName) return;
            
            try {
                const quest = questDataMap[questTitle];
                if (!quest) {
                    alert('Quest not found');
                    return;
                }
                
                // Find the add_name command and update it
                const commands = [...quest.commands];
                let updated = false;
                for (let i = 0; i < commands.length; i++) {
                    if (commands[i].startsWith('add_name:')) {
                        // Update: add_name:name
                        commands[i] = `add_name:${newName}`;
                        updated = true;
                        break;
                    }
                }
                
                if (!updated) {
                    console.error('No add_name command found to update');
                    return;
                }
                
                quest.commands = commands;
                
                const payload = {
                    uri: quest.uri,
                    condition: quest.condition,
                    conditions: quest.conditions,
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
                    // Visual feedback
                    input.style.transition = 'all 0.3s ease';
                    input.style.borderColor = '#22c55e';
                    input.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.5)';
                    
                    // Show success message
                    const successMsg = document.createElement('div');
                    successMsg.textContent = `✓ Name saved: ${newName}`;
                    successMsg.style.cssText = 'position: absolute; background: #22c55e; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px; z-index: 1000; animation: fadeOut 2s forwards;';
                    input.parentElement.insertBefore(successMsg, input.nextSibling);
                    
                    setTimeout(() => {
                        input.style.borderColor = '';
                        input.style.boxShadow = '';
                        successMsg.remove();
                    }, 2000);
                    
                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.commands = commands;
                    }
                } else {
                    const result = await response.json();
                    alert('Failed to save name: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error saving name: ' + err.message);
            }
        }

        async function saveModSpectrum(input) {
            const questTitle = input.getAttribute('data-quest-title');
            const commandIndex = parseInt(input.getAttribute('data-command-index'));
            const newModifier = input.value.trim();
            
            console.log('=== SAVING MOD_SPECTRUM ===');
            console.log('Quest title:', questTitle);
            console.log('Command index:', commandIndex);
            console.log('New modifier:', newModifier);
            
            if (!newModifier) return;
            
            try {
                const quest = questDataMap[questTitle];
                if (!quest) {
                    alert('Quest not found');
                    return;
                }
                
                // Update the command in the commands array
                const commands = [...quest.commands];
                commands[commandIndex] = `mod_spectrum:${newModifier}`;
                
                quest.commands = commands;
                
                const payload = {
                    uri: quest.uri,
                    condition: quest.condition,
                    conditions: quest.conditions,
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
                    // Visual feedback
                    input.style.transition = 'all 0.3s ease';
                    input.style.borderColor = '#22c55e';
                    input.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.5)';
                    
                    // Show success message
                    const successMsg = document.createElement('div');
                    successMsg.textContent = `✓ Modifier saved: ${newModifier}`;
                    successMsg.style.cssText = 'position: absolute; background: #22c55e; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px; z-index: 1000; animation: fadeOut 2s forwards;';
                    input.parentElement.insertBefore(successMsg, input.nextSibling);
                    
                    setTimeout(() => {
                        input.style.borderColor = '';
                        input.style.boxShadow = '';
                        successMsg.remove();
                    }, 2000);
                    
                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.commands = commands;
                    }
                } else {
                    const result = await response.json();
                    alert('Failed to save spectrum modifier: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error saving spectrum modifier: ' + err.message);
            }
        }

        async function saveReplyPost(questTitle, commandIndex, input) {
            const newText = input.value.trim();
            if (!newText) {
                alert('Reply text cannot be empty');
                return;
            }

            try {
                // Find the quest data from questDataMap
                const quest = questDataMap[questTitle];
                if (!quest) {
                    alert('Quest not found');
                    return;
                }

                // Update the command in the commands array (commands are strings like "reply_post:text")
                const commands = [...quest.commands];
                commands[commandIndex] = `reply_post:${newText}`;

                // Update quest in memory
                quest.commands = commands;

                // Build payload with all required fields
                const payload = {
                    uri: quest.uri,
                    condition: quest.condition,
                    conditions: quest.conditions,
                    condition_operator: quest.condition_operator || 'AND',
                    commands: commands,
                    description: quest.description,
                    enabled: quest.enabled
                };

                // Save to backend using the correct endpoint
                const response = await authenticatedFetch(`/api/quests/update/${encodeURIComponent(questTitle)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    // Visual feedback
                    input.style.transition = 'all 0.3s ease';
                    input.style.borderColor = '#22c55e';
                    input.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.5)';
                    
                    const successMsg = document.createElement('div');
                    successMsg.textContent = '✓ Reply post saved';
                    successMsg.style.cssText = 'position: absolute; background: #22c55e; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px; z-index: 1000; animation: fadeOut 2s forwards;';
                    input.parentElement.insertBefore(successMsg, input.nextSibling);

                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.commands = commands;
                    }

                    setTimeout(() => {
                        input.style.borderColor = '';
                        input.style.boxShadow = '';
                        successMsg.remove();
                    }, 2000);
                } else {
                    const result = await response.json();
                    alert('Failed to save reply post: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                alert(`Failed to save reply post: ${error.message}`);
                console.error('Save error:', error);
            }
        }

        // Drag and drop functionality
        let draggedElement = null;
        let draggedQuestTitle = null;
        let draggedType = null;
        let draggedIndex = null;
        
        function setupDragAndDrop(element, gripperZone) {
            // Only the gripper zone is draggable
            gripperZone.addEventListener('dragstart', function(e) {
                handleDragStart.call(element, e);
            });
            
            element.addEventListener('dragend', handleDragEnd);
            element.addEventListener('dragover', handleDragOver);
            element.addEventListener('drop', handleDrop);
            element.addEventListener('dragleave', handleDragLeave);
        }
        
        function handleDragStart(e) {
            draggedElement = this;
            draggedQuestTitle = this.dataset.questTitle;
            draggedType = this.dataset.type;
            draggedIndex = this.dataset.commandIndex ? parseInt(this.dataset.commandIndex) : 
                          (this.dataset.conditionIndex ? parseInt(this.dataset.conditionIndex) : null);
            
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
        }
        
        function handleDragEnd(e) {
            this.classList.remove('dragging');
            
            // Remove all drag-over classes
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        }
        
        function handleDragOver(e) {
            if (e.preventDefault) {
                e.preventDefault();
            }
            
            // Only allow dropping on same type within same quest
            if (this.dataset.questTitle === draggedQuestTitle && 
                this.dataset.type === draggedType && 
                this !== draggedElement) {
                e.dataTransfer.dropEffect = 'move';
                this.classList.add('drag-over');
            }
            
            return false;
        }
        
        function handleDragLeave(e) {
            this.classList.remove('drag-over');
        }
        
        async function handleDrop(e) {
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            
            this.classList.remove('drag-over');
            
            // Only process if same quest and type
            if (this.dataset.questTitle !== draggedQuestTitle || 
                this.dataset.type !== draggedType ||
                this === draggedElement) {
                return false;
            }
            
            const dropIndex = this.dataset.commandIndex ? parseInt(this.dataset.commandIndex) : 
                            (this.dataset.conditionIndex ? parseInt(this.dataset.conditionIndex) : null);
            
            console.log('=== REORDERING ===');
            console.log('Quest:', draggedQuestTitle);
            console.log('Type:', draggedType);
            console.log('From index:', draggedIndex);
            console.log('To index:', dropIndex);
            
            // Get quest data
            const quest = questDataMap[draggedQuestTitle];
            if (!quest) {
                console.error('Quest not found:', draggedQuestTitle);
                return false;
            }
            
            if (draggedType === 'command' && draggedIndex !== null && dropIndex !== null) {
                // Reorder commands array
                const commands = [...quest.commands];
                const [removed] = commands.splice(draggedIndex, 1);
                commands.splice(dropIndex, 0, removed);
                
                console.log('New commands order:', commands);
                
                // Save to API
                const url = `/api/quests/update/${encodeURIComponent(draggedQuestTitle)}`;
                const payload = {
                    commands: commands,
                    condition: quest.condition,
                    description: quest.description,
                    enabled: quest.enabled
                };
                
                try {
                    const response = await authenticatedFetch(url, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        console.log('✅ Order saved successfully');
                        // Reload the quest cards to show new order
                        const currentGroup = questGroups[currentGroupIndex];
                        const updatedQuest = currentGroup.quests.find(q => q.title === draggedQuestTitle);
                        if (updatedQuest) {
                            updatedQuest.commands = commands;
                            questDataMap[draggedQuestTitle] = updatedQuest;
                        }
                        loadQuestCards(currentGroup);
                        
                        // Scroll the card into view and highlight it
                        setTimeout(() => {
                            const card = document.querySelector(`[data-quest-title="${draggedQuestTitle}"]`)?.closest('.quest-card');
                            if (card) {
                                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                card.classList.add('highlight');
                                setTimeout(() => card.classList.remove('highlight'), 1000);
                            }
                        }, 100);
                    } else {
                        console.error('❌ Failed to save order:', result);
                        alert('Failed to save reordering: ' + (result.error || 'Unknown error'));
                    }
                } catch (err) {
                    console.error('❌ Error saving order:', err);
                    alert('Network error: ' + err.message);
                }
            } else if (draggedType === 'condition' && draggedIndex !== null && dropIndex !== null) {
                // Reorder conditions array
                const conditions = quest.conditions ? [...quest.conditions] : [];
                const [removed] = conditions.splice(draggedIndex, 1);
                conditions.splice(dropIndex, 0, removed);
                
                console.log('New conditions order:', conditions);
                
                // Save to API
                const url = `/api/quests/update/${encodeURIComponent(draggedQuestTitle)}`;
                const payload = {
                    commands: quest.commands,
                    condition: quest.condition || '',  // Must include condition field (NOT NULL in DB)
                    conditions: conditions,
                    condition_operator: quest.condition_operator,
                    description: quest.description,
                    enabled: quest.enabled
                };
                
                try {
                    const response = await authenticatedFetch(url, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        console.log('✅ Condition order saved successfully');
                        // Reload the quest cards to show new order
                        const currentGroup = questGroups[currentGroupIndex];
                        const updatedQuest = currentGroup.quests.find(q => q.title === draggedQuestTitle);
                        if (updatedQuest) {
                            updatedQuest.conditions = conditions;
                            questDataMap[draggedQuestTitle] = updatedQuest;
                        }
                        loadQuestCards(currentGroup);
                        
                        // Scroll the card into view and highlight it
                        setTimeout(() => {
                            const card = document.querySelector(`[data-quest-title="${draggedQuestTitle}"]`)?.closest('.quest-card');
                            if (card) {
                                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                card.classList.add('highlight');
                                setTimeout(() => card.classList.remove('highlight'), 1000);
                            }
                        }, 100);
                    } else {
                        console.error('❌ Failed to save condition order:', result);
                        alert('Failed to save condition reordering: ' + (result.error || 'Unknown error'));
                    }
                } catch (err) {
                    console.error('❌ Error saving condition order:', err);
                    alert('Network error: ' + err.message);
                }
            }
            
            return false;
        }
        
        // Reorder function for arrow buttons
        async function reorderItem(questTitle, type, currentIndex, direction) {
            console.log('=== ARROW REORDER ===');
            console.log('Quest:', questTitle);
            console.log('Type:', type);
            console.log('Current index:', currentIndex);
            console.log('Direction:', direction);
            
            const quest = questDataMap[questTitle];
            if (!quest) {
                console.error('Quest not found:', questTitle);
                return;
            }
            
            if (type === 'command') {
                const commands = [...quest.commands];
                const newIndex = currentIndex + direction;
                
                // Boundary check
                if (newIndex < 0 || newIndex >= commands.length) {
                    return;
                }
                
                // Swap positions
                [commands[currentIndex], commands[newIndex]] = [commands[newIndex], commands[currentIndex]];
                
                console.log('New commands order:', commands);
                
                // Save to API
                const url = `/api/quests/update/${encodeURIComponent(questTitle)}`;
                const payload = {
                    commands: commands,
                    condition: quest.condition,
                    description: quest.description,
                    enabled: quest.enabled
                };
                
                try {
                    const response = await authenticatedFetch(url, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        console.log('✅ Order saved successfully');
                        // Update quest data
                        const currentGroup = questGroups[currentGroupIndex];
                        const updatedQuest = currentGroup.quests.find(q => q.title === questTitle);
                        if (updatedQuest) {
                            updatedQuest.commands = commands;
                            questDataMap[questTitle] = updatedQuest;
                        }
                        loadQuestCards(currentGroup);
                        
                        // Scroll the card into view and highlight it
                        setTimeout(() => {
                            const card = document.querySelector(`[data-quest-title="${questTitle}"]`)?.closest('.quest-card');
                            if (card) {
                                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                card.classList.add('highlight');
                                setTimeout(() => card.classList.remove('highlight'), 1000);
                            }
                        }, 100);
                    } else {
                        console.error('❌ Failed to save order:', result);
                        alert('Failed to save reordering: ' + (result.error || 'Unknown error'));
                    }
                } catch (err) {
                    console.error('❌ Error saving order:', err);
                    alert('Network error: ' + err.message);
                }
            }
        }

        // Quest control functions
        async function toggleQuestStatus(questTitle, enable) {
            const quest = questDataMap[questTitle];
            if (!quest) {
                alert('Quest not found');
                return;
            }
            
            const action = enable ? 'activate' : 'deactivate';
            if (!confirm(`Are you sure you want to ${action} "${questTitle}"?`)) {
                return;
            }
            
            try {
                const url = `/api/quests/update/${encodeURIComponent(questTitle)}`;
                const payload = {
                    enabled: enable,
                    condition: quest.condition,
                    commands: quest.commands,
                    description: quest.description
                };
                
                const response = await authenticatedFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    // Update local data
                    quest.enabled = enable;
                    questDataMap[questTitle] = quest;
                    
                    // Update the quest in the current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const questInGroup = currentGroup.quests.find(q => q.title === questTitle);
                    if (questInGroup) {
                        questInGroup.enabled = enable;
                    }
                    
                    // Refresh just the cards for current group (stay in place)
                    loadQuestCards(currentGroup);
                } else {
                    const result = await response.json();
                    alert(`Failed to ${action} quest: ` + (result.error || 'Unknown error'));
                }
            } catch (err) {
                alert(`Error ${action}ing quest: ` + err.message);
            }
        }
        
        async function deleteQuest(questTitle) {
            if (!confirm(`Delete quest "${questTitle}"?\n\nThis cannot be undone.`)) {
                return;
            }
            
            try {
                const response = await authenticatedFetch(`/api/quests/delete/${encodeURIComponent(questTitle)}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    // Remove from current group and refresh
                    const currentGroup = questGroups[currentGroupIndex];
                    currentGroup.quests = currentGroup.quests.filter(q => q.title !== questTitle);
                    delete questDataMap[questTitle];
                    
                    // Refresh the display
                    loadQuestCards(currentGroup);
                } else {
                    const result = await response.json();
                    alert('Failed to delete quest: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error deleting quest: ' + err.message);
            }
        }
        
        // Wrapper functions for preview panel controls
        function toggleQuestStatusFromPreview(questTitle, enable) {
            toggleQuestStatus(questTitle, enable);
        }
        
        function deleteQuestFromPreview(questTitle) {
            deleteQuest(questTitle);
        }
        
        async function deleteCondition(questTitle, conditionIndex) {
            console.log('=== DELETE CONDITION ===');
            console.log('Quest title:', questTitle);
            console.log('Condition index:', conditionIndex);
            
            if (!confirm(`Delete this condition from "${questTitle}"?`)) {
                console.log('❌ User cancelled deletion');
                return;
            }
            
            try {
                const quest = questDataMap[questTitle];
                if (!quest) {
                    console.error('❌ Quest not found in dataMap');
                    alert('Quest not found');
                    return;
                }
                
                console.log('Current quest data:', JSON.stringify(quest, null, 2));
                
                // Support both array and single condition
                if (quest.conditions && Array.isArray(quest.conditions)) {
                    console.log('Removing from conditions array at index:', conditionIndex);
                    quest.conditions.splice(conditionIndex, 1);
                    console.log('Remaining conditions:', quest.conditions);
                    
                    // Update primary condition for backward compatibility
                    if (quest.conditions.length === 0) {
                        quest.conditions = null;
                        quest.condition = '';
                        console.log('No conditions left, cleared both fields');
                    } else {
                        // Extract condition string from first item (handle both formats)
                        const firstCond = quest.conditions[0];
                        quest.condition = typeof firstCond === 'string' ? firstCond : firstCond.condition;
                        console.log('Updated primary condition to:', quest.condition);
                    }
                } else {
                    // Old single condition format
                    console.log('Using old single condition format, clearing condition field');
                    quest.condition = '';
                }
                
                const payload = {
                    condition: quest.condition || '',
                    conditions: quest.conditions ? JSON.stringify(quest.conditions) : null,
                    condition_operator: quest.condition_operator || 'AND',
                    commands: quest.commands,
                    description: quest.description,
                    enabled: quest.enabled
                };
                
                console.log('Sending payload:', JSON.stringify(payload, null, 2));
                
                const url = `/api/quests/update/${encodeURIComponent(questTitle)}`;
                console.log('URL:', url);
                
                const response = await authenticatedFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                console.log('Response status:', response.status);
                console.log('Response ok:', response.ok);
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Success! Response:', result);
                    
                    // Update in current group and refresh
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        if (quest.conditions) {
                            groupQuest.conditions = quest.conditions;
                            groupQuest.condition = quest.condition;
                        } else {
                            groupQuest.condition = '';
                        }
                        console.log('Updated quest in current group');
                    }
                    
                    // Refresh display (stay in place)
                    console.log('Refreshing display...');
                    loadQuestCards(currentGroup);
                } else {
                    const contentType = response.headers.get('content-type');
                    let errorMsg;
                    if (contentType && contentType.includes('application/json')) {
                        const result = await response.json();
                        errorMsg = result.error || 'Unknown error';
                        console.error('❌ API error:', result);
                    } else {
                        errorMsg = await response.text();
                        console.error('❌ Non-JSON error:', errorMsg);
                    }
                    alert('Failed to delete condition: ' + errorMsg);
                }
            } catch (err) {
                console.error('❌ Exception caught:', err);
                console.error('Error type:', err.constructor.name);
                console.error('Error message:', err.message);
                if (err.stack) console.error('Stack trace:', err.stack);
                alert('Error deleting condition: ' + err.message);
            }
            
            console.log('=== END DELETE CONDITION ===\n');
        }
        
        async function deleteCommand(questTitle, commandIndex) {
            if (!confirm(`Delete this command from "${questTitle}"?`)) {
                return;
            }
            
            try {
                const quest = questDataMap[questTitle];
                if (!quest) {
                    alert('Quest not found');
                    return;
                }
                
                if (!quest.commands || commandIndex >= quest.commands.length) {
                    alert('Command not found');
                    return;
                }
                
                quest.commands.splice(commandIndex, 1);
                
                const payload = {
                    uri: quest.uri,
                    condition: quest.condition,
                    conditions: quest.conditions,
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
                    // Update in current group and refresh
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.commands.splice(commandIndex, 1);
                    }
                    
                    // Refresh display (stay in place)
                    loadQuestCards(currentGroup);
                } else {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const result = await response.json();
                        alert('Failed to delete command: ' + (result.error || 'Unknown error'));
                    } else {
                        const text = await response.text();
                        alert('Failed to delete command: ' + text);
                    }
                }
            } catch (err) {
                alert('Error deleting command: ' + err.message);
            }
        }
        
        // Add condition/command dropdown functions
        function showConditionDropdown(button, questTitle) {
            // Remove any existing dropdowns and overlays
            document.querySelectorAll('.add-item-dropdown').forEach(d => d.remove());
            document.querySelectorAll('.add-item-dropdown-overlay').forEach(d => d.remove());
            
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'add-item-dropdown-overlay';
            
            const dropdown = document.createElement('div');
            dropdown.className = 'add-item-dropdown';
            
            const conditions = [
                { value: 'any_reply', title: 'any_reply', desc: 'Triggers on any reply to this post' },
                { value: 'new_reply', title: 'new_reply', desc: 'Only new dreamers (not yet registered)' },
                { value: 'dreamer_replies', title: 'dreamer_replies', desc: 'Only registered dreamers' },
                { value: 'reply_contains:', title: 'reply_contains', desc: 'Reply must contain specific words' },
                { value: 'contains_hashtags', title: 'contains_hashtags', desc: 'Reply must contain #hashtags' },
                { value: 'contains_mentions', title: 'contains_mentions', desc: 'Reply must contain @mentions' },
                { value: 'has_canon:', title: 'has_canon', desc: 'User must have a canon key' },
                { value: 'hasnt_canon:', title: 'hasnt_canon', desc: 'User must NOT have a canon key' },
                { value: 'count_canon:', title: 'count_canon', desc: 'Compare count of users with canon key (e.g., found_glinda<1, completed>=5)' },
                { value: 'user_canon_equals:', title: 'user_canon_equals', desc: 'User canon key must equal value (key=value)' },
                { value: 'user_canon_not_equals:', title: 'user_canon_not_equals', desc: 'User canon key must NOT equal value (key=value)' },
                { value: 'user_in_canon_list:', title: 'user_in_canon_list', desc: 'User canon key in list (key=val1,val2,val3)' }
            ];
            
            conditions.forEach(cond => {
                const item = document.createElement('div');
                item.className = 'add-item-dropdown-item';
                item.innerHTML = `
                    <div class="add-item-dropdown-item-title">${cond.title}</div>
                    <div class="add-item-dropdown-item-desc">${cond.desc}</div>
                `;
                item.onclick = () => {
                    addCondition(questTitle, cond.value);
                    dropdown.remove();
                    overlay.remove();
                };
                dropdown.appendChild(item);
            });
            
            document.body.appendChild(overlay);
            document.body.appendChild(dropdown);
            
            // Close on overlay click
            overlay.onclick = () => {
                dropdown.remove();
                overlay.remove();
            };
        }
        
        function showCommandDropdown(button, questTitle) {
            // Remove any existing dropdowns and overlays
            document.querySelectorAll('.add-item-dropdown').forEach(d => d.remove());
            document.querySelectorAll('.add-item-dropdown-overlay').forEach(d => d.remove());
            
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'add-item-dropdown-overlay';
            
            const dropdown = document.createElement('div');
            dropdown.className = 'add-item-dropdown';
            
            const commands = [
                { value: 'like_post', title: 'like_post', desc: 'Like the triggering post on Bluesky' },
                { value: 'reply_post:', title: 'reply_post', desc: 'Reply to the post with custom text' },
                { value: 'name_dreamer', title: 'name_dreamer', desc: 'Hear and assign dreamer name, handle, and first canons' },
                { value: 'register_if_needed', title: 'register_if_needed', desc: 'Register dreamer if new' },
                { value: 'award_souvenir:', title: 'award_souvenir', desc: 'Award a souvenir to the dreamer' },
                { value: 'disable_quest', title: 'disable_quest', desc: 'Disable this quest after triggering (one-time quest)' },
                { value: 'add_canon:', title: 'add_canon', desc: 'Add a canon event to dreamer history' },
                { value: 'add_name:', title: 'add_name', desc: 'Add name to dreamer record' },
                { value: 'mod_spectrum:', title: 'mod_spectrum', desc: 'Modify dreamer spectrum value' },
                { value: 'calculate_origin', title: 'calculate_origin', desc: 'Calculate dreamer origin' }
            ];
            
            commands.forEach(cmd => {
                const item = document.createElement('div');
                item.className = 'add-item-dropdown-item';
                item.innerHTML = `
                    <div class="add-item-dropdown-item-title">${cmd.title}</div>
                    <div class="add-item-dropdown-item-desc">${cmd.desc}</div>
                `;
                item.onclick = () => {
                    addCommand(questTitle, cmd.value);
                    dropdown.remove();
                    overlay.remove();
                };
                dropdown.appendChild(item);
            });
            
            document.body.appendChild(overlay);
            document.body.appendChild(dropdown);
            
            // Close on overlay click
            overlay.onclick = () => {
                dropdown.remove();
                overlay.remove();
            };
        }
        
        async function addCondition(questTitle, conditionType) {
            console.log('=== ADD CONDITION ===');
            console.log('Quest title:', questTitle);
            console.log('Condition type:', conditionType);
            
            const quest = questDataMap[questTitle];
            if (!quest) {
                console.error('❌ Quest not found in dataMap');
                alert('Quest not found');
                return;
            }
            
            console.log('Current quest data:', JSON.stringify(quest, null, 2));
            
            let newCondition = conditionType;
            
            // If it requires a value, prompt for it
            if (conditionType === 'reply_contains:') {
                const words = prompt('Enter words to match (comma-separated):');
                if (!words) {
                    console.log('❌ User cancelled reply_contains prompt');
                    return;
                }
                newCondition = `reply_contains:${words.trim()}`;
                console.log('New condition with words:', newCondition);
            } else if (conditionType === 'has_canon:') {
                const key = prompt('Enter canon key to check for (e.g., "arrival", "zone"):');
                if (!key) return;
                newCondition = `has_canon:${key.trim()}`;
            } else if (conditionType === 'hasnt_canon:') {
                const key = prompt('Enter canon key to check for absence (e.g., "quest_watson"):');
                if (!key) return;
                newCondition = `hasnt_canon:${key.trim()}`;
            } else if (conditionType === 'count_canon:') {
                const input = prompt('Enter condition: key<operator><number>\n\nExamples:\n  found_glinda<1 (fewer than 1 person)\n  completed>=5 (5 or more people)\n  early_access<=10 (at most 10 people)\n\nOperators: <, <=, ==, !=, >=, >');
                if (!input) return;
                // Validate format (should contain at least one operator)
                if (!/[<>=!]+/.test(input)) {
                    alert('Must include an operator: <, <=, ==, !=, >=, or >');
                    return;
                }
                newCondition = `count_canon:${input.trim()}`;
            } else if (conditionType === 'user_canon_equals:') {
                const keyValue = prompt('Enter canon key=value (e.g., "zone=1"):');
                if (!keyValue || !keyValue.includes('=')) {
                    alert('Format must be key=value');
                    return;
                }
                newCondition = `user_canon_equals:${keyValue.trim()}`;
            } else if (conditionType === 'user_canon_not_equals:') {
                const keyValue = prompt('Enter canon key=value to exclude (e.g., "zone=0"):');
                if (!keyValue || !keyValue.includes('=')) {
                    alert('Format must be key=value');
                    return;
                }
                newCondition = `user_canon_not_equals:${keyValue.trim()}`;
            } else if (conditionType === 'user_in_canon_list:') {
                const keyValues = prompt('Enter canon key=value1,value2,value3 (e.g., "zone=1,2,3"):');
                if (!keyValues || !keyValues.includes('=')) {
                    alert('Format must be key=value1,value2,value3');
                    return;
                }
                newCondition = `user_in_canon_list:${keyValues.trim()}`;
            }
            
            // Initialize conditions array if needed
            if (!quest.conditions || !Array.isArray(quest.conditions)) {
                console.log('Initializing conditions array...');
                // Convert old single condition to array
                if (quest.condition) {
                    quest.conditions = [{ type: 'condition', condition: quest.condition, operator: 'AND' }];
                    console.log('Converted single condition to array:', quest.conditions);
                } else {
                    quest.conditions = [];
                    console.log('Created empty conditions array');
                }
            }
            
            // Normalize existing conditions to object format
            quest.conditions = quest.conditions.map(c => {
                if (typeof c === 'string') {
                    return { type: 'condition', condition: c, operator: 'AND' };
                }
                return c;
            });
            
            // Add new condition to array with default operator
            const newConditionObj = {
                type: 'condition',
                condition: newCondition,
                operator: quest.conditions.length === 0 ? 'AND' : 'AND'  // First one is always AND
            };
            quest.conditions.push(newConditionObj);
            console.log('Updated conditions array:', quest.conditions);
            
            // For backward compatibility, also set the first condition as the primary condition
            quest.condition = quest.conditions[0].condition || '';
            console.log('Backward compatibility: condition field set to:', quest.condition);
            
            try {
                const url = `/api/quests/update/${encodeURIComponent(questTitle)}`;
                const payload = {
                    condition: quest.condition,  // Required for backward compatibility
                    conditions: JSON.stringify(quest.conditions),  // New array format
                    condition_operator: quest.condition_operator || 'AND',
                    commands: quest.commands,
                    description: quest.description,
                    enabled: quest.enabled
                };
                
                console.log('Sending payload:', JSON.stringify(payload, null, 2));
                console.log('URL:', url);
                
                const response = await authenticatedFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                console.log('Response status:', response.status);
                console.log('Response ok:', response.ok);
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Success! Response:', result);
                    
                    // Update local data
                    questDataMap[questTitle] = quest;
                    
                    // Update quest in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const questInGroup = currentGroup.quests.find(q => q.title === questTitle);
                    if (questInGroup) {
                        questInGroup.conditions = quest.conditions;
                        questInGroup.condition = quest.condition;
                        questInGroup.condition_operator = quest.condition_operator || 'AND';
                        console.log('Updated quest in current group');
                    }
                    
                    // Refresh display (stay in place)
                    console.log('Refreshing display...');
                    loadQuestCards(currentGroup);
                } else {
                    const contentType = response.headers.get('content-type');
                    let errorMsg;
                    if (contentType && contentType.includes('application/json')) {
                        const result = await response.json();
                        errorMsg = result.error || 'Unknown error';
                        console.error('❌ API error:', result);
                    } else {
                        errorMsg = await response.text();
                        console.error('❌ Non-JSON error:', errorMsg);
                    }
                    alert('Failed to add condition: ' + errorMsg);
                }
            } catch (err) {
                console.error('❌ Exception caught:', err);
                console.error('Error type:', err.constructor.name);
                console.error('Error message:', err.message);
                if (err.stack) console.error('Stack trace:', err.stack);
                alert('Error adding condition: ' + err.message);
            }
            
            console.log('=== END ADD CONDITION ===\n');
        }
        
        async function saveConditionOperator(questTitle, conditionIndex, operator) {
            console.log('=== SAVE CONDITION OPERATOR ===');
            console.log('Quest title:', questTitle);
            console.log('Condition index:', conditionIndex);
            console.log('Operator:', operator);
            
            try {
                const quest = questDataMap[questTitle];
                if (!quest) {
                    console.error('❌ Quest not found in dataMap');
                    alert('Quest not found');
                    return;
                }
                
                console.log('Current quest data:', JSON.stringify(quest, null, 2));
                
                if (!quest.conditions || !Array.isArray(quest.conditions)) {
                    console.error('❌ No conditions array found');
                    alert('No conditions found');
                    return;
                }
                
                if (conditionIndex >= quest.conditions.length) {
                    console.error('❌ Invalid condition index');
                    alert('Invalid condition index');
                    return;
                }
                
                // Normalize to object format if needed
                quest.conditions = quest.conditions.map(c => {
                    if (typeof c === 'string') {
                        return { type: 'condition', condition: c, operator: 'AND' };
                    }
                    return c;
                });
                
                // Update the specific condition's operator
                quest.conditions[conditionIndex].operator = operator;
                console.log('Updated condition:', quest.conditions[conditionIndex]);
                
                const payload = {
                    condition: quest.condition || '',
                    conditions: JSON.stringify(quest.conditions),
                    commands: quest.commands,
                    description: quest.description,
                    enabled: quest.enabled
                };
                
                console.log('Sending payload:', JSON.stringify(payload, null, 2));
                
                const url = `/api/quests/update/${encodeURIComponent(questTitle)}`;
                console.log('URL:', url);
                
                const response = await authenticatedFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                console.log('Response status:', response.status);
                console.log('Response ok:', response.ok);
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Success! Response:', result);
                    
                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.conditions = quest.conditions;
                        console.log('Updated quest in current group');
                    }
                    
                    console.log(`Condition operator saved: ${operator} for condition ${conditionIndex}`);
                } else {
                    const contentType = response.headers.get('content-type');
                    let errorMsg;
                    if (contentType && contentType.includes('application/json')) {
                        const result = await response.json();
                        errorMsg = result.error || 'Unknown error';
                        console.error('❌ API error:', result);
                    } else {
                        errorMsg = await response.text();
                        console.error('❌ Non-JSON error:', errorMsg);
                    }
                    alert('Failed to save operator: ' + errorMsg);
                }
            } catch (err) {
                console.error('❌ Exception caught:', err);
                console.error('Error type:', err.constructor.name);
                console.error('Error message:', err.message);
                if (err.stack) console.error('Stack trace:', err.stack);
                alert('Error saving operator: ' + err.message);
            }
            
            console.log('=== END SAVE CONDITION OPERATOR ===\n');
        }
        
        async function toggleConditionOnceOnly(questTitle, conditionIndex, enabled) {
            try {
                const quest = questDataMap[questTitle];
                if (!quest || !quest.conditions || !Array.isArray(quest.conditions)) {
                    alert('Quest or conditions not found');
                    return;
                }
                
                if (conditionIndex >= quest.conditions.length) {
                    alert('Invalid condition index');
                    return;
                }
                
                // Normalize to object format
                quest.conditions = quest.conditions.map(c => {
                    if (typeof c === 'string') {
                        return { type: 'condition', condition: c, operator: 'AND' };
                    }
                    return c;
                });
                
                // Toggle once_only flag
                quest.conditions[conditionIndex].once_only = enabled;
                
                const payload = {
                    condition: quest.condition || '',
                    conditions: JSON.stringify(quest.conditions),
                    commands: quest.commands,
                    description: quest.description,
                    enabled: quest.enabled
                };
                
                const url = `/api/quests/update/${encodeURIComponent(questTitle)}`;
                const response = await authenticatedFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.conditions = quest.conditions;
                    }
                    
                    // Refresh display
                    loadQuestCards(currentGroup);
                } else {
                    const errorMsg = await response.text();
                    alert('Failed to toggle self-destruct: ' + errorMsg);
                }
            } catch (err) {
                console.error('Error toggling self-destruct:', err);
                alert('Error toggling self-destruct: ' + err.message);
            }
        }
        
        async function reEnableCondition(questTitle, conditionIndex) {
            try {
                const quest = questDataMap[questTitle];
                if (!quest || !quest.conditions || !Array.isArray(quest.conditions)) {
                    alert('Quest or conditions not found');
                    return;
                }
                
                if (conditionIndex >= quest.conditions.length) {
                    alert('Invalid condition index');
                    return;
                }
                
                // Normalize to object format
                quest.conditions = quest.conditions.map(c => {
                    if (typeof c === 'string') {
                        return { type: 'condition', condition: c, operator: 'AND' };
                    }
                    return c;
                });
                
                // Remove disabled flag
                delete quest.conditions[conditionIndex].disabled;
                
                const payload = {
                    condition: quest.condition || '',
                    conditions: JSON.stringify(quest.conditions),
                    commands: quest.commands,
                    description: quest.description,
                    enabled: quest.enabled
                };
                
                const url = `/api/quests/update/${encodeURIComponent(questTitle)}`;
                const response = await authenticatedFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    // Update in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const groupQuest = currentGroup.quests.find(q => q.title === questTitle);
                    if (groupQuest) {
                        groupQuest.conditions = quest.conditions;
                    }
                    
                    // Refresh display
                    loadQuestCards(currentGroup);
                } else {
                    const errorMsg = await response.text();
                    alert('Failed to re-enable condition: ' + errorMsg);
                }
            } catch (err) {
                console.error('Error re-enabling condition:', err);
                alert('Error re-enabling condition: ' + err.message);
            }
        }
        
        
        async function addCommand(questTitle, commandType) {
            const quest = questDataMap[questTitle];
            if (!quest) {
                alert('Quest not found');
                return;
            }
            
            let newCommand = commandType;
            
            // If it requires a value, prompt for it
            if (commandType === 'reply_post:') {
                const text = prompt('Enter reply text (use {{name}} for dreamer name):');
                if (!text) return;
                newCommand = `reply_post:${text.trim()}`;
            } else if (commandType === 'award_souvenir:') {
                const key = prompt('Enter souvenir key:');
                if (!key) return;
                newCommand = `award_souvenir:${key.trim()}`;
            } else if (commandType === 'add_canon:') {
                const key = prompt('Enter canon key (e.g., first_quest):');
                if (!key) return;
                const event = prompt('Enter canon event text:');
                if (!event) return;
                const type = prompt('Enter canon type (event, souvenir, milestone, memory, lore):', 'event');
                newCommand = `add_canon:${key.trim()}:${event.trim()}:${type.trim()}`;
            } else if (commandType === 'add_name:') {
                const name = prompt('Enter name to add:');
                if (!name) return;
                newCommand = `add_name:${name.trim()}`;
            } else if (commandType === 'mod_spectrum:') {
                const value = prompt('Enter spectrum modifier (e.g., +1.5 or -0.5):');
                if (!value) return;
                newCommand = `mod_spectrum:${value.trim()}`;
            }
            
            const commands = [...(quest.commands || []), newCommand];
            
            try {
                const url = `/api/quests/update/${encodeURIComponent(questTitle)}`;
                const payload = {
                    condition: quest.condition,
                    commands: commands,
                    description: quest.description,
                    enabled: quest.enabled
                };
                
                const response = await authenticatedFetch(url, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    // Update local data
                    quest.commands = commands;
                    questDataMap[questTitle] = quest;
                    
                    // Update quest in current group
                    const currentGroup = questGroups[currentGroupIndex];
                    const questInGroup = currentGroup.quests.find(q => q.title === questTitle);
                    if (questInGroup) {
                        questInGroup.commands = commands;
                    }
                    
                    // Refresh display (stay in place)
                    loadQuestCards(currentGroup);
                } else {
                    const result = await response.json();
                    alert('Failed to add command: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error adding command: ' + err.message);
            }
        }
        
        // Create blank quest - no modal, just create it directly
        async function createBlankQuest() {
            try {
                const newQuest = {
                    name: 'New Quest',
                    description: '',
                    trigger_type: null,
                    uri: null,
                    trigger_config: null,
                    conditions: [],
                    condition_operator: 'AND',
                    commands: [],
                    enabled: false,
                    hose_service: 'questhose'  // Default to questhose
                };
                
                const response = await fetch('/api/admin/quests', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify(newQuest)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to create quest');
                }
                
                const result = await response.json();
                console.log('✅ Blank quest created:', result);
                
                // Reload quests to show the new one
                await loadQuests();
                
                // Scroll to bottom where new quest will be
                setTimeout(() => {
                    const questCards = document.getElementById('quest-cards');
                    if (questCards) {
                        questCards.scrollTop = questCards.scrollHeight;
                    }
                }, 100);
                
            } catch (error) {
                console.error('❌ Error creating quest:', error);
                alert('Error creating quest: ' + error.message);
            }
        }
        
        // Real-time preview update functions
        function updatePreviewDisplay() {
            // Update mini-card and art panel when title/description changes
            const titleInput = document.getElementById('preview-quest-title');
            const descInput = document.getElementById('preview-quest-description');
            
            if (!titleInput) return;
            
            const newTitle = titleInput.value || 'Untitled Quest';
            const newDesc = descInput?.value || '';
            
            // Update mini-card text at top if visible
            const miniCards = document.querySelectorAll('.origin-mini-card');
            const activeMiniCard = Array.from(miniCards).find(card => 
                card.classList.contains('active')
            );
            
            if (activeMiniCard) {
                const textEl = activeMiniCard.querySelector('.origin-mini-text');
                if (textEl) {
                    textEl.textContent = newDesc || newTitle;
                }
            }
        }
        
        function updateMiniCardForTriggerType(triggerType) {
            // Update mini-card trigger icon when trigger type changes
            const triggerIcons = {
                'bsky_reply': '💬',
                'bibliohose': '📚',
                'firehose_phrase': '🔍',
                'poll': '🔄',
                'webhook': '🪝',
                'cron': '⏰',
                'database_watch': '👁️'
            };
            
            const icon = triggerIcons[triggerType] || '⚙️';
            
            const miniCards = document.querySelectorAll('.origin-mini-card');
            const activeMiniCard = Array.from(miniCards).find(card => 
                card.classList.contains('active')
            );
            
            if (activeMiniCard) {
                const iconEl = activeMiniCard.querySelector('.origin-mini-icon');
                if (iconEl) {
                    iconEl.textContent = icon;
                }
            }
        }
        
        function updateArtPanelForTriggerType(triggerType, artContainer) {
            // Update the left art panel to match the selected trigger type
            if (!artContainer) return;
            
            let artHtml = '';
            
            if (triggerType === 'bibliohose') {
                // Show bibliohose monitor panel
                artHtml = `
                    <div style="font-size: 0.85rem; padding: 1rem; background: linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%); border-radius: 6px;">
                        <div style="font-weight: 700; color: #6b21a8; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">📚 BIBLIOHOSE MONITOR</div>
                        <div id="biblio-monitor-details" style="color: #4c1d95; line-height: 1.6;">
                            <div style="padding: 1rem; text-align: center; color: #6b7280;">
                                Configure monitoring options to see what will be watched
                            </div>
                        </div>
                    </div>`;
            } else if (triggerType === 'firehose_phrase') {
                // Show firehose phrase panel with actual configuration
                let configHtml = '';
                const config = quest.trigger_config;
                
                if (config && typeof config === 'object') {
                    const phrases = config.phrases || [];
                    const caseSensitive = config.case_sensitive || false;
                    const matchWholeWords = config.match_whole_words || false;
                    const excludeReposts = config.exclude_reposts !== false; // default true
                    
                    if (phrases.length > 0) {
                        configHtml = `
                            <div style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(30, 64, 175, 0.2);">
                                <div style="font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.7rem; margin-bottom: 0.5rem;">MONITORING ${phrases.length} PHRASE${phrases.length > 1 ? 'S' : ''}</div>
                                ${phrases.map(p => `
                                    <div style="margin-bottom: 0.4rem; padding: 0.4rem; background: rgba(255,255,255,0.7); border-radius: 3px; border-left: 3px solid #3b82f6;">
                                        <div style="font-family: monospace; font-size: 0.75rem; color: #1e3a8a; font-weight: 600;">${escapeHtml(p)}</div>
                                    </div>
                                `).join('')}
                            </div>
                            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; font-size: 0.65rem; color: #4b5563;">
                                <div style="display: flex; align-items: center; gap: 0.3rem;">
                                    <span style="font-size: 1rem;">${caseSensitive ? '✅' : '⬜'}</span>
                                    <span>Case Sensitive</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.3rem;">
                                    <span style="font-size: 1rem;">${matchWholeWords ? '✅' : '⬜'}</span>
                                    <span>Whole Words</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.3rem;">
                                    <span style="font-size: 1rem;">${excludeReposts ? '✅' : '⬜'}</span>
                                    <span>Exclude Reposts</span>
                                </div>
                            </div>`;
                    } else {
                        configHtml = `
                            <div style="padding: 1rem; text-align: center; color: #6b7280; font-size: 0.75rem;">
                                No phrases configured yet.<br>
                                Add phrases in the configuration panel →
                            </div>`;
                    }
                } else {
                    configHtml = `
                        <div style="padding: 1rem; text-align: center; color: #6b7280; font-size: 0.75rem;">
                            Configure phrases to monitor<br>
                            in the trigger settings →
                        </div>`;
                }
                
                artHtml = `
                    <div style="font-size: 0.85rem; padding: 1rem; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 6px;">
                        <div style="font-weight: 700; color: #1e40af; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">🔍 FIREHOSE MONITOR</div>
                        <div style="color: #1e3a8a; line-height: 1.6;">
                            ${configHtml}
                            <div style="margin-top: 0.75rem; padding: 0.5rem; background: rgba(255,255,255,0.5); border-radius: 4px; font-size: 0.7rem; border-left: 3px solid #60a5fa;">
                                <div style="margin-bottom: 0.3rem;">⚡ Instant detection across network</div>
                                <div style="margin-bottom: 0.3rem;">🌐 Monitors all public posts</div>
                                <div>🎯 Triggers when any user posts matching phrase</div>
                            </div>
                        </div>
                    </div>`;
            } else if (triggerType === 'bsky_reply') {
                // Show reply monitor panel
                artHtml = `
                    <div style="font-size: 0.85rem; padding: 1rem; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 6px;">
                        <div style="font-weight: 700; color: #92400e; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">💬 REPLY MONITOR</div>
                        <div id="post-preview-content" style="color: #78350f; line-height: 1.6;">
                            <div style="padding: 1rem; text-align: center; color: #6b7280;">
                                Enter a post URI to monitor for replies
                            </div>
                        </div>
                    </div>`;
            } else {
                // Generic panel for other trigger types
                const triggerLabels = {
                    'poll': 'Poll Monitor',
                    'webhook': 'Webhook Trigger',
                    'cron': 'Scheduled Task',
                    'database_watch': 'Database Watch'
                };
                
                const triggerEmojis = {
                    'poll': '🔄',
                    'webhook': '🪝',
                    'cron': '⏰',
                    'database_watch': '👁️'
                };
                
                const label = triggerLabels[triggerType] || 'Quest Trigger';
                const emoji = triggerEmojis[triggerType] || '⚙️';
                
                artHtml = `
                    <div style="font-size: 0.85rem; padding: 1rem; background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); border-radius: 6px;">
                        <div style="font-weight: 700; color: #374151; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">${emoji} ${label.toUpperCase()}</div>
                        <div style="color: #4b5563; line-height: 1.6; font-size: 0.75rem;">
                            Configure the trigger settings on the right to activate this quest.
                        </div>
                    </div>`;
            }
            
            artContainer.innerHTML = artHtml;
        }
        
        function updateBiblioMonitorPanel() {
            // Update the left art panel with current bibliohose configuration
            const listUri = document.getElementById('biblio-list-uri')?.value?.trim() || '';
            const bookTitle = document.getElementById('biblio-book-title')?.value?.trim() || '';
            const checkStamps = document.getElementById('biblio-coll-stamps')?.checked || false;
            const checkBook = document.getElementById('biblio-coll-book')?.checked || false;
            const checkList = document.getElementById('biblio-coll-list')?.checked || false;
            
            const detailsEl = document.getElementById('biblio-monitor-details');
            if (!detailsEl) return;
            
            // Rebuild the monitoring details panel
            let html = '';
            
            if (listUri) {
                html += `
                    <div style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(0,0,0,0.1);">
                        <div style="font-weight: 700; color: #6b21a8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;">📋 READING LIST</div>
                        <div id="biblio-list-title" style="font-size: 0.85rem; font-weight: 600; color: #4c1d95; margin-bottom: 0.3rem;">Loading list info...</div>
                        <div style="font-family: monospace; font-size: 0.65rem; color: #6b7280; word-break: break-all; line-height: 1.3;">${listUri}</div>
                    </div>`;
                
                // Trigger list info fetch
                setTimeout(() => loadBiblioListInfo(listUri), 100);
            }
            
            html += `
                <div style="margin-bottom: 0.75rem;">
                    <div style="font-weight: 700; color: #6b21a8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.4rem;">🎯 TRIGGERS ON</div>`;
            
            if (checkStamps) {
                html += `
                    <div style="display: flex; align-items: start; gap: 0.4rem; margin-bottom: 0.3rem;">
                        <span style="color: #059669;">✅</span>
                        <div>
                            <strong>Completion Stamps</strong><br>
                            <span style="color: #6b7280; font-size: 0.65rem;">When libre.reverie.house issues badge to dreamer for completing ${listUri ? 'this list' : 'any list'}</span>
                        </div>
                    </div>`;
            }
            
            if (checkBook) {
                html += `
                    <div style="display: flex; align-items: start; gap: 0.4rem; margin-bottom: 0.3rem;">
                        <span style="color: #2563eb;">📖</span>
                        <div>
                            <strong>Reading Records</strong><br>
                            <span style="color: #6b7280; font-size: 0.65rem;">When dreamers create book reading records${bookTitle ? ' for "' + bookTitle + '"' : ''}</span>
                        </div>
                    </div>`;
            }
            
            if (checkList) {
                html += `
                    <div style="display: flex; align-items: start; gap: 0.4rem;">
                        <span style="color: #9333ea;">📋</span>
                        <div>
                            <strong>List Creation</strong><br>
                            <span style="color: #6b7280; font-size: 0.65rem;">When new reading lists are created</span>
                        </div>
                    </div>`;
            }
            
            if (!checkStamps && !checkBook && !checkList) {
                html += `
                    <div style="color: #b45309; font-size: 0.75rem;">
                        ⚠️ Monitoring all biblio.bond record types
                    </div>`;
            }
            
            html += `
                </div>`;
            
            if (bookTitle) {
                html += `
                    <div style="padding-top: 0.75rem; border-top: 1px solid rgba(0,0,0,0.1);">
                        <div style="font-weight: 700; color: #6b21a8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.3rem;">📚 BOOK FILTER</div>
                        <div style="color: #4c1d95;">"${bookTitle}"</div>
                        <div style="color: #6b7280; font-size: 0.65rem; margin-top: 0.2rem;">Only matches books containing this title</div>
                    </div>`;
            }
            
            detailsEl.innerHTML = html;
        }
        
        async function createQuest() {
            const name = document.getElementById('new-quest-name').value.trim();
            const triggerType = document.getElementById('new-quest-trigger-type').value;
            const uri = document.getElementById('new-quest-uri')?.value.trim() || '';
            const configText = document.getElementById('new-quest-config')?.value.trim() || '';
            
            if (!name) {
                alert('Please enter a quest name');
                return;
            }
            
            // Parse config JSON if provided
            let triggerConfig = null;
            if (configText && triggerType !== 'bsky_reply') {
                try {
                    triggerConfig = JSON.parse(configText);
                } catch (e) {
                    alert('Invalid JSON in trigger configuration: ' + e.message);
                    return;
                }
            }
            
            try {
                const payload = {
                    title: name,
                    description: '',
                    uri: triggerType === 'bsky_reply' ? uri : '',
                    condition: 'any_reply',
                    commands: [],
                    enabled: false,  // Start disabled so user can configure it first
                    trigger_type: triggerType
                };
                
                if (triggerConfig) {
                    payload.trigger_config = JSON.stringify(triggerConfig);
                }
                
                const response = await authenticatedFetch('/api/quests/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    document.querySelector('.modal-overlay').remove();
                    
                    // Reload all quest groups to include the new one
                    await loadQuests();
                    
                    // Try to find and navigate to the new quest's group
                    for (let i = 0; i < questGroups.length; i++) {
                        const group = questGroups[i];
                        if (group.quests.some(q => q.title === name)) {
                            await showGroupWithBuffer(i);
                            break;
                        }
                    }
                } else {
                    const result = await response.json();
                    alert('Failed to create quest: ' + (result.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error creating quest: ' + err.message);
            }
        }

