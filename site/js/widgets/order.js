/**
 * Order Widget - Rebuilt for integrated layout
 * Handles book ordering with cover art, stats, buttons, and CC0 notice in one widget
 */

class OrderWidget {
    constructor() {
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
        
        this.bookData = {
            title: "Seeker's Reverie",
            author: "errantson",
            authorDid: "errantson",
            coverImage: "/books/seeker/seekers_reverie.png",
            synopsis: "After falling from his nightmare into the place between dreams, a dreamer finds our wild mindscape and Reverie House.<br><br>When an unending nightmare threatens to consume this strange new home, Seeker must quickly master the art of dreamweaving before everything is lost to oblivion.",
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
    }

    init() {
        this.render();
        this.attachEventListeners();
        this.handleUrlParams();
        
        // Listen for OAuth events
        window.addEventListener('oauth:login', () => this.updateCanonPreview());
        window.addEventListener('oauth:logout', () => this.updateCanonPreview());
        window.addEventListener('oauth:profile-loaded', () => this.updateCanonPreview());
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
            <!-- Order Section (desktop: book widget left, order form right) -->
            <div class="order-section">
                <div class="order-content">
                    <!-- Content Row: left book widget + right order form -->
                    <div class="order-content-row">
                        <div class="order-left">
                            ${this.renderBookWidget()}
                        </div>
                        <div class="order-right">
                            ${this.renderOrderForm()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.renderSliderNotches();
        this.updateCanonPreview();
        this.handleMobileSynopsis();
    }

    handleMobileSynopsis() {
        const synopsisEl = document.querySelector('.order-synopsis');
        if (!synopsisEl) return;

        const updateSynopsis = () => {
            const fullText = synopsisEl.getAttribute('data-full-text');
            if (window.innerWidth <= 768) {
                // Show only first paragraph on mobile
                const firstPara = fullText.split('<br><br>')[0];
                synopsisEl.innerHTML = firstPara;
            } else {
                // Show full text on desktop
                synopsisEl.innerHTML = fullText;
            }
        };

        updateSynopsis();
        window.addEventListener('resize', updateSynopsis);
    }

    renderBookWidget() {
        const { title, coverImage, stats } = this.bookData;
        
        return `
            <div class="book-widget">
                <!-- Cover Art -->
                <div class="book-cover-container">
                    <img src="${coverImage}" 
                         alt="${title}" 
                         class="book-cover">
                </div>
                
                <!-- Book Stats -->
                <div class="book-stats">
                    <div class="stat-item"><b>Genre:</b> ${stats.genre}</div>
                    <div class="stat-item"><b>Length:</b> ${stats.length}</div>
                    <div class="stat-item"><b>Author:</b> <a href="/dreamer?did=${this.bookData.authorDid}" onclick="event.stopPropagation()">${this.bookData.author}</a></div>
                    <div class="stat-item"><b>Ages:</b> ${stats.ages}</div>
                    <div class="stat-item"><b>Binding:</b> ${stats.binding}</div>
                    <div class="stat-item"><b>Published:</b> ${stats.published}</div>
                    <div class="stat-item"><b>ASIN:</b> <span class="small-text">${stats.asin}</span></div>
                    <div class="stat-item"><b>ISBN:</b> <span class="small-text">${stats.isbn}</span></div>
                </div>
                
                <!-- Action Buttons -->
                <div class="action-buttons-container">
                    <button class="read-online-btn" onclick="event.stopPropagation(); orderWidget.handleReadOnline()">Read Online Now</button>
                    <button class="download-epub-btn" onclick="event.stopPropagation(); orderWidget.handleDownloadEpub()">Download ePub</button>
                    <button class="kindle-button" onclick="event.stopPropagation(); orderWidget.handleKindleClick()">Read on Kindle</button>
                </div>
            </div>
        `;
    }

    renderOrderForm() {
        return `
            <div class="order-form">
                <!-- Compact Cover (left) + Synopsis (right) inside a boxed container -->
                <div class="compact-box">
                    <div class="cover-description-row compact">
                        <div class="cover-art-small">
                            <img src="${this.bookData.coverImage}" 
                                 alt="${this.bookData.title}" 
                                 class="order-cover-small">
                        </div>
                        <div class="description-column">
                            <h2 class="order-title">${this.bookData.title}</h2>
                            <div class="order-synopsis" data-full-text="${this.bookData.synopsis.replace(/"/g, '&quot;')}">${this.bookData.synopsis}</div>
                        </div>
                    </div>
                </div>
                <!-- Quantity Slider -->
                <div class="quantity-section">
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
                               step="1">
                        <div class="slider-notches" id="slider-notches"></div>
                    </div>
                </div>
                <!-- Realizes & Price Row -->
                <div class="order-row-flex">
                    <div class="canon-preview" id="canon-preview">
                        <div class="canon-header">
                            <img id="canon-avatar" src="" alt="" class="canon-avatar">
                            <div class="canon-info">
                                <div id="canon-handle" class="canon-handle">@username</div>
                                <div class="canon-text">
                                    <span id="canon-name" class="canon-name">Name</span> realizes 
                                    <span id="canon-quantity">1</span> 
                                    <span id="canon-copies">book</span>
                                </div>
                            </div>
                        </div>
                        <div id="canon-notice" class="canon-notice">
                            Your support will be noted in the public canon.
                        </div>
                        <label class="canon-checkbox">
                            <input type="checkbox" id="anonymize-order">
                            <span id="anonymize-label">Make my order anonymous</span>
                        </label>
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
                    </div>
                </div>
                <!-- Shipping Notice -->
                <div class="shipping-notice">FREE WORLDWIDE SHIPPING</div>
                <!-- Order Button -->
                <button id="order-btn" class="order-btn">ORDER BOOKS</button>
                <!-- CC0 Notice -->
                <div class="cc0-notice-order">
                    All prior editions of texts by ${this.bookData.author} are dedicated to you through 
                    <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank">CC0 1.0</a> 
                    universal license. You may freely adapt or utilize these texts for commercial and/or 
                    non-commercial purposes. Authorial attribution to 
                    <a href="https://reverie.house">reverie.house</a> is appreciated.
                </div>
            </div>
        `;
    }

    renderPrincesSection() {
        return `
            <div class="princes-section">
                <div class="princes-container">
                    <div class="princes-content">
                        <img src="/books/princes/princes_reverie.png" 
                             alt="Prince's Reverie" 
                             class="princes-cover"
                             onclick="orderWidget.handlePrincesCoverClick()">
                        
                        <div class="princes-info">
                            <h3 class="princes-title">Prince's Reverie</h3>
                            <div class="princes-synopsis">
                                An enchanting prince with absolute power over his own reality discovers 
                                a way into our wild mindscape.<br><br>
                                What dreams and dreamweavers survive must contend.
                            </div>
                        </div>
                        
                        <div class="princes-request">
                            <p class="request-label">Advanced Readers</p>
                            <div class="request-form">
                                <input type="text" 
                                       id="request-name" 
                                       placeholder="Your name"
                                       class="request-input">
                                <input type="email" 
                                       id="request-email" 
                                       placeholder="your@email.com"
                                       class="request-input">
                                <button id="request-btn" class="request-btn">Request Copy</button>
                            </div>
                            <div id="request-message" class="request-message"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
            orderBtn.addEventListener('click', () => this.handleOrderClick());
            orderBtn.addEventListener('mouseenter', () => this.snapToFinalPrice());
        }

        // Anonymize checkbox
        const checkbox = document.getElementById('anonymize-order');
        if (checkbox) {
            checkbox.addEventListener('change', () => this.updateCanonPreview());
        }

        // Request copy button
        const requestBtn = document.getElementById('request-btn');
        if (requestBtn) {
            requestBtn.addEventListener('click', () => this.handleRequestCopy());
        }

        // Enter key on email input
        const emailInput = document.getElementById('request-email');
        if (emailInput) {
            emailInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleRequestCopy();
            });
        }
    }

    handleSliderChange(e) {
        this.currentSliderIndex = parseInt(e.target.value);
        this.quantity = this.quantityOptions[this.currentSliderIndex];
        
        // Calculate tilt for knob animation
        this.sliderVelocity = this.currentSliderIndex - this.lastSliderValue;
        this.lastSliderValue = this.currentSliderIndex;
        const tilt = Math.max(-15, Math.min(15, this.sliderVelocity * 8));
        e.target.style.setProperty('--slider-tilt', `${tilt}deg`);
        
        // Reset tilt
        setTimeout(() => {
            this.sliderVelocity *= 0.5;
            const settleTilt = Math.max(-15, Math.min(15, this.sliderVelocity * 8));
            e.target.style.setProperty('--slider-tilt', `${settleTilt}deg`);
            setTimeout(() => e.target.style.setProperty('--slider-tilt', '0deg'), 100);
        }, 50);

        this.updatePriceDisplay();
        this.updateCanonPreview();
    }

    updatePriceDisplay() {
        const quantityDisplay = document.getElementById('quantity-display');
        const copiesLabel = document.getElementById('copies-label');
        const quantityValue = document.getElementById('quantity-value');
        const totalPrice = document.getElementById('total-price');

        if (quantityDisplay) {
            quantityDisplay.textContent = this.quantity;
            quantityDisplay.classList.remove('quantity-bump');
            void quantityDisplay.offsetWidth;
            quantityDisplay.classList.add('quantity-bump');
        }

        if (copiesLabel) {
            copiesLabel.textContent = this.quantity === 1 ? 'Copy' : 'Copies';
            copiesLabel.classList.remove('quantity-bump');
            void copiesLabel.offsetWidth;
            copiesLabel.classList.add('quantity-bump');
        }

        if (quantityValue) {
            quantityValue.textContent = this.quantity;
        }

        if (totalPrice) {
            this.targetTotal = this.quantity * this.unitPrice;
            this.animatePrice(totalPrice);
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
            
            let easeMultiplier = distance > 100 ? 0.08 :
                               distance > 50 ? 0.18 :
                               distance > 20 ? 0.25 :
                               distance > 10 ? 0.22 :
                               distance > 5 ? 0.18 :
                               distance > 2 ? 0.14 :
                               distance > 0.25 ? 0.10 : 0.05;

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

    updateCanonPreview() {
        const session = window.oauthManager?.getSession();
        const checkbox = document.getElementById('anonymize-order');
        const isAnonymous = !session || checkbox?.checked;

        // Update avatar
        const avatar = document.getElementById('canon-avatar');
        if (avatar) {
            avatar.src = isAnonymous ? '/assets/icon_face.png' : (session?.avatar || '/assets/icon_face.png');
            avatar.alt = isAnonymous ? 'Anonymous' : (session?.displayName || 'Dreamer');
        }

        // Update handle
        const handle = document.getElementById('canon-handle');
        if (handle) {
            handle.textContent = '@' + (isAnonymous ? 'reverie.house' : (session?.handle || 'dreamer'));
        }

        // Update name
        const name = document.getElementById('canon-name');
        if (name) {
            name.textContent = isAnonymous ? 'a dreamer' : (session?.displayName || session?.handle || 'Dreamer');
        }

        // Update quantity text
        const quantitySpan = document.getElementById('canon-quantity');
        const copiesSpan = document.getElementById('canon-copies');
        if (quantitySpan && copiesSpan) {
            const numberWords = {
                1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
                6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
                15: 'fifteen', 20: 'twenty', 25: 'twenty five',
                50: 'fifty', 75: 'seventy five', 100: 'one hundred'
            };
            quantitySpan.textContent = numberWords[this.quantity] || this.quantity;
            copiesSpan.textContent = this.quantity === 1 ? 'book' : 'books';
        }

        // Update notice
        const notice = document.getElementById('canon-notice');
        if (notice) {
            notice.textContent = isAnonymous 
                ? 'Anonymous support will be noted in the public canon.'
                : 'Your support will be noted in the public canon.';
            notice.style.color = isAnonymous ? '#777' : '#555';
        }

        // Update checkbox label
        const label = document.getElementById('anonymize-label');
        if (label && !session) {
            label.textContent = 'Anonymous';
        }

        // Show login link if not logged in
        if (!session && checkbox) {
            checkbox.checked = true;
            checkbox.disabled = true;
            checkbox.style.opacity = '0.5';
            
            const checkboxLabel = checkbox.closest('.canon-checkbox');
            if (checkboxLabel && !checkboxLabel.querySelector('.login-link')) {
                const loginLink = document.createElement('a');
                loginLink.className = 'login-link';
                loginLink.href = '#';
                loginLink.textContent = 'Login';
                loginLink.onclick = (e) => {
                    e.preventDefault();
                    if (window.LoginWidget) new LoginWidget();
                };
                checkboxLabel.style.display = 'flex';
                checkboxLabel.style.justifyContent = 'space-between';
                checkboxLabel.appendChild(loginLink);
            }
        } else if (checkbox) {
            checkbox.disabled = false;
            checkbox.style.opacity = '1';
        }
    }

    async handleOrderClick() {
        const orderBtn = document.getElementById('order-btn');
        if (!orderBtn) return;

        this.triggerConfetti(orderBtn);

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

            if (!response.ok) throw new Error('Failed to create checkout session');

            const data = await response.json();
            if (data.url) {
                window.open(data.url, '_blank', 'noopener,noreferrer');
            } else {
                throw new Error('No checkout URL received');
            }
        } catch (error) {
            console.error('Order error:', error);
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
                        vy += 0.25; // gravity
                        rotation += 12;
                        opacity -= 0.018;
                        
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

    handlePrincesCoverClick() {
        if (window.booksWidget) {
            window.booksWidget.showBookTOC('princes-reverie');
        }
    }

    handleReadOnline() {
        window.location.href = this.bookData.readOnlineUrl;
    }

    handleDownloadEpub() {
        window.location.href = this.bookData.epubUrl;
    }

    async handleKindleClick() {
        const link = await (window.getRegionalAmazonLink?.() || 'https://amazon.com');
        window.open(link, '_blank');
    }

    async handleRequestCopy() {
        const nameInput = document.getElementById('request-name');
        const emailInput = document.getElementById('request-email');
        const messageDiv = document.getElementById('request-message');

        if (!nameInput || !emailInput || !messageDiv) return;

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();

        if (!name) {
            this.showRequestMessage('Please enter your name.', 'error');
            return;
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showRequestMessage('Please enter a valid email.', 'error');
            return;
        }

        const subject = encodeURIComponent("Request for Prince's Reverie Advance Copy");
        const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nI would like to request an advance copy of Prince's Reverie.`);
        window.open(`mailto:books@reverie.house?subject=${subject}&body=${body}`, '_blank');

        this.showRequestMessage('Opening email client...', 'success');
        setTimeout(() => {
            nameInput.value = '';
            emailInput.value = '';
            messageDiv.style.display = 'none';
        }, 2000);
    }

    showRequestMessage(text, type) {
        const messageDiv = document.getElementById('request-message');
        if (!messageDiv) return;

        messageDiv.textContent = text;
        messageDiv.className = `request-message ${type}`;
        messageDiv.style.display = 'block';

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    }

    async showSuccessMessage(sessionId) {
        // Implementation for success popup (kept from original)
        console.log('Order success:', sessionId);
    }

    showCancelMessage() {
        // Implementation for cancel popup (kept from original)
        console.log('Order canceled');
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.orderWidget = new OrderWidget();
    window.orderWidget.init();
    console.log('✅ Order widget initialized');
});
