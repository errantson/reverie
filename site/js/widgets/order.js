/**
 * Order Widget - Rebuilt for integrated layout
 * Handles book ordering with cover art, stats, buttons, and CC0 notice in one widget
 */

class OrderWidget {
    constructor(bookData = null) {
        // Constants for magic numbers
        this.ANIMATION_DURATION = 300;
        this.CONFETTI_PARTICLE_COUNT = 40;
        this.CONFETTI_VELOCITY = 150;
        this.CONFETTI_ROTATION = 720;
        this.SLIDER_TILT_MAX = 15;
        this.GRAVITY = 0.25;
        this.OPACITY_DECAY = 0.018;
        this.ANIMATION_EASE_MULTIPLIER = {
            high: 0.08,
            medium: 0.18,
            low: 0.25,
            veryLow: 0.22
        };
        
        this.unitPrice = 14.99;
        this.quantity = 1;
        this.quantityOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 50, 75, 100];
        this.currentSliderIndex = 0;
        this.animatedTotal = this.unitPrice;
        this.targetTotal = this.unitPrice;
        this.animationFrame = null;
        this.isAnimating = false;
        this.lastSliderValue = 0;
        this.sliderVelocity = 0;
        
        // Cache for RGB values to avoid recalculation
        this.userColorCache = new Map();
        
        // Live clock interval
        this.clockInterval = null;
        
        this.bookData = bookData || {
            title: "Seeker's Reverie",
            author: "errantson",
            authorDid: "errantson",
            coverImage: "/books/seeker/seekers_reverie.png",
            synopsis: "After falling from his nightmare into the place between dreams, one lost dreamer finds our wild mindscape and Reverie House.<br><br>When an unending nightmare threatens to consume this strange but welcoming new home, Seeker must quickly master the art of dreamweaving before everything is lost to oblivion.",
            stats: {
                genre: "Fantasy",
                length: "188 pages",
                ages: "16+",
                binding: "Softcover",
                published: "29/03/25",
                asin: "B0F2ST7CXZ",
                isbn: "Undeclared"
            },
            readOnlineUrl: "/books/seeker/00",
            epubUrl: "/books/seeker/seekers_reverie.epub"
        };
        
        this.isProcessingOrder = false;
        this.carouselAutoRotate = null;
        this.carouselAutoRotateEnabled = true;
    }

    init() {
        this.render();
        this.attachEventListeners();
        this.handleUrlParams();
        
        // Listen for OAuth events
        window.addEventListener('oauth:login', () => this.updateOrderHistory());
        window.addEventListener('oauth:logout', () => this.updateOrderHistory());
        window.addEventListener('oauth:profile-loaded', () => this.updateOrderHistory());
    }

    handleUrlParams() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('success')) {
            this.showSuccessMessage(params.get('session_id'));
        } else if (params.get('canceled')) {
            this.showCancelMessage();
        }
    }

    render() {
        const container = document.querySelector('.order-widget-container');
        if (!container) return;

        container.innerHTML = `
            <div class="order-section">
                <div class="order-container">
                    <div class="order-row-1">
                        ${this.renderHeroCover()}
                        ${this.renderTitleSynopsis()}
                    </div>
                    
                    ${this.renderInteractiveSection()}
                    ${this.renderQuantitySection()}
                    ${this.renderMobileCarousel()}
                </div>
            </div>
        `;

        this.renderSliderNotches();
        this.updateOrderHistory();
        this.loadRecentOrders();
        
        // Enable the order button on initial render
        this.updatePriceDisplay();
        
        // Start carousel auto-rotation
        this.startCarouselAutoRotate();
    }

    renderHeroCover() {
        const { title, coverImage } = this.bookData;
        return `
            <div class="hero-cover">
                <img src="${coverImage}" 
                     alt="${title}" 
                     class="hero-cover-img"
                     onclick="orderWidget.openTableOfContents()">
                <button class="kindle-btn" onclick="orderWidget.handleKindleClick()">Read on Kindle</button>
                <button class="epub-btn" onclick="orderWidget.handleEpubDownload()">Download ePub</button>
            </div>
        `;
    }
    
    renderTitleSynopsis() {
        const { title, author, synopsis, authorDid, stats } = this.bookData;
        const formattedSynopsis = synopsis.replace(/\n\n/g, '</p><p>');
        return `
            <div class="title-synopsis">
                <div class="order-main-synopsis">
                    <h1 class="order-main-title">${title}</h1>
                    <div class="order-author">by <a href="/dreamer?did=${authorDid}">${author}</a></div>
                    <div class="synopsis-text"><p>${formattedSynopsis}</p></div>
                </div>
                
                <div class="book-info-carousel-container desktop-carousel">
                    <div class="book-info-carousel">
                        <div class="carousel-slide active" data-slide="0">
                            <div class="patronage-message">
                                <p style="font-weight: 700; font-size: 0.85rem; color: #734ba1; margin-bottom: 10px; letter-spacing: 0.5px; text-transform: uppercase;">Reverie House Press</p>
                                <p>Readers, scholars, and vendors support Reverie House by ordering books for their favourite shops, clubs, and people directly.</p>
                                <p>We recognize and appreciate the value of your patronage.</p>
                                <p>Please contact <a href="mailto:books@reverie.house">books@reverie.house</a> for any special requests.</p>
                            </div>
                        </div>
                        
                        <div class="carousel-slide" data-slide="1">
                            <div class="carousel-stats-container">
                                <div class="shipping-notice-header">
                                    <div class="shipping-badge">
                                        <span class="shipping-icon">✦</span>
                                        <span class="shipping-text">Free Worldwide Shipping</span>
                                        <span class="shipping-icon">✦</span>
                                    </div>
                                    <div class="edition-text">First Print Edition</div>
                                </div>
                                <div class="book-info-grid">
                                    <span class="info-label">Author:</span><span>${author}</span>
                                    <span class="info-label">Genre:</span><span>${stats.genre}</span>
                                    <span class="info-label">Binding:</span><span>${stats.binding}</span>
                                    <span class="info-label">Length:</span><span>${stats.length}</span>
                                    <span class="info-label">Published:</span><span>${stats.published}</span>
                                    <span class="info-label">Ages:</span><span>${stats.ages}</span>
                                    <span class="info-label">ISBN:</span><span>${stats.isbn}</span>
                                    <span class="info-label">ASIN:</span><span>${stats.asin}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="carousel-slide" data-slide="2">
                            <div class="residence-bonus-panel">
                                <div class="bonus-header"></div>
                                <div class="bonus-content">
                                    <img src="/souvenirs/residence/icon.png" alt="Residence Key" class="residence-key-icon">
                                    <div class="bonus-text">
                                        <div class="bonus-title">Become a Resident Dreamweaver</div>
                                        <div class="bonus-description">Every copy of <b>Seeker's Reverie</b> ordered directly from our press includes a unique invitation to claim residence at <b>Reverie House</b></div>
                                        <div class="bonus-description" style="margin-top: 4px;">Use it to begin your journey through our wild mindscape, or to adopt a new dreamweaver persona and explore.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="carousel-panel-indicators">
                            <span class="panel-indicator active" data-panel="0"></span>
                            <span class="panel-indicator" data-panel="1"></span>
                            <span class="panel-indicator" data-panel="2"></span>
                        </div>
                    </div>
                </div>
                
                <div class="quantity-section desktop-quantity">
                    <label for="quantity-slider-desktop" class="quantity-label">
                        <span class="quantity-display">1</span> 
                        <span class="copies-label">Copy</span>
                    </label>
                    <div class="slider-wrapper">
                        <input type="range" 
                               id="quantity-slider-desktop" 
                               class="quantity-slider" 
                               min="0" 
                               max="${this.quantityOptions.length - 1}" 
                               value="0" 
                               step="1"
                               aria-label="Select quantity of books to order"
                               aria-valuemin="1"
                               aria-valuemax="${this.quantityOptions[this.quantityOptions.length - 1]}"
                               aria-valuenow="1"
                               role="slider">
                        <div class="slider-notches desktop-notches"></div>
                    </div>
                </div>
            </div>
        `;
    }

    renderQuantitySection() {
        return `
            <div class="quantity-section mobile-quantity">
                <label for="quantity-slider-mobile" class="quantity-label">
                    <span class="quantity-display">1</span> 
                    <span class="copies-label">Copy</span>
                </label>
                <div class="slider-wrapper">
                    <input type="range" 
                           id="quantity-slider-mobile" 
                           class="quantity-slider" 
                           min="0" 
                           max="${this.quantityOptions.length - 1}" 
                           value="0" 
                           step="1"
                           aria-label="Select quantity of books to order"
                           aria-valuemin="1"
                           aria-valuemax="${this.quantityOptions[this.quantityOptions.length - 1]}"
                           aria-valuenow="1"
                           role="slider">
                    <div class="slider-notches mobile-notches"></div>
                </div>
            </div>
        `;
    }
    
    renderMobileCarousel() {
        const { author, stats } = this.bookData;
        return `
            <div class="book-info-carousel-container mobile-carousel">
                <div class="book-info-carousel">
                    <div class="carousel-slide active" data-slide="0">
                        <div class="patronage-message">
                            <p style="font-weight: 700; font-size: 0.85rem; color: #734ba1; margin-bottom: 10px; letter-spacing: 0.5px; text-transform: uppercase;">Reverie House Press</p>
                            <p>Readers, scholars, and vendors support Reverie House by ordering books for their favourite shops, clubs, and people directly.</p>
                            <p>We recognize and appreciate the value of your patronage.</p>
                            <p>Please contact <a href="mailto:books@reverie.house">books@reverie.house</a> for any special requests.</p>
                        </div>
                    </div>
                    
                    <div class="carousel-slide" data-slide="1">
                        <div class="carousel-stats-container">
                            <div class="shipping-notice-header">
                                <div class="shipping-badge">
                                    <span class="shipping-icon">✦</span>
                                    <span class="shipping-text">Free Worldwide Shipping</span>
                                    <span class="shipping-icon">✦</span>
                                </div>
                                <div class="edition-text">First Print Edition</div>
                            </div>
                            <div class="book-info-grid">
                                <span class="info-label">Author:</span><span>${author}</span>
                                <span class="info-label">Genre:</span><span>${stats.genre}</span>
                                <span class="info-label">Binding:</span><span>${stats.binding}</span>
                                <span class="info-label">Length:</span><span>${stats.length}</span>
                                <span class="info-label">Published:</span><span>${stats.published}</span>
                                <span class="info-label">Ages:</span><span>${stats.ages}</span>
                                <span class="info-label">ISBN:</span><span>${stats.isbn}</span>
                                <span class="info-label">ASIN:</span><span>${stats.asin}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="carousel-slide" data-slide="2">
                        <div class="residence-bonus-panel">
                            <div class="bonus-header"></div>
                            <div class="bonus-content">
                                <img src="/souvenirs/residence/icon.png" alt="Residence Key" class="residence-key-icon">
                                <div class="bonus-text">
                                    <div class="bonus-title">Become a Resident Dreamweaver</div>
                                    <div class="bonus-description">Every copy of <b>Seeker's Reverie</b> ordered directly from our press includes a unique invitation to claim residence at <b>Reverie House</b></div>
                                    <div class="bonus-description" style="margin-top: 4px;">Use it to begin your journey through our wild mindscape, or to adopt a new dreamweaver persona and explore.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="carousel-panel-indicators">
                        <span class="panel-indicator active" data-panel="0"></span>
                        <span class="panel-indicator" data-panel="1"></span>
                        <span class="panel-indicator" data-panel="2"></span>
                    </div>
                </div>
            </div>
        `;
    }

    renderInteractiveSection() {
        return `
            <div class="order-row-2">
                <div class="order-row-flex">
                    <div class="order-history-preview" id="order-history-preview">
                        <div class="order-history-recent" id="recent-history"></div>
                    </div>
                    <div class="price-breakdown">
                        <div class="price-row">
                            <span class="price-label">Unit Price:</span>
                            <span class="price-value">$${this.unitPrice.toFixed(2)} USD</span>
                        </div>
                        <div class="price-row">
                            <span class="price-label">Quantity:</span>
                            <span class="price-value" id="quantity-value">1</span>
                        </div>
                        <div class="price-row total-row">
                            <span class="price-label">Total:</span>
                            <span class="price-value" id="total-price">$${this.unitPrice.toFixed(2)} USD</span>
                        </div>
                        <div class="price-row price-row-actions">
                            <label class="canon-checkbox">
                                <input type="checkbox" id="anonymize-order">
                                <span id="anonymize-label">Make me anonymous</span>
                            </label>
                            <button id="order-btn" class="order-btn-integrated" aria-label="Order books">
                                <span class="order-btn-text">Order Books</span>
                                <span class="order-btn-loading" style="display: none;">Processing...</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    async loadRecentOrders() {
        const container = document.getElementById('recent-history');
        
        try {
            const response = await fetch('/api/canon');
            if (!response.ok) throw new Error('Failed to load canon');
            
            const canon = await response.json();
            
            // Filter for all seeker (book order) events - max 4 recent
            const bookOrders = canon.filter(e => 
                e.key === 'seeker'
            ).slice(0, 4);
            
            // Render in history preview using EventStack
            if (container && window.EventStack) {
                const eventStack = new EventStack();
                eventStack.render(bookOrders, container, {
                    colorMode: 'auto',
                    colorIntensity: 'highlight',
                    showReactions: false,
                    limit: 4,
                    sortOrder: 'desc',
                    emptyMessage: 'No orders yet. Be the first!',
                    columns: {
                        type: false,
                        key: false,
                        uri: false
                    }
                });

                // Inject a prospective (live) row at the top showing the current user and time
                try {
                    const session = window.oauthManager?.getSession();
                    const checkbox = document.getElementById('anonymize-order');
                    const isAnonymous = !session || checkbox?.checked;
                    const dreamerDid = 'did:plc:zdxbourfcbv66iq2xfpb233q';
                    const dreamerAvatar = 'https://cdn.bsky.app/img/avatar/plain/did:plc:zdxbourfcbv66iq2xfpb233q/bafkreihoe46uedehpa2ngkmvku72giztmsqac4fblx5bklxwngfczdzrzm@jpeg';

                    // Fetch user's dreamer record to get actual name and color
                    let dreamer = null;
                    let dreamerRecord = null;
                    
                    // If anonymous, fetch dreamer.reverie.house record
                    if (isAnonymous) {
                        try {
                            const dreamersResponse = await fetch('/api/dreamers');
                            if (dreamersResponse.ok) {
                                const dreamers = await dreamersResponse.json();
                                dreamerRecord = dreamers.find(d => d.did === dreamerDid);
                            }
                        } catch (err) {
                            console.warn('[Order] Failed to fetch dreamer.reverie.house data:', err);
                        }
                    } else if (session && session.did) {
                        try {
                            const dreamersResponse = await fetch('/api/dreamers');
                            if (dreamersResponse.ok) {
                                const dreamers = await dreamersResponse.json();
                                dreamer = dreamers.find(d => d.did === session.did);
                            }
                        } catch (err) {
                            console.warn('[Order] Failed to fetch dreamer data:', err);
                        }
                    }

                    // Use dreamer record if available, otherwise fall back to session/defaults
                    const name = isAnonymous ? (dreamerRecord?.name || 'dreamer') : (dreamer?.name || session?.handle || 'Dreamer');
                    const avatar = isAnonymous ? (dreamerRecord?.avatar || dreamerAvatar) : (dreamer?.avatar || session?.avatar || dreamerAvatar);
                    const did = isAnonymous ? dreamerDid : (session?.did || '');
                    const userColor = isAnonymous ? (dreamerRecord?.color_hex || '#734ba1') : (dreamer?.color_hex || window.colorManager?.color || '#734ba1');

                    // Format quantity using NumNom if available ("num_nom" style)
                    const qty = Number.isInteger(this.quantity) ? this.quantity : parseInt(this.quantity, 10) || 1;
                    // Prefer global NumNom.numberToWord when available; otherwise use a small fallback map
                    let qtyWord;
                    if (window.NumNom && typeof window.NumNom.numberToWord === 'function') {
                        qtyWord = window.NumNom.numberToWord(qty);
                    } else {
                        const smallNums = {
                            0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
                            6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
                            11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen',
                            16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty'
                        };
                        if (qty in smallNums) {
                            qtyWord = smallNums[qty];
                        } else if (qty < 100) {
                            const tens = Math.floor(qty / 10) * 10;
                            const ones = qty % 10;
                            const tensMap = {20:'twenty',30:'thirty',40:'forty',50:'fifty',60:'sixty',70:'seventy',80:'eighty',90:'ninety'};
                            qtyWord = tensMap[tens] ? (ones ? `${tensMap[tens]}-${smallNums[ones]}` : tensMap[tens]) : String(qty);
                        } else {
                            qtyWord = String(qty);
                        }
                    }

                    const plural = qty === 1 ? 'book' : 'books';
                    const eventText = `realizes ${qtyWord} ${plural}`;

                    // Build synthetic event matching exact API structure from /api/canon
                    const syntheticEvent = {
                        id: 'live',
                        epoch: Math.floor(Date.now() / 1000),
                        did: did,
                        name: name,
                        avatar: avatar,
                        color_hex: userColor,
                        event: eventText,
                        url: '',
                        uri: '',
                        type: 'order',
                        key: 'seeker',  // Match real order events
                        color_source: 'user',
                        color_intensity: 'none',
                        octant: '',
                        origin_octant: '',
                        reaction_to: null
                    };

                    console.log('[Order] Synthetic event:', syntheticEvent);

                    // Build HTML using EventStack's builder so markup matches exactly
                    const liveRowHtml = eventStack.buildEventRow(syntheticEvent, 0);
                    
                    console.log('[Order] Generated row HTML:', liveRowHtml);

                    // Prepend to container so it appears above recent events
                    container.insertAdjacentHTML('afterbegin', liveRowHtml);
                    
                    // Apply special styling to the live row
                    const liveRow = container.querySelector('.row-entry');
                    if (liveRow) {
                        liveRow.classList.add('order-live-row');
                        liveRow.style.setProperty('--user-color', userColor);
                        // Make the event text bold AND italic
                        const canonCell = liveRow.querySelector('.cell.canon');
                        if (canonCell) {
                            const eventSpan = canonCell.querySelector('span[style*="italic"]');
                            if (eventSpan) {
                                eventSpan.style.fontWeight = '700';
                                eventSpan.style.fontStyle = 'italic';
                            }
                        }
                    }

                    // Re-apply RowStyle effects so the injected row gets snakecharmer, etc.
                    if (window.rowStyleEngine) {
                        // Clear previously-applied effects so they run again
                        if (typeof window.rowStyleEngine.clearEffects === 'function') {
                            window.rowStyleEngine.clearEffects(container);
                        }
                        window.rowStyleEngine.applyEffects(container);
                    }
                } catch (err) {
                    console.warn('[Order] Failed to inject live row', err);
                }
            } else if (!window.EventStack) {
                console.warn('[Order] EventStack not available yet');
            }
            
        } catch (error) {
            console.error('Error loading recent orders:', error);
            if (container) container.innerHTML = '<div style="text-align: center; padding: 1rem; font-style: italic; color: #999;">Unable to load recent orders</div>';
        }
    }

    renderSliderNotches() {
        // Render notches for both desktop and mobile sliders
        const notchContainers = document.querySelectorAll('.slider-notches');
        notchContainers.forEach(notchesContainer => {
            notchesContainer.innerHTML = '';
            this.quantityOptions.forEach((_, index) => {
                const notch = document.createElement('div');
                notch.className = 'slider-notch';
                notch.style.left = `${(index / (this.quantityOptions.length - 1)) * 100}%`;
                notchesContainer.appendChild(notch);
            });
        });
    }

    attachEventListeners() {
        // Quantity sliders (both desktop and mobile)
        const sliders = document.querySelectorAll('.quantity-slider');
        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => this.handleSliderChange(e));
        });

        // Order button
        const orderBtn = document.getElementById('order-btn');
        if (orderBtn) {
            orderBtn.addEventListener('click', (e) => {
                if (this.isProcessingOrder) return;
                this.setOrderLoading(true);
                this.triggerConfetti(orderBtn);
                setTimeout(() => this.handleOrderClick(), this.ANIMATION_DURATION);
            });
            orderBtn.addEventListener('mouseenter', () => this.snapToFinalPrice());
        }

        // Anonymize checkbox
        const checkbox = document.getElementById('anonymize-order');
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                this.updateOrderHistory();
                this.updateLiveRow();
            });
        }

        // Carousel click to rotate (but not on links) - attach to all carousels
        const carousels = document.querySelectorAll('.book-info-carousel');
        carousels.forEach(carousel => {
            carousel.addEventListener('click', (e) => {
                // Don't rotate if clicking on a link
                if (e.target.tagName === 'A' || e.target.closest('a')) {
                    return;
                }
                this.stopCarouselAutoRotate();
                this.nextSlide();
            });
            // Add cursor pointer to indicate it's clickable
            carousel.style.cursor = 'pointer';
        });
    }

    handleSliderChange(e) {
        this.currentSliderIndex = parseInt(e.target.value);
        this.quantity = this.quantityOptions[this.currentSliderIndex];
        
        // Sync all sliders to the same value
        document.querySelectorAll('.quantity-slider').forEach(slider => {
            if (slider !== e.target) {
                slider.value = this.currentSliderIndex;
            }
            slider.setAttribute('aria-valuenow', this.quantity);
        });
        
        // Calculate tilt for knob animation
        this.sliderVelocity = this.currentSliderIndex - this.lastSliderValue;
        this.lastSliderValue = this.currentSliderIndex;
        const tilt = Math.max(-this.SLIDER_TILT_MAX, Math.min(this.SLIDER_TILT_MAX, this.sliderVelocity * 8));
        e.target.style.setProperty('--slider-tilt', `${tilt}deg`);
        
        // Reset tilt
        setTimeout(() => {
            this.sliderVelocity *= 0.5;
            const settleTilt = Math.max(-this.SLIDER_TILT_MAX, Math.min(this.SLIDER_TILT_MAX, this.sliderVelocity * 8));
            e.target.style.setProperty('--slider-tilt', `${settleTilt}deg`);
            setTimeout(() => e.target.style.setProperty('--slider-tilt', '0deg'), 100);
        }, 50);

        this.updatePriceDisplay();
        this.updateOrderHistory();
        this.updateLiveRow();
    }

    updatePriceDisplay() {
        // Update all quantity displays (desktop and mobile)
        document.querySelectorAll('.quantity-display').forEach(el => {
            el.textContent = this.quantity;
        });
        document.querySelectorAll('.copies-label').forEach(el => {
            el.textContent = this.quantity === 1 ? 'Copy' : 'Copies';
        });
        
        const quantityValue = document.getElementById('quantity-value');
        const totalPrice = document.getElementById('total-price');
        const orderBtn = document.getElementById('order-btn');
        
        if (quantityValue) quantityValue.textContent = this.quantity;
        
        // Animate total price
        this.targetTotal = this.quantity * this.unitPrice;
        if (totalPrice) {
            this.animatePrice(totalPrice);
        }
        
        // Enable order button
        if (orderBtn) {
            orderBtn.disabled = false;
        }
    }

    setOrderLoading(loading) {
        this.isProcessingOrder = loading;
        const orderBtn = document.getElementById('order-btn');
        const btnText = orderBtn?.querySelector('.order-btn-text');
        const loadingText = orderBtn?.querySelector('.order-btn-loading');
        
        if (orderBtn) {
            orderBtn.disabled = loading;
            orderBtn.setAttribute('aria-disabled', loading.toString());
        }
        if (btnText) btnText.style.display = loading ? 'none' : 'inline';
        if (loadingText) loadingText.style.display = loading ? 'inline' : 'none';
    }

    async updateLiveRow() {
        const container = document.getElementById('recent-history');
        const liveRow = container?.querySelector('.order-live-row');
        if (!liveRow) return;

        // Check if anonymous mode is enabled
        const session = window.oauthManager?.getSession();
        const checkbox = document.getElementById('anonymize-order');
        const isAnonymous = !session || checkbox?.checked;
        const dreamerDid = 'did:plc:zdxbourfcbv66iq2xfpb233q';
        const dreamerAvatar = 'https://cdn.bsky.app/img/avatar/plain/did:plc:zdxbourfcbv66iq2xfpb233q/bafkreihoe46uedehpa2ngkmvku72giztmsqac4fblx5bklxwngfczdzrzm@jpeg';

        // Fetch the appropriate dreamer record
        let dreamer = null;
        let dreamerRecord = null;
        
        if (isAnonymous) {
            try {
                const dreamersResponse = await fetch('/api/dreamers');
                if (dreamersResponse.ok) {
                    const dreamers = await dreamersResponse.json();
                    dreamerRecord = dreamers.find(d => d.did === dreamerDid);
                }
            } catch (err) {
                console.warn('[Order] Failed to fetch dreamer.reverie.house data:', err);
            }
        } else if (session && session.did) {
            try {
                const dreamersResponse = await fetch('/api/dreamers');
                if (dreamersResponse.ok) {
                    const dreamers = await dreamersResponse.json();
                    dreamer = dreamers.find(d => d.did === session.did);
                }
            } catch (err) {
                console.warn('[Order] Failed to fetch dreamer data:', err);
            }
        }

        // Determine user data based on anonymous mode
        const name = isAnonymous ? (dreamerRecord?.name || 'dreamer') : (dreamer?.name || session?.handle || 'Dreamer');
        const avatar = isAnonymous ? (dreamerRecord?.avatar || dreamerAvatar) : (dreamer?.avatar || session?.avatar || dreamerAvatar);
        const userColor = isAnonymous ? (dreamerRecord?.color_hex || '#734ba1') : (dreamer?.color_hex || window.colorManager?.color || '#734ba1');

        // Format quantity using NumNom
        const qty = this.quantity;
        let qtyWord;
        if (window.NumNom && typeof window.NumNom.numberToWord === 'function') {
            qtyWord = window.NumNom.numberToWord(qty);
        } else {
            const smallNums = {
                0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
                6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
                11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen',
                16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty'
            };
            if (qty in smallNums) {
                qtyWord = smallNums[qty];
            } else if (qty < 100) {
                const tens = Math.floor(qty / 10) * 10;
                const ones = qty % 10;
                const tensMap = {20:'twenty',30:'thirty',40:'forty',50:'fifty',60:'sixty',70:'seventy',80:'eighty',90:'ninety'};
                qtyWord = tensMap[tens] ? (ones ? `${tensMap[tens]}-${smallNums[ones]}` : tensMap[tens]) : String(qty);
            } else {
                qtyWord = String(qty);
            }
        }

        const plural = qty === 1 ? 'book' : 'books';
        const eventText = `realizes ${qtyWord} ${plural}`;

        // Update the avatar
        const avatarCell = liveRow.querySelector('.cell.avatar');
        if (avatarCell) {
            const avatarImg = avatarCell.querySelector('.avatar-img');
            if (avatarImg) {
                avatarImg.src = avatar;
            }
        }

        // Update the name and event text in the canon cell
        const canonCell = liveRow.querySelector('.cell.canon');
        if (canonCell) {
            const nameLink = canonCell.querySelector('a') || canonCell.querySelector('.dreamer-name');
            if (nameLink) {
                nameLink.textContent = name;
            }
            const eventSpan = canonCell.querySelector('span[style*="italic"]');
            if (eventSpan) {
                eventSpan.textContent = eventText;
            }
        }

        // Update the row color
        liveRow.style.setProperty('--user-color', userColor);
        
        // Re-apply RowStyle if available
        if (window.rowStyleEngine) {
            if (typeof window.rowStyleEngine.clearEffects === 'function') {
                window.rowStyleEngine.clearEffects(container);
            }
            window.rowStyleEngine.applyEffects(container);
        }
    }

    animatePrice(element) {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        this.isAnimating = true;
        element.classList.add('price-animating');

        const animate = () => {
            const diff = this.targetTotal - this.animatedTotal;
            const distance = Math.abs(diff);
            
            let easeMultiplier = distance > 100 ? this.ANIMATION_EASE_MULTIPLIER.high :
                               distance > 50 ? this.ANIMATION_EASE_MULTIPLIER.medium :
                               distance > 20 ? this.ANIMATION_EASE_MULTIPLIER.low :
                               distance > 10 ? this.ANIMATION_EASE_MULTIPLIER.veryLow :
                               distance > 5 ? this.ANIMATION_EASE_MULTIPLIER.veryLow :
                               distance > 2 ? 0.14 : 0.05;

            if (Math.abs(diff) < 0.01) {
                this.animatedTotal = this.targetTotal;
                this.isAnimating = false;
                element.classList.remove('price-animating');
                element.textContent = `$${this.animatedTotal.toFixed(2)} USD`;
                return;
            }

            this.animatedTotal += diff * easeMultiplier;
            element.textContent = `$${this.animatedTotal.toFixed(2)} USD`;
            this.animationFrame = requestAnimationFrame(animate);
        };

        animate();
    }

    snapToFinalPrice() {
        const totalPrice = document.getElementById('total-price');
        if (this.isAnimating && totalPrice) {
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
            }
            this.animatedTotal = this.targetTotal;
            this.isAnimating = false;
            totalPrice.classList.remove('price-animating');
            totalPrice.textContent = `$${this.targetTotal.toFixed(2)} USD`;
        }
    }

    updateOrderHistory() {
        const userEntryContainer = document.getElementById('user-entry');
        // If the user-entry container exists, clear it so only real events are shown
        if (userEntryContainer) {
            userEntryContainer.innerHTML = '';
        }

        const session = window.oauthManager?.getSession();
        const checkbox = document.getElementById('anonymize-order');

        // Update checkbox state (keep default anonymous when no session)
        if (!session && checkbox) {
            checkbox.checked = true;
            checkbox.disabled = true;
            checkbox.style.opacity = '0.5';
        } else if (checkbox) {
            checkbox.disabled = false;
            checkbox.style.opacity = '1';
        }
    }

    startLiveClock() {
        // Clear any existing interval
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
        }
        
        // Update clock every second to match epoch format (DD/MM/YY HH:MM)
        this.clockInterval = setInterval(() => {
            const epochEl = document.getElementById('live-epoch');
            if (epochEl) {
                const now = new Date();
                const day = String(now.getDate()).padStart(2, '0');
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = String(now.getFullYear()).slice(-2);
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                epochEl.textContent = `${day}/${month}/${year} ${hours}:${minutes}`;
            } else {
                // Stop if element doesn't exist
                clearInterval(this.clockInterval);
            }
        }, 1000);
    }

    async handleOrderClick() {
        const orderBtn = document.getElementById('order-btn');
        if (!orderBtn) return;

        try {
            const session = window.oauthManager?.getSession();
            const checkbox = document.getElementById('anonymize-order');
            const isAnonymous = !session || checkbox?.checked;

            const response = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quantity: this.quantity,
                    customer_did: isAnonymous ? null : session?.did,
                    customer_handle: isAnonymous ? null : session?.handle,
                    anonymous: isAnonymous
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create checkout session');
            }

            const data = await response.json();
            
            if (data.url) {
                window.open(data.url, '_blank', 'noopener,noreferrer');
                this.setOrderLoading(false);
            } else {
                throw new Error('No checkout URL received');
            }
        } catch (error) {
            console.error('[OrderWidget] Order error:', error);
            this.setOrderLoading(false);
            alert(
                `Unable to process your order at this time.\n\n` +
                `Please contact books@reverie.house to order ${this.quantity} ${this.quantity === 1 ? 'copy' : 'copies'} directly.`
            );
        }
    }

    triggerConfetti(button) {
        const colors = ['#87408d', '#000080', '#ff9900', '#00cc88', '#ff6b9d'];
        const rect = button.getBoundingClientRect();
        const sprayPoints = [
            { x: rect.left + 10, y: rect.top + 10 },
            { x: rect.right - 10, y: rect.top + 10 },
            { x: rect.left + 10, y: rect.bottom - 10 },
            { x: rect.right - 10, y: rect.bottom - 10 },
            { x: rect.left + rect.width * 0.3, y: rect.top + rect.height / 2 },
            { x: rect.right - rect.width * 0.3, y: rect.top + rect.height / 2 }
        ];

        sprayPoints.forEach((point, pointIndex) => {
            for (let i = 0; i < 15; i++) {
                setTimeout(() => {
                    const confetti = document.createElement('div');
                    confetti.style.cssText = `
                        position: fixed;
                        left: ${point.x}px;
                        top: ${point.y}px;
                        width: 5px;
                        height: 5px;
                        background-color: ${colors[Math.floor(Math.random() * colors.length)]};
                        border-radius: ${Math.random() > 0.5 ? '50%' : '1px'};
                        pointer-events: none;
                        z-index: 10000;
                    `;
                    document.body.appendChild(confetti);

                    const angle = Math.random() * Math.PI * 2;
                    const velocity = 2.5 + Math.random() * 5;
                    let x = 0, y = 0, rotation = 0, opacity = 1;
                    let vx = Math.cos(angle) * velocity;
                    let vy = Math.sin(angle) * velocity - 4;

                    const animate = () => {
                        x += vx;
                        y += vy;
                        vy += this.GRAVITY;
                        rotation += 12;
                        opacity -= this.OPACITY_DECAY;
                        
                        confetti.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
                        confetti.style.opacity = opacity;

                        if (opacity > 0) {
                            requestAnimationFrame(animate);
                        } else {
                            confetti.remove();
                        }
                    };
                    animate();
                }, (pointIndex * 25) + (i * 8));
            }
        });
    }
    
    handleReadOnline() {
        // Use session progress if available
        let url = this.bookData.readOnlineUrl;
        try {
            const lastChapter = sessionStorage.getItem('reading_progress_seekers-reverie');
            if (lastChapter) {
                url = `/books/seeker/${lastChapter}`;
            }
        } catch (e) {
            // Session storage not available, use default
        }
        window.location.href = url;
    }
    
    handleDownloadEpub() {
        window.location.href = this.bookData.epubUrl;
    }
    
    // Carousel navigation methods - sync both desktop and mobile carousels
    nextSlide() {
        // Get all carousels and their slides
        const carouselContainers = document.querySelectorAll('.book-info-carousel');
        
        // Find current slide index from any active carousel
        const currentActive = document.querySelector('.carousel-slide.active');
        if (!currentActive) return;
        
        const currentIndex = parseInt(currentActive.dataset.slide);
        const totalSlides = document.querySelectorAll('.desktop-carousel .carousel-slide').length;
        const nextIndex = (currentIndex + 1) % totalSlides;
        
        // Update all carousels to the same slide
        carouselContainers.forEach(carousel => {
            const slides = carousel.querySelectorAll('.carousel-slide');
            const indicators = carousel.querySelectorAll('.panel-indicator');
            
            slides.forEach((slide, i) => {
                slide.classList.toggle('active', i === nextIndex);
            });
            
            indicators.forEach((ind, i) => {
                ind.classList.toggle('active', i === nextIndex);
            });
        });
    }
    
    startCarouselAutoRotate() {
        // Auto-rotate carousel every 4 seconds
        if (this.carouselAutoRotateEnabled) {
            this.carouselAutoRotate = setInterval(() => {
                this.nextSlide();
            }, 4000);
        }
    }
    
    stopCarouselAutoRotate() {
        // Stop auto-rotation when user manually interacts
        if (this.carouselAutoRotate) {
            clearInterval(this.carouselAutoRotate);
            this.carouselAutoRotate = null;
            this.carouselAutoRotateEnabled = false;
        }
    }
    
    previousSlide() {
        const carouselContainers = document.querySelectorAll('.book-info-carousel');
        const currentActive = document.querySelector('.carousel-slide.active');
        if (!currentActive) return;
        
        const currentIndex = parseInt(currentActive.dataset.slide);
        const totalSlides = document.querySelectorAll('.desktop-carousel .carousel-slide').length;
        const prevIndex = (currentIndex - 1 + totalSlides) % totalSlides;
        
        carouselContainers.forEach(carousel => {
            const slides = carousel.querySelectorAll('.carousel-slide');
            const indicators = carousel.querySelectorAll('.panel-indicator');
            
            slides.forEach((slide, i) => {
                slide.classList.toggle('active', i === prevIndex);
            });
            
            indicators.forEach((ind, i) => {
                ind.classList.toggle('active', i === prevIndex);
            });
        });
    }
    
    goToSlide(index) {
        const carouselContainers = document.querySelectorAll('.book-info-carousel');
        
        carouselContainers.forEach(carousel => {
            const slides = carousel.querySelectorAll('.carousel-slide');
            const indicators = carousel.querySelectorAll('.panel-indicator');
            
            slides.forEach((slide, i) => {
                slide.classList.toggle('active', i === index);
            });
            
            indicators.forEach((ind, i) => {
                ind.classList.toggle('active', i === index);
            });
        });
    }

    async handleKindleClick() {
        const link = await (window.getRegionalAmazonLink?.() || 'https://amazon.com');
        window.open(link, '_blank');
    }

    handleEpubDownload() {
        const epubUrl = this.bookData.epubUrl;
        if (epubUrl) {
            window.open(epubUrl, '_blank');
        }
    }

    openTableOfContents() {
        const coverImg = document.querySelector('.hero-cover-img');
        if (!coverImg) return;
        
        // Juke animation effect (same as TOC cover)
        coverImg.style.transition = 'transform 0.1s ease';
        coverImg.style.transform = 'scale(1.05) rotate(2deg)';
        
        setTimeout(() => {
            coverImg.style.transform = 'scale(0.95) rotate(-2deg)';
        }, 100);
        
        setTimeout(() => {
            coverImg.style.transform = 'scale(1) rotate(0)';
        }, 200);
        
        setTimeout(() => {
            // Navigate to last read chapter or preface
            let url = '/books/seeker/00';
            try {
                const lastChapter = sessionStorage.getItem('reading_progress_seekers-reverie');
                if (lastChapter) {
                    url = `/books/seeker/${lastChapter}`;
                }
            } catch (e) {
                // Session storage not available, use default
            }
            window.location.href = url;
        }, 300);
    }

    async showSuccessMessage(sessionId) {
        console.log('Order success:', sessionId);
        
        const session = window.oauthManager?.getSession();
        const checkbox = document.getElementById('anonymize-order');
        const isAnonymous = !session || checkbox?.checked;
        
        const patronTint = session?.color || '#734ba1';
        const patronFace = isAnonymous ? '/assets/icon_face.png' : (session?.avatar || '/assets/icon_face.png');
        const patronName = isAnonymous ? 'a dreamer' : (session?.name || session?.handle || 'Dreamer');
        const patronDid = isAnonymous ? '' : (session?.did || '');
        
        const numberWords = {
            1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
            6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
            15: 'fifteen', 20: 'twenty', 25: 'twenty five',
            50: 'fifty', 75: 'seventy five', 100: 'one hundred'
        };
        const quantityWord = numberWords[this.quantity] || this.quantity;
        const bookWord = this.quantity === 1 ? 'book' : 'books';
        
        const r = parseInt(patronTint.substr(1, 2), 16);
        const g = parseInt(patronTint.substr(3, 2), 16);
        const b = parseInt(patronTint.substr(5, 2), 16);
        
        const compactSuccess = `
            <div class="gratitude-nucleus" style="--patron-tint: ${patronTint}; --patron-rgb: ${r}, ${g}, ${b};">
                <div class="gratitude-headline">🎉 Order Complete!</div>
                <img src="/assets/logo.png" alt="Reverie House" class="gratitude-sigil">
                <div class="canon-inscription">
                    <img src="${patronFace}" class="inscription-face" onerror="this.src='/assets/icon_face.png'">
                    <div class="inscription-words">
                        ${patronDid ? `<a href="/dreamer?did=${encodeURIComponent(patronDid)}" class="inscription-name">${patronName}</a>` : `<span class="inscription-name">${patronName}</span>`}
                        <span class="inscription-deed">realizes ${quantityWord} ${bookWord}</span>
                    </div>
                </div>
                <div class="fulfillment-pledge"><strong>Thank you for supporting Reverie House!</strong><br>Your ${this.quantity === 1 ? 'book' : 'books'} will be shipped as fast as humanly possible.</div>
                <div class="contact-whisper">Questions or special requests? Email <a href="mailto:books@reverie.house">books@reverie.house</a></div>
                <div class="success-actions" style="margin-top: 1.5rem; display: flex; gap: 1rem; justify-content: center;">
                    <button onclick="window.location.reload()" style="padding: 0.75rem 1.5rem; background: #734ba1; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Continue Shopping</button>
                    <button onclick="orderWidget.handleReadOnline()" style="padding: 0.75rem 1.5rem; background: white; color: #734ba1; border: 2px solid #734ba1; border-radius: 4px; cursor: pointer; font-weight: 600;">Read Now</button>
                </div>
            </div>
        `;
        
        // Immediately refresh the support list
        this.loadRecentOrders();
        
        if (window.Popup) {
            window.Popup.show(compactSuccess, {
                title: '',
                type: 'success',
                duration: 15000
            });
        }
        
        // Clean up URL params after showing success
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }

    showCancelMessage() {
        console.log('Order canceled');
        
        // Show cancel popup
        if (window.Popup) {
            window.Popup.show(
                `<p>Your order was canceled. No charges were made.</p>
                <p>Feel free to try again whenever you're ready!</p>`,
                {
                    title: 'Order Canceled',
                    type: 'info',
                    duration: 5000,
                    buttons: [
                        { text: 'OK', onClick: () => {} }
                    ]
                }
            );
        }
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.orderWidget = new OrderWidget();
    window.orderWidget.init();
    console.log('✅ Order widget initialized');
});
