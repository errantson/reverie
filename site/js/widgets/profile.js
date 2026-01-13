class Profile {
    constructor(container) {
        this.container = container;
        this.dreamer = null;
        this.session = null;
        this.octantDisplay = null;
        this.loadStyles();
        this.init();
    }

    loadStyles() {
        // Track loaded dependencies
        this.dependenciesLoaded = this.dependenciesLoaded || new Set();
        this.dependencyPromises = this.dependencyPromises || [];
        
        // Helper to load script with promise
        const loadScript = (src, checkGlobal) => {
            // Check if already loaded by this instance
            if (this.dependenciesLoaded.has(src)) {
                return Promise.resolve();
            }
            
            // Check if script tag exists OR global is already defined
            const scriptExists = document.querySelector(`script[src*="${src}"]`);
            const globalExists = checkGlobal && typeof window[checkGlobal] !== 'undefined';
            
            if (scriptExists || globalExists) {
                this.dependenciesLoaded.add(src);
                if (globalExists) {
                    console.log(`[Profile] Already loaded (global exists): ${checkGlobal}`);
                }
                return Promise.resolve();
            }
            
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = () => {
                    this.dependenciesLoaded.add(src);
                    console.log(`[Profile] Loaded: ${src}`);
                    resolve();
                };
                script.onerror = () => {
                    console.warn(`[Profile] Failed to load: ${src}`);
                    reject(new Error(`Failed to load ${src}`));
                };
                document.head.appendChild(script);
            });
        };
        
        // Helper to load stylesheet
        const loadStylesheet = (href) => {
            if (document.querySelector(`link[href*="${href}"]`)) {
                return;
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        };
        
        // Load CSS (synchronous, no need to wait)
        loadStylesheet('/css/widgets/profile.css?v=4');
        loadStylesheet('/css/octants.css');
        loadStylesheet('/css/roles.css');
        loadStylesheet('/css/color-rows.css');
        loadStylesheet('/css/others.css');
        loadStylesheet('/css/souvenirs.css');
        loadStylesheet('/css/widgets/popup.css');
        
        // Load JavaScript dependencies in order with promises
        // Core utilities first
        this.dependencyPromises.push(
            loadScript('/js/core/rowstyle-registry.js'),
            loadScript('/js/core/rowstyle-engine.js', 'RowStyleEngine'),
            loadScript('/js/utils/num_nom.js'),
            loadScript('/js/utils/user-status.js', 'UserStatus'),
            loadScript('/js/utils/atproto-interactions.js'),
            loadScript('/js/widgets/popup.js', 'Popup')
        );
        
        // Then widgets that may depend on core utilities
        this.dependencyPromises.push(
            loadScript('/js/widgets/axisexplainer.js', 'axisExplainerWidget'),
            loadScript('/js/widgets/designations.js'),
            loadScript('/js/widgets/dreamer-hover.js', 'DreamerHoverWidget'),
            loadScript('/js/widgets/octantshowcase.js', 'OctantShowcase'),
            loadScript('/js/widgets/octantdisplay.js', 'OctantDisplay'),
            loadScript('/js/widgets/spectrum.js', 'SpectrumVisualizer'),
            loadScript('/js/widgets/eventstack.js', 'EventStack')
        );
    }
    
    async waitForDependencies() {
        if (this.dependencyPromises && this.dependencyPromises.length > 0) {
            try {
                await Promise.allSettled(this.dependencyPromises);
                console.log('[Profile] All dependencies loaded');
            } catch (error) {
                console.warn('[Profile] Some dependencies failed to load:', error);
            }
        }
    }

    async init() {
        this.session = window.oauthManager?.getSession();
        this.renderLoading();
    }

    renderLoading() {
        this.container.innerHTML = `
            <div class="profile-loading">
                <div>Loading profile...</div>
            </div>
        `;
    }

    renderError(error) {
        this.container.innerHTML = `
            <div class="profile-error">
                <div style="font-size: 3rem;">⚠️</div>
                <div style="font-size: 1.2rem; font-weight: 600; color: #d9534f; margin-top: 16px;">
                    Failed to load profile
                </div>
                <div style="font-size: 0.9rem; color: #666; margin-top: 8px; max-width: 400px;">
                    ${error?.message || 'An unexpected error occurred'}
                </div>
            </div>
        `;
    }

    render() {
        this.container.innerHTML = `
            <div class="profile-row-1">
                <div class="profile-avatar"></div>
                <div class="profile-identity">
                    <div class="profile-name"></div>
                    <div class="profile-handle"></div>
                    <div class="profile-arrival"></div>
                </div>
                <div class="profile-contribution-card"></div>
            </div>
            <div class="profile-row-single">
                <div class="profile-activity-header">
                    <div class="activity-face-controls">
                        <button class="activity-face-btn active" data-face="lore" title="Recent Activity">Recent</button>
                        <button class="activity-face-btn" data-face="history" title="Event History">History</button>
                        <button class="activity-face-btn" data-face="souvenirs" title="Earned Souvenirs">Souvenirs</button>
                        <button class="activity-face-btn" data-face="spectrum" title="Spectrum Map">Spectrum</button>
                        <button class="activity-face-btn" data-face="identity" title="Contribution & Patron">Identity</button>
                    </div>
                </div>
                <div class="profile-activity-content"></div>
                <div class="profile-events-content" style="display: none;"></div>
                <div class="profile-contribution-face" style="display: none;"></div>
                <div class="profile-souvenirs-face" style="display: none;"></div>
                <div class="profile-spectrum-face" style="display: none;"></div>
            </div>
        `;
    }
    async displayProfile(dreamer) {
        try {
            // Wait for all dependencies to load before proceeding
            await this.waitForDependencies();
            
            this.dreamer = dreamer;
            document.title = `Reverie Spectrum — ${dreamer.name || dreamer.handle}`;
            
            // Set profile color from dreamer's color_hex (this will override user color temporarily)
            if (dreamer.color_hex && window.colorManager) {
                window.colorManager.setProfileColor(dreamer.color_hex, dreamer.name || dreamer.handle);
                // Also set --reverie-core-color for inline styles in profile
                document.documentElement.style.setProperty('--reverie-core-color', dreamer.color_hex);
            } else if (dreamer.color_hex) {
                // Fallback if color manager not available
                document.documentElement.style.setProperty('--user-color', dreamer.color_hex);
                document.documentElement.style.setProperty('--reverie-core-color', dreamer.color_hex);
            }
            
            // Update background phanera if background widget is available
            if (window.background) {
                // Initialize in profile mode if not already done
                if (!window.background.mode) {
                    window.background = new Background('profile', { dreamer });
                    await window.background.init();
                } else {
                    window.background.setDreamer(dreamer);
                }
            }
            
            this.render();
            
            // Setup activity face toggle
            const faceBtns = this.container.querySelectorAll('.activity-face-btn');
            const activityContent = this.container.querySelector('.profile-activity-content');
            const eventsContent = this.container.querySelector('.profile-events-content');
            const contributionFace = this.container.querySelector('.profile-contribution-face');
            const souvenirsFace = this.container.querySelector('.profile-souvenirs-face');
            const spectrumFace = this.container.querySelector('.profile-spectrum-face');
            
            const allFaces = [activityContent, eventsContent, contributionFace, souvenirsFace, spectrumFace];
            
            // Restore last selected tab from localStorage (used for auto-activation after content loads)
            const lastSelectedFace = localStorage.getItem('profile-selected-face') || 'lore';
            console.log('Restoring profile tab:', lastSelectedFace);
            
            faceBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const face = btn.getAttribute('data-face');
                    console.log('Profile tab clicked:', face);
                    
                    // Save selection to localStorage
                    localStorage.setItem('profile-selected-face', face);
                    
                    // Update button states
                    faceBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Hide all content with fade
                    allFaces.forEach(el => {
                        if (el && el.style.display !== 'none') {
                            el.style.opacity = '0';
                        }
                    });
                    
                    setTimeout(() => {
                        // Hide all
                        allFaces.forEach(el => el.style.display = 'none');
                        
                        // Show selected
                        let targetContent;
                        if (face === 'lore') targetContent = activityContent;
                        else if (face === 'history') targetContent = eventsContent;
                        else if (face === 'identity') targetContent = contributionFace;
                        else if (face === 'souvenirs') {
                            targetContent = souvenirsFace;
                            // Initialize souvenirs canvas when shown
                            setTimeout(() => this.initSouvenirsPhysics(this.dreamer), 50);
                        }
                        else if (face === 'spectrum') {
                            targetContent = spectrumFace;
                            // Initialize spectrum canvas when shown
                            setTimeout(() => this.initSpectrumVisualization(this.dreamer), 50);
                        }
                        
                        if (targetContent) {
                            targetContent.style.display = 'block';
                            requestAnimationFrame(() => {
                                targetContent.style.opacity = '1';
                            });
                        }
                    }, 200);
                });
            });
            
            // Find button for auto-activation after content is ready (lastSelectedFace declared earlier)
            const btnToActivate = Array.from(faceBtns).find(b => b.getAttribute('data-face') === lastSelectedFace);
            
            // Fetch user status once upfront (centralized check)
            let userStatus = null;
            if (window.UserStatus) {
                try {
                    const isOwnProfile = this.session && this.session.did === dreamer.did;
                    const authToken = isOwnProfile ? localStorage.getItem('oauth_token') : null;
                    userStatus = await window.UserStatus.getUserStatus(dreamer, { authToken });
                } catch (error) {
                    console.warn('Error getting user status:', error);
                }
            }
            
            await this.updateAvatar(dreamer);
            await this.updateIdentity(dreamer, userStatus);
            await this.updateContributionCard(dreamer, userStatus);
            await this.updateActivityCard(dreamer);
            await this.updateEventsCard(dreamer);
            await this.updateIdentityFace(dreamer);
            await this.updateSouvenirsFace(dreamer);
            await this.updateSpectrumFace(dreamer);
            
            await this.initializeExplainer();
            
            // Auto-activate saved tab AFTER all content is ready
            if (btnToActivate && lastSelectedFace !== 'lore') {
                console.log('Auto-activating saved profile tab:', lastSelectedFace);
                // Small delay to ensure DOM is fully rendered
                setTimeout(() => btnToActivate.click(), 50);
            }
        } catch (error) {
            console.error('Error displaying profile:', error);
            this.renderError(error);
        }
    }

    async initializeExplainer() {
        // Wait for dependencies if not already loaded
        if (!window.axisExplainerWidget) {
            await this.waitForDependencies();
        }
        
        // Explainer initialization is now handled by the OctantDisplay widget
        // This method is kept for any other explainer needs in the profile
        if (window.axisExplainerWidget) {
            const explainerElements = this.container.querySelectorAll('[data-explainer]');
            explainerElements.forEach(el => {
                const term = el.getAttribute('data-explainer');
                if (term && term !== 'Unknown') {
                    window.axisExplainerWidget.attach(el, term);
                }
            });
        } else {
            console.warn('[Profile] axisExplainerWidget still not available after waiting');
        }
    }
    async updateAvatar(dreamer) {
        const avatarEl = this.container.querySelector('.profile-avatar');
        if (!avatarEl) return;

        let avatarUrl = '/assets/icon_face.png';
        
        if (typeof dreamer.avatar === 'string' && dreamer.avatar) {
            avatarUrl = dreamer.avatar;
        } else if (dreamer.avatar?.url) {
            avatarUrl = dreamer.avatar.url;
        } else if (dreamer.avatar?.ref?.$link) {
            const ext = (dreamer.avatar.mimeType === 'image/jpeg') ? 'jpeg' : 'png';
            if (dreamer.server?.includes('bsky.network') || dreamer.server === 'https://reverie.house') {
                avatarUrl = `https://cdn.bsky.app/img/feed_thumbnail/plain/${dreamer.did}/${dreamer.avatar.ref.$link}@${ext}`;
            } else {
                avatarUrl = dreamer.avatar.ref.$link;
            }
        }

        // Initialize random love phrase if needed
        if (!this.currentLovePhrase) {
            this.rotateLovePhrase();
        }

        // Fetch last sent time
        let lastSentText = 'Never';
        try {
            const sentResponse = await fetch(`/api/messages/last-sent?to_did=${encodeURIComponent(dreamer.did)}`);
            if (sentResponse.ok) {
                const sentData = await sentResponse.json();
                if (sentData.last_sent) {
                    lastSentText = this.getTimeAgo(sentData.last_sent * 1000);
                }
            }
        } catch (err) {
            console.warn('Could not fetch last sent time:', err);
        }

        avatarEl.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                <a href="https://bsky.app/profile/${dreamer.did}" target="_blank" rel="noopener noreferrer">
                    <img src="${avatarUrl}" 
                         alt="${dreamer.name || dreamer.handle}"
                         onerror="this.src='/assets/icon_face.png'">
                </a>
                <button class="profile-send-love-btn" 
                        onmouseenter="window.profileWidget.startHoverRotation()" 
                        onmouseleave="window.profileWidget.stopHoverRotation()" 
                        onclick="window.profileWidget.sendLove('${dreamer.did}')" 
                        style="padding: 4px 8px; background: var(--user-color, var(--reverie-core-color, #734ba1)); color: white; border: none; border-radius: 0; cursor: pointer; font-size: 0.7rem; font-weight: 500; white-space: nowrap; width: 85px; text-align: center; margin-top: 4px;">
                    <span id="lovePhraseText">${this.currentLovePhrase}</span>
                </button>
                <div id="profileLastSent" style="font-size: 0.55rem; opacity: 0.5; color: var(--reverie-core-color); text-align: center; line-height: 1.2; width: 85px;">
                    Last: <span style="font-style: italic;">${lastSentText}</span>
                </div>
            </div>
        `;

        // Start auto-rotation of love phrase
        this.startAutoRotation();
    }

    async updateIdentity(dreamer, userStatus = null) {
        const identityEl = this.container.querySelector('.profile-identity');
        if (!identityEl) return;

        const nameEl = identityEl.querySelector('.profile-name');
        const handleEl = identityEl.querySelector('.profile-handle');
        const arrivalEl = identityEl.querySelector('.profile-arrival');

        // Display designation in uppercase
        let designation = (dreamer.designation || 'Dreamer').toUpperCase();

        // Name without icon
        nameEl.innerHTML = `
            <h1>
                ${dreamer.name || dreamer.handle}
            </h1>
        `;

        // Handle with designation below (make designation clickable)
        handleEl.innerHTML = `
            <a href="https://bsky.app/profile/${dreamer.did}" target="_blank" rel="noopener noreferrer">
                @${dreamer.handle}
            </a>
            <div class="profile-status" data-status="${designation}">${designation}</div>
        `;

        // Attach designation explainer after a short delay to ensure widget is loaded
        setTimeout(() => {
            const statusEl = handleEl.querySelector('.profile-status');
            if (statusEl && window.designationExplainerWidget) {
                window.designationExplainerWidget.attach(statusEl, designation, dreamer.color_hex);
            }
        }, 200);

        // Arrival time
        if (dreamer.arrival) {
            const arrivalFormatted = this.formatArrival(dreamer.arrival);
            arrivalEl.innerHTML = arrivalFormatted;
        } else {
            arrivalEl.innerHTML = '';
        }

        // Update bio content (now part of header)
        const bioContent = this.container.querySelector('.profile-bio-content');
        if (bioContent) {
            const bioText = dreamer.description || dreamer.bio || '';
            if (bioText.trim()) {
                // Use simple URL linkification for bio (synchronous)
                const linkedText = this.linkifyBioText(bioText.trim());
                // Check if bio is short (30% less than 150 = 105 characters)
                const isShort = bioText.trim().length <= 105;
                const shortClass = isShort ? ' short-bio' : '';
                bioContent.innerHTML = `
                    <div class="profile-bio-text${shortClass}" style="color: var(--reverie-core-color);">${linkedText}</div>
                `;
            } else {
                bioContent.innerHTML = `
                    <div class="profile-empty">Little is said. Less is known.</div>
                `;
            }
        }
    }

    async updateContributionCard(dreamer, userStatus = null) {
        const contributionCard = this.container.querySelector('.profile-contribution-card');
        if (!contributionCard) return;

        // Use provided userStatus if available, otherwise status checks already failed
        const isCharacter = userStatus?.isCharacter || false;
        const characterLevel = userStatus?.characterLevel || null;
        
        // Get scores from database (already calculated by contributions.py)
        const canonCount = dreamer.canon_score || 0;        // Raw count
        const loreCount = dreamer.lore_score || 0;          // Raw count
        const patronScore = dreamer.patron_score || 0;      // Book count × 150
        const totalContribution = dreamer.contribution_score || 0;
        
        // Display patron as book count (divide by 150)
        const patronCount = Math.floor(patronScore / 150);

        // Determine star character and tooltip based on character level
        let starChar = '✦';
        let starTooltip = '';
        if (isCharacter) {
            const name = dreamer.name || dreamer.handle;
            if (characterLevel === 'revered') {
                starChar = '★'; // Filled star for auto-canon
                starTooltip = `${name} is a revered character`;
            } else if (characterLevel === 'well-known') {
                starChar = '✧'; // Hollow star for auto-lore
                starTooltip = `${name} is a well-known character`;
            } else {
                starChar = '✦'; // Four-pointed star for basic character
                starTooltip = `${name} is a known character`;
            }
        }

        // Add character sigil overlay if applicable
        const characterSigil = isCharacter ? `<div class="contribution-character-sigil" title="${starTooltip}">${starChar}</div>` : '';

        contributionCard.innerHTML = `
            ${characterSigil}
            <div class="contribution-total" style="text-align: center;">
                <span class="contribution-label">Contribution</span>
                <span class="contribution-value">${totalContribution}</span>
            </div>
            <div class="contribution-breakdown" style="text-align: center;">
                <div class="contribution-item">
                    <span class="contribution-sublabel">Canon</span>
                    <span class="contribution-subvalue">${canonCount}</span>
                </div>
                <div class="contribution-item">
                    <span class="contribution-sublabel">Lore</span>
                    <span class="contribution-subvalue">${loreCount}</span>
                </div>
                <div class="contribution-item">
                    <span class="contribution-sublabel">Patron</span>
                    <span class="contribution-subvalue">${patronCount}</span>
                </div>
            </div>
        `;
    }

    linkifyBioText(text) {
        // Convert URLs and plain domains in text to clickable links that open in new tabs
        // Keep link styling plain with just an underline
        
        // First, handle full URLs (http:// or https://)
        const urlPattern = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
        let result = text.replace(urlPattern, (match) => {
            const fullUrl = match;
            // Create abbreviated display: remove https://, trailing /, and www.
            let displayUrl = fullUrl
                .replace(/^https:\/\//, '')  // Remove https:// (but keep http://)
                .replace(/\/$/, '')          // Remove trailing /
                .replace(/^www\./, '');      // Remove www. prefix
            
            return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">${displayUrl}</a>`;
        });
        
        // Then, detect plain domains (e.g., "example.com", "toogoodtogo.com")
        // Match word boundaries, domain name with TLD, but not already in href attributes
        const domainPattern = /\b(?<!href=")([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g;
        result = result.replace(domainPattern, (match) => {
            // Skip if this is already part of a link (basic check)
            if (result.indexOf(`href="http`) !== -1 && result.indexOf(match) > result.lastIndexOf(`href="http`)) {
                return match; // Already linked
            }
            const fullUrl = `https://${match}`;
            return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">${match}</a>`;
        });
        
        return result;
    }

    formatArrival(dateString) {
        if (window.NumNom?.formatArrivalTime) {
            return window.NumNom.formatArrivalTime(dateString);
        }
        
        if (!dateString) return 'Unknown';
        
        let date;
        if (typeof dateString === 'number') {
            date = new Date(dateString > 10000000000 ? dateString : dateString * 1000);
        } else {
            date = new Date(dateString);
        }
        
        if (isNaN(date.getTime())) return 'Unknown';
        
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    async updateHeadingCard(dreamer) {
        const headingContent = this.container.querySelector('.profile-heading-content');
        if (!headingContent) return;

        if (!dreamer.heading) {
            headingContent.style.display = 'none';
            return;
        }

        headingContent.style.display = 'block';
        
        // Get octant for styling - use simple mapping
        const octant = dreamer.spectrum?.octant || 'equilibrium';
        const octantCodeToName = {
            '+++': 'adaptive', '++-': 'chaotic', '+-+': 'prepared', '+--': 'intended',
            '-++': 'contented', '-+-': 'assertive', '--+': 'ordered', '---': 'guarded',
            'equilibrium': 'equilibrium', 'confused': 'confused', 'singling': 'singling'
        };
        const octantKey = octant?.match(/^[+-]{3}$/) ? octantCodeToName[octant] : octant;

        let headingHTML = `<div class="profile-spectrum-container" data-octant="${octantKey}">`;
        headingHTML += '<div class="profile-heading-section">';
        
        if (dreamer.heading.startsWith('did:')) {
            try {
                const response = await fetch('/api/dreamers');
                const dreamers = await response.json();
                const targetDreamer = dreamers.find(d => d.did === dreamer.heading);
                
                if (targetDreamer) {
                    const avatarUrl = targetDreamer.avatar 
                        ? `https://cdn.bsky.app/img/avatar/plain/${targetDreamer.did}/${targetDreamer.avatar.ref.$link}@jpeg`
                        : '/assets/icon_face.png';
                    
                    headingHTML += `
                        <div class="heading-dreamer">
                            <a href="/dreamer?did=${encodeURIComponent(targetDreamer.did)}" class="heading-avatar">
                                <img src="${avatarUrl}" alt="${targetDreamer.name || targetDreamer.handle}">
                            </a>
                            <div class="heading-info">
                                <a href="/dreamer?did=${encodeURIComponent(targetDreamer.did)}" class="heading-name">
                                    ${targetDreamer.name || targetDreamer.handle}
                                </a>
                                <div class="heading-handle">@${targetDreamer.handle}</div>
                            </div>
                        </div>
                    `;
                } else {
                    headingHTML += '<div class="heading-text">Unknown Dreamer</div>';
                }
            } catch (error) {
                console.error('Error loading heading dreamer:', error);
                headingHTML += '<div class="heading-text">Error loading dreamer</div>';
            }
        } else {
            headingHTML += `<div class="heading-text">${dreamer.heading}</div>`;
        }
        
        if (dreamer.heading_changed) {
            const changedDate = new Date(dreamer.heading_changed * 1000);
            const timeAgo = this.getTimeAgo(dreamer.heading_changed * 1000);
            headingHTML += `<div class="heading-changed">${timeAgo}</div>`;
        }
        
        headingHTML += '</div></div>';
        headingContent.innerHTML = headingHTML;
    }

    async updateActivityCard(dreamer) {
        const activityContent = this.container.querySelector('.profile-activity-content');
        if (!activityContent) return;

        console.log('🔍 Loading activity for DID:', dreamer.did);

        try {
            // Priority 1: Check lore.farm for canon:reverie.house label
            let activityData = await this.fetchPostWithLabel(dreamer.did, 'canon:reverie.house');
            let labelType = activityData ? 'canon' : null;
            
            // Priority 2: Check for lore:reverie.house label
            if (!activityData) {
                activityData = await this.fetchPostWithLabel(dreamer.did, 'lore:reverie.house');
                labelType = activityData ? 'lore' : null;
            }
            
            // Priority 3: Get most recent post
            if (!activityData) {
                console.log('   📝 Fetching most recent post for', dreamer.did);
                activityData = await this.fetchMostRecentPost(dreamer.did);
            }
            
            // Priority 4: Get most recent reply
            if (!activityData) {
                activityData = await this.fetchMostRecentReply(dreamer.did);
            }
            
            // Priority 5: "Just arrived" template
            if (!activityData) {
                // Show empty state with proper interactive buttons at 0 counts
                const timeAgo = 'just now';
                
                // Check if user is logged in to show interactive buttons
                const session = window.oauthManager ? window.oauthManager.getSession() : null;
                const isLoggedIn = !!session;
                
                let interactionStats = '';
                if (isLoggedIn) {
                    // Show interactive buttons but disabled (no URI to interact with)
                    interactionStats = `
                        <button class="activity-time" 
                                style="border: none; background: none; padding: 0; margin: 0; cursor: default; opacity: 0.5;"
                                disabled
                                title="No posts yet">
                            ♡
                        </button>
                        <span class="activity-time" style="opacity: 0.3; cursor: default;">•</span>
                        <button class="activity-time" 
                                style="border: none; background: none; padding: 0; margin: 0; cursor: default; opacity: 0.5;"
                                disabled
                                title="No posts yet">
                            ↻
                        </button>
                        <span class="activity-time" style="opacity: 0.3; cursor: default;">•</span>
                        <button class="activity-time" 
                                style="border: none; background: none; padding: 0; margin: 0; cursor: default; opacity: 0.5;"
                                disabled
                                title="No posts yet">
                            ↵
                        </button>
                    `;
                } else {
                    // Not logged in - show stats as text
                    interactionStats = `
                        <span class="activity-time" style="opacity: 0.5;">0 likes</span>
                        <span class="activity-time" style="opacity: 0.3; cursor: default;">•</span>
                        <span class="activity-time" style="opacity: 0.5;">0 reposts</span>
                        <span class="activity-time" style="opacity: 0.3; cursor: default;">•</span>
                        <span class="activity-time" style="opacity: 0.5;">0 replies</span>
                    `;
                }
                
                activityContent.innerHTML = `
                    <div class="activity-box">
                        <div class="activity-text-content activity-text-only-centered">
                            <div class="activity-text activity-text-empty">Just exploring our wild mindscape</div>
                            <div class="activity-info-overlay">
                                <div class="activity-overlay-content">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span class="activity-time">${timeAgo}</span>
                                        ${interactionStats}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                return;
            }
            
            // Render the full visual activity card
            const timeAgo = this.getTimeAgo(new Date(activityData.createdAt).getTime());
            const postUrl = activityData.uri ? this.uriToUrl(activityData.uri) : '#';
            
            // Generate complementary colors for badges
            const userColor = dreamer.color_hex || '#734ba1';
            const { canon: canonColor, lore: loreColor } = this.generateBadgeColors(userColor);
            
            // Build label badge (overlay on image if present, inline if not)
            let badgeOverlay = '';
            let badgeInline = '';
            if (labelType === 'canon') {
                badgeOverlay = `<span class="activity-badge-overlay badge-canon" style="background: ${canonColor}; border-color: ${canonColor};">canon</span>`;
                badgeInline = `<span class="activity-badge-inline badge-canon" style="background: ${canonColor};">canon</span>`;
            } else if (labelType === 'lore') {
                badgeOverlay = `<span class="activity-badge-overlay badge-lore" style="background: ${loreColor}; border-color: ${loreColor};">lore</span>`;
                badgeInline = `<span class="activity-badge-inline badge-lore" style="background: ${loreColor};">lore</span>`;
            }
            
            // Linkify text content
            const linkedText = await this.linkifyText(activityData.text);
            const hasText = activityData.text && activityData.text.trim().length > 0;
            
            // Get interaction counts and build overlay first
            const likeCount = activityData.likeCount || 0;
            const repostCount = activityData.repostCount || 0;
            const replyCount = activityData.replyCount || 0;
            
            // Check if user is logged in
            const session = window.oauthManager ? window.oauthManager.getSession() : null;
            const isLoggedIn = !!session;
            
            // Check viewer state
            const isLiked = activityData.viewer?.like || false;
            const isReposted = activityData.viewer?.repost || false;
            
            // Build interaction stats - styled exactly like timestamp
            let interactionStats = '';
            if (isLoggedIn && activityData.uri && activityData.cid) {
                const escapedDisplayName = this.escapeHtml(dreamer.name || dreamer.handle);
                const truncatedText = activityData.text.substring(0, 30) + (activityData.text.length > 30 ? '...' : '');
                const escapedPostText = this.escapeHtml(truncatedText);
                
                interactionStats = `
                    <button class="activity-time" 
                            data-uri="${activityData.uri}"
                            data-cid="${activityData.cid}"
                            data-liked="${isLiked}"
                            onclick="window.profileWidget.handleLike(this)"
                            style="border: none; background: none; padding: 0; margin: 0; cursor: pointer;"
                            title="${isLiked ? 'Unlike' : 'Like'} this post">
                        ${likeCount > 0 ? likeCount : '♡'}
                    </button>
                    <span class="activity-time" style="opacity: 0.3; cursor: default;">•</span>
                    <button class="activity-time" 
                            data-uri="${activityData.uri}"
                            data-cid="${activityData.cid}"
                            data-reposted="${isReposted}"
                            onclick="window.profileWidget.handleRepost(this)"
                            style="border: none; background: none; padding: 0; margin: 0; cursor: pointer;"
                            title="${isReposted ? 'Undo repost' : 'Repost'} to your timeline">
                        ${repostCount > 0 ? repostCount : '↻'}
                    </button>
                    <span class="activity-time" style="opacity: 0.3; cursor: default;">•</span>
                    <button class="activity-time" 
                            data-uri="${activityData.uri}"
                            data-cid="${activityData.cid}"
                            data-handle="${dreamer.handle}"
                            data-displayname="${escapedDisplayName}"
                            data-text="${escapedPostText}"
                            onclick="window.profileWidget.handleReply(this)"
                            style="border: none; background: none; padding: 0; margin: 0; cursor: pointer;"
                            title="Reply to this post">
                        ${replyCount > 0 ? replyCount : '↵'}
                    </button>
                `;
            } else {
                // Not logged in - show stats as links with activity-time class
                interactionStats = `
                    <a href="${postUrl}" target="_blank" rel="noopener" class="activity-time">${likeCount} like${likeCount === 1 ? '' : 's'}</a>
                    <span class="activity-time" style="opacity: 0.3; cursor: default;">•</span>
                    <a href="${postUrl}" target="_blank" rel="noopener" class="activity-time">${repostCount} repost${repostCount === 1 ? '' : 's'}</a>
                    <span class="activity-time" style="opacity: 0.3; cursor: default;">•</span>
                    <a href="${postUrl}" target="_blank" rel="noopener" class="activity-time">${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}</a>
                `;
            }
            
            // Build info overlay
            const infoOverlay = `
                <div class="activity-info-overlay">
                    <div class="activity-overlay-content">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <a href="${postUrl}" target="_blank" rel="noopener" class="activity-time">${timeAgo}</a>
                            <span class="activity-time" style="opacity: 0.3; cursor: default;">•</span>
                            ${interactionStats}
                        </div>
                        ${badgeOverlay}
                    </div>
                </div>
            `;
            
            // Build image HTML if present
            let imageHtml = '';
            let textContentHtml = '';
            if (activityData.images && activityData.images.length > 0) {
                const img = activityData.images[0];
                
                // If there's text, show it as overlay; if no text, just show image
                if (hasText) {
                    imageHtml = `
                        <div class="activity-image-container">
                            <img src="${img.thumb || img.fullsize}" alt="${img.alt || 'Post image'}" class="activity-image" onclick="window.open('${img.fullsize}', '_blank')">
                            <div class="activity-text-overlay">
                                <div class="activity-text-overlay-content">
                                    <div class="activity-text">${linkedText}</div>
                                </div>
                            </div>
                            ${infoOverlay}
                        </div>
                    `;
                } else {
                    // Just image, no text overlay
                    imageHtml = `
                        <div class="activity-image-container">
                            <img src="${img.thumb || img.fullsize}" alt="${img.alt || 'Post image'}" class="activity-image" onclick="window.open('${img.fullsize}', '_blank')">
                            ${infoOverlay}
                        </div>
                    `;
                }
            } else {
                // No image - show text normally centered in box with overlay
                textContentHtml = `
                    <div class="activity-text-content activity-text-only-centered">
                        <div class="activity-text">${linkedText}</div>
                        ${infoOverlay}
                    </div>
                `;
            }
            
            activityContent.innerHTML = `
                <div class="activity-box">
                    ${imageHtml}
                    ${textContentHtml}
                </div>
            `;
            
        } catch (error) {
            console.error('Error loading activity:', error);
            activityContent.innerHTML = `
                <div class="activity-empty">Unable to load activity</div>
            `;
        }
    }

    async updateEventsCard(dreamer) {
        const eventsContent = this.container.querySelector('.profile-events-content');
        if (!eventsContent) return;
        
        try {
            // Fetch canon data
            const canonResponse = await fetch('/api/canon');
            if (!canonResponse.ok) throw new Error('Failed to load canon');
            const allCanon = await canonResponse.json();
            
            // Filter to this dreamer's events AND events they reacted to
            const dreamerEvents = allCanon.filter(entry => {
                // Include events created by this dreamer
                const isOwnEvent = entry.did?.toLowerCase() === dreamer.did.toLowerCase();
                
                // Include events that this dreamer reacted to (events where reaction_did matches)
                const isReactedTo = entry.reaction_did?.toLowerCase() === dreamer.did.toLowerCase();
                
                return isOwnEvent || isReactedTo;
            });
            
            // Remove duplicates (in case an event has multiple reactions from the same user)
            const uniqueEvents = [];
            const seenIds = new Set();
            for (const event of dreamerEvents) {
                if (!seenIds.has(event.id)) {
                    seenIds.add(event.id);
                    uniqueEvents.push(event);
                }
            }
            
            // Use EventStack to render events (same as database.html)
            if (window.EventStack) {
                const eventStack = new EventStack();
                eventStack.render(uniqueEvents, eventsContent, {
                    columns: {
                        type: false,
                        key: false,
                        uri: false
                    }
                });
            } else {
                console.error('EventStack not loaded');
                eventsContent.innerHTML = '<div class="activity-empty">Unable to load events</div>';
            }
            
        } catch (error) {
            console.error('Error loading events:', error);
            eventsContent.innerHTML = '<div class="activity-empty">Unable to load events</div>';
        }
    }

    async updateIdentityFace(dreamer) {
        const identityFace = this.container.querySelector('.profile-contribution-face');
        if (!identityFace) return;
        
        const dreamerColor = dreamer.color_hex || '#734ba1';
        // derive a slightly darker label color for headings
        function darkenHex(hex, amount = 0.18) {
            if (!hex) return hex;
            let h = hex.replace('#', '');
            if (h.length === 3) h = h.split('').map(c => c + c).join('');
            const num = parseInt(h, 16);
            let r = (num >> 16) & 0xff;
            let g = (num >> 8) & 0xff;
            let b = num & 0xff;
            r = Math.max(0, Math.min(255, Math.round(r * (1 - amount))));
            g = Math.max(0, Math.min(255, Math.round(g * (1 - amount))));
            b = Math.max(0, Math.min(255, Math.round(b * (1 - amount))));
            return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        }
        const labelColor = darkenHex(dreamerColor, 0.18);
        const serverUrl = dreamer.server || 'https://reverie.house';
        const serverClean = serverUrl.replace(/^https?:\/\//, '');
        const isReverieHouse = serverClean === 'reverie.house';
        const isBskyNetwork = serverClean.endsWith('bsky.network');
        
        // Determine server label and display based on type
        let serverLabel = 'Domain';
        let serverDisplay = serverClean;
        let serverLinkUrl = serverUrl;
        
        if (isReverieHouse) {
            serverLabel = 'Residence';
            serverDisplay = 'reverie.house';
        } else if (isBskyNetwork) {
            // Extract homestar name (e.g., "porcini" from "porcini.us-east.host.bsky.network")
            serverLabel = 'Homestar';
            const homestarMatch = serverClean.match(/^([^.]+)\./);
            serverDisplay = homestarMatch ? homestarMatch[1] : serverClean;
            serverLinkUrl = 'https://bsky.app';  // Link to Bluesky for bsky.network users
        } else {
            // Custom PDS - remove 'pds.' prefix for cleaner display
            serverDisplay = serverClean.replace(/^pds\./, '');
            // For custom PDS, link to the actual domain instead of the PDS URL
            serverLinkUrl = serverClean.startsWith('pds.') 
                ? 'https://' + serverClean.replace(/^pds\./, '')
                : serverUrl;
        }
        
        const renderAltNames = (alts) => {
            if (!alts || alts === 'none') return '<span style="opacity: 0.5;">none</span>';
            return alts;
        };
        
        const bioText = dreamer.description || dreamer.bio || '';
        const bioHTML = bioText.trim() 
            ? this.linkifyBioText(bioText.trim())
            : '<span style="opacity: 0.5; font-style: italic;">Little is said. Less is known.</span>';
        
        // Get most recently read book from biblio.bond API
        let recentlyReadHTML = '<div class="profile-empty" style="font-style: italic; opacity: 0.6;">no books yet</div>';
        try {
            const booksResponse = await fetch(`https://biblio.bond/api/books/${encodeURIComponent(dreamer.did)}`);
            if (booksResponse.ok) {
                const allBooks = await booksResponse.json();
                if (allBooks && allBooks.length > 0) {
                    // Sort by created_at descending and take the single most recent
                    const book = allBooks
                        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                    const bookAuthors = book.authors || book.author;
                    recentlyReadHTML = `
                        <div class="identity-book-featured" style="margin-top: 6px;">
                            <div class="identity-book-title-featured" style="color: ${dreamerColor}; font-size: 1.0rem; font-weight: 500; line-height: 1.3;">${book.title || 'Untitled'}</div>
                            ${bookAuthors ? `<div class="identity-book-author-featured" style="color: ${dreamerColor}; opacity: 0.7; font-size: 0.85rem; margin-top: 4px;">by ${bookAuthors}</div>` : ''}
                            <a href="https://biblio.bond/library/${dreamer.did}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 6px; font-size: 0.7rem; padding: 2px 6px; border: 1px solid ${dreamerColor}; color: ${dreamerColor}; text-decoration: none; border-radius: 3px; opacity: 0.8;">View Library</a>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.warn('[Profile] Failed to fetch books from biblio.bond:', error);
        }
        
        // Get kindred
        let kindredHTML = '<div class="profile-empty">no kindred yet</div>';
        if (dreamer.kindred && dreamer.kindred.length > 0) {
            // Fetch all dreamers to get kindred info
            try {
                const response = await fetch('/api/dreamers');
                const allDreamers = await response.json();
                
                const kindredDreamers = dreamer.kindred
                    .map(k => {
                        const did = typeof k === 'string' ? k : k.did;
                        return allDreamers.find(d => d.did === did);
                    })
                    .filter(Boolean)
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 6);
                
                // Render six slots (2 columns x 3 rows). Missing entries become empty grey boxes.
                kindredHTML = `
                    <div class="profile-kindred-list">
                        ${Array.from({ length: 6 }).map((_, idx) => {
                            const k = kindredDreamers[idx];
                            if (k) {
                                const avatarUrl = k.avatar?.url || k.avatar || '/assets/icon_face.png';
                                return `
                                    <div class="profile-kindred-card" data-dreamer-did="${k.did}" data-dreamer-handle="${k.handle}">
                                        <a href="/dreamer?did=${encodeURIComponent(k.did)}" 
                                           class="profile-kindred-link"
                                           data-dreamer-did="${k.did}"
                                           data-dreamer-handle="${k.handle}">
                                            <img src="${avatarUrl}" 
                                                 alt="${k.name || k.handle}"
                                                 class="profile-kindred-avatar"
                                                 onerror="this.src='/assets/icon_face.png'">
                                            <span class="profile-kindred-name" style="color: ${dreamerColor};">${k.name || k.handle}</span>
                                        </a>
                                    </div>
                                `;
                            }
                            // empty placeholder
                            return `
                                <div class="profile-kindred-card profile-kindred-empty" aria-hidden="true">
                                    <div class="profile-kindred-link"></div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            } catch (err) {
                console.error('Error loading kindred:', err);
            }
        }
        
        identityFace.innerHTML = `
            <div class="identity-compact-layout">
                <div class="identity-top-section">
                    <div class="identity-bio-box" style="grid-column: 1 / -1;">
                        <div class="identity-bio-label" style="color: ${labelColor};">Bio</div>
                        <div class="identity-bio-text" style="text-align: center; color: ${dreamerColor};">${bioHTML}</div>
                    </div>
                </div>
                <div class="identity-middle-section">
                    <div class="identity-books-box">
                        <div class="identity-kindred-label" style="color: ${labelColor};">Recently Read</div>
                        <div class="identity-books-list" style="color: ${dreamerColor};">${recentlyReadHTML}</div>
                    </div>
                    <div class="identity-kindred-box">
                        <div class="identity-kindred-label" style="color: ${labelColor};">Kindred</div>
                        ${kindredHTML}
                    </div>
                </div>
                <div class="identity-info-row">
                    <span class="identity-info-label">Pseudonyms</span>
                    <span class="identity-info-value" style="color: ${dreamerColor};">${renderAltNames(dreamer.alt_names)}</span>
                </div>
                <div class="identity-info-row">
                    <span class="identity-info-label">Color</span>
                    <span class="identity-info-value" style="display: flex; align-items: center; gap: 8px;">
                        <span style="display: inline-block; width: 24px; height: 16px; background: ${dreamerColor}; border: 1px solid rgba(0,0,0,0.2); vertical-align: middle;"></span>
                        <span style="font-family: monospace; font-size: 0.7rem;">${dreamerColor}</span>
                    </span>
                </div>
                <div class="identity-info-row">
                    <span class="identity-info-label">${serverLabel}</span>
                    <a href="${serverLinkUrl}" 
                       target="_blank" 
                       rel="noopener"
                       class="identity-info-value identity-info-link"
                       style="color: ${dreamerColor};">
                        ${serverDisplay}
                    </a>
                </div>
                <div class="identity-info-row">
                    <span class="identity-info-label">Dream ID</span>
                    <button class="identity-info-value identity-info-link did-copy-btn" 
                       data-did="${dreamer.did}"
                       style="color: ${dreamerColor}; cursor: pointer; background: none; border: none; padding: 0; text-decoration: underline; font-family: monospace; font-size: 0.7rem;"
                       title="Click to copy DID">
                        ${dreamer.did.replace('did:plc:', '')}
                    </button>
                </div>
            </div>
        `;
        
        // Attach DID copy handler
        const didCopyBtn = identityFace.querySelector('.did-copy-btn');
        if (didCopyBtn) {
            didCopyBtn.onclick = async () => {
                const did = didCopyBtn.dataset.did;
                try {
                    await navigator.clipboard.writeText(did);
                    const originalText = didCopyBtn.textContent;
                    didCopyBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        didCopyBtn.textContent = originalText;
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy DID:', err);
                }
            };
        }
    }

    async updateSouvenirsFace(dreamer) {
        console.log('[Souvenirs] Starting updateSouvenirsFace', dreamer.name);
        const souvenirsFace = this.container.querySelector('.profile-souvenirs-face');
        
        if (!souvenirsFace) {
            console.error('[Souvenirs] ERROR: .profile-souvenirs-face container not found in DOM');
            return;
        }
        
        console.log('[Souvenirs] Container found, setting innerHTML');
        const userColor = dreamer.color_hex || '#734ba1';
        souvenirsFace.innerHTML = `
            <div class="souvenirs-physics-container" style="border-color: ${userColor};">
                <canvas id="souvenirs-physics-canvas"></canvas>
                <div class="souvenirs-mini-widget"></div>
            </div>
        `;
        
        // Don't initialize yet - it will happen when face becomes visible
        console.log('[Souvenirs] HTML set, waiting for face to be shown');
    }

    async updateSpectrumFace(dreamer) {
        console.log('[Spectrum] Starting updateSpectrumFace', dreamer.name);
        const spectrumFace = this.container.querySelector('.profile-spectrum-face');
        
        if (!spectrumFace) {
            console.error('[Spectrum] ERROR: .profile-spectrum-face container not found in DOM');
            return;
        }
        
        console.log('[Spectrum] Container found, setting innerHTML with loading state');
        const userColor = dreamer.color_hex || '#734ba1';
        spectrumFace.innerHTML = `
            <div class="spectrum-face-container" style="border-color: ${userColor};">
                <div class="spectrum-loading" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #999; font-style: italic; font-size: 16px; background: #fdfcfe;">Loading spectrum...</div>
                <canvas id="spectrum-face-canvas" style="display: none;"></canvas>
                <div class="spectrum-face-octant-overlay" style="border-color: ${userColor};"></div>
                <div class="spectrum-face-controls">
                    <button class="spectrum-face-btn" id="spectrumExploreOctantsBtn" title="Explore the octants of the spectrum" style="border-color: ${userColor}; color: ${userColor};">
                        <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                    </button>
                    <button class="spectrum-face-btn" id="spectrumCalculateOriginsBtn" title="Open Spectrum Calculator" style="border-color: ${userColor}; color: ${userColor};">
                        <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </button>
                </div>
                <div class="spectrum-octant-overlay" style="display: none;"></div>
            </div>
        `;
        
        // Don't initialize yet - it will happen when face becomes visible
        console.log('[Spectrum] HTML set with loading indicator, waiting for face to be shown');
    }

    initSouvenirsPhysics(dreamer) {
        console.log('[Souvenirs] Starting initSouvenirsPhysics', dreamer.name);
        const canvas = document.getElementById('souvenirs-physics-canvas');
        
        if (!canvas) {
            console.warn('[Souvenirs] ERROR: Canvas not found');
            return;
        }
        
        const container = canvas.parentElement;
        
        // Set canvas size
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        console.log('[Souvenirs] Canvas dimensions set:', canvas.width, 'x', canvas.height);
        console.log('[Souvenirs] Dreamer souvenirs object:', dreamer.souvenirs);
        console.log('[Souvenirs] Souvenirs keys:', Object.keys(dreamer.souvenirs || {}));
        console.log('[Souvenirs] Souvenirs count:', Object.keys(dreamer.souvenirs || {}).length);
        
        // Stop any existing animation
        if (this.souvenirsAnimationFrame) {
            cancelAnimationFrame(this.souvenirsAnimationFrame);
        }
        
        // Track mouse position for click detection
        this.souvenirsMouseX = 0;
        this.souvenirsMouseY = 0;
        this.selectedSouvenir = null;
        this.phaneraBgImage = null;
        this.phaneraBgAlpha = 1; // For fade transitions
        
        const handleMouseMove = (e) => {
            const rect = canvas.getBoundingClientRect();
            this.souvenirsMouseX = e.clientX - rect.left;
            this.souvenirsMouseY = e.clientY - rect.top;
            
            // Check if hovering over any bubble and update cursor
            let hovering = false;
            if (this.souvenirsBubbles) {
                for (const bubble of this.souvenirsBubbles) {
                    const dx = this.souvenirsMouseX - bubble.x;
                    const dy = this.souvenirsMouseY - bubble.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < bubble.size / 2) {
                        hovering = true;
                        break;
                    }
                }
            }
            canvas.style.cursor = hovering ? 'pointer' : 'default';
        };
        
        const handleClick = async (e) => {
            const rect = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            // Check if any bubble was clicked
            for (const bubble of this.souvenirsBubbles) {
                const dx = clickX - bubble.x;
                const dy = clickY - bubble.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < bubble.size / 2) {
                    console.log('[Souvenirs] Bubble clicked:', bubble.key, bubble.souvenirData);
                    
                    // Add click animation - pulse effect
                    const originalSize = bubble.size;
                    bubble.targetSize = originalSize * 1.2;
                    
                    // Animate pulse
                    const pulseAnimation = () => {
                        if (bubble.size < bubble.targetSize) {
                            bubble.size += (bubble.targetSize - bubble.size) * 0.3;
                            if (Math.abs(bubble.size - bubble.targetSize) < 0.5) {
                                bubble.size = bubble.targetSize;
                                // Start shrinking back
                                bubble.targetSize = originalSize;
                            }
                        } else if (bubble.size > originalSize) {
                            bubble.size -= (bubble.size - originalSize) * 0.3;
                            if (Math.abs(bubble.size - originalSize) < 0.5) {
                                bubble.size = originalSize;
                                bubble.targetSize = null;
                            }
                        }
                    };
                    
                    // Run animation for a few frames
                    let frameCount = 0;
                    const animateInterval = setInterval(() => {
                        pulseAnimation();
                        frameCount++;
                        if (frameCount > 15 || !bubble.targetSize) {
                            clearInterval(animateInterval);
                            bubble.size = originalSize;
                        }
                    }, 16);
                    
                    // Load phanera image with crossfade transition
                    if (bubble.phanera) {
                        console.log('[Souvenirs] Loading phanera:', bubble.phanera);
                        const newImage = new Image();
                        newImage.src = bubble.phanera;
                        newImage.onload = () => {
                            console.log('[Souvenirs] Phanera loaded');
                            // Crossfade: fade out old, then swap and fade in new
                            const fadeOut = setInterval(() => {
                                this.phaneraBgAlpha = Math.max(0, this.phaneraBgAlpha - 0.05);
                                if (this.phaneraBgAlpha <= 0) {
                                    clearInterval(fadeOut);
                                    // Swap to new image
                                    this.phaneraBgImage = newImage;
                                    // Fade in new image
                                    const fadeIn = setInterval(() => {
                                        this.phaneraBgAlpha = Math.min(1, this.phaneraBgAlpha + 0.05);
                                        if (this.phaneraBgAlpha >= 1) clearInterval(fadeIn);
                                    }, 16);
                                }
                            }, 16);
                        };
                        newImage.onerror = () => {
                            console.warn('[Souvenirs] Phanera failed to load:', bubble.phanera);
                        };
                    } else {
                        console.warn('[Souvenirs] No phanera for this souvenir');
                    }
                    
                    // Update mini widget with slide-down/slide-up animation
                    const widget = document.querySelector('.souvenirs-mini-widget');
                    if (widget) {
                        const canvas = document.getElementById('souvenirs-physics-canvas');
                        const canvasRect = canvas.getBoundingClientRect();
                        const widgetRect = widget.getBoundingClientRect();
                        
                        // Calculate distance to slide (just past bottom of canvas)
                        const slideDistance = canvasRect.bottom - widgetRect.top + 20;
                        
                        widget.style.transition = 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
                        widget.style.transform = `translateY(${slideDistance}px)`;
                        
                        setTimeout(() => {
                            // Update content while off-screen
                            this.updateSouvenirsWidget(bubble.key, bubble.name, bubble.icon, bubble.phanera);
                            
                            // Slide back up
                            setTimeout(() => {
                                widget.style.transform = 'translateY(0)';
                            }, 50);
                        }, 300);
                    } else {
                        this.updateSouvenirsWidget(bubble.key, bubble.name, bubble.icon, bubble.phanera);
                    }
                    return;
                }
            }
        };
        
        // Attach event listeners for interactivity
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('click', handleClick);
        
        // Initialize physics bubbles - need to fetch souvenirs data first
        this.initSouvenirsBubbles(dreamer, canvas);
    }
    
    async initSouvenirsBubbles(dreamer, canvas) {
        console.log('[Souvenirs] Fetching souvenirs data from API...');
        
        try {
            const response = await fetch('/api/souvenirs');
            const rawSouvenirs = await response.json();
            console.log('[Souvenirs] API returned souvenirs:', Object.keys(rawSouvenirs));
            
            // Build souvenirs data structure matching profile lower section
            const souvenirsData = {};
            for (const [key, souvenir] of Object.entries(rawSouvenirs)) {
                souvenirsData[key] = {
                    forms: [{
                        key: souvenir.key,
                        name: souvenir.name,
                        icon: souvenir.icon,
                        phanera: souvenir.phanera
                    }]
                };
            }
            
            const userFormKeys = Object.keys(dreamer.souvenirs || {});
            console.log('[Souvenirs] User form keys:', userFormKeys);
            
            if (userFormKeys.length === 0) {
                console.log('[Souvenirs] No souvenirs to display');
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#fdfcfe';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Add explanatory text to canvas (higher up to avoid widget box)
                ctx.fillStyle = '#999';
                ctx.font = 'italic 14px serif';
                ctx.textAlign = 'center';
                const text1 = 'Souvenirs are memories of your journey through our wild mindscape.';
                const text2 = 'Continue exploring with a curious mind, and you will make some.';
                ctx.fillText(text1, canvas.width / 2, canvas.height / 2 - 60);
                ctx.fillText(text2, canvas.width / 2, canvas.height / 2 - 40);
                
                // Show empty state widget
                this.updateSouvenirsWidgetEmpty();
                return;
            }
            
            // Match souvenirs to user's forms
            const userSouvenirs = [];
            userFormKeys.forEach(formKey => {
                for (const [souvenirKey, souvenirData] of Object.entries(souvenirsData)) {
                    const form = souvenirData.forms.find(f => f.key === formKey);
                    if (form) {
                        userSouvenirs.push({
                            formKey: formKey,
                            souvenirKey: souvenirKey,
                            form: form,
                            epoch: dreamer.souvenirs[formKey]
                        });
                        console.log('[Souvenirs] Matched souvenir:', {
                            key: formKey,
                            name: form.name,
                            icon: form.icon,
                            phanera: form.phanera
                        });
                        break;
                    }
                }
            });
            
            console.log('[Souvenirs] Creating', userSouvenirs.length, 'bubbles');
            
            this.souvenirsBubbles = [];
            
            // Auto-select first souvenir if any exist
            if (userSouvenirs.length > 0) {
                const firstSouvenir = userSouvenirs[0];
                console.log('[Souvenirs] Auto-selecting first souvenir:', firstSouvenir.form.name);
                
                // Load phanera background
                if (firstSouvenir.form.phanera) {
                    this.phaneraBgImage = new Image();
                    this.phaneraBgImage.src = firstSouvenir.form.phanera;
                    this.phaneraBgImage.onload = () => {
                        console.log('[Souvenirs] Initial phanera loaded');
                    };
                }
                
                // Show widget
                this.updateSouvenirsWidget(
                    firstSouvenir.formKey,
                    firstSouvenir.form.name,
                    firstSouvenir.form.icon,
                    firstSouvenir.form.phanera
                );
            }
            
            // Create bubble for each souvenir
            // First, get widget dimensions to avoid spawning bubbles there
            const widgetWidth = 280; // max-width from CSS
            const widgetHeight = 150; // approximate height
            const widgetMargin = 12; // bottom and left margin
            
            userSouvenirs.forEach((s, index) => {
                // Constrain bubble size with min/max
                const minSize = 55;
                const maxSize = 85;
                const size = minSize + Math.random() * (maxSize - minSize);
                
                // Find valid position that doesn't overlap with widget area
                let x, y;
                let attempts = 0;
                const maxAttempts = 50;
                
                do {
                    // Random position with margin for bubble radius
                    x = size / 2 + Math.random() * (canvas.width - size);
                    y = size / 2 + Math.random() * (canvas.height - size);
                    
                    // Check if position overlaps with widget area (bottom left)
                    const widgetLeft = widgetMargin;
                    const widgetRight = widgetMargin + widgetWidth;
                    const widgetTop = canvas.height - widgetMargin - widgetHeight;
                    const widgetBottom = canvas.height - widgetMargin;
                    
                    // Check if bubble center is outside widget area (with padding)
                    const padding = size / 2 + 20; // Extra padding for safety
                    const isOutsideWidget = x > widgetRight + padding || 
                                           x < widgetLeft - padding ||
                                           y < widgetTop - padding ||
                                           y > widgetBottom + padding;
                    
                    if (isOutsideWidget) break;
                    
                    attempts++;
                } while (attempts < maxAttempts);
                
                // If we couldn't find a good spot, place in upper right quadrant
                if (attempts >= maxAttempts) {
                    x = canvas.width * 0.6 + Math.random() * (canvas.width * 0.3);
                    y = canvas.height * 0.2 + Math.random() * (canvas.height * 0.3);
                }
                
                // Constrain velocity with min/max to prevent deadstates
                const minVelocity = 1.5;
                const maxVelocity = 4;
                let vx = (Math.random() - 0.5) * maxVelocity * 2;
                let vy = (Math.random() - 0.5) * maxVelocity * 2;
                
                // Ensure minimum velocity (prevent near-stationary bubbles)
                const speed = Math.sqrt(vx * vx + vy * vy);
                if (speed < minVelocity) {
                    const angle = Math.random() * Math.PI * 2;
                    vx = Math.cos(angle) * minVelocity;
                    vy = Math.sin(angle) * minVelocity;
                } else if (speed > maxVelocity) {
                    // Cap maximum velocity (prevent crazy states)
                    vx = (vx / speed) * maxVelocity;
                    vy = (vy / speed) * maxVelocity;
                }
                
                const bubble = {
                    key: s.formKey,
                    name: s.form.name,
                    icon: s.form.icon,
                    phanera: s.form.phanera,
                    x: x,
                    y: y,
                    vx: vx,
                    vy: vy,
                    size: size,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: (Math.random() - 0.5) * 0.02,
                    image: new Image()
                };
                
                // Load image
                bubble.image.src = bubble.icon;
                bubble.image.onload = () => {
                    console.log('[Souvenirs] Icon loaded:', bubble.icon);
                };
                bubble.image.onerror = () => {
                    console.warn('[Souvenirs] Icon failed to load:', bubble.icon);
                };
                
                this.souvenirsBubbles.push(bubble);
            });
            
            console.log('[Souvenirs] Starting animation loop');
            this.startSouvenirsAnimation(canvas, dreamer);
            
        } catch (error) {
            console.error('[Souvenirs] Error loading souvenirs data:', error);
        }
    }
    
    startSouvenirsAnimation(canvas, dreamer) {
        
        // Start animation loop
        const ctx = canvas.getContext('2d');
        let animationTime = 0;
        
        // Get user color for background gradient
        const userColor = dreamer.color_hex || '#734ba1';
        
        const animate = () => {
            animationTime += 0.01;
            
            // Draw animated background gradient
            const gradient1 = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            const gradient2 = ctx.createLinearGradient(canvas.width, 0, 0, canvas.height);
            
            // Parse user color
            const r = parseInt(userColor.slice(1, 3), 16);
            const g = parseInt(userColor.slice(3, 5), 16);
            const b = parseInt(userColor.slice(5, 7), 16);
            
            // Gentle oscillation between two gradient states
            const oscillation = Math.sin(animationTime) * 0.5 + 0.5; // 0 to 1
            
            gradient1.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.03 + oscillation * 0.02})`);
            gradient1.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${0.08 - oscillation * 0.02})`);
            
            ctx.fillStyle = '#fdfcfe';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw phanera background if selected
            if (this.phaneraBgImage && this.phaneraBgImage.complete && this.phaneraBgImage.naturalWidth > 0) {
                ctx.save();
                ctx.globalAlpha = 0.15 * (this.phaneraBgAlpha || 1);
                
                // Draw phanera centered and scaled to fill
                const imgAspect = this.phaneraBgImage.naturalWidth / this.phaneraBgImage.naturalHeight;
                const canvasAspect = canvas.width / canvas.height;
                let drawWidth, drawHeight, drawX, drawY;
                
                if (imgAspect > canvasAspect) {
                    drawHeight = canvas.height;
                    drawWidth = drawHeight * imgAspect;
                    drawX = (canvas.width - drawWidth) / 2;
                    drawY = 0;
                } else {
                    drawWidth = canvas.width;
                    drawHeight = drawWidth / imgAspect;
                    drawX = 0;
                    drawY = (canvas.height - drawHeight) / 2;
                }
                
                ctx.drawImage(this.phaneraBgImage, drawX, drawY, drawWidth, drawHeight);
                ctx.restore();
            }
            
            ctx.fillStyle = gradient1;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Update and draw each bubble
            this.souvenirsBubbles.forEach((bubble, i) => {
                // Update position
                bubble.x += bubble.vx;
                bubble.y += bubble.vy;
                
                // Update rotation
                bubble.rotation += bubble.rotationSpeed;
                
                // Constrain velocity to prevent crazy states during animation
                const minVelocity = 0.8;
                const maxVelocity = 5;
                const speed = Math.sqrt(bubble.vx * bubble.vx + bubble.vy * bubble.vy);
                
                if (speed > maxVelocity) {
                    bubble.vx = (bubble.vx / speed) * maxVelocity;
                    bubble.vy = (bubble.vy / speed) * maxVelocity;
                } else if (speed < minVelocity && speed > 0) {
                    // Add a tiny bit of energy to prevent deadstates
                    bubble.vx = (bubble.vx / speed) * minVelocity;
                    bubble.vy = (bubble.vy / speed) * minVelocity;
                }
                
                // Check hover state
                const dx = this.souvenirsMouseX - bubble.x;
                const dy = this.souvenirsMouseY - bubble.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const isHovered = distance < bubble.size / 2;
                
                // Wall collisions
                if (bubble.x - bubble.size / 2 < 0) {
                    bubble.x = bubble.size / 2;
                    bubble.vx = Math.abs(bubble.vx);
                }
                if (bubble.x + bubble.size / 2 > canvas.width) {
                    bubble.x = canvas.width - bubble.size / 2;
                    bubble.vx = -Math.abs(bubble.vx);
                }
                if (bubble.y - bubble.size / 2 < 0) {
                    bubble.y = bubble.size / 2;
                    bubble.vy = Math.abs(bubble.vy);
                }
                if (bubble.y + bubble.size / 2 > canvas.height) {
                    bubble.y = canvas.height - bubble.size / 2;
                    bubble.vy = -Math.abs(bubble.vy);
                }
                
                // Collision with widget box in bottom left
                const widget = document.querySelector('.souvenirs-mini-widget');
                if (widget) {
                    const rect = widget.getBoundingClientRect();
                    const canvasRect = canvas.getBoundingClientRect();
                    
                    // Convert widget position to canvas coordinates
                    const widgetLeft = rect.left - canvasRect.left;
                    const widgetTop = rect.top - canvasRect.top;
                    const widgetRight = widgetLeft + rect.width;
                    const widgetBottom = widgetTop + rect.height;
                    
                    const bubbleRadius = bubble.size / 2;
                    
                    // Check if bubble is colliding with widget box
                    const closestX = Math.max(widgetLeft, Math.min(bubble.x, widgetRight));
                    const closestY = Math.max(widgetTop, Math.min(bubble.y, widgetBottom));
                    
                    const distX = bubble.x - closestX;
                    const distY = bubble.y - closestY;
                    const distance = Math.sqrt(distX * distX + distY * distY);
                    
                    if (distance < bubbleRadius) {
                        // Collision! Push bubble away from widget
                        if (distance > 0) {
                            const pushX = (distX / distance) * (bubbleRadius - distance);
                            const pushY = (distY / distance) * (bubbleRadius - distance);
                            bubble.x += pushX;
                            bubble.y += pushY;
                            
                            // Reflect velocity based on collision normal
                            const normalX = distX / distance;
                            const normalY = distY / distance;
                            const dotProduct = bubble.vx * normalX + bubble.vy * normalY;
                            bubble.vx -= 2 * dotProduct * normalX;
                            bubble.vy -= 2 * dotProduct * normalY;
                            
                            // Add some energy damping
                            bubble.vx *= 0.9;
                            bubble.vy *= 0.9;
                        }
                    }
                }
                
                // Bubble-to-bubble collisions
                for (let j = i + 1; j < this.souvenirsBubbles.length; j++) {
                    const other = this.souvenirsBubbles[j];
                    const dx = other.x - bubble.x;
                    const dy = other.y - bubble.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const minDist = (bubble.size + other.size) / 2;
                    
                    if (distance < minDist && distance > 0) {
                        // Collision detected - simple elastic collision
                        const angle = Math.atan2(dy, dx);
                        const targetX = bubble.x + Math.cos(angle) * minDist;
                        const targetY = bubble.y + Math.sin(angle) * minDist;
                        
                        // Separate bubbles
                        const ax = (targetX - other.x) * 0.5;
                        const ay = (targetY - other.y) * 0.5;
                        bubble.x -= ax;
                        bubble.y -= ay;
                        other.x += ax;
                        other.y += ay;
                        
                        // Exchange velocities
                        const vxTemp = bubble.vx;
                        const vyTemp = bubble.vy;
                        bubble.vx = other.vx * 0.95;
                        bubble.vy = other.vy * 0.95;
                        other.vx = vxTemp * 0.95;
                        other.vy = vyTemp * 0.95;
                    }
                }
                
                // Draw bubble
                ctx.save();
                
                // Scale up slightly on hover
                if (isHovered) {
                    ctx.translate(bubble.x, bubble.y);
                    ctx.scale(1.1, 1.1);
                    ctx.translate(-bubble.x, -bubble.y);
                }
                
                // Bubble gradient background
                const gradient = ctx.createRadialGradient(
                    bubble.x - bubble.size * 0.2, 
                    bubble.y - bubble.size * 0.2, 
                    0,
                    bubble.x, 
                    bubble.y, 
                    bubble.size / 2
                );
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
                gradient.addColorStop(0.5, 'rgba(200, 220, 255, 0.4)');
                gradient.addColorStop(1, 'rgba(180, 200, 255, 0.2)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(bubble.x, bubble.y, bubble.size / 2, 0, Math.PI * 2);
                ctx.fill();
                
                // Bubble border (thicker on hover)
                ctx.strokeStyle = isHovered ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = isHovered ? 3 : 2;
                ctx.stroke();
                
                // Draw icon if loaded
                if (bubble.image.complete && bubble.image.naturalWidth > 0) {
                    const iconSize = bubble.size * 0.85; // Bigger icon (85% instead of 65%)
                    ctx.globalAlpha = 0.95;
                    
                    // Save context for rotation
                    ctx.save();
                    ctx.translate(bubble.x, bubble.y);
                    ctx.rotate(bubble.rotation);
                    
                    ctx.drawImage(
                        bubble.image,
                        -iconSize / 2,
                        -iconSize / 2,
                        iconSize,
                        iconSize
                    );
                    
                    ctx.restore();
                    ctx.globalAlpha = 1;
                }
                
                ctx.restore();
            });
            
            // Continue animation
            this.souvenirsAnimationFrame = requestAnimationFrame(animate);
        };
        
        animate();
    }

    async updateSouvenirsWidget(key, name, icon, phanera) {
        const widget = document.querySelector('.souvenirs-mini-widget');
        if (!widget) return;
        
        console.log('[Souvenirs] Updating widget:', { key, name, icon, phanera });
        
        // Fetch full souvenir data to get description, category, keepers
        try {
            const response = await fetch('/api/souvenirs');
            const allSouvenirs = await response.json();
            const souvenirData = allSouvenirs[key];
            
            if (!souvenirData) {
                console.warn('[Souvenirs] No data found for key:', key);
                this.updateSouvenirsWidgetBasic(key, name, icon, phanera);
                return;
            }
            
            const keeperCount = souvenirData.keepers ? souvenirData.keepers.length : 0;
            const category = souvenirData.category || 'souvenir';
            const description = souvenirData.description || '';
            
            // Get earned timestamp from dreamer data
            const earnedEpoch = this.dreamer.souvenirs[key];
            const earnedTime = earnedEpoch ? this.formatTimeAgo(earnedEpoch) : '';
            
            // Build luxurious mini widget HTML with robust info
            const keeperText = keeperCount === 0 ? 'unclaimed' : 
                              keeperCount === 1 ? '1 keeper' : 
                              `${keeperCount} keepers`;
            
            // Get user's color for button and key badge
            const userColor = this.dreamer.color_hex || '#734ba1';
            
            widget.innerHTML = `
                <div class="souvenir-widget-inner" style="border-color: ${userColor};">
                    <div class="souvenir-widget-close" onclick="document.querySelector('.souvenirs-mini-widget').innerHTML = ''">&times;</div>
                    <div class="souvenir-widget-content">
                        <div class="souvenir-widget-photo">
                            <img src="${icon}" alt="${name}" class="souvenir-widget-icon souvenir-icon-wave">
                        </div>
                        <div class="souvenir-widget-info">
                            <h3 class="souvenir-widget-title">${name}</h3>
                            ${description ? `<p class="souvenir-widget-description">${description}</p>` : ''}
                            <div class="souvenir-widget-meta">
                                <span class="souvenir-widget-category" style="background: ${userColor}15; color: ${userColor};">${key}</span>
                                <span class="souvenir-widget-separator">•</span>
                                <span class="souvenir-widget-keepers">${keeperText}</span>
                            </div>
                            ${earnedTime ? `<div class="souvenir-widget-earned">earned ${earnedTime}</div>` : ''}
                        </div>
                    </div>
                    <a href="/souvenirs?key=${key}" class="souvenir-widget-explore" target="_blank" style="background-color: ${userColor}; color: white;">
                        <span>Explore Souvenir</span>
                        <span class="souvenir-widget-arrow">→</span>
                    </a>
                </div>
            `;
            
            // Apply wave animation to icon
            this.applySouvenirIconEffects();
        } catch (error) {
            console.error('[Souvenirs] Error fetching souvenir data:', error);
            this.updateSouvenirsWidgetBasic(key, name, icon, phanera);
        }
    }
    
    updateSouvenirsWidgetBasic(key, name, icon, phanera) {
        const widget = document.querySelector('.souvenirs-mini-widget');
        if (!widget) return;
        
        const userColor = this.dreamer.color_hex || '#734ba1';
        
        // Fallback to basic widget if API fails
        widget.innerHTML = `
            <div class="souvenir-widget-inner" style="border-color: ${userColor};">
                <div class="souvenir-widget-close" onclick="document.querySelector('.souvenirs-mini-widget').innerHTML = ''">&times;</div>
                <div class="souvenir-widget-content">
                    <div class="souvenir-widget-photo">
                        <img src="${icon}" alt="${name}" class="souvenir-widget-icon souvenir-icon-wave">
                    </div>
                    <div class="souvenir-widget-info">
                        <h3 class="souvenir-widget-title">${name}</h3>
                    </div>
                </div>
                <a href="/souvenirs.html?key=${key}" class="souvenir-widget-explore" target="_blank" style="background-color: ${userColor}; color: white;">
                    <span>Explore Souvenir</span>
                    <span class="souvenir-widget-arrow">→</span>
                </a>
            </div>
        `;
        
        this.applySouvenirIconEffects();
    }
    
    applySouvenirIconEffects() {
        // Apply gentle wave animation (micro version from souvenirs.html)
        const icon = document.querySelector('.souvenir-widget-icon');
        if (!icon) return;
        
        // Gentle wave animation
        let wavePhase = 0;
        const waveInterval = setInterval(() => {
            if (!document.querySelector('.souvenir-widget-icon')) {
                clearInterval(waveInterval);
                return;
            }
            wavePhase += 0.02;
            const rotation = Math.sin(wavePhase) * 0.5;
            const yOffset = Math.sin(wavePhase * 1.5) * 2;
            icon.style.transform = `rotate(${rotation}deg) translateY(${yOffset}px)`;
        }, 50);
    }
    
    async updateSouvenirsWidgetEmpty() {
        const widget = document.querySelector('.souvenirs-mini-widget');
        if (!widget) return;
        
        const userColor = this.dreamer.color_hex || '#734ba1';
        
        // Count dreamers with no souvenirs
        let keepersWithNone = 0;
        try {
            const response = await fetch('/api/dreamers');
            const dreamers = await response.json();
            keepersWithNone = dreamers.filter(d => !d.souvenirs || Object.keys(d.souvenirs).length === 0).length;
        } catch (error) {
            console.warn('[Souvenirs] Could not fetch keeper count:', error);
        }
        
        const keeperText = keepersWithNone === 0 ? 'no other keepers' :
                          keepersWithNone === 1 ? '1 other keeper' :
                          `${keepersWithNone} other keepers`;
        
        widget.innerHTML = `
            <div class="souvenir-widget-inner" style="border-color: ${userColor};">
                <div class="souvenir-widget-content">
                    <div class="souvenir-widget-photo souvenir-widget-photo-empty">
                        <div class="souvenir-widget-photo-placeholder">?</div>
                    </div>
                    <div class="souvenir-widget-info">
                        <h3 class="souvenir-widget-title">No Souvenirs</h3>
                        <p class="souvenir-widget-description">Still exploring our wild mindscape</p>
                        <div class="souvenir-widget-meta">
                            <span class="souvenir-widget-category" style="background: ${userColor}15; color: ${userColor};">none</span>
                            <span class="souvenir-widget-separator">•</span>
                            <span class="souvenir-widget-keepers">${keeperText}</span>
                        </div>
                        <div class="souvenir-widget-earned">not yet earned</div>
                    </div>
                </div>
                <a href="/souvenirs.html" class="souvenir-widget-explore" target="_blank" style="background-color: ${userColor}; color: white;">
                    <span>Explore Souvenirs</span>
                    <span class="souvenir-widget-arrow">→</span>
                </a>
            </div>
        `;
    }
    
    formatTimeAgo(epoch) {
        const now = Date.now() / 1000;
        const diff = now - epoch;
        const seconds = Math.floor(diff);
        const days = Math.floor(diff / (24 * 60 * 60));
        
        if (seconds < 0) return 'in the future';
        if (seconds < 60) return 'just now';
        if (seconds < 300) return 'now';
        if (seconds < 1800) return 'recent';
        if (seconds < 3600) return 'the hour';
        if (seconds < 86400) {
            const hours = Math.floor(seconds / 3600);
            if (hours === 1) return 'an hour ago';
            if (hours < 6) return `${hours} hours ago`;
            if (hours < 12) return 'this morning';
            return 'earlier today';
        }
        if (days === 1) return 'yesterday';
        if (days === 2) return 'two days ago';
        if (days === 3) return 'three days ago';
        if (days <= 6) return 'a few days ago';
        if (days === 7) return 'one week ago';
        if (days <= 10) return 'more than a week ago';
        if (days === 14) return 'two weeks ago';
        if (days <= 17) return 'more than two weeks ago';
        if (days <= 28) return 'a few weeks ago';
        if (days <= 45) return 'about a month ago';
        if (days <= 60) return 'two months ago';
        if (days <= 90) return 'some months ago';
        if (days <= 150) return 'several months ago';
        if (days <= 270) return 'many months ago';
        if (days <= 365) return 'about a year ago';
        if (days <= 547) return 'beyond the year';
        if (days <= 730) return 'two years ago';
        if (days <= 1095) return 'some years ago';
        if (days <= 1825) return 'several years ago';
        return 'long ago';
    }

    async initSpectrumVisualization(dreamer) {
        console.log('[Spectrum] Starting initSpectrumVisualization', dreamer.name);
        
        // Ensure dependencies are loaded
        if (typeof SpectrumVisualizer === 'undefined') {
            console.warn('[Spectrum] SpectrumVisualizer not loaded yet, waiting...');
            await this.waitForDependencies();
            
            // Double-check after waiting
            if (typeof SpectrumVisualizer === 'undefined') {
                console.error('[Spectrum] SpectrumVisualizer still not available after waiting');
                const loadingDiv = document.querySelector('.spectrum-loading');
                if (loadingDiv) {
                    loadingDiv.textContent = 'Spectrum visualizer failed to load';
                    loadingDiv.style.color = '#c44';
                }
                return;
            }
        }
        
        // Query canvas from the profile container (works even when parent is hidden)
        const canvas = this.container.querySelector('#spectrum-face-canvas');
        const loadingDiv = this.container.querySelector('.spectrum-loading');
        
        if (!canvas) {
            console.warn('[Spectrum] ERROR: Canvas not found in container');
            if (loadingDiv) {
                loadingDiv.textContent = 'Error loading spectrum';
                loadingDiv.style.color = '#c44';
            }
            return;
        }
        
        console.log('[Spectrum] Canvas found, dimensions:', canvas.width, 'x', canvas.height);
        console.log('[Spectrum] SpectrumVisualizer available?', typeof SpectrumVisualizer !== 'undefined');
        
        try {
            // Fetch all dreamers to get kindred data
            console.log('[Spectrum] Fetching dreamers...');
            const response = await fetch('/api/dreamers');
            const allDreamers = await response.json();
            console.log('[Spectrum] Got', allDreamers.length, 'dreamers');
            
            // Build filter list: this dreamer + their kindred
            const filterDIDs = [dreamer.did];
            if (dreamer.kindred && dreamer.kindred.length > 0) {
                dreamer.kindred.forEach(k => {
                    const did = typeof k === 'string' ? k : k.did;
                    if (did) filterDIDs.push(did);
                });
            }
            
            // Filter dreamers by DID
            const filteredHandles = allDreamers
                .filter(d => filterDIDs.includes(d.did))
                .map(d => d.handle);
            
            console.log('[Spectrum] Filtering to handles:', filteredHandles);
            
            // Initialize SpectrumVisualizer with filtered dreamers
            if (typeof SpectrumVisualizer !== 'undefined') {
                console.log('[Spectrum] Creating SpectrumVisualizer instance...');
                
                // Show canvas first (it will render as it loads)
                canvas.style.display = 'block';
                
                // Get user color for spectrum customization
                const userColor = dreamer.color_hex || '#734ba1';
                
                this.spectrumVisualizerInstance = new SpectrumVisualizer(canvas, {
                    showLabels: true,
                    showAllNames: true,
                    filterDreamers: filteredHandles,
                    initialZoom: 1.5,
                    showControls: false,
                    userColor: userColor,
                    onDotClick: (clickedDreamer) => {
                        // Navigate to dreamer page
                        if (clickedDreamer.did) {
                            window.location.href = `/dreamer?did=${encodeURIComponent(clickedDreamer.did)}`;
                        }
                    }
                });
                
                // Override resize to use simple canvas center instead of viewport alignment
                this.spectrumVisualizerInstance.resize = function() {
                    const rect = this.canvas.getBoundingClientRect();
                    const width = rect.width || this.canvas.width || 600;
                    const height = rect.height || this.canvas.height || 600;
                    if (width > 0 && height > 0) {
                        this.canvas.width = width;
                        this.canvas.height = height;
                        this.centerX = this.canvas.width / 2;
                        this.centerY = this.canvas.height / 2;
                    } else {
                        this.canvas.width = 600;
                        this.canvas.height = 600;
                        this.centerX = 300;
                        this.centerY = 300;
                    }
                };
                // Re-run resize with new logic
                this.spectrumVisualizerInstance.resize();
                console.log('[Spectrum] Instance created and resized');
                
                // Hide loading indicator after a brief moment to let first frame render
                setTimeout(() => {
                    const loadingElement = this.container.querySelector('.spectrum-loading');
                    if (loadingElement) {
                        loadingElement.style.display = 'none';
                        console.log('[Spectrum] Loading indicator hidden');
                    }
                }, 100);
                
                // Add octant overlay
                const octantOverlay = this.container.querySelector('.spectrum-face-octant-overlay');
                console.log('[Spectrum] Octant overlay element:', octantOverlay);
                console.log('[Spectrum] OctantDisplay available?', typeof OctantDisplay !== 'undefined');
                
                if (octantOverlay && typeof OctantDisplay !== 'undefined') {
                    console.log('[Spectrum] Creating OctantDisplay...');
                    this.spectrumOctantDisplay = new OctantDisplay(octantOverlay, {
                        did: dreamer.did,
                        showHeader: true,
                        showFooter: false
                    });
                    await this.spectrumOctantDisplay.updateDreamer(dreamer);
                    console.log('[Spectrum] OctantDisplay created and updated');
                } else {
                    if (!octantOverlay) console.warn('[Spectrum] Octant overlay element not found');
                    if (typeof OctantDisplay === 'undefined') console.warn('[Spectrum] OctantDisplay class not available');
                }
                
                // Setup button event listeners
                this.setupSpectrumButtons();
            } else {
                console.warn('[Spectrum] SpectrumVisualizer class not available');
                if (loadingDiv) {
                    loadingDiv.textContent = 'Spectrum visualizer not loaded';
                    loadingDiv.style.color = '#c44';
                }
            }
        } catch (error) {
            console.error('[Spectrum] Failed to initialize spectrum visualization:', error);
            const errorLoadingDiv = document.querySelector('.spectrum-loading');
            if (errorLoadingDiv) {
                errorLoadingDiv.textContent = 'Error loading spectrum';
                errorLoadingDiv.style.color = '#c44';
            }
        }
    }
    
    setupSpectrumButtons() {
        console.log('[Profile] setupSpectrumButtons called');
        
        // Explore Octants button
        const exploreBtn = this.container.querySelector('#spectrumExploreOctantsBtn');
        console.log('[Profile] Explore button found:', exploreBtn);
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                console.log('[Profile] Explore button clicked');
                this.openOctantShowcase(exploreBtn);
            });
        }
        
        // Calculate Origins button
        const calcBtn = this.container.querySelector('#spectrumCalculateOriginsBtn');
        if (calcBtn) {
            calcBtn.addEventListener('click', () => {
                console.log('[Profile] Calculator button clicked - opening calculator');
                this.openSpectrumCalculator();
            });
        }
        
        // Check mapper status to show/hide calculator button
        this.checkMapperStatusForButton();
    }
    
    openOctantShowcase(buttonElement) {
        // Dynamically load octantshowcase.js if not already loaded
        if (!document.querySelector('script[src*="octantshowcase.js"]')) {
            console.log('[Profile] Loading octantshowcase.js...');
            const script = document.createElement('script');
            script.src = '/js/widgets/octantshowcase.js';
            script.onload = () => {
                console.log('[Profile] octantshowcase.js loaded');
                this.showOctantShowcase(buttonElement);
            };
            script.onerror = () => {
                console.error('[Profile] Failed to load octantshowcase.js');
            };
            document.head.appendChild(script);
        } else {
            this.showOctantShowcase(buttonElement);
        }
    }
    
    showOctantShowcase(buttonElement) {
        const attemptShow = () => {
            if (typeof OctantShowcase !== 'undefined') {
                console.log('[Profile] Creating OctantShowcase instance');
                if (!window.octantShowcaseWidget) {
                    window.octantShowcaseWidget = new OctantShowcase();
                }
                console.log('[Profile] Calling showPopup');
                window.octantShowcaseWidget.showPopup(buttonElement);
            } else {
                console.warn('[Profile] OctantShowcase not yet available, waiting...');
                setTimeout(attemptShow, 100);
            }
        };
        attemptShow();
    }
    
    showMapperOfflinePopup(buttonElement) {
        console.log('[Profile] showMapperOfflinePopup called', buttonElement);
        
        // Use the Popup widget if available
        if (typeof Popup !== 'undefined') {
            Popup.show("Unfortunately, the <strong>Origin Calculator</strong> is only functional while there is an active <a href='/spectrum.html'>Spectrum Mapper</a> working.\n\nSee the <a href='/work.html'>Open Workshop</a> for availability.", {
                title: 'Origin Calculator Offline',
                type: 'info',
                duration: 0, // Don't auto-dismiss
                buttons: [
                    {
                        text: 'Go to Open Workshop',
                        onClick: () => {
                            window.location.href = '/work.html';
                        }
                    },
                    {
                        text: 'Close',
                        onClick: () => {} // Just dismiss
                    }
                ]
            });
        } else {
            // Fallback to confirm if Popup not loaded
            if (confirm('Unfortunately, the Origin Calculator is only functional while there is an active Spectrum Mapper working.\n\nSee the Open Workshop for availability.\n\nGo to Open Workshop?')) {
                window.location.href = '/work.html';
            }
        }
    }
    
    openSpectrumCalculator() {
        // Dynamically load spectrumcalculator-modal.js if not already loaded
        if (!document.querySelector('script[src*="spectrumcalculator-modal.js"]')) {
            console.log('[Profile] Loading spectrumcalculator-modal.js...');
            const script = document.createElement('script');
            script.src = '/js/widgets/spectrumcalculator-modal.js';
            script.onload = () => {
                console.log('[Profile] spectrumcalculator-modal.js loaded');
                this.showSpectrumCalculator();
            };
            script.onerror = () => {
                console.error('[Profile] Failed to load spectrumcalculator-modal.js');
            };
            document.head.appendChild(script);
        } else {
            this.showSpectrumCalculator();
        }
    }
    
    showSpectrumCalculator() {
        const attemptShow = () => {
            if (typeof openSpectrumCalculatorModal !== 'undefined') {
                console.log('[Profile] Opening spectrum calculator modal');
                openSpectrumCalculatorModal();
            } else {
                console.warn('[Profile] openSpectrumCalculatorModal not yet available, waiting...');
                setTimeout(attemptShow, 100);
            }
        };
        attemptShow();
    }
    
    async checkMapperStatusForButton() {
        console.log('[Profile] checkMapperStatusForButton called');
        // MAPPER LIMITATION REMOVED - button is always enabled
        
        const calcBtn = this.container.querySelector('#spectrumCalculateOriginsBtn');
        if (calcBtn) {
            console.log('[Profile] Enabling calculator button (mapper check disabled)');
            calcBtn.classList.remove('disabled');
            calcBtn.style.cursor = 'pointer';
            calcBtn.title = 'Open Spectrum Calculator';
        }
    }

    async linkifyText(text) {
        if (!text) return '';
        
        const escapeHtml = (str) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };
        
        // Patterns to match
        const handleRegex = /@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?/g;
        const urlRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?/g;
        const hashtagRegex = /#[a-zA-Z0-9_]+/g;
        
        // Find all matches with their types
        const matches = [];
        let match;
        
        // Find handles
        handleRegex.lastIndex = 0;
        while ((match = handleRegex.exec(text)) !== null) {
            matches.push({
                index: match.index,
                length: match[0].length,
                text: match[0],
                type: 'handle'
            });
        }
        
        // Find URLs
        urlRegex.lastIndex = 0;
        while ((match = urlRegex.exec(text)) !== null) {
            const isPartOfHandle = matches.some(m => 
                m.type === 'handle' && 
                match.index >= m.index - 1 && 
                match.index < m.index + m.length
            );
            if (!isPartOfHandle) {
                matches.push({
                    index: match.index,
                    length: match[0].length,
                    text: match[0],
                    type: 'url'
                });
            }
        }
        
        // Find hashtags
        hashtagRegex.lastIndex = 0;
        while ((match = hashtagRegex.exec(text)) !== null) {
            const isPartOfOther = matches.some(m => 
                match.index >= m.index && 
                match.index < m.index + m.length
            );
            if (!isPartOfOther) {
                matches.push({
                    index: match.index,
                    length: match[0].length,
                    text: match[0],
                    type: 'hashtag'
                });
            }
        }
        
        // Sort by index
        matches.sort((a, b) => a.index - b.index);
        
        // Fetch dreamers for handle resolution
        let allDreamers = [];
        try {
            const response = await fetch('/api/dreamers');
            if (response.ok) {
                allDreamers = await response.json();
            }
        } catch (error) {
            console.error('Error fetching dreamers for linkify:', error);
        }
        
        // Build the final HTML
        const parts = [];
        let lastIndex = 0;
        
        matches.forEach(match => {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(escapeHtml(text.substring(lastIndex, match.index)));
            }
            
            if (match.type === 'handle') {
                const handle = match.text.substring(1);
                const dreamer = allDreamers.find(d => 
                    d.handle && d.handle.toLowerCase() === handle.toLowerCase()
                );
                
                if (dreamer) {
                    parts.push(`<a href="/dreamer?did=${encodeURIComponent(dreamer.did)}" class="activity-handle-link">${escapeHtml(match.text)}</a>`);
                } else {
                    parts.push(`<a href="https://bsky.app/profile/${encodeURIComponent(handle)}" target="_blank" class="activity-handle-link">${escapeHtml(match.text)}</a>`);
                }
            } else if (match.type === 'url') {
                let url = match.text;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                parts.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="activity-url-link">${escapeHtml(match.text)}</a>`);
            } else if (match.type === 'hashtag') {
                const searchQuery = encodeURIComponent(match.text);
                parts.push(`<a href="https://bsky.app/search?q=${searchQuery}" target="_blank" rel="noopener noreferrer" class="activity-hashtag-link">${escapeHtml(match.text)}</a>`);
            }
            
            lastIndex = match.index + match.length;
        });
        
        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(escapeHtml(text.substring(lastIndex)));
        }
        
        return parts.join('');
    }

    async fetchPostWithLabel(did, label) {
        try {
            // Query lore.farm for labels on this user's posts
            const response = await fetch(`https://lore.farm/xrpc/com.atproto.label.queryLabels?uriPatterns=at://${did}/*&limit=100`);
            if (!response.ok) return null;
            
            const data = await response.json();
            const labels = data.labels || [];
            
            console.log(`📋 Found ${labels.length} total labels for ${did}`);
            console.log(`🔍 Filtering for label: ${label}`);
            
            // Find the most recent post with the specified label that actually belongs to this user
            const matchingLabels = labels
                .filter(l => {
                    // Ensure the label value matches
                    if (l.val !== label) return false;
                    
                    // Ensure the URI belongs to this user (starts with at://did/...)
                    if (!l.uri || !l.uri.startsWith(`at://${did}/`)) {
                        console.log(`⚠️ Skipping label with wrong DID in URI: ${l.uri}`);
                        return false;
                    }
                    
                    return true;
                })
                .sort((a, b) => new Date(b.cts) - new Date(a.cts));
            
            console.log(`✅ Found ${matchingLabels.length} matching ${label} labels for this user`);
            
            if (matchingLabels.length === 0) return null;
            
            // Fetch the actual post with full details
            const postUri = matchingLabels[0].uri;
            console.log(`📝 Fetching post: ${postUri}`);
            return await this.fetchPostByUri(postUri);
            
        } catch (error) {
            console.error(`Error fetching post with label ${label}:`, error);
            return null;
        }
    }

    async fetchMostRecentPost(did) {
        try {
            const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${did}&limit=1`);
            if (!response.ok) return null;
            
            const data = await response.json();
            if (!data.feed || data.feed.length === 0) return null;
            
            const post = data.feed[0].post;
            return this.extractPostData(post);
            
        } catch (error) {
            console.error('Error fetching most recent post:', error);
            return null;
        }
    }

    async fetchMostRecentReply(did) {
        try {
            // Get author feed and filter for replies
            const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${did}&limit=10`);
            if (!response.ok) return null;
            
            const data = await response.json();
            if (!data.feed || data.feed.length === 0) return null;
            
            // Find the first post that has a reply reference
            for (const item of data.feed) {
                const post = item.post;
                if (post.record.reply) {
                    return this.extractPostData(post);
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('Error fetching most recent reply:', error);
            return null;
        }
    }

    async fetchPostByUri(uri) {
        try {
            const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`);
            if (!response.ok) return null;
            
            const data = await response.json();
            const post = data.thread?.post;
            if (!post) return null;
            
            return this.extractPostData(post);
            
        } catch (error) {
            console.error('Error fetching post by URI:', error);
            return null;
        }
    }

    extractPostData(post) {
        const data = {
            uri: post.uri,
            text: post.record.text || '',
            createdAt: post.record.createdAt,
            images: [],
            likeCount: post.likeCount || 0,
            repostCount: post.repostCount || 0,
            replyCount: post.replyCount || 0
        };
        
        // Extract images from embed
        if (post.embed) {
            if (post.embed.images) {
                data.images = post.embed.images.map(img => ({
                    thumb: img.thumb,
                    fullsize: img.fullsize,
                    alt: img.alt || ''
                }));
            } else if (post.embed.$type === 'app.bsky.embed.images#view' && post.embed.images) {
                data.images = post.embed.images.map(img => ({
                    thumb: img.thumb,
                    fullsize: img.fullsize,
                    alt: img.alt || ''
                }));
            } else if (post.embed.$type === 'app.bsky.embed.external#view' && post.embed.external) {
                // Extract link card image
                const external = post.embed.external;
                if (external.thumb) {
                    data.images = [{
                        thumb: external.thumb,
                        fullsize: external.thumb,
                        alt: external.title || external.description || 'Link preview'
                    }];
                }
            }
        }
        
        return data;
    }

    uriToUrl(uri) {
        if (!uri || !uri.startsWith('at://')) return '#';
        const parts = uri.replace('at://', '').split('/');
        if (parts.length < 3) return '#';
        const did = parts[0];
        const postId = parts[2];
        return `https://bsky.app/profile/${did}/post/${postId}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    generateBadgeColors(hexColor) {
        // Convert hex to HSL
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        
        // Convert HSL back to RGB with adjusted hue
        const hslToRgb = (h, s, l) => {
            let r, g, b;
            if (s === 0) {
                r = g = b = l;
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }
            return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
        };
        
        // Determine if base color is light or dark
        const isDark = l < 0.5;
        
        // Canon: shift hue by +45 degrees (warmer complement)
        // If dark, lighten and boost saturation; if light, keep vibrant
        const canonHue = (h + 45/360) % 1;
        const canonSat = Math.min(1, s * 1.3); // Boost saturation
        const canonLight = isDark ? Math.min(0.65, l + 0.2) : Math.max(0.4, l - 0.1);
        const canonRgb = hslToRgb(canonHue, canonSat, canonLight);
        const canonHex = `#${canonRgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
        
        // Lore: shift hue by -50 degrees (cooler complement)
        // Adjust for good contrast and vibrancy
        const loreHue = (h - 50/360 + 1) % 1;
        const loreSat = Math.min(1, s * 1.25); // Boost saturation
        const loreLight = isDark ? Math.min(0.6, l + 0.15) : Math.max(0.45, l - 0.05);
        const loreRgb = hslToRgb(loreHue, loreSat, loreLight);
        const loreHex = `#${loreRgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
        
        return { canon: canonHex, lore: loreHex };
    }

    getTimeAgo(timestamp) {
        // Validate timestamp
        if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
            return 'unknown';
        }
        
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        // Handle future timestamps or invalid calculations
        if (seconds < 0 || isNaN(seconds)) {
            return 'unknown';
        }
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            return `${mins} minute${mins === 1 ? '' : 's'} ago`;
        }
        if (seconds < 86400) {
            const hours = Math.floor(seconds / 3600);
            return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        }
        if (seconds < 2592000) {
            const days = Math.floor(seconds / 86400);
            return `${days} day${days === 1 ? '' : 's'} ago`;
        }
        if (seconds < 31536000) {
            const months = Math.floor(seconds / 2592000);
            return `${months} month${months === 1 ? '' : 's'} ago`;
        }
        const years = Math.floor(seconds / 31536000);
        return `${years} year${years === 1 ? '' : 's'} ago`;
    }

    rotateLovePhrase() {
        const phrases = ['Send Love', 'Send Praise', 'Send Care', 'Send Joy', 'Send Delight'];
        
        // Pick a random phrase different from current
        let newPhrase;
        do {
            newPhrase = phrases[Math.floor(Math.random() * phrases.length)];
        } while (newPhrase === this.currentLovePhrase && phrases.length > 1);
        
        this.currentLovePhrase = newPhrase;
        
        // Update the button text if it exists
        const phraseText = document.getElementById('lovePhraseText');
        if (phraseText) {
            phraseText.textContent = newPhrase;
        }
    }

    startAutoRotation() {
        // Clear any existing interval
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
        }
        
        // Start slow rotation (every 4 seconds)
        this.rotationInterval = setInterval(() => {
            this.rotateLovePhrase();
        }, 4000);
    }

    startHoverRotation() {
        // Clear slow rotation
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
        }
        
        // Start fast rotation (every 0.8 seconds)
        this.hoverRotationInterval = setInterval(() => {
            this.rotateLovePhrase();
        }, 800);
    }

    stopHoverRotation() {
        // Clear fast rotation
        if (this.hoverRotationInterval) {
            clearInterval(this.hoverRotationInterval);
        }
        
        // Resume slow rotation
        this.startAutoRotation();
    }

    async sendLove(did) {
        // Feature not yet available
        const button = document.querySelector('.profile-send-love-btn');
        const lastSentEl = document.getElementById('profileLastSent');
        
        if (button) {
            button.style.background = '#999';
            button.style.cursor = 'not-allowed';
            button.disabled = true;
        }
        
        if (lastSentEl) {
            lastSentEl.innerHTML = '<span style="font-style: italic;">not yet available</span>';
        }
        
        return;
        
        // Original code below (disabled for now)
        /*
        // Check if logged in
        if (!this.session) {
            if (window.loginManager) {
                window.loginManager.showLogin();
            } else {
                alert('Please log in to send a message');
            }
            return;
        }

        // Prompt for message
        const message = prompt('Send a message to this dreamer:');
        if (!message || !message.trim()) {
            return;
        }

        try {
            const token = localStorage.getItem('oauth_token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    to_did: did,
                    message: message.trim()
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            alert('Message sent! ✨');
            
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        }
        */
    }

    async setHeadingToDreamer(dreamer) {
        if (!this.session) {
            if (window.loginManager) {
                window.loginManager.showLogin();
            } else {
                alert('Please log in to set a heading');
            }
            return;
        }

        const button = document.getElementById('setHeadingBtn');
        if (!button) return;

        button.disabled = true;
        const originalHTML = button.innerHTML;
        button.innerHTML = '<div>SETTING</div><div>...</div>';

        try {
            const token = localStorage.getItem('oauth_token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch('/api/heading/set', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    did: this.session.did, 
                    heading: dreamer.did,
                    name: this.session.displayName || this.session.handle
                })
            });

            const data = await response.json();
            
            if (data.success) {
                button.innerHTML = '<div>✓</div><div>SET!</div>';
                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.disabled = false;
                }, 2000);
            } else {
                throw new Error(data.error || 'Failed to set heading');
            }
        } catch (error) {
            console.error('Failed to set heading:', error);
            button.innerHTML = '<div>✗</div><div>ERROR</div>';
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.disabled = false;
            }, 2000);
        }
    }

    async navigateToDreamer(name) {
        try {
            const response = await fetch('/api/dreamers');
            const dreamers = await response.json();
            const dreamer = dreamers.find(d => 
                d.name === name || 
                d.display_name === name || 
                (name === 'Reverie House' && d.name === 'errantson')
            );
            
            if (!dreamer) {
                console.warn(`Dreamer not found: ${name}`);
                return;
            }
            
            if (window.sidebarWidget?.displayDreamer) {
                window.sidebarWidget.displayDreamer(dreamer);
            } else {
                window.location.href = `/dreamer?did=${encodeURIComponent(dreamer.did)}`;
            }
        } catch (error) {
            console.error('Error navigating to dreamer:', error);
        }
    }

    async handleLike(button) {
        const uri = button.dataset.uri;
        const cid = button.dataset.cid;
        const isCurrentlyLiked = button.dataset.liked === 'true';
        
        if (!window.atprotoInteractions) {
            console.error('AT Protocol interactions utility not loaded');
            alert('Unable to like post. Please refresh the page.');
            return;
        }
        
        const session = window.atprotoInteractions.getSession();
        if (!session) {
            alert('Please log in to like posts');
            return;
        }
        
        try {
            button.disabled = true;
            
            if (isCurrentlyLiked) {
                await window.atprotoInteractions.unlikePost(uri);
                button.title = 'Like this post';
                
                // Update button text
                const currentText = button.textContent.trim();
                const currentCount = parseInt(currentText) || 1;
                button.textContent = currentCount > 1 ? currentCount - 1 : '♡';
            } else {
                await window.atprotoInteractions.likePost(uri, cid);
                button.title = 'Unlike this post';
                
                // Update button text
                const currentText = button.textContent.trim();
                const currentCount = currentText === '♡' ? 0 : parseInt(currentText) || 0;
                button.textContent = currentCount + 1;
            }
            
            button.setAttribute('data-liked', (!isCurrentlyLiked).toString());
        } catch (error) {
            console.error('Error handling like:', error);
            alert('Failed to like post. Please try again.');
        } finally {
            button.disabled = false;
        }
    }

    async handleRepost(button) {
        const uri = button.dataset.uri;
        const cid = button.dataset.cid;
        const isCurrentlyReposted = button.dataset.reposted === 'true';
        
        if (!window.atprotoInteractions) {
            console.error('AT Protocol interactions utility not loaded');
            alert('Unable to repost. Please refresh the page.');
            return;
        }
        
        const session = window.atprotoInteractions.getSession();
        if (!session) {
            alert('Please log in to repost');
            return;
        }
        
        try {
            button.disabled = true;
            
            if (isCurrentlyReposted) {
                await window.atprotoInteractions.unrepostPost(uri);
                button.title = 'Repost to your timeline';
                
                // Update button text
                const currentText = button.textContent.trim();
                const currentCount = parseInt(currentText) || 1;
                button.textContent = currentCount > 1 ? currentCount - 1 : '↻';
            } else {
                await window.atprotoInteractions.repostPost(uri, cid);
                button.title = 'Undo repost';
                
                // Update button text
                const currentText = button.textContent.trim();
                const currentCount = currentText === '↻' ? 0 : parseInt(currentText) || 0;
                button.textContent = currentCount + 1;
            }
            
            button.setAttribute('data-reposted', (!isCurrentlyReposted).toString());
        } catch (error) {
            console.error('Error handling repost:', error);
            alert('Failed to repost. Please try again.');
        } finally {
            button.disabled = false;
        }
    }

    async handleReply(button) {
        const uri = button.dataset.uri;
        const cid = button.dataset.cid;
        const handle = button.dataset.handle;
        const displayName = button.dataset.displayname;
        const text = button.dataset.text;
        
        if (!window.atprotoInteractions) {
            console.error('AT Protocol interactions utility not loaded');
            alert('Unable to reply. Please refresh the page.');
            return;
        }
        
        window.atprotoInteractions.openReplyComposer({
            uri,
            cid,
            handle,
            displayName,
            text
        });
    }









    async refresh() {
        console.log('🔄 [Profile] refresh() called');
        if (!this.session || !this.session.did) {
            console.warn('⚠️ [Profile] No session available for refresh');
            return;
        }
        
        try {
            console.log('🌐 [Profile] Fetching updated dreamer data from /api/dreamers');
            const response = await fetch('/api/dreamers');
            if (!response.ok) {
                throw new Error('Failed to fetch dreamers');
            }
            
            const dreamers = await response.json();
            console.log('📥 [Profile] Received', dreamers.length, 'dreamers from API');
            
            this.dreamer = dreamers.find(d => d.did === this.session.did);
            
            if (!this.dreamer) {
                console.warn('⚠️ [Profile] Dreamer not found in response');
                return;
            }
            
            console.log('✅ [Profile] Found updated dreamer data:', {
                display_name: this.dreamer.display_name,
                avatar: this.dreamer.avatar?.substring(0, 60) + '...',
                handle: this.dreamer.handle
            });
            
            console.log('🎨 [Profile] Calling render() to update display');
            this.render();
            console.log('✅ [Profile] Profile refreshed successfully');
            
        } catch (error) {
            console.error('❌ [Profile] Error refreshing profile:', error);
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('profile-container');
    if (container) {
        window.profileWidget = new Profile(container);
    }
});

// Export
window.Profile = Profile;
