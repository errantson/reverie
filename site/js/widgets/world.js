class World {
    constructor() {
        this.container = null;
        this.worldData = null;
        this.dreamersData = null;
        this.canonData = null;
        this.updateInterval = null;
        this.init();
    }
    init() {
        const container = document.querySelector('.world-widget');
        if (container) {
            this.container = container;
            this.loadData();
            this.setupAutoRefresh();
        }
    }
    async loadData() {
        try {
            const [world, dreamers, canon, library, dreams, souvenirs, operationsStatus] = await Promise.all([
                fetch('/api/world').then(r => r.json()),
                fetch('/api/dreamers').then(r => r.json()),
                fetch('/api/canon').then(r => r.json()).catch(() => []),
                fetch('/api/library').then(r => r.json()).catch(() => []),
                fetch('data/dreams.json').then(r => r.json()).catch(() => []),
                fetch('/api/souvenirs').then(r => r.json()).catch(() => ({})),
                fetch('/api/operations-status').then(r => r.json()).catch((err) => {
                    console.warn('Failed to fetch operations status:', err);
                    return {
                        firehose: {active: false, status: 'unknown'},
                        pds: {active: false, status: 'unknown'},
                        caddy: {active: false, status: 'unknown'}
                    };
                })
            ]);
            this.worldData = world;
            this.dreamersData = dreamers;
            this.canonData = canon;
            this.libraryData = library;
            this.dreamsData = dreams;
            this.souvenirsData = souvenirs;
            this.operationsStatus = operationsStatus;
            this.fetchKeeperLatestPost();
            this.render();
        } catch (error) {
            console.error('Error loading world data:', error);
            this.renderError();
        }
    }
    async fetchKeeperLatestPost() {
        try {
            const keeperHandle = this.worldData.keeper;
            if (!keeperHandle) return;
            
            const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${keeperHandle}`);
            const profileData = await profileResponse.json();
            const did = profileData.did;
            
            // Fetch more posts to find one with the canon:reverie.house label
            const feedResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${did}&limit=50`);
            const feedData = await feedResponse.json();
            
            if (feedData.feed && feedData.feed.length > 0) {
                // Find the first post with the canon:reverie.house label
                let latestCanonPost = null;
                
                for (const feedItem of feedData.feed) {
                    const post = feedItem.post;
                    
                    // Check if post has labels
                    if (post.labels && Array.isArray(post.labels)) {
                        const hasCanonLabel = post.labels.some(label => 
                            label.val === 'canon:reverie.house'
                        );
                        
                        if (hasCanonLabel) {
                            latestCanonPost = post;
                            break;
                        }
                    }
                }
                
                if (latestCanonPost) {
                    let images = [];
                    if (latestCanonPost.embed && latestCanonPost.embed.images) {
                        images = latestCanonPost.embed.images.map(img => ({
                            thumb: img.thumb,
                            fullsize: img.fullsize,
                            alt: img.alt || ''
                        }));
                    }
                    
                    this.latestPost = {
                        text: latestCanonPost.record.text,
                        uri: latestCanonPost.uri,
                        cid: latestCanonPost.cid,
                        createdAt: latestCanonPost.record.createdAt,
                        author: latestCanonPost.author,
                        images: images
                    };
                    this.render();
                }
            }
        } catch (error) {
            console.error('Error fetching keeper latest post:', error);
            this.latestPost = null;
        }
    }
    render() {
        if (!this.container || !this.worldData) return;
        const smallbox = false;
        const keeper = this.dreamersData.find(d => d.did === this.worldData.keeper_did);
        const keeperName = keeper ? keeper.name : this.worldData.keeper;
        const updateDate = new Date((this.worldData.epoch || this.worldData.timestamp) * 1000);
        const timeAgo = this.getTimeAgo((this.worldData.epoch || this.worldData.timestamp) * 1000);
        const totalDreamers = this.dreamersData.length;
        const recentDreamers = this.dreamersData.filter(d => 
            d.arrival && (Date.now() - d.arrival * 1000) < (30 * 24 * 60 * 60 * 1000)
        ).length;
        const canonEvents = this.canonData.length;
        const activeRatio = totalDreamers > 0 ? Math.round((recentDreamers / totalDreamers) * 100) : 0;
        const growthRate = totalDreamers > 0 ? Math.round((recentDreamers / Math.max(totalDreamers - recentDreamers, 1)) * 100) : 0;
        const avgEventsPerDreamer = totalDreamers > 0 ? Math.round((canonEvents / totalDreamers) * 10) / 10 : 0;
        const uptimePercent = Math.round(this.worldData.uptime_percentage || 0);
        const resourceUtil = Math.round(this.worldData.resource_utilization || 0);
        const networkEff = Math.round(this.worldData.network_efficiency / 1000000 || 0);
        const activeDreamerRatio = Math.round(this.worldData.active_dreamer_ratio || 0);
        const newArrivalVelocity = Math.round((this.worldData.new_arrival_velocity || 0) * 10) / 10;
        const kindredDensity = Math.round((this.worldData.kindred_density || 0) * 1000) / 10;
        const canonGrowthRate = this.worldData.canon_growth_rate || 0;
        const souvenirEntropy = Math.round((this.worldData.souvenir_entropy || 0) * 100) / 100;
        const readingEngagement = Math.round((this.worldData.reading_engagement || 0) * 10) / 10;
        const activityIndex = Math.round((this.worldData.reverie_activity_index || 0) * 10) / 10;
        const crossServerIntegration = Math.round(this.worldData.cross_server_integration || 0);
        const systemResilience = Math.round(this.worldData.system_resilience || 0);
        const knownDreamers = this.worldData.known_dreamers || 0;
        const totalBskyUsers = this.worldData.total_bsky_users || 0;
        const rarityRatio = (this.worldData.community_rarity_ratio || 0).toFixed(4);
        const rarityExpression = this.worldData.rarity_expression || 0;
        const getStatusColor = (value, thresholds) => {
            if (value >= thresholds.good) return '#4CAF50';
            if (value >= thresholds.warning) return '#FF9800';
            return '#F44336';
        };
        const uptimeColor = getStatusColor(uptimePercent, {good: 90, warning: 70});
        const resourceColor = getStatusColor(100 - resourceUtil, {good: 60, warning: 40});
        const activityColor = getStatusColor(activityIndex, {good: 50, warning: 25});
        const resilienceColor = getStatusColor(systemResilience, {good: 70, warning: 50});
        const idleDreamers = this.worldData.idle_dreamers;
        const dreamweavers = this.dreamersData.length;
        const residents = this.dreamersData.filter(d => 
            d.server && d.server.includes('reverie.house')
        ).length;
        const canonCount = this.canonData.length;
        const souvenirsCount = this.souvenirsData ? Object.values(this.souvenirsData).reduce((acc, v) => acc + (Array.isArray(v.forms) ? v.forms.length : 0), 0) : 0;
        const capacityPercent = Math.round((residents / 50) * 100);
        let idleDisplay;
        if (idleDreamers) {
            idleDisplay = idleDreamers.toLocaleString();
        } else {
            idleDisplay = '???';
        }
        const potentialRatio = (idleDreamers && dreamweavers > 0) ? Math.round(idleDreamers / dreamweavers) : null;
        let potentialDisplay;
        if (potentialRatio === null) {
            potentialDisplay = '???';
        } else if (potentialRatio >= 1000000) {
            potentialDisplay = `1:${(potentialRatio / 1000000).toFixed(0)}M`;
        } else if (potentialRatio >= 1000) {
            potentialDisplay = `1:${(potentialRatio / 1000).toFixed(0)}k`;
        } else {
            potentialDisplay = `1:${potentialRatio}`;
        }
        const forcesRaw = this.worldData.path_force_gb || 0;
        let forces;
        if (forcesRaw >= 1000) {
            forces = (forcesRaw / 1000).toFixed(1) + 'k';
        } else if (forcesRaw >= 100) {
            forces = forcesRaw.toFixed(0) + '.';
        } else if (forcesRaw >= 10) {
            forces = forcesRaw.toFixed(1);
        } else if (forcesRaw >= 1) {
            forces = forcesRaw.toFixed(2);
        } else {
            forces = forcesRaw.toFixed(3).replace(/^0/, '');
        }
        this.container.innerHTML = `
            ${this.latestPost ? `
            <div class="keeper-latest-post" style="position: relative; overflow: hidden; border: 1.5px solid #d0c7f0; margin-bottom: 16px; box-shadow: 0 2px 6px rgba(115,75,161,0.08); cursor: pointer; transition: all 0.2s ease; min-height: 120px; ${!this.latestPost.images || this.latestPost.images.length === 0 ? 'background: linear-gradient(135deg, #8c6bb1 0%, #a084ca 50%, #b491d4 100%);' : ''}">
                ${this.latestPost.images && this.latestPost.images.length > 0 ? `
                <div style="position: absolute; inset: 0; z-index: 0;">
                    <img src="${this.latestPost.images[0].fullsize || this.latestPost.images[0].thumb}" alt="${this.latestPost.images[0].alt}" style="width: 100%; height: 100%; object-fit: cover; filter: blur(2px) brightness(0.6) grayscale(0.2); opacity: 0.7;">
                    <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(248,246,255,0.7) 0%, rgba(60,40,100,0.45) 100%);"></div>
                </div>
                ` : ''}
                <div style="position: relative; z-index: 1; padding: 0;">
                    <div style="display: flex; align-items: center; gap: 10px; padding: 14px 18px 10px 18px; border-bottom: 1.5px solid ${this.latestPost.images && this.latestPost.images.length > 0 ? 'rgba(224, 215, 240, 0.5)' : 'rgba(255, 255, 255, 0.3)'}; background: ${this.latestPost.images && this.latestPost.images.length > 0 ? 'rgba(90,74,122,0.13)' : 'rgba(255, 255, 255, 0.15)'};">
                        <img src="${this.latestPost.author.avatar || 'assets/icon_transp.png'}" alt="${this.latestPost.author.displayName || this.latestPost.author.handle}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.9);">
                        <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: 15px; color: #f8f6ff; text-shadow: 0 1px 4px rgba(0,0,0,0.4); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; letter-spacing: 0.7px; text-transform: none;">Current Event</div>
                            <div style="display: inline-block; font-size: 13px; color: #fff; background: rgba(0, 0, 0, 0.2); border-radius: 4px; font-family: monospace; font-weight: 600; margin-top: 6px; margin-left: 2px; padding: 2px 16px; letter-spacing: 0.2px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); min-width: 0; width: auto;">@${this.latestPost.author.handle}</div>
                        </div>
                        <img src="assets/bluesky.png" alt="Bluesky" style="width: 22px; height: 22px; margin-left: 8px; vertical-align: middle; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
                    </div>
                    <div style="width: 100%; display: flex; justify-content: center;">
                        <div style="font-size: 15px; line-height: 1.6; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; margin: 18px 0 10px 0; font-weight: 400; max-width: 90%; text-align: center; cursor: pointer;" onclick="window.open('https://bsky.app/profile/${this.latestPost.author.handle}/post/${this.latestPost.uri.split('/').pop()}', '_blank')">${this.latestPost.text.replace(/\n/g, '<br>')}</div>
                    </div>
                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding: 0 18px 12px 0;">
                        <span style="font-size: 10px; color: ${this.latestPost.images && this.latestPost.images.length > 0 ? '#e8e6f5' : 'rgba(255, 255, 255, 0.9)'}; font-family: monospace; background: rgba(0, 0, 0, 0.2); padding: 2px 6px; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">${this.latestPost.uri.split('/').pop()}</span>
                        <span style="font-size: 10px; color: ${this.latestPost.images && this.latestPost.images.length > 0 ? '#e8e6f5' : 'rgba(255, 255, 255, 0.9)'}; font-family: monospace;">${new Date(this.latestPost.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
            ` : ''}
            <div class="world-advanced-sections">
                <!-- Our Wild Mindscape -->
                <div class="world-section">
                    <h4 class="section-title" style="text-align: left; cursor: pointer;" onclick="window.location.href='/dreamers'">🫧 Our Wild Mindscape</h4>
                    <div class="section-grid">
                        <div class="metric-item">
                            <div class="metric-value">${idleDisplay}</div>
                            <div class="metric-label">Idle Dreamers</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value" data-target="${dreamweavers}">${dreamweavers}</div>
                            <div class="metric-label">Dreamweavers</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value" data-target="${residents}">${residents}</div>
                            <div class="metric-label">Residents</div>
                        </div>
                    </div>
                </div>
                <!-- Reverie Library -->
                <div class="world-section">
                    <h4 class="section-title" style="text-align: left; cursor: pointer;" onclick="window.location.href='/books'">📚 Reverie Library</h4>
                    <div class="section-grid">
                        <div class="metric-item">
                            <div class="metric-value" data-target="${Array.isArray(this.libraryData) ? this.libraryData.filter(b => b.release).length : 0}">${Array.isArray(this.libraryData) ? this.libraryData.filter(b => b.release).length : ''}</div>
                            <div class="metric-label">Books</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value" data-target="${Array.isArray(this.libraryData) ? this.libraryData.filter(b => b.release).reduce((acc, b) => acc + (Array.isArray(b.chapters) ? b.chapters.length : 0), 0) : 0}">${Array.isArray(this.libraryData) ? this.libraryData.filter(b => b.release).reduce((acc, b) => acc + (Array.isArray(b.chapters) ? b.chapters.length : 0), 0) : ''}</div>
                            <div class="metric-label">Chapters</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value" data-target="${(() => {
                                if (!Array.isArray(this.libraryData)) return 1;
                                const books = this.libraryData.filter(b => b.release);
                                let total = 1;
                                books.forEach(b => {
                                    if (b.reviews) {
                                        const amazon = parseInt(b.reviews.amazon) || 0;
                                        const goodreads = parseInt(b.reviews.goodreads) || 0;
                                        total += amazon + goodreads;
                                    }
                                });
                                const readers = parseInt(this.worldData.readers) || 0;
                                total += readers;
                                return total;
                            })()}">${(() => {
                                if (!Array.isArray(this.libraryData)) return 1;
                                const books = this.libraryData.filter(b => b.release);
                                let total = 1;
                                books.forEach(b => {
                                    if (b.reviews) {
                                        const amazon = parseInt(b.reviews.amazon) || 0;
                                        const goodreads = parseInt(b.reviews.goodreads) || 0;
                                        total += amazon + goodreads;
                                    }
                                });
                                const readers = parseInt(this.worldData.readers) || 0;
                                total += readers;
                                return total;
                            })()}</div>
                            <div class="metric-label">Readers</div>
                        </div>
                    </div>
                </div>
            </div>
            ${smallbox ? `
            <div class="world-stats-grid">
                <div class="world-stat-item">
                    <div class="stat-number" data-target="${souvenirsCount}">${souvenirsCount}</div>
                    <div class="stat-label">souvenirs</div>
                </div>
                <div class="world-stat-item">
                    <div class="stat-number" data-target="${canonCount}">${canonCount}</div>
                    <div class="stat-label">canon</div>
                </div>
                <div class="world-stat-item">
                    <div class="stat-number">${capacityPercent}%</div>
                    <div class="stat-label">capacity</div>
                </div>
                <div class="world-stat-item">
                    <div class="stat-number">${potentialDisplay}</div>
                    <div class="stat-label">potential</div>
                </div>
                <div class="world-stat-item">
                    <div class="stat-number">${forces}</div>
                    <div class="stat-label">force</div>
                </div>
                <div class="world-stat-item">
                    <div class="stat-number">?</div>
                    <div class="stat-label">?????</div>
                </div>
            </div>
            ` : ''}
            <div class="world-details">
                <div class="world-detail-column">
                    <div class="world-detail-row">
                        <span class="detail-label">keeper:</span>
                        <span class="detail-value">
                            <a href="/dreamer?handle=${encodeURIComponent(this.worldData.keeper)}" style="color: #2a4d69; text-decoration: none;">
                                ${keeperName}
                            </a>
                        </span>
                    </div>
                    <div class="world-detail-row">
                        <span class="detail-label">updated:</span>
                        <span class="detail-value" title="${updateDate.toLocaleString()}">${timeAgo}</span>
                    </div>
                    <div class="world-detail-row">
                        <span class="detail-label">capacity:</span>
                        <span class="detail-value">${capacityPercent}% (${residents} of 50)</span>
                    </div>
                    ${this.worldData.wind ? `
                    <div class="world-detail-row">
                        <span class="detail-label">wind:</span>
                        <span class="detail-value">${this.worldData.wind.heading}° @ ${this.worldData.wind.gales}kts</span>
                    </div>
                    ` : ''}
                </div>
                <!-- Operations Status -->
                <div class="world-detail-column">
                    <div class="world-detail-row">
                        <span class="detail-label">Dream Storage:</span>
                        <span class="detail-value">
                            <span style="font-size: 0.75rem; color: #94a3b8; margin-right: 6px;">(${this.operationsStatus?.pds?.active ? 'active' : 'felled'})</span>
                            <div class="operations-light ${this.operationsStatus?.pds?.active ? 'active' : 'inactive'}" style="display: inline-block; vertical-align: middle;"></div>
                        </span>
                    </div>
                    <div class="world-detail-row">
                        <span class="detail-label">Dreamer Routing:</span>
                        <span class="detail-value">
                            <span style="font-size: 0.75rem; color: #94a3b8; margin-right: 6px;">(${this.operationsStatus?.caddy?.active ? 'active' : 'felled'})</span>
                            <div class="operations-light ${this.operationsStatus?.caddy?.active ? 'active' : 'inactive'}" style="display: inline-block; vertical-align: middle;"></div>
                        </span>
                    </div>
                    <div class="world-detail-row">
                        <span class="detail-label">Dreaming Monitor:</span>
                        <span class="detail-value">
                            <span style="font-size: 0.75rem; color: #94a3b8; margin-right: 6px;">(${this.operationsStatus?.firehose?.active ? 'active' : 'felled'})</span>
                            <div class="operations-light ${this.operationsStatus?.firehose?.active ? 'active' : 'inactive'}" style="display: inline-block; vertical-align: middle;"></div>
                        </span>
                    </div>
                </div>
            </div>
            <div style="font-size: 0.58rem; color: #666; font-style: italic; text-align: center; margin: 16px 10px 12px 10px; font-family: monospace;">
                our connection is preserved through collective service
                <br>
                <a href="/order" style="color: #666; text-decoration: none; font-style: italic;" target="_self">support Reverie House by reading</a>
            </div>
            ${this.worldData.messages && this.worldData.messages.length > 0 ? `
            <div class="world-messages" onclick="window.open('https://bsky.app/profile/reverie.house/post/${this.worldData.messages[0].uri.split('/').pop()}', '_blank')" style="border: 1.5px solid #e0d7f3; background: #f8f6ff; border-radius: 8px; padding: 14px 16px; margin-top: 16px; box-shadow: 0 1px 4px rgba(115,75,161,0.04); cursor: pointer; transition: all 0.2s ease;">
                <div class="message-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #e5e5f7; padding-bottom: 6px;">
                    <div class="message-label" style="font-weight: bold; font-size: 13px; color: #734ba1; letter-spacing: 0.5px;">KEEPER'S MESSAGE</div>
                    <div class="message-timestamp" style="font-size: 12px; color: #666; font-style: italic;">${this.getTimeAgo(this.worldData.messages[0].timestamp * 1000)}</div>
                </div>
                <div class="message-content" style="font-size: 14px; line-height: 1.5; color: #372e42; margin-bottom: 10px;">${this.worldData.messages[0].text.replace(/\n/g, '<br>')}</div>
                <div class="message-footer" style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="keeper-id" style="font-size: 11px; color: #734ba1; font-weight: bold;">${this.worldData.keeper || 'errantson'}</span>
                    <span class="message-id" style="font-size: 11px; color: #999; font-family: monospace; background: #f0e6ff; padding: 2px 6px; border-radius: 4px;">${this.worldData.messages[0].uri.split('/').pop()}</span>
                </div>
            </div>
            ` : ''}
        `;
        this.animateStats();
        this.setupInteractivity();
    }
    animateStats() {
        const statNumbers = this.container.querySelectorAll('.stat-number[data-target]');
        statNumbers.forEach(el => {
            const target = parseInt(el.dataset.target) || 0;
            const duration = 800 + Math.floor(Math.random() * 800);
            this.animateNumber(el, target, duration);
        });
        const metricValues = this.container.querySelectorAll('.metric-value[data-target]');
        metricValues.forEach(el => {
            const target = parseInt(el.dataset.target) || 0;
            const duration = 800 + Math.floor(Math.random() * 800);
            this.animateNumber(el, target, duration);
        });
    }
    animateNumber(element, targetNumber, duration = 1000) {
        const steps = 30;
        const increment = targetNumber / steps;
        let current = 0;
        let step = 0;
        const timer = setInterval(() => {
            step++;
            current = Math.min(current + increment, targetNumber);
            element.textContent = Math.floor(current);
            if (step >= steps || current >= targetNumber) {
                element.textContent = targetNumber;
                clearInterval(timer);
            }
        }, duration / steps);
    }
    setupInteractivity() {
        const statItems = this.container.querySelectorAll('.world-stat-item');
        statItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                this.trackStatClick(['dreamers', 'active_ratio', 'events', 'growth_rate', 'new_arrivals', 'events_per_dreamer'][index]);
                item.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    item.style.transform = '';
                }, 150);
            });
        });
        const metricItems = this.container.querySelectorAll('.metric-item');
        metricItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                const metricTypes = [
                    'uptime_percentage', 'resource_utilization', 'network_efficiency',
                    'known_dreamers', 'total_bsky_users', 'community_rarity_ratio',
                    'active_dreamer_ratio', 'new_arrival_velocity', 'kindred_density',
                    'canon_growth_rate', 'souvenir_entropy', 'reading_engagement',
                    'reverie_activity_index', 'cross_server_integration', 'system_resilience'
                ];
                this.trackStatClick(metricTypes[index]);
                item.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    item.style.transform = '';
                }, 150);
            });
        });
        const detailRows = this.container.querySelectorAll('.world-detail-row');
        detailRows.forEach(row => {
            row.addEventListener('mouseenter', () => {
                row.style.backgroundColor = 'rgba(0, 0, 128, 0.05)';
            });
            row.addEventListener('mouseleave', () => {
                row.style.backgroundColor = '';
            });
        });
    }
    trackStatClick(statType) {
        const metrics = JSON.parse(localStorage.getItem('reverie_metrics') || '{}');
        metrics[`world_${statType}_clicks`] = (metrics[`world_${statType}_clicks`] || 0) + 1;
        metrics.last_world_interaction = Date.now();
        localStorage.setItem('reverie_metrics', JSON.stringify(metrics));
    }
    
    setupAutoRefresh() {
        this.updateInterval = setInterval(() => {
            this.loadData();
        }, 5 * 60 * 1000);
    }
    getTimeAgo(timestamp) {
        const now = Date.now();
        const diffMs = now - timestamp;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        if (diffMinutes < 1) return 'just now';
        if (diffMinutes < 60) return `${diffMinutes} min ago`;
        if (diffMinutes < 1440) {
            const hours = Math.floor(diffMinutes / 60);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
        const days = Math.floor(diffMinutes / 1440);
        if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
        const months = Math.floor(days / 30);
        return `${months} month${months > 1 ? 's' : ''} ago`;
    }
    renderError() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="world-error">
                <div class="error-icon">⚠️</div>
                <div class="error-message">Unable to load world data</div>
                <button onclick="window.worldWidget.loadData()" class="retry-btn">Retry</button>
            </div>
        `;
    }
    refresh() {
        this.loadData();
    }
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    window.worldWidget = new World();
});
window.World = World;
