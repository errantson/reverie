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
            synopsis: "After falling from his nightmare into the place between dreams, our lost dreamer finds our wild mindscape and Reverie House.<br><br>When an unending nightmare threatens to consume this strange new home, Seeker must quickly master the art of dreamweaving before everything is lost to oblivion.",
            stats: {
                genre: "Fantasy",
                length: "155 pages",
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
                </div>
            </div>
        `;

        this.renderSliderNotches();
        this.updateOrderHistory();
        this.loadRecentOrders();
        
        // Enable the order button on initial render
        this.updatePriceDisplay();
    }

    renderHeroCover() {
        const { title, coverImage } = this.bookData;
        return `
            <div class="hero-cover">
                <img src="${coverImage}" 
                     alt="${title}" 
                     class="hero-cover-img">
                <button class="kindle-btn" onclick="orderWidget.handleKindleClick()">Read on Kindle</button>
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
                
                <div class="book-info-carousel-container">
                    <div class="book-info-carousel">
                        <div class="carousel-slide active" data-slide="0">
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
                        
                        <div class="carousel-slide" data-slide="1">
                            <div class="patronage-message">
                                <p>Readers, scholars, and vendors support Reverie House by ordering books for their favourite shops, clubs, and people directly from our press.</p>
                                <p>We recognize and appreciate the value of your patronage.</p>
                                <p>Please contact <a href="mailto:books@reverie.house">books@reverie.house</a> for any special requests.</p>
                            </div>
                        </div>
                        
                        <button class="carousel-rotate-btn" onclick="orderWidget.nextSlide()" aria-label="Next slide">›</button>
                        
                        <div class="carousel-indicators">
                            <button class="indicator active" onclick="orderWidget.goToSlide(0)" aria-label="Slide 1"></button>
                            <button class="indicator" onclick="orderWidget.goToSlide(1)" aria-label="Slide 2"></button>
                        </div>
                    </div>
                </div>
                
                <div class="quantity-section">
                    <div class="shipping-notice-header">
                        <div class="edition-text">First Print Edition</div>
                        <div class="shipping-text">FREE WORLDWIDE SHIPPING</div>
                    </div>
                    <label for="quantity-slider" class="quantity-label">
                        <span id="quantity-display">1</span> 
                        <span id="copies-label">Copy</span>
                    </label>
                    <div class="slider-wrapper">
                        <input type="range" 
                               id="quantity-slider" 
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
                        <div class="slider-notches" id="slider-notches"></div>
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
                        <div class="order-history-user-entry" id="user-entry"></div>
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
        const fullContainer = document.getElementById('recent-orders');
        
        try {
            const response = await fetch('/api/canon');
            if (!response.ok) throw new Error('Failed to load canon');
            
            const canon = await response.json();
            
            // Filter for all seeker (book order) events - max 4 recent (user entry will make 5 total)
            const bookOrders = canon.filter(e => 
                e.key === 'seeker'
            ).slice(0, 4);
            
            // Get user color or default
            const session = window.oauthManager?.getSession();
            const userColor = session?.color || '#734ba1';
            
            // Import and use event renderer for both containers
            const { renderEventRows } = await import('/js/utils/event-renderer.js');
            
            // Render in history preview (left side, compact)
            if (container && bookOrders.length > 0) {
                const eventsHTML = renderEventRows(bookOrders, {
                    colorHex: userColor,
                    showAvatar: true,
                    showKey: false,
                    showUri: false,
                    showType: false
                });
                container.innerHTML = eventsHTML;
                
                // Apply effects using RowStyle engine
                if (window.rowStyleEngine) {
                    window.rowStyleEngine.applyEffects(container);
                } else {
                    this.applySnakeCharmerEffect(container);
                }
            }
            
            // Render in full list (bottom right)
            if (fullContainer) {
                if (bookOrders.length === 0) {
                    fullContainer.innerHTML = '<div class=\"recent-orders-empty\">No orders yet. Be the first!</div>';
                } else {
                    const eventsHTML = renderEventRows(bookOrders, {
                        colorHex: userColor,
                        showAvatar: true,
                        showKey: false,
                        showUri: false,
                        showType: false
                    });
                    
                    fullContainer.innerHTML = `
                        <h3 class=\"recent-orders-title\">📚 Recent Support</h3>
                        <div class=\"recent-orders-list\">${eventsHTML}</div>
                    `;
                    const recentList = fullContainer.querySelector('.recent-orders-list');
                    if (recentList) {
                        // Apply effects using RowStyle engine
                        if (window.rowStyleEngine) {
                            window.rowStyleEngine.applyEffects(recentList);
                        } else {
                            this.applySnakeCharmerEffect(recentList);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('Error loading recent orders:', error);
            if (container) container.innerHTML = '';
            if (fullContainer) fullContainer.innerHTML = '<div class=\"recent-orders-error\">Unable to load recent orders</div>';
        }
    }

    applySnakeCharmerEffect(container) {
        // Find all strange souvenir rows within the container
        const strangeRows = container.querySelectorAll('.souvenir-strange.intensity-highlight, .souvenir-strange.intensity-special');
        
        strangeRows.forEach(row => {
            // Get all cells in the row (including key cell for wobble)
            const cells = row.querySelectorAll('.cell');
            
            cells.forEach((cell, cellIndex) => {
                // Skip if cell only contains images or empty content
                const hasOnlyImages = cell.querySelectorAll('img').length > 0 && !cell.textContent.trim();
                if (hasOnlyImages) return;
                
                let wordIndex = 0;
                
                // Recursively process all text nodes within the cell
                function processNode(node) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.textContent;
                        const wordParts = text.split(/(\s+)/);
                        const fragment = document.createDocumentFragment();
                        
                        wordParts.forEach(part => {
                            if (part.trim()) {
                                const wordSpan = document.createElement('span');
                                wordSpan.textContent = part;
                                wordSpan.className = 'snake-word';
                                const totalDelay = (cellIndex * 8 + wordIndex * 2) * 0.1;
                                wordSpan.style.animationDelay = `${totalDelay}s`;
                                fragment.appendChild(wordSpan);
                                wordIndex++;
                            } else if (part) {
                                fragment.appendChild(document.createTextNode(part));
                            }
                        });
                        
                        node.parentNode.replaceChild(fragment, node);
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        // Recursively process child nodes
                        Array.from(node.childNodes).forEach(child => processNode(child));
                    }
                }
                
                // Process all child nodes of the cell
                Array.from(cell.childNodes).forEach(node => processNode(node));
            });
        });
    }

    renderSliderNotches() {
        const notchesContainer = document.getElementById('slider-notches');
        if (!notchesContainer) return;

        notchesContainer.innerHTML = '';
        this.quantityOptions.forEach((_, index) => {
            const notch = document.createElement('div');
            notch.className = 'slider-notch';
            notch.style.left = `${(index / (this.quantityOptions.length - 1)) * 100}%`;
            notchesContainer.appendChild(notch);
        });
    }

    attachEventListeners() {
        // Quantity slider
        const slider = document.getElementById('quantity-slider');
        if (slider) {
            slider.addEventListener('input', (e) => this.handleSliderChange(e));
        }

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
            checkbox.addEventListener('change', () => this.updateOrderHistory());
        }
    }

    handleSliderChange(e) {
        this.currentSliderIndex = parseInt(e.target.value);
        this.quantity = this.quantityOptions[this.currentSliderIndex];
        
        // Update ARIA attributes for accessibility
        e.target.setAttribute('aria-valuenow', this.quantity);
        
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
    }

    updatePriceDisplay() {
        const quantityDisplay = document.getElementById('quantity-display');
        const copiesLabel = document.getElementById('copies-label');
        const quantityValue = document.getElementById('quantity-value');
        const totalPrice = document.getElementById('total-price');
        const orderBtn = document.getElementById('order-btn');
        
        if (quantityDisplay) quantityDisplay.textContent = this.quantity;
        if (copiesLabel) copiesLabel.textContent = this.quantity === 1 ? 'Copy' : 'Copies';
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
        if (!userEntryContainer) return;

        const session = window.oauthManager?.getSession();
        const checkbox = document.getElementById('anonymize-order');
        const isAnonymous = !session || checkbox?.checked;

        // When anonymous, show as dreamer.reverie.house
        const dreamerDid = 'did:plc:zdxbourfcbv66iq2xfpb233q';
        const dreamerAvatar = 'https://cdn.bsky.app/img/avatar/plain/did:plc:zdxbourfcbv66iq2xfpb233q/bafkreihoe46uedehpa2ngkmvku72giztmsqac4fblx5bklxwngfczdzrzm@jpeg';
        const dreamerColor = '#BE8F8F';

        // Get user details - use dreamer.reverie.house when anonymous
        const userColor = isAnonymous ? dreamerColor : (session?.color || '#734ba1');
        const avatar = isAnonymous ? dreamerAvatar : (session?.avatar || '/assets/icon_face.png');
        const name = isAnonymous ? 'dreamer' : (session?.name || session?.handle || 'Dreamer');
        const did = isAnonymous ? dreamerDid : (session?.did || '');
        
        // Format quantity text
        const numberWords = {
            1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
            6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
            15: 'fifteen', 20: 'twenty', 25: 'twenty five',
            50: 'fifty', 75: 'seventy five', 100: 'one hundred'
        };
        const quantityText = numberWords[this.quantity] || this.quantity;
        const copiesText = this.quantity === 1 ? 'book' : 'books';
        
        // Cache RGB calculation
        let rgbValues = this.userColorCache.get(userColor);
        if (!rgbValues) {
            const r = parseInt(userColor.substr(1, 2), 16);
            const g = parseInt(userColor.substr(3, 2), 16);
            const b = parseInt(userColor.substr(5, 2), 16);
            rgbValues = { r, g, b };
            this.userColorCache.set(userColor, rgbValues);
        }
        const { r, g, b } = rgbValues;
        
        // Format current time and date to match epoch format (DD/MM/YY HH:MM)
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String(now.getFullYear()).slice(-2);
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const formattedTime = `${day}/${month}/${year} ${hours}:${minutes}`;
        
        // Create the user's theoretical entry
        const userEntry = `
            <div class="row-entry canon-row" style="--canon-color: ${userColor}; --canon-color-rgb: ${r}, ${g}, ${b};">
                <div class="cell epoch" id="live-epoch">${formattedTime}</div>
                <div class="cell avatar">
                    <img src="${avatar}" class="avatar-img" alt="avatar" onerror="this.src='/assets/icon_face.png'">
                </div>
                <div class="cell canon">
                    ${did ? `<a href="/dreamer?did=${encodeURIComponent(did)}" class="dreamer-name">${name}</a>` : `<span class="dreamer-name">${name}</span>`}
                    <span class="event-text">realizes ${quantityText} ${copiesText}</span>
                </div>
            </div>
        `;
        
        userEntryContainer.innerHTML = userEntry;
        
        // Start live clock update
        this.startLiveClock();
        
        // Update checkbox state
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
        window.location.href = this.bookData.readOnlineUrl;
    }
    
    handleDownloadEpub() {
        window.location.href = this.bookData.epubUrl;
    }
    
    // Carousel navigation methods
    nextSlide() {
        const slides = document.querySelectorAll('.carousel-slide');
        const indicators = document.querySelectorAll('.carousel-indicators .indicator');
        const current = document.querySelector('.carousel-slide.active');
        const currentIndex = parseInt(current.dataset.slide);
        const nextIndex = (currentIndex + 1) % slides.length;
        
        current.classList.remove('active');
        slides[nextIndex].classList.add('active');
        
        indicators.forEach((ind, i) => {
            ind.classList.toggle('active', i === nextIndex);
        });
    }
    
    previousSlide() {
        const slides = document.querySelectorAll('.carousel-slide');
        const indicators = document.querySelectorAll('.carousel-indicators .indicator');
        const current = document.querySelector('.carousel-slide.active');
        const currentIndex = parseInt(current.dataset.slide);
        const prevIndex = (currentIndex - 1 + slides.length) % slides.length;
        
        current.classList.remove('active');
        slides[prevIndex].classList.add('active');
        
        indicators.forEach((ind, i) => {
            ind.classList.toggle('active', i === prevIndex);
        });
    }
    
    goToSlide(index) {
        const slides = document.querySelectorAll('.carousel-slide');
        const indicators = document.querySelectorAll('.carousel-indicators .indicator');
        
        slides.forEach(slide => slide.classList.remove('active'));
        indicators.forEach(ind => ind.classList.remove('active'));
        
        slides[index].classList.add('active');
        indicators[index].classList.add('active');
    }

    async handleKindleClick() {
        const link = await (window.getRegionalAmazonLink?.() || 'https://amazon.com');
        window.open(link, '_blank');
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
                    <button onclick="window.location.href='/books/seeker/00'" style="padding: 0.75rem 1.5rem; background: white; color: #734ba1; border: 2px solid #734ba1; border-radius: 4px; cursor: pointer; font-weight: 600;">Read Now</button>
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
