/**
 * Reverie House Music Player
 * Compact SoundCloud player with cross-page state resume
 * Only visible to admin users
 * 
 * Audio Continuity: Saves position before navigation, resumes on page load
 */
class MusicPlayer {
    constructor() {
        this.isPlaying = false;
        this.isAdmin = false;
        this.volume = 0.5;
        this.position = 0;
        this.duration = 0;
        this.widget = null;
        this.widgetReady = false;
        
        this.track = {
            title: 'Some Sunsick Day',
            artist: 'Morgan Delt',
            trackUrl: 'https://soundcloud.com/subpop/morgan-delt-some-sunsick-day',
            artworkUrl: '/assets/audio/morgan-delt-cover.jpg'
        };
        
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.checkAdminAndSetup());
        } else {
            this.checkAdminAndSetup();
        }
        
        // Save state before leaving page
        window.addEventListener('beforeunload', () => this.saveState());
        window.addEventListener('pagehide', () => this.saveState());
    }

    saveState() {
        if (this.widget && this.widgetReady) {
            // Synchronous save - can't wait for async getPosition
            const state = {
                isPlaying: this.isPlaying,
                position: this.position, // Use last tracked position
                volume: this.volume,
                timestamp: Date.now()
            };
            localStorage.setItem('reverie-music-state', JSON.stringify(state));
            console.log('🎵 [MusicPlayer] State saved:', state.position, 'ms, playing:', state.isPlaying);
        }
    }

    loadState() {
        const saved = localStorage.getItem('reverie-music-state');
        if (!saved) return null;
        
        try {
            const state = JSON.parse(saved);
            // Only restore if saved within last 30 minutes
            const age = Date.now() - state.timestamp;
            if (age < 30 * 60 * 1000) {
                return state;
            }
        } catch (e) {
            console.log('🎵 [MusicPlayer] Could not parse saved state');
        }
        return null;
    }

    async checkAdminAndSetup() {
        const adminToken = localStorage.getItem('admin_token');
        
        if (!adminToken) {
            console.log('🎵 [MusicPlayer] No admin token, player hidden');
            return;
        }

        try {
            const response = await fetch('/api/admin/verify', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            
            if (response.ok) {
                this.isAdmin = true;
                console.log('🎵 [MusicPlayer] Admin verified, showing player');
                this.loadWidgetAPI().then(() => this.setup());
            }
        } catch (error) {
            console.log('🎵 [MusicPlayer] Admin check failed:', error);
        }
    }

    loadWidgetAPI() {
        return new Promise((resolve) => {
            if (window.SC && window.SC.Widget) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://w.soundcloud.com/player/api.js';
            script.onload = () => resolve();
            script.onerror = () => resolve();
            document.head.appendChild(script);
        });
    }

    setup() {
        this.waitForDrawer().then(() => {
            this.render();
            this.loadStyles();
            this.bindEvents();
            this.initWidget();
        });
    }

    waitForDrawer() {
        return new Promise((resolve) => {
            const check = () => {
                const drawerHeader = document.querySelector('.drawer-header');
                if (drawerHeader) resolve();
                else requestAnimationFrame(check);
            };
            check();
        });
    }

    loadStyles() {
        if (!document.querySelector('link[href*="musicplayer.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/css/widgets/musicplayer.css';
            document.head.appendChild(link);
        }
    }

    render() {
        const drawerHeader = document.querySelector('.drawer-header');
        if (!drawerHeader) return;

        const playerHTML = `
            <div class="music-player" id="musicPlayer">
                <a href="${this.track.trackUrl}" target="_blank" rel="noopener noreferrer" 
                   class="music-player-artwork" title="${this.track.title} by ${this.track.artist}">
                    <img src="${this.track.artworkUrl}" alt="${this.track.title}">
                    <div class="music-player-play-overlay" id="musicPlayOverlay">
                        <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        <svg class="pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display:none;">
                            <rect x="6" y="4" width="4" height="16"/>
                            <rect x="14" y="4" width="4" height="16"/>
                        </svg>
                    </div>
                </a>
                <div class="music-player-controls">
                    <button class="music-player-btn" id="musicPlayBtn" title="Play/Pause">
                        <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        <svg class="pause-icon" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="display:none;">
                            <rect x="6" y="4" width="4" height="16"/>
                            <rect x="14" y="4" width="4" height="16"/>
                        </svg>
                    </button>
                    <input type="range" class="music-player-volume" id="musicVolume" 
                           min="0" max="100" value="50" title="Volume">
                </div>
            </div>
            <iframe id="soundcloudPlayer" 
                    class="soundcloud-player-hidden"
                    allow="autoplay"
                    src="https://w.soundcloud.com/player/?url=${encodeURIComponent(this.track.trackUrl)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false">
            </iframe>
        `;

        const grip = drawerHeader.querySelector('.drawer-grip');
        if (grip) {
            grip.insertAdjacentHTML('beforebegin', playerHTML);
        } else {
            drawerHeader.insertAdjacentHTML('beforeend', playerHTML);
        }
        
        // Load saved volume
        const savedVolume = localStorage.getItem('reverie-music-volume');
        if (savedVolume !== null) {
            this.volume = parseFloat(savedVolume);
            const volumeSlider = document.getElementById('musicVolume');
            if (volumeSlider) volumeSlider.value = this.volume * 100;
        }
    }

    initWidget() {
        const iframe = document.getElementById('soundcloudPlayer');
        if (!iframe || !window.SC || !window.SC.Widget) {
            console.log('🎵 [MusicPlayer] Widget API not available');
            return;
        }

        this.widget = SC.Widget(iframe);
        
        this.widget.bind(SC.Widget.Events.READY, () => {
            console.log('🎵 [MusicPlayer] Widget ready');
            this.widgetReady = true;
            this.widget.setVolume(this.volume * 100);
            this.widget.getDuration((d) => this.duration = d);
            
            // Check for saved state to resume
            const savedState = this.loadState();
            if (savedState && savedState.isPlaying) {
                console.log('🎵 [MusicPlayer] Has saved playing state, position:', savedState.position, 'ms');
                this.pendingResume = savedState;
                this.widget.seekTo(savedState.position);
                
                // Try to auto-play (may be blocked by browser)
                setTimeout(() => {
                    this.widget.play();
                    
                    // Check if play actually started after a moment
                    setTimeout(() => {
                        if (!this.isPlaying && this.pendingResume) {
                            console.log('🎵 [MusicPlayer] Autoplay blocked, showing resume indicator');
                            this.showResumeIndicator();
                        }
                    }, 500);
                }, 400);
            }
        });

        this.widget.bind(SC.Widget.Events.PLAY, () => {
            this.isPlaying = true;
            this.pendingResume = null; // Clear pending state
            this.hideResumeIndicator();
            this.updatePlayButton();
            this.startPositionTracking();
        });

        this.widget.bind(SC.Widget.Events.PAUSE, () => {
            this.isPlaying = false;
            this.updatePlayButton();
            this.stopPositionTracking();
        });

        this.widget.bind(SC.Widget.Events.FINISH, () => {
            this.isPlaying = false;
            this.position = 0;
            this.updatePlayButton();
            this.stopPositionTracking();
        });

        this.widget.bind(SC.Widget.Events.PLAY_PROGRESS, (data) => {
            this.position = data.currentPosition;
        });
    }

    startPositionTracking() {
        // Track position every second for accurate resume
        this.positionInterval = setInterval(() => {
            if (this.widget && this.widgetReady) {
                this.widget.getPosition((pos) => this.position = pos);
            }
        }, 1000);
    }

    stopPositionTracking() {
        if (this.positionInterval) {
            clearInterval(this.positionInterval);
            this.positionInterval = null;
        }
    }

    bindEvents() {
        const playBtn = document.getElementById('musicPlayBtn');
        const playOverlay = document.getElementById('musicPlayOverlay');
        const volumeSlider = document.getElementById('musicVolume');
        const player = document.getElementById('musicPlayer');

        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.togglePlay();
            });
        }

        if (playOverlay) {
            playOverlay.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.togglePlay();
            });
        }

        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                e.stopPropagation();
                this.setVolume(e.target.value / 100);
            });
            volumeSlider.addEventListener('click', (e) => e.stopPropagation());
            volumeSlider.addEventListener('mousedown', (e) => e.stopPropagation());
        }

        if (player) {
            player.addEventListener('click', (e) => e.stopPropagation());
        }
    }

    togglePlay() {
        if (this.widget && this.widgetReady) {
            this.widget.toggle();
        }
    }

    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        localStorage.setItem('reverie-music-volume', this.volume.toString());
        if (this.widget && this.widgetReady) {
            this.widget.setVolume(this.volume * 100);
        }
    }

    updatePlayButton() {
        const playBtn = document.getElementById('musicPlayBtn');
        const playOverlay = document.getElementById('musicPlayOverlay');
        const player = document.getElementById('musicPlayer');
        
        [playBtn, playOverlay].forEach(el => {
            if (!el) return;
            const playIcon = el.querySelector('.play-icon');
            const pauseIcon = el.querySelector('.pause-icon');
            if (this.isPlaying) {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            } else {
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            }
        });

        if (player) {
            player.classList.toggle('playing', this.isPlaying);
        }
    }

    showResumeIndicator() {
        const player = document.getElementById('musicPlayer');
        if (!player || player.querySelector('.music-resume-indicator')) return;
        
        const indicator = document.createElement('div');
        indicator.className = 'music-resume-indicator';
        indicator.innerHTML = '▶ Click to resume';
        indicator.title = 'Browser blocked autoplay - click to resume';
        indicator.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlay();
        });
        
        player.appendChild(indicator);
        player.classList.add('has-pending-resume');
    }

    hideResumeIndicator() {
        const player = document.getElementById('musicPlayer');
        const indicator = player?.querySelector('.music-resume-indicator');
        if (indicator) indicator.remove();
        player?.classList.remove('has-pending-resume');
    }
}

// Auto-initialize
window.musicPlayer = new MusicPlayer();
