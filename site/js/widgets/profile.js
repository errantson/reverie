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
        // Load profile CSS if it exists
        if (!document.querySelector('link[href*="css/widgets/profile.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/profile.css?v=4';
            document.head.appendChild(link);
        }
        
        // Load octants CSS for standardized octant colors
        if (!document.querySelector('link[href*="css/octants.css"]')) {
            const octantsLink = document.createElement('link');
            octantsLink.rel = 'stylesheet';
            octantsLink.href = '/css/octants.css';
            document.head.appendChild(octantsLink);
        }
        
        // Load octant showcase widget (unified octant display)
        if (!document.querySelector('script[src*="js/widgets/octantshowcase.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/widgets/octantshowcase.js';
            document.head.appendChild(script);
        }
        
        // Load axis explainer widget
        if (!document.querySelector('script[src*="js/widgets/axisexplainer.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/widgets/axisexplainer.js';
            document.head.appendChild(script);
        }
        
        // Load num_nom for time formatting
        if (!document.querySelector('script[src*="js/utils/num_nom.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/utils/num_nom.js';
            document.head.appendChild(script);
        }
        
        // Load dreamer-hover widget
        if (!document.querySelector('script[src*="js/widgets/dreamer-hover.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/widgets/dreamer-hover.js';
            document.head.appendChild(script);
        }
        
        // Load user status utility
        if (!document.querySelector('script[src*="js/utils/user-status.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/utils/user-status.js';
            document.head.appendChild(script);
        }
        
        // Load status explainer widget
        if (!document.querySelector('script[src*="js/widgets/statusexplainer.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/widgets/statusexplainer.js';
            document.head.appendChild(script);
        }
        
        // Load octant display widget
        if (!document.querySelector('script[src*="js/widgets/octantdisplay.js"]')) {
            const script = document.createElement('script');
            script.src = '/js/widgets/octantdisplay.js';
            document.head.appendChild(script);
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
            <div class="profile-row-3">
                <div class="profile-bio-content"></div>
                <div class="profile-spectrum-content"></div>
            </div>
            <div class="profile-row-2">
                <div class="profile-souvenirs-box">
                    <div class="profile-souvenirs-title">Souvenirs</div>
                    <div class="profile-souvenirs-content"></div>
                </div>
                <div class="profile-kindred-box">
                    <div class="profile-kindred-title">Kindred</div>
                    <div class="profile-kindred-content"></div>
                </div>
            </div>
            <div class="profile-row-2">
                <div class="profile-souvenirs-box">
                    <div class="profile-souvenirs-title">Recently Read</div>
                    <div class="profile-recently-read-content"></div>
                </div>
                <div class="profile-kindred-box">
                    <div class="profile-kindred-title">CHECK-IN</div>
                    <div class="profile-messages-content"></div>
                </div>
            </div>
            <div class="profile-row-4">
                <div class="profile-info-content"></div>
                <div class="profile-activity-content"></div>
                <div class="profile-canon-content"></div>
            </div>
        `;
    }
    async displayProfile(dreamer) {
        try {
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
            await this.updateSpectrumCard(dreamer);
            await this.updateSouvenirs(dreamer);
            await this.updateKindredCard();
            await this.updateRecentlyReadCard(dreamer);
            await this.updateMessagesCard(dreamer);
            await this.updateInfoCard(dreamer);
            await this.updateActivityCard(dreamer);
            await this.updateCanonCard(dreamer);
            
            setTimeout(() => this.initializeExplainer(), 200);
        } catch (error) {
            console.error('Error displaying profile:', error);
            this.renderError(error);
        }
    }

    initializeExplainer() {
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
        }
        
        if (!window.axisExplainerWidget) {
            setTimeout(() => this.initializeExplainer(), 500);
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

        avatarEl.innerHTML = `
            <a href="https://bsky.app/profile/${dreamer.handle}" target="_blank" rel="noopener noreferrer">
                <img src="${avatarUrl}" 
                     alt="${dreamer.name || dreamer.handle}"
                     onerror="this.src='/assets/icon_face.png'">
            </a>
        `;
    }

    async updateIdentity(dreamer, userStatus = null) {
        const identityEl = this.container.querySelector('.profile-identity');
        if (!identityEl) return;

        const nameEl = identityEl.querySelector('.profile-name');
        const handleEl = identityEl.querySelector('.profile-handle');
        const arrivalEl = identityEl.querySelector('.profile-arrival');

        // Use status from database (pre-calculated and saved)
        let status = dreamer.status || 'dreamer';
        
        // Capitalize first letter if lowercase
        if (status && status[0] === status[0].toLowerCase()) {
            status = status.charAt(0).toUpperCase() + status.slice(1);
        }

        // Name without icon
        nameEl.innerHTML = `
            <h1>
                ${dreamer.name || dreamer.handle}
            </h1>
        `;

        // Handle with status below (make status clickable)
        handleEl.innerHTML = `
            <a href="https://bsky.app/profile/${dreamer.handle}" target="_blank" rel="noopener noreferrer">
                @${dreamer.handle}
            </a>
            <div class="profile-status" data-status="${status}">${status}</div>
        `;

        // Attach status explainer after a short delay to ensure widget is loaded
        setTimeout(() => {
            const statusEl = handleEl.querySelector('.profile-status');
            if (statusEl && window.statusExplainerWidget) {
                window.statusExplainerWidget.attach(statusEl, null, dreamer.color_hex);
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
        
        // Fetch real canon and lore counts from lore.farm labels
        let canonCount = 0;
        let loreCount = 0;
        try {
            // Query labels for this user's posts
            const labelsResponse = await fetch(`https://lore.farm/xrpc/com.atproto.label.queryLabels?uriPatterns=at://${dreamer.did}/*&limit=1000`);
            if (labelsResponse.ok) {
                const labelsData = await labelsResponse.json();
                const labels = labelsData.labels || [];
                
                // Count canon and lore labels that belong to this user
                labels.forEach(label => {
                    if (label.uri && label.uri.startsWith(`at://${dreamer.did}/`)) {
                        if (label.val === 'canon:reverie.house') {
                            canonCount++;
                        } else if (label.val === 'lore:reverie.house') {
                            loreCount++;
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching label counts:', error);
            // Fall back to stored values if lore.farm fails
            canonCount = dreamer.canon_contribution || 0;
            loreCount = dreamer.lore_contribution || 0;
        }
        
        // Get patron score
        const patronScore = dreamer.patronage || 0;
        
        // Calculate total contribution (canon counts as 30 points, lore as 10, patron as 1)
        const totalContribution = (canonCount * 30) + (loreCount * 10) + patronScore;

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
            <div class="contribution-total">
                <span class="contribution-label">Contribution</span>
                <span class="contribution-value">${totalContribution}</span>
            </div>
            <div class="contribution-breakdown">
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
                    <span class="contribution-subvalue">${patronScore}</span>
                </div>
            </div>
        `;
    }

    linkifyBioText(text) {
        // Convert URLs in text to clickable links that open in new tabs
        // Keep link styling the same as text, but abbreviate display
        const urlPattern = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
        return text.replace(urlPattern, (match) => {
            const fullUrl = match;
            // Create abbreviated display: remove https://, trailing /, and www.
            let displayUrl = fullUrl
                .replace(/^https:\/\//, '')  // Remove https:// (but keep http://)
                .replace(/\/$/, '')          // Remove trailing /
                .replace(/^www\./, '');      // Remove www. prefix
            
            return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none; border-bottom: 1px solid currentColor;">${displayUrl}</a>`;
        });
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
    async updateSouvenirs(dreamer) {
        const souvenirsContent = this.container.querySelector('.profile-souvenirs-content');
        if (!souvenirsContent) return;

        if (!dreamer.souvenirs || Object.keys(dreamer.souvenirs).length === 0) {
            souvenirsContent.innerHTML = '<div class="profile-empty">no souvenirs yet</div>';
            return;
        }

        try {
            const response = await fetch('/api/souvenirs');
            const rawSouvenirs = await response.json();
            
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

            const userFormKeys = Object.keys(dreamer.souvenirs);
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
                        break;
                    }
                }
            });

            if (userSouvenirs.length > 0) {
                userSouvenirs.sort((a, b) => b.epoch - a.epoch);
                
                const gridHTML = userSouvenirs.map(s => `
                    <a href="/souvenirs.html?key=${s.formKey}" class="profile-souvenir-item" title="${s.form.name}">
                        <div class="souvenir-icon">
                            <img src="${s.form.icon}" 
                                 alt="${s.form.name}"
                                 onerror="this.src='/assets/icon_face.png'">
                        </div>
                        <div class="souvenir-name">${s.form.name}</div>
                    </a>
                `).join('');

                souvenirsContent.innerHTML = `<div class="souvenirs-grid">${gridHTML}</div>`;
            } else {
                souvenirsContent.innerHTML = '<div class="profile-empty">no souvenirs yet</div>';
            }
        } catch (error) {
            console.error('Error loading souvenirs:', error);
            souvenirsContent.innerHTML = '<div class="profile-empty">no souvenirs yet</div>';
        }
    }

    async updateInfoCard(dreamer) {
        const infoContent = this.container.querySelector('.profile-info-content');
        if (!infoContent) return;
        
        // Use the dreamer's color explicitly for info links
        const dreamerColor = dreamer.color_hex || '#734ba1';
        
        // Parse server for display
        const serverUrl = dreamer.server || 'https://reverie.house';
        const serverClean = serverUrl.replace(/^https?:\/\//, '');
        const isReverieHouse = serverClean === 'reverie.house';
        const isBskyNetwork = serverClean.endsWith('bsky.network');
        
        // Determine label and display value
        let serverLabel, serverDisplay;
        if (isReverieHouse) {
            serverLabel = 'Residence';
            serverDisplay = 'Reverie House';
        } else if (isBskyNetwork) {
            serverLabel = 'Homestar';
            // Extract and capitalize the prefix (e.g., "rhizopogon" -> "Rhizopogon")
            const prefix = serverClean.split('.')[0];
            serverDisplay = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        } else {
            serverLabel = 'Server';
            serverDisplay = serverClean.split('.')[0];
        }
        
        // Render alt names helper
        const renderAltNames = (alts) => {
            if (!alts || alts === 'none') return '<span style="opacity: 0.5;">none</span>';
            return alts;
        };
        
        let infoHTML = `
            <div class="info-row">
                <span class="profile-info-label">Name</span>
                <span class="profile-info-value">${dreamer.name || dreamer.handle}</span>
            </div>
            <div class="info-row">
                <span class="profile-info-label">Pseudonyms</span>
                <span class="profile-info-value" title="${dreamer.alt_names || 'none'}">${renderAltNames(dreamer.alt_names)}</span>
            </div>
            <div class="info-row">
                <span class="profile-info-label">Handle</span>
                <a href="https://bsky.app/profile/${dreamer.handle}" 
                   target="_blank" 
                   rel="noopener"
                   class="profile-info-value profile-info-link"
                   style="color: ${dreamerColor};"
                   title="View on Bluesky">@${dreamer.handle}</a>
            </div>
            <div class="info-row">
                <span class="profile-info-label">${serverLabel}</span>
                <a href="${serverUrl}" 
                   target="_blank" 
                   rel="noopener"
                   class="profile-info-value profile-info-link"
                   style="color: ${dreamerColor};">${serverDisplay}</a>
            </div>
            <div class="info-row">
                <span class="profile-info-label">Patronage</span>
                <span class="profile-info-value" title="${dreamer.patronage || 0} cents total from book purchases">${dreamer.patronage || 0}</span>
            </div>
            <div class="info-row">
                <span class="profile-info-label">Dream ID</span>
                <button class="profile-info-value profile-info-link profile-info-monospace did-copy-btn" 
                   data-did="${dreamer.did}"
                   style="color: ${dreamerColor}; cursor: pointer; background: none; border: none; padding: 0; text-decoration: underline;"
                   title="Click to copy DID">${dreamer.did.replace('did:plc:', '')}</button>
            </div>
        `;
        
        infoContent.innerHTML = infoHTML;
        
        // Attach event listener for DID copy button
        const didCopyBtn = infoContent.querySelector('.did-copy-btn');
        if (didCopyBtn) {
            didCopyBtn.onclick = async () => {
                const did = didCopyBtn.dataset.did;
                try {
                    await navigator.clipboard.writeText(did);
                    const originalText = didCopyBtn.textContent;
                    didCopyBtn.textContent = 'Copied to Clipboard';
                    setTimeout(() => {
                        didCopyBtn.textContent = originalText;
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy DID:', err);
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = did;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        const originalText = didCopyBtn.textContent;
                        didCopyBtn.textContent = 'Copied to Clipboard';
                        setTimeout(() => {
                            didCopyBtn.textContent = originalText;
                        }, 2000);
                    } catch (err2) {
                        console.error('Fallback copy failed:', err2);
                    }
                    document.body.removeChild(textArea);
                }
            };
        }
    }
    
    async updateSpectrumCard(dreamer) {
        const spectrumContent = this.container.querySelector('.profile-spectrum-content');
        
        if (!spectrumContent) return;

        if (!dreamer.spectrum) {
            spectrumContent.style.display = 'none';
            return;
        }

        spectrumContent.style.display = 'block';

        // Initialize or update the octant display widget
        if (!this.octantDisplay) {
            this.octantDisplay = new window.OctantDisplay(spectrumContent, {
                did: dreamer.did,
                onSetHeading: (d) => this.setHeadingToDreamer(d),
                showHeader: true,
                showFooter: true
            });
            await this.octantDisplay.updateDreamer(dreamer);
        } else {
            await this.octantDisplay.updateDreamer(dreamer);
        }
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
                            <a href="/dreamer.html?did=${encodeURIComponent(targetDreamer.did)}" class="heading-avatar">
                                <img src="${avatarUrl}" alt="${targetDreamer.name || targetDreamer.handle}">
                            </a>
                            <div class="heading-info">
                                <a href="/dreamer.html?did=${encodeURIComponent(targetDreamer.did)}" class="heading-name">
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
                activityContent.innerHTML = `
                    <div class="activity-box">
                        <div class="activity-text-content">
                            <div class="activity-text">Just exploring our wild mindscape</div>
                        </div>
                    </div>
                `;
                return;
            }
            
            // Render the full visual activity card
            const timeAgo = this.getTimeAgo(new Date(activityData.createdAt).getTime());
            const postUrl = activityData.uri ? this.uriToUrl(activityData.uri) : '#';
            
            // Build label badge (overlay on image if present, inline if not)
            let badgeOverlay = '';
            let badgeInline = '';
            if (labelType === 'canon') {
                badgeOverlay = '<span class="activity-badge-overlay badge-canon">canon</span>';
                badgeInline = '<span class="activity-badge-inline badge-canon">canon</span>';
            } else if (labelType === 'lore') {
                badgeOverlay = '<span class="activity-badge-overlay badge-lore">lore</span>';
                badgeInline = '<span class="activity-badge-inline badge-lore">lore</span>';
            }
            
            // Linkify text content
            const linkedText = await this.linkifyText(activityData.text);
            const hasText = activityData.text && activityData.text.trim().length > 0;
            
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
                        </div>
                    `;
                } else {
                    // Just image, no text overlay
                    imageHtml = `
                        <div class="activity-image-container">
                            <img src="${img.thumb || img.fullsize}" alt="${img.alt || 'Post image'}" class="activity-image" onclick="window.open('${img.fullsize}', '_blank')">
                        </div>
                    `;
                }
            } else {
                // No image - show text normally without badge
                textContentHtml = `
                    <div class="activity-text-content">
                        <div class="activity-text">${linkedText}</div>
                    </div>
                `;
            }
            
            // Get interaction counts if available
            const likeCount = activityData.likeCount || 0;
            const repostCount = activityData.repostCount || 0;
            const replyCount = activityData.replyCount || 0;
            
            // Build interaction stats display naturally (including timestamp)
            let interactionStats = '';
            const stats = [];
            
            // Add timestamp first
            stats.push(`<a href="${postUrl}" target="_blank" rel="noopener" class="activity-time">${timeAgo}</a>`);
            
            // Add interaction counts
            if (likeCount > 0) stats.push(`${likeCount} like${likeCount === 1 ? '' : 's'}`);
            if (repostCount > 0) stats.push(`${repostCount} repost${repostCount === 1 ? '' : 's'}`);
            if (replyCount > 0) stats.push(`${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`);
            
            interactionStats = `<span class="activity-stats">${stats.join(' · ')}</span>`;
            
            // Build info overlay (badge and stats together)
            const infoOverlay = `
                <div class="activity-info-overlay">
                    <div class="activity-overlay-content">
                        ${badgeOverlay}
                    </div>
                    <div class="activity-overlay-stats">${interactionStats}</div>
                </div>
            `;
            
            activityContent.innerHTML = `
                <div class="activity-box">
                    ${imageHtml}
                    ${textContentHtml}
                    ${infoOverlay}
                </div>
            `;
            
        } catch (error) {
            console.error('Error loading activity:', error);
            activityContent.innerHTML = `
                <div class="activity-empty">Unable to load activity</div>
            `;
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

    async updateCanonCard(dreamer) {
        const canonContent = this.container.querySelector('.profile-canon-content');
        if (!canonContent) return;
        
        // Render canon entries
        const canonHTML = await this.renderCanon(dreamer);
        
        if (canonHTML === '<div class="profile-canon-empty">No canon events yet</div>' || 
            canonHTML === '<div class="profile-canon-empty">Error loading canon</div>') {
            canonContent.style.display = 'none';
        } else {
            canonContent.style.display = 'block';
            canonContent.innerHTML = `
                <div class="profile-canon-log">
                    ${canonHTML}
                </div>
            `;
        }
    }

    async renderCanon(dreamer) {
        try {
            const response = await fetch('/api/canon');
            if (!response.ok) throw new Error('Failed to load canon');
            
            const canon = await response.json();
            const dreamerEvents = canon.filter(entry => 
                entry.did?.toLowerCase() === dreamer.did.toLowerCase()
            );
            
            dreamerEvents.sort((a, b) => b.epoch - a.epoch);
            const recentEvents = dreamerEvents.slice(0, 5);
            
            if (recentEvents.length === 0) {
                return '<div class="profile-canon-empty">No canon events yet</div>';
            }
            
            return recentEvents.map(ev => {
                const eventDate = new Date(ev.epoch * 1000);
                const timeAgo = this.getTimeAgo(ev.epoch * 1000);
                
                let eventText = ev.event;
                if (ev.url?.trim()) {
                    eventText = `<a href="${ev.url}" target="_blank" rel="noopener">${ev.event}</a>`;
                } else if (ev.uri?.trim()?.startsWith('/')) {
                    eventText = `<a href="${ev.uri}">${ev.event}</a>`;
                }
                
                return `
                    <div class="canon-entry">
                        <span class="canon-text">${eventText}</span>
                        <span class="canon-time">${timeAgo}</span>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Error loading canon:', error);
            return '<div class="profile-canon-empty">Error loading canon</div>';
        }
    }

    getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
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

    async updateKindredCard() {
        const kindredContent = this.container.querySelector('.profile-kindred-content');
        if (!kindredContent) return;

        if (!this.dreamer?.kindred || this.dreamer.kindred.length === 0) {
            kindredContent.innerHTML = '<div class="profile-empty">no kindred yet</div>';
            return;
        }

        try {
            // Fetch all dreamers to get full info
            const response = await fetch('/api/dreamers');
            const allDreamers = await response.json();
            
            // Get kindred dreamers with full info
            const kindredDreamers = this.dreamer.kindred
                .map(k => {
                    const did = typeof k === 'string' ? k : k.did;
                    return allDreamers.find(d => d.did === did);
                })
                .filter(Boolean);
            
            // Shuffle and select up to 4 kindred (2x2 grid)
            const shuffled = kindredDreamers.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 4);
            
            if (selected.length === 0) {
                kindredContent.innerHTML = '<div class="profile-empty">no kindred yet</div>';
                return;
            }
            
            // Use simpler profile-kindred-list style
            const kindredHTML = `
                <div class="profile-kindred-list">
                    ${selected.map(k => `
                        <div class="profile-kindred-card" data-dreamer-did="${k.did}" data-dreamer-handle="${k.handle}">
                            <a href="/dreamer.html?did=${k.did}" 
                               class="profile-kindred-link"
                               data-dreamer-did="${k.did}"
                               data-dreamer-handle="${k.handle}">
                                <img src="${k.avatar?.url || k.avatar || '/assets/icon_face.png'}" 
                                     alt="${k.name || k.handle}"
                                     class="profile-kindred-avatar"
                                     onerror="this.src='/assets/icon_face.png'">
                                <span class="profile-kindred-name">${k.name || k.handle}</span>
                            </a>
                        </div>
                    `).join('')}
                </div>
            `;
            
            kindredContent.innerHTML = kindredHTML;
        } catch (error) {
            console.error('Error loading kindred:', error);
            kindredContent.innerHTML = '<div class="profile-empty">no kindred yet</div>';
        }
    }

    async updateRecentlyReadCard(dreamer) {
        const recentlyReadContent = this.container.querySelector('.profile-recently-read-content');
        if (!recentlyReadContent) return;

        try {
            // Fetch books from biblio.bond via the dreamer's DID
            const did = dreamer.did;
            if (!did) {
                recentlyReadContent.innerHTML = '<div class="profile-empty">no books yet</div>';
                return;
            }

            // Call biblio.bond API
            const response = await fetch(`https://biblio.bond/api/books/${encodeURIComponent(did)}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch books');
            }

            const books = await response.json();
            
            if (!books || books.length === 0) {
                recentlyReadContent.innerHTML = '<div class="profile-empty">no books yet</div>';
                return;
            }

            // Sort by created_at descending, get the most recent
            const mostRecent = books
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
            
            // Display the book with natural styling using page colors
            const bookHTML = `
                <div class="profile-book-display">
                    <div class="profile-book-title" style="font-size: 0.95rem; font-weight: 600; margin-bottom: 4px; line-height: 1.3; color: var(--reverie-core-color);">
                        ${this.escapeHtml(mostRecent.title || 'Untitled')}
                    </div>
                    <div class="profile-book-author" style="font-size: 0.8rem; color: var(--reverie-core-color); opacity: 0.7; font-style: italic;">
                        ${this.escapeHtml(mostRecent.author || 'Unknown')}
                    </div>
                </div>
            `;
            
            recentlyReadContent.innerHTML = bookHTML;
            
        } catch (error) {
            console.error('Error loading recently read:', error);
            recentlyReadContent.innerHTML = '<div class="profile-empty">no books yet</div>';
        }
    }

    async updateMessagesCard(dreamer) {
        const messagesContent = this.container.querySelector('.profile-messages-content');
        if (!messagesContent) return;

        // Initialize random love phrase
        if (!this.currentLovePhrase) {
            this.rotateLovePhrase();
        }

        try {
            // Fetch last sent time for this dreamer
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

            // Fetch recent messages for this dreamer
            const response = await fetch(`/api/messages?did=${encodeURIComponent(dreamer.did)}&limit=3`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch messages');
            }

            const messages = await response.json();
            
            if (!messages || messages.length === 0) {
                // Show just the Send Love button with info
                messagesContent.innerHTML = `
                    <div style="padding: 0px 10px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px;">
                            <div style="font-size: 0.75rem; opacity: 0.6; white-space: nowrap; color: var(--reverie-core-color);">
                                Last Sent: <span style="font-style: italic;">${lastSentText}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <button class="profile-send-love-btn" onclick="window.profileWidget.sendLove('${dreamer.did}')" style="padding: 6px 12px; background: var(--reverie-core-color); color: white; border: none; border-radius: 0; cursor: pointer; font-size: 0.85rem; font-weight: 500; white-space: nowrap; min-width: 100px;">
                                    <span id="lovePhraseText">${this.currentLovePhrase}</span>
                                </button>
                                <button onclick="window.profileWidget.rotateLovePhrase()" style="background: none; border: none; cursor: pointer; font-size: 1rem; color: var(--reverie-core-color); opacity: 0.5; padding: 0; margin: 0; line-height: 1;" title="Change phrase">
                                    🔄
                                </button>
                            </div>
                        </div>
                        <div style="font-size: 0.7rem; opacity: 0.6; line-height: 1.3; color: var(--reverie-core-color);">
                            send ${this.escapeHtml(dreamer.name || dreamer.handle)} a kindly pulse
                        </div>
                    </div>
                `;
                return;
            }

            // Display the messages with Send Love button
            const messagesHTML = `
                <div style="padding: 0px 10px;">
                    <div class="profile-message-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;">
                        ${messages.map(msg => {
                            const timeAgo = this.getTimeAgo(msg.epoch * 1000);
                            let messageText = msg.message || '';
                            
                            // Truncate if too long
                            if (messageText.length > 60) {
                                messageText = messageText.substring(0, 57) + '...';
                            }
                            
                            return `
                                <div class="profile-message-item" style="font-size: 0.85rem; line-height: 1.4;">
                                    <div class="profile-message-text" style="margin-bottom: 2px; color: var(--reverie-core-color);">${this.escapeHtml(messageText)}</div>
                                    <div class="profile-message-time" style="font-size: 0.75rem; opacity: 0.6; color: var(--reverie-core-color);">${timeAgo}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px;">
                        <div style="font-size: 0.75rem; opacity: 0.6; white-space: nowrap; color: var(--reverie-core-color);">
                            Last Sent: <span style="font-style: italic;">${lastSentText}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <button class="profile-send-love-btn" onclick="window.profileWidget.sendLove('${dreamer.did}')" style="padding: 6px 12px; background: var(--reverie-core-color); color: white; border: none; border-radius: 0; cursor: pointer; font-size: 0.85rem; font-weight: 500; white-space: nowrap; min-width: 100px;">
                                <span id="lovePhraseText">${this.currentLovePhrase}</span>
                            </button>
                            <button onclick="window.profileWidget.rotateLovePhrase()" style="background: none; border: none; cursor: pointer; font-size: 1rem; color: var(--reverie-core-color); opacity: 0.5; padding: 0; margin: 0; line-height: 1;" title="Change phrase">
                                🔄
                            </button>
                        </div>
                    </div>
                    <div style="font-size: 0.7rem; opacity: 0.6; line-height: 1.3; color: var(--reverie-core-color);">
                        send ${this.escapeHtml(dreamer.name || dreamer.handle)} a kindly pulse
                    </div>
                </div>
            `;
            
            messagesContent.innerHTML = messagesHTML;
            
        } catch (error) {
            console.error('Error loading messages:', error);
            messagesContent.innerHTML = `
                <div style="padding: 0px 10px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px;">
                        <div style="font-size: 0.75rem; opacity: 0.6; white-space: nowrap; color: var(--reverie-core-color);">
                            Last Sent: <span style="font-style: italic;">Never</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <button class="profile-send-love-btn" onclick="window.profileWidget.sendLove('${dreamer.did}')" style="padding: 6px 12px; background: var(--reverie-core-color); color: white; border: none; border-radius: 0; cursor: pointer; font-size: 0.85rem; font-weight: 500; white-space: nowrap; min-width: 100px;">
                                <span id="lovePhraseText">${this.currentLovePhrase}</span>
                            </button>
                            <button onclick="window.profileWidget.rotateLovePhrase()" style="background: none; border: none; cursor: pointer; font-size: 1rem; color: var(--reverie-core-color); opacity: 0.5; padding: 0; margin: 0; line-height: 1;" title="Change phrase">
                                🔄
                            </button>
                        </div>
                    </div>
                    <div style="font-size: 0.7rem; opacity: 0.6; line-height: 1.3; color: var(--reverie-core-color);">
                        send ${this.escapeHtml(dreamer.name || dreamer.handle)} a kindly pulse
                    </div>
                </div>
            `;
        }
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

    async sendLove(did) {
        // Feature not yet available
        const button = document.querySelector('.profile-send-love-btn');
        const desc = button?.closest('div').previousElementSibling;
        
        if (button) {
            button.style.background = '#999';
            button.style.cursor = 'not-allowed';
            button.disabled = true;
        }
        
        if (desc) {
            desc.textContent = 'not yet available';
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
                const url = new URL(window.location);
                url.searchParams.set('did', dreamer.did);
                url.searchParams.delete('name');
                url.searchParams.delete('handle');
                window.history.pushState({}, '', url);
            } else {
                window.location.href = `/dreamer.html?did=${dreamer.did}`;
            }
        } catch (error) {
            console.error('Error navigating to dreamer:', error);
            window.location.href = `/dreamer.html?name=${encodeURIComponent(name)}`;
        }
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
