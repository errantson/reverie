
class Sidebar {
    constructor(container) {
        this.container = container;
        this.dreamers = [];
        this.hoverWidget = null;
        this.render();
        this.initialize();
    }
    render() {
        this.container.innerHTML = `
            <div class="recent-arrivals-detached">
                <div class="recent-arrivals-title">Recent Visitors</div>
                <div class="recent-arrivals-container"></div>
            </div>
            <div class="search-dreamers-detached">
                <div class="search-dreamers-title">Search Dreamers</div>
                <div class="search-bar">
                    <input type="text" id="search-input" placeholder="Enter dreamer name...">
                    <button id="refresh-button">
                        <img src="assets/refresh.svg" alt="Refresh">
                    </button>
                </div>
                <div class="dreamers-list">
                    <div class="autofill-container"></div>   
                </div>
            </div>
            <div class="invitation-text">
                Are you a dreamweaver?<br>
                <a href="https://bsky.app/profile/reverie.house/post/3lljjzcydwc25" target="_blank">Introduce Yourself</a>
            </div>
        `;
    }
    initialize() {
        const searchInput = this.container.querySelector('#search-input');
        const autofillContainer = this.container.querySelector('.autofill-container');
        const refreshButton = this.container.querySelector('#refresh-button');
        
        // Load recent arrivals and active dreamers
        this.loadRecentArrivals();
        
        fetch('/api/dreamers')
            .then(response => response.json())
            .then(data => {
                this.dreamers = data;
                
                // Initialize hover widget after dreamers are loaded
                if (typeof DreamerHoverWidget !== 'undefined') {
                    this.hoverWidget = new DreamerHoverWidget(this.dreamers);
                    this.hoverWidget.init();
                                    } else {
                    console.warn('DreamerHoverWidget not loaded');
                }
                
                this.handleUrlParams();
                if (searchInput.value === '') {
                    searchInput.dispatchEvent(new Event('input'));
                }
            })
            .catch(error => {
                console.error('Error loading dreamers data:', error);
                const profileDetails = document.getElementById('profile-details');
                if (profileDetails) {
                    profileDetails.innerHTML = '<p>Error loading dreamer data. Please refresh the page.</p>';
                }
            });
        if (searchInput && autofillContainer) {
            searchInput.addEventListener('input', () => {    
                this.updateSearchResults(searchInput.value, autofillContainer);
            });
        }
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {  
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.dispatchEvent(new Event('input'));
                }
            });
        }
    }
    
    async loadRecentArrivals() {
        try {
            const response = await fetch('/api/dreamers/recent');
            const recentDreamers = await response.json();
            
            const container = this.container.querySelector('.recent-arrivals-container');
            if (!container) return;
            
            if (!recentDreamers || recentDreamers.length === 0) {
                container.innerHTML = '<div style="color: #999; font-size: 0.9rem; padding: 8px;">No recent arrivals</div>';
                return;
            }
            
            container.innerHTML = recentDreamers.map(dreamer => {
                // Get avatar URL (same logic as regular results)
                let avatarUrl = '/assets/icon_face.png';
                if (dreamer.avatar?.url) {
                    avatarUrl = dreamer.avatar.url;
                } else if (dreamer.avatar?.ref?.$link) {
                    const ext = (dreamer.avatar.mimeType === 'image/jpeg') ? 'jpeg' : 'png';
                    avatarUrl = `https://cdn.bsky.app/img/avatar/plain/${dreamer.did}/${dreamer.avatar.ref.$link}@${ext}`;
                } else if (typeof dreamer.avatar === 'string' && dreamer.avatar) {
                    avatarUrl = dreamer.avatar;
                }
                
                // Get server icon (same logic as regular results)
                let serverIconSrc = '';
                let serverIconStyle = '';
                if (dreamer.server === 'https://reverie.house') {
                    if (dreamer.handle.endsWith('reverie.house')) {
                        serverIconSrc = 'assets/icon.png';
                        serverIconStyle = '';
                    } else {
                        serverIconSrc = 'assets/icon.png';
                        serverIconStyle = 'filter: saturate(40%);';
                    }
                } else if (dreamer.server && dreamer.server.includes('bsky.network')) {
                    if (dreamer.handle.endsWith('bsky.social')) {
                        serverIconSrc = 'assets/bluesky.png';
                        serverIconStyle = '';
                    } else if (dreamer.handle.endsWith('reverie.house')) {
                        serverIconSrc = 'assets/icon.png';
                        serverIconStyle = 'filter: saturate(40%);';
                    } else {
                        serverIconSrc = 'assets/bluesky.svg';
                        serverIconStyle = 'filter: brightness(50%) saturate(80%);';
                    }
                } else {
                    serverIconSrc = 'assets/wild_mindscape.svg';
                    serverIconStyle = '';
                }
                
                return `
                    <div class="recent-arrival-item" data-did="${encodeURIComponent(dreamer.did)}">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${avatarUrl}" alt="avatar" style="width:20px; height:20px; border-radius: 50%; object-fit: cover; vertical-align:middle;" onerror="this.src='/assets/icon_face.png'">
                                <span class="dreamer-link" data-dreamer-did="${encodeURIComponent(dreamer.did)}" style="text-align: left; cursor: pointer;">${dreamer.name}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <img src="${serverIconSrc}" alt="server" style="width:12px; height:12px; vertical-align:middle;${serverIconStyle}">
                                <a href="https://bsky.app/profile/${dreamer.did}" target="_blank" onclick="event.stopPropagation();" style="font-size: 10px; color: #666; text-decoration: none; text-align: right;">@${dreamer.handle}</a>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add click handlers
            container.querySelectorAll('.recent-arrival-item').forEach(item => {
                item.addEventListener('click', () => {
                    const did = decodeURIComponent(item.dataset.did);
                    window.location.href = `${window.location.pathname}?did=${encodeURIComponent(did)}`;
                });
            });
            
        } catch (error) {
            console.error('Error loading recent arrivals:', error);
        }
    }
    
    async loadActiveDreamers() {
        try {
            const response = await fetch('/api/dreamers/active');
            const activeDreamers = await response.json();
            
            const container = this.container.querySelector('.active-dreamers-container');
            if (!container) return;
            
            if (!activeDreamers || activeDreamers.length === 0) {
                container.innerHTML = '<div style="color: #999; font-size: 0.9rem; padding: 8px;">No active dreamers</div>';
                return;
            }
            
            container.innerHTML = activeDreamers.map(dreamer => {
                // Get avatar URL
                let avatarUrl = '/assets/icon_face.png';
                if (dreamer.avatar?.url) {
                    avatarUrl = dreamer.avatar.url;
                } else if (dreamer.avatar?.ref?.$link) {
                    const ext = (dreamer.avatar.mimeType === 'image/jpeg') ? 'jpeg' : 'png';
                    avatarUrl = `https://cdn.bsky.app/img/avatar/plain/${dreamer.did}/${dreamer.avatar.ref.$link}@${ext}`;
                } else if (typeof dreamer.avatar === 'string' && dreamer.avatar) {
                    avatarUrl = dreamer.avatar;
                }
                
                // Get server icon
                let serverIconSrc = '';
                let serverIconStyle = '';
                if (dreamer.server === 'https://reverie.house') {
                    if (dreamer.handle.endsWith('reverie.house')) {
                        serverIconSrc = 'assets/icon.png';
                        serverIconStyle = '';
                    } else {
                        serverIconSrc = 'assets/icon.png';
                        serverIconStyle = 'filter: saturate(40%);';
                    }
                } else if (dreamer.server && dreamer.server.includes('bsky.network')) {
                    if (dreamer.handle.endsWith('bsky.social')) {
                        serverIconSrc = 'assets/bluesky.png';
                        serverIconStyle = '';
                    } else if (dreamer.handle.endsWith('reverie.house')) {
                        serverIconSrc = 'assets/icon.png';
                        serverIconStyle = 'filter: saturate(40%);';
                    } else {
                        serverIconSrc = 'assets/bluesky.svg';
                        serverIconStyle = 'filter: brightness(50%) saturate(80%);';
                    }
                } else {
                    serverIconSrc = 'assets/wild_mindscape.svg';
                    serverIconStyle = '';
                }
                
                return `
                    <div class="active-dreamer-item" data-did="${encodeURIComponent(dreamer.did)}">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${avatarUrl}" alt="avatar" style="width:20px; height:20px; border-radius: 50%; object-fit: cover; vertical-align:middle;" onerror="this.src='/assets/icon_face.png'">
                                <span class="dreamer-link" data-dreamer-did="${encodeURIComponent(dreamer.did)}" style="text-align: left; cursor: pointer;">${dreamer.name}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <img src="${serverIconSrc}" alt="server" style="width:12px; height:12px; vertical-align:middle;${serverIconStyle}">
                                <a href="https://bsky.app/profile/${dreamer.did}" target="_blank" onclick="event.stopPropagation();" style="font-size: 10px; color: #666; text-decoration: none; text-align: right;">@${dreamer.handle}</a>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add click handlers
            container.querySelectorAll('.active-dreamer-item').forEach(item => {
                item.addEventListener('click', () => {
                    const did = decodeURIComponent(item.dataset.did);
                    window.location.href = `${window.location.pathname}?did=${encodeURIComponent(did)}`;
                });
            });
            
        } catch (error) {
            console.error('Error loading active dreamers:', error);
        }
    }
    
    handleUrlParams() {
        const params = new URLSearchParams(window.location.search);
        let foundDreamer;
        if (params.has('name')) {
            const queryName = params.get('name').toLowerCase();
            foundDreamer = this.dreamers.find(d => d.name.toLowerCase() === queryName);
        } else if (params.has('handle')) {
            const queryHandle = params.get('handle').toLowerCase();
            foundDreamer = this.dreamers.find(d => d.handle.toLowerCase() === queryHandle);
        } else if (params.has('did')) {
            const queryDid = params.get('did').toLowerCase();
            foundDreamer = this.dreamers.find(d => d.did.toLowerCase() === queryDid);
        }
        if (foundDreamer) {
            this.displayDreamer(foundDreamer);
        } else {
            this.displayRandomProfile();
        }
    }
    displayDreamer(dreamer) {
        if (dreamer && dreamer.did && dreamer.handle) {
            localStorage.setItem('lastViewedDreamer', JSON.stringify({
                did: dreamer.did,
                handle: dreamer.handle,
                name: dreamer.display_name || dreamer.name
            }));
            if (window.spectrumDrawer && typeof window.spectrumDrawer.updateAvatarButton === 'function') {
                window.spectrumDrawer.updateAvatarButton();
            }
        }
        const profileContainer = document.getElementById('profile-container');
        if (profileContainer) {
            profileContainer.classList.add('loading');
            profileContainer.classList.remove('loaded');
            setTimeout(() => {
                if (window.profileWidget && typeof window.profileWidget.displayProfile === 'function') {
                    window.profileWidget.displayProfile(dreamer);
                }
                setTimeout(() => {
                    profileContainer.classList.remove('loading');
                    profileContainer.classList.add('loaded');
                }, 50);
            }, 150);
        } else {
            if (window.profileWidget && typeof window.profileWidget.displayProfile === 'function') {
                window.profileWidget.displayProfile(dreamer);
            }
        }
    }
    
    updateSearchResults(query, container) {
        container.innerHTML = '';
        let results = query ?
            this.dreamers.filter(d => d.name.toLowerCase().includes(query.toLowerCase())) :
            this.dreamers.slice().sort(() => Math.random() - 0.5);
        
        // Limit to 6 results
        results = results.slice(0, 6);
        
        results.forEach((match, index) => {
            const item = document.createElement('div');       
            item.className = 'dreamer-item';
            if (index % 2 === 0) {
                item.style.backgroundColor = '#f0f0f0';
            } else {
                item.style.backgroundColor = '#ffffff';
            }
            
            // Get avatar URL
            let avatarUrl = '/assets/icon_face.png';
            if (match.avatar?.url) {
                avatarUrl = match.avatar.url;
            } else if (match.avatar?.ref?.$link) {
                const ext = (match.avatar.mimeType === 'image/jpeg') ? 'jpeg' : 'png';
                avatarUrl = `https://cdn.bsky.app/img/avatar/plain/${match.did}/${match.avatar.ref.$link}@${ext}`;
            } else if (typeof match.avatar === 'string' && match.avatar) {
                avatarUrl = match.avatar;
            }
            
            // Get server icon (smaller, for handle)
            let serverIconSrc = '';
            let serverIconStyle = '';
            if (match.server === 'https://reverie.house') {
                if (match.handle.endsWith('reverie.house')) {
                    serverIconSrc = 'assets/icon.png';      
                    serverIconStyle = '';
                } else {
                    serverIconSrc = 'assets/icon.png';      
                    serverIconStyle = 'filter: saturate(40%);';    
                }
            } else if (match.server && match.server.includes('bsky.network')) {
                if (match.handle.endsWith('bsky.social')) {  
                    serverIconSrc = 'assets/bluesky.png';
                    serverIconStyle = '';
                } else if (match.handle.endsWith('reverie.house')) {
                    serverIconSrc = 'assets/icon.png';      
                    serverIconStyle = 'filter: saturate(40%);';    
                } else {
                    serverIconSrc = 'assets/bluesky.svg';
                    serverIconStyle = 'filter: brightness(50%) saturate(80%);';
                }
            } else {
                serverIconSrc = 'assets/wild_mindscape.svg';       
                serverIconStyle = '';
            }
            
            item.innerHTML = `<div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="${avatarUrl}" alt="avatar" style="width:20px; height:20px; border-radius: 50%; object-fit: cover; vertical-align:middle;" onerror="this.src='/assets/icon_face.png'"> 
                    <span class="dreamer-link" data-dreamer-did="${encodeURIComponent(match.did)}" style="text-align: left; cursor: pointer;">${match.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <img src="${serverIconSrc}" alt="server" style="width:12px; height:12px; vertical-align:middle;${serverIconStyle}">
                    <a href="https://bsky.app/profile/${match.did}" target="_blank" onclick="event.stopPropagation();" style="font-size: 10px; color: #666; text-decoration: none; text-align: right;">@${match.handle}</a>
                </div>
            </div>`;
            item.addEventListener('click', () => {
                window.location.href = `${window.location.pathname}?name=${encodeURIComponent(match.name)}`;
            });
            container.appendChild(item);
        });
    }
    displayRandomProfile() {
        const reverieDreamers = this.dreamers.filter(d => d.server === 'https://reverie.house');
        if (reverieDreamers.length > 0) {
            const randomDreamer = reverieDreamers[Math.floor(Math.random() * reverieDreamers.length)];
            this.displayDreamer(randomDreamer);
        } else if (this.dreamers.length > 0) {
            this.displayDreamer(this.dreamers[0]);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {        
    const container = document.getElementById('search-container');
    if (container) {
        window.sidebarWidget = new Sidebar(container);       
    }
});
window.Sidebar = Sidebar;
