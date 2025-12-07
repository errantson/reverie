
class PrintWidget {
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
    }
    init() {
        this.renderPage();
        this.attachEventListeners();
        this.handleUrlParams();
        window.addEventListener('oauth:login', () => {
            console.log('🔔 print.js received oauth:login event');
            this.updateCanonPreview();
        });
        window.addEventListener('oauth:logout', () => {
            console.log('🔔 print.js received oauth:logout event');
            this.updateCanonPreview();
        });
        window.addEventListener('oauth:profile-loaded', () => {
            console.log('🔔 print.js received oauth:profile-loaded event');
            this.updateCanonPreview();
        });
    }
    handleUrlParams() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('success')) {
            const sessionId = params.get('session_id');
            this.showSuccessMessage(sessionId);
        } else if (params.get('canceled')) {
            this.showCancelMessage();
        }
    }
    async showSuccessMessage(sessionId) {
        const container = document.querySelector('.print-content');
        if (!container) return;
        let orderDetails = null;
        if (sessionId) {
            try {
                const response = await fetch(`/api/stripe/order-details/${sessionId}`);
                if (response.ok) {
                    orderDetails = await response.json();
                }
            } catch (e) {
                console.error('Failed to fetch order details:', e);
            }
        }
        const oldPopup = document.getElementById('order-success-popup');
        if (oldPopup) oldPopup.remove();
        const popup = document.createElement('div');
        popup.id = 'order-success-popup';
        popup.style.position = 'fixed';
        popup.style.top = '0';
        popup.style.left = '0';
        popup.style.width = '100vw';
        popup.style.height = '100vh';
        popup.style.background = 'rgba(0,0,0,0.08)';
        popup.style.display = 'flex';
        popup.style.alignItems = 'center';
        popup.style.justifyContent = 'center';
        popup.style.zIndex = '9999';
        const box = document.createElement('div');
        box.style.background = '#fff';
        box.style.border = '1px solid hsl(270, 35%, 75%)';
        box.style.borderRadius = '0';
        box.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        box.style.padding = '30px 35px';
        box.style.maxWidth = '540px';
        box.style.textAlign = 'left';
        const header = document.createElement('div');
        header.textContent = 'Order Confirmed';
        header.style.color = 'hsl(270, 25%, 45%)';
        header.style.fontWeight = 'bold';
        header.style.fontSize = '1.18em';
        header.style.marginBottom = '20px';
        header.style.textAlign = 'center';
        box.appendChild(header);
        if (orderDetails) {
            if (orderDetails.customer_name) {
                const nameDiv = document.createElement('div');
                nameDiv.textContent = orderDetails.customer_name;
                nameDiv.style.fontSize = '1.1em';
                nameDiv.style.fontWeight = 'bold';
                nameDiv.style.color = '#333';
                nameDiv.style.marginBottom = '5px';
                nameDiv.style.textAlign = 'center';
                box.appendChild(nameDiv);
            }
            const emailDiv = document.createElement('div');
            emailDiv.textContent = orderDetails.customer_email;
            emailDiv.style.fontSize = '0.9em';
            emailDiv.style.color = '#666';
            emailDiv.style.marginBottom = '18px';
            emailDiv.style.textAlign = 'center';
            box.appendChild(emailDiv);
            const bookSection = document.createElement('div');
            bookSection.style.display = 'flex';
            bookSection.style.gap = '20px';
            bookSection.style.background = '#faf9fc';
            bookSection.style.border = '1px solid #e8e6f5';
            bookSection.style.padding = '15px';
            bookSection.style.marginBottom = '15px';
            bookSection.style.alignItems = 'center';
            const coverImg = document.createElement('img');
            coverImg.src = '/books/seeker/seekers_reverie.png';
            coverImg.alt = "Seeker's Reverie";
            coverImg.style.width = '80px';
            coverImg.style.height = 'auto';
            coverImg.style.flexShrink = '0';
            bookSection.appendChild(coverImg);
            const detailsDiv = document.createElement('div');
            detailsDiv.style.flex = '1';
            detailsDiv.style.fontSize = '0.9em';
            detailsDiv.style.lineHeight = '1.6';
            const unitPrice = orderDetails.amount / orderDetails.quantity;
            const formattedTotal = orderDetails.amount.toFixed(2);
            detailsDiv.innerHTML = `
                <div style="font-weight:600;color:#333;margin-bottom:10px;font-size:1.05em;">Seeker's Reverie</div>
                <div style="margin-bottom:6px;color:#555;">
                    <strong>${orderDetails.quantity}</strong> ${orderDetails.quantity === 1 ? 'copy' : 'copies'} × <strong>$${unitPrice.toFixed(2)}</strong>
                </div>
                <div style="font-size:1.1em;font-weight:bold;color:var(--primary);margin-top:8px;">
                    Total: $${formattedTotal} ${orderDetails.currency}
                </div>
            `;
            bookSection.appendChild(detailsDiv);
            box.appendChild(bookSection);
            const refDiv = document.createElement('div');
            refDiv.style.fontSize = '0.8em';
            refDiv.style.color = '#888';
            refDiv.style.marginBottom = '15px';
            refDiv.style.textAlign = 'center';
            refDiv.innerHTML = `Order #${orderDetails.order_id} · Canon entry #${orderDetails.canon_id}`;
            box.appendChild(refDiv);
        }
        const msg = document.createElement('div');
        msg.innerHTML = orderDetails 
            ? 'Thank you for supporting Reverie House!<br>You\'ll receive a confirmation email with tracking details.'
            : 'Thank you for your order!<br>You\'ll receive a confirmation email shortly.';
        msg.style.color = '#666';
        msg.style.fontSize = '0.9em';
        msg.style.lineHeight = '1.6';
        msg.style.marginBottom = '18px';
        msg.style.textAlign = 'center';
        box.appendChild(msg);
        const session = window.oauthManager?.session;
        if (session && orderDetails && !orderDetails.anonymous) {
            const canonPreview = document.createElement('div');
            canonPreview.style.background = '#f8f6fc';
            canonPreview.style.border = '1px solid #d0c7f0';
            canonPreview.style.padding = '15px';
            canonPreview.style.marginBottom = '18px';
            canonPreview.style.fontSize = '0.85em';
            canonPreview.style.lineHeight = '1.5';
            const profile = window.oauthManager?.profile;
            const avatarUrl = profile?.avatar || '/assets/icon_face.png';
            const displayName = profile?.displayName || session.handle?.replace('.reverie.house', '') || 'dreamer';
            const handle = session.handle || 'reverie.house';
            canonPreview.innerHTML = `
                <div style="font-weight:600;color:var(--primary);margin-bottom:10px;font-size:0.95em;">Your Canon Entry</div>
                <div style="display:flex;align-items:start;gap:10px;">
                    <img src="${avatarUrl}" alt="${displayName}" style="width:32px;height:32px;border-radius:50%;border:1.5px solid var(--primary);">
                    <div style="flex:1;">
                        <div style="font-weight:600;color:#333;">${displayName}</div>
                        <div style="color:#666;font-size:0.9em;margin-bottom:8px;">@${handle}</div>
                        <div style="color:#555;">
                            Ordered ${orderDetails.quantity} ${orderDetails.quantity === 1 ? 'copy' : 'copies'} of <strong>Seeker's Reverie</strong> from Reverie House
                        </div>
                    </div>
                </div>
            `;
            box.appendChild(canonPreview);
        } else if (orderDetails && orderDetails.anonymous) {
            const canonPreview = document.createElement('div');
            canonPreview.style.background = '#f8f6fc';
            canonPreview.style.border = '1px solid #d0c7f0';
            canonPreview.style.padding = '15px';
            canonPreview.style.marginBottom = '18px';
            canonPreview.style.fontSize = '0.85em';
            canonPreview.style.lineHeight = '1.5';
            canonPreview.innerHTML = `
                <div style="font-weight:600;color:var(--primary);margin-bottom:10px;font-size:0.95em;">Canon Entry</div>
                <div style="display:flex;align-items:start;gap:10px;">
                    <img src="/assets/icon_face.png" alt="Anonymous" style="width:32px;height:32px;border-radius:50%;border:1.5px solid var(--primary);">
                    <div style="flex:1;">
                        <div style="font-weight:600;color:#333;">a dreamer</div>
                        <div style="color:#666;font-size:0.9em;margin-bottom:8px;">@reverie.house</div>
                        <div style="color:#555;">
                            Ordered ${orderDetails.quantity} ${orderDetails.quantity === 1 ? 'copy' : 'copies'} of <strong>Seeker's Reverie</strong> from Reverie House
                        </div>
                    </div>
                </div>
            `;
            box.appendChild(canonPreview);
        }
        if (session) {
            const shareBtn = document.createElement('button');
            shareBtn.innerHTML = `
                <img src="/assets/bluesky.png" alt="Bluesky" style="width:16px;height:16px;margin-right:6px;vertical-align:middle;">
                Share on Bluesky
            `;
            shareBtn.style.background = '#4299e1';
            shareBtn.style.color = 'white';
            shareBtn.style.border = 'none';
            shareBtn.style.borderRadius = '0';
            shareBtn.style.fontWeight = 'bold';
            shareBtn.style.fontSize = '0.9em';
            shareBtn.style.padding = '9px 20px';
            shareBtn.style.cursor = 'pointer';
            shareBtn.style.width = '100%';
            shareBtn.style.marginBottom = '10px';
            shareBtn.style.display = 'flex';
            shareBtn.style.alignItems = 'center';
            shareBtn.style.justifyContent = 'center';
            shareBtn.onmouseover = () => shareBtn.style.background = '#3182ce';
            shareBtn.onmouseout = () => shareBtn.style.background = '#4299e1';
            shareBtn.onclick = () => {
                const shareText = "Just ordered Seeker's Reverie from Reverie House! ✨📚\n\nreverie.house/order";
                const url = `https://bsky.app/intent/compose?text=${encodeURIComponent(shareText)}`;
                window.open(url, '_blank');
            };
            box.appendChild(shareBtn);
        }
        const btn = document.createElement('button');
        btn.textContent = 'Continue';
        btn.style.background = '#fff';
        btn.style.color = 'hsl(270, 30%, 40%)';
        btn.style.border = '1px solid hsl(270, 35%, 70%)';
        btn.style.borderRadius = '0';
        btn.style.fontWeight = 'bold';
        btn.style.fontSize = '1em';
        btn.style.padding = '8px 22px';
        btn.style.cursor = 'pointer';
        btn.style.width = '100%';
        btn.onmouseover = () => btn.style.background = 'hsl(270, 35%, 97%)';
        btn.onmouseout = () => btn.style.background = '#fff';
        btn.onclick = () => {
            popup.remove();
            window.history.replaceState({}, '', '/order');
        };
        box.appendChild(btn);
        popup.appendChild(box);
        document.body.appendChild(popup);
    }
    showCancelMessage() {
        const container = document.querySelector('.print-content');
        if (!container) return;
        const oldPopup = document.getElementById('order-cancel-popup');
        if (oldPopup) oldPopup.remove();
        const popup = document.createElement('div');
        popup.id = 'order-cancel-popup';
        popup.style.position = 'fixed';
        popup.style.top = '0';
        popup.style.left = '0';
        popup.style.width = '100vw';
        popup.style.height = '100vh';
        popup.style.background = 'rgba(0,0,0,0.08)';
        popup.style.display = 'flex';
        popup.style.alignItems = 'center';
        popup.style.justifyContent = 'center';
        popup.style.zIndex = '9999';
        const box = document.createElement('div');
        box.style.background = '#fff';
        box.style.border = '1px solid hsl(270, 35%, 75%)';
        box.style.borderRadius = '0';
        box.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        box.style.padding = '32px 32px 24px 32px';
        box.style.maxWidth = '340px';
        box.style.textAlign = 'center';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.alignItems = 'center';
        const header = document.createElement('div');
        header.textContent = 'Order Canceled';
        header.style.color = 'hsl(270, 25%, 45%)';
        header.style.fontWeight = 'bold';
        header.style.fontSize = '1.18em';
        header.style.marginBottom = '10px';
        box.appendChild(header);
        const msg = document.createElement('div');
        msg.innerHTML = 'Your order was canceled.<br>No charges were made.';
        msg.style.color = '#666';
        msg.style.fontSize = '1em';
        msg.style.lineHeight = '1.5';
        msg.style.marginBottom = '18px';
        box.appendChild(msg);
        const btn = document.createElement('button');
        btn.textContent = 'Try Again';
        btn.style.background = '#fff';
        btn.style.color = 'hsl(270, 30%, 40%)';
        btn.style.border = '1px solid hsl(270, 35%, 70%)';
        btn.style.borderRadius = '0';
        btn.style.fontWeight = 'bold';
        btn.style.fontSize = '1em';
        btn.style.padding = '8px 22px';
        btn.style.cursor = 'pointer';
        btn.onmouseover = () => btn.style.background = 'hsl(270, 35%, 97%)';
        btn.onmouseout = () => btn.style.background = '#fff';
        btn.onclick = () => {
            popup.remove();
            window.history.replaceState({}, '', '/order');
        };
        box.appendChild(btn);
        popup.appendChild(box);
        document.body.appendChild(popup);
    }
    renderPage() {
        const container = document.querySelector('.print-content');
        if (!container) return;
        container.innerHTML = `
            <div class="order-section" style="background:#faf7fc;padding:32px 16px;">
                <div class="order-content" style="gap:32px;display:flex;max-width:820px;margin:0 auto;align-items:stretch;">
                    <div class="order-left" style="display:flex;flex-direction:column;">
                        <div class="book-stack" style="max-width:340px;margin:0 auto;display:flex;flex-direction:column;align-items:center;flex:1;">
                            <img src="/books/seeker/seekers_reverie.png" alt="Seeker's Reverie" class="showcase-cover" style="width:100%;max-width:340px;display:block;margin:0 auto 0 auto;border:none;box-shadow:none;transition:transform 0.3s ease;">
                            <div class="book-stats-grid">
                                <div class="mobile-first-print-label" style="display:none;grid-column:1/-1;text-align:center;font-weight:bold;color:#000;font-size:0.95rem;letter-spacing:0.02em;margin-bottom:8px;margin-top:3px;">FIRST PRINT EDITION</div>
                                <div><b>Genre:</b> Fantasy</div><div><b>Length:</b> 155 pages</div>
                                <div><b>Author:</b> <a href="/dreamer?did=errantson" style="color:inherit;text-decoration:none;">errantson</a></div><div><b>Ages:</b> 16+</div>
                                <div><b>Binding:</b> Softcover</div><div><b>Published:</b> 29/03/25</div>
                                <div><b>ASIN:</b> <span style="font-size:0.88rem;word-break:break-all;">B0F2ST7CXZ</span></div><div><b>ISBN:</b> <span style="font-size:0.88rem;">Undeclared</span></div>
                            </div>
                            <div class="action-buttons-container">
                                <button class="read-online-btn" onclick="printWidget?.handleReadOnlineClick()">Read Online Now</button>
                                <button class="download-epub-btn" onclick="window.location.href='/books/seeker/seekers_reverie.epub'">Download ePub</button>
                                <button class="kindle-button" onclick="openRegionalAmazonLink()">Read on Kindle</button>
                                <div class="cc0-notice" style="margin-top:auto;">
                                    All prior editions of texts by errantson are dedicated to you through <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank">CC0 1.0</a> universal license. You may freely adapt or utilize these texts for commercial and/or non-commercial purposes. Authorial attribution to <a href="https://reverie.house">reverie.house</a> is appreciated.
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="order-right">
                        <div class="order-form">
                            <h2 class="book-title" style="margin-top:-25px;font-size:2.25rem;">Seeker's Reverie</h2>
                            <div class="synopsisbox" style="padding:12px 14px;font-size:0.86rem;line-height:1.5;">
                                After falling into a place between dreams, a lost dreamer discovers our wild mindscape and Reverie House.<br><br>
                                When an unending nightmare threatens to consume this strange new home, Seeker must quickly master the art of dreamweaving before everything is lost to oblivion.
                            </div>
                            <!-- Canon Preview with Privacy Checkbox (always visible) -->
                            <div id="canon-preview-container">
                                <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                                    <img id="canon-preview-avatar" src="" alt="" style="width:36px;height:36px;border-radius:50%;border:2px solid #87408d;object-fit:cover;flex-shrink:0;">
                                    <div style="flex:1;">
                                        <div id="canon-preview-handle" style="font-size:0.75rem;color:#999;margin-bottom:2px;">@username</div>
                                        <div style="font-style:italic;color:#555;font-size:0.88rem;">
                                            <span id="canon-preview-name" style="font-weight:500;">Name</span> realizes <span id="canon-preview-quantity">1</span> <span id="canon-preview-copies">book</span>
                                        </div>
                                    </div>
                                </div>
                                <div id="canon-public-notice" style="font-size:0.82rem;color:#555;padding:8px 10px;background:#fff;border-radius:3px;margin-bottom:10px;">
                                    Your support will be noted in the public canon.
                                </div>
                                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.85rem;padding:6px 0;">
                                    <input type="checkbox" id="anonymize-order" style="width:15px;height:15px;cursor:pointer;flex-shrink:0;">
                                    <span style="color:#666;">Make my order anonymous</span>
                                </label>
                            </div>
                            <div class="quantity-slider-container">
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
                                <label for="quantity-slider" style="margin-top:-21px;font-size:0.85rem;"><span id="quantity-display">1</span> <span id="copies-label">Copy</span></label>
                            </div>
                            <div class="price-display">
                                <div class="price-row">
                                    <span class="price-label">Unit Price:</span>
                                    <span class="price-value">$${this.unitPrice.toFixed(2)} USD</span>
                                </div>
                                <div class="price-row">
                                    <span class="price-label">Quantity:</span>
                                    <span class="price-value" id="quantity-display-price">1</span>
                                </div>
                                <div class="price-row total-row">
                                    <span class="price-label">Total:</span>
                                    <span class="price-value total-price" id="total-price">$${this.unitPrice.toFixed(2)} USD</span>
                                </div>
                            </div>
                            <div class="first-print-label" style="margin-top:-10px;">First Print Edition</div>
                            <div class="free-shipping-banner">FREE WORLDWIDE SHIPPING</div>
                            <button id="order-now-btn" class="order-now-btn">
                                Order Print Editions
                            </button>
                            <p class="order-note">
                                Secure payment processing via Stripe<br>
                                <small>Questions? Contact <a href="mailto:books@reverie.house">books@reverie.house</a></small>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Prince's Reverie Section -->
            <div class="princes-section" style="background:#fff8f8;border-top:1px solid #ddd;padding:28px 20px;">
                <div style="max-width:820px;margin:0 auto;">
                    <div style="display:flex;gap:32px;align-items:stretch;">
                        <img src="/books/princes/princes_reverie.png" alt="Prince's Reverie" class="princes-cover" style="width:auto;height:200px;flex-shrink:0;border-radius:3px;box-shadow:0 2px 6px rgba(0,0,0,0.08);cursor:pointer;">
                        <div style="flex:1;max-width:440px;display:flex;flex-direction:column;">
                            <h3 style="color:#8b0000;margin:0 0 14px 0;font-size:1.3rem;">Prince's Reverie</h3>
                            <div class="synopsisbox" style="margin:0;font-size:0.84rem;flex:1;display:flex;align-items:center;padding:14px 16px;">
                                <div>An enchanting prince with absolute power over his own reality discovers a way into our wild mindscape.<br><br>
                                What dreams and dreamweavers survive must contend.</div>
                            </div>
                        </div>
                        <div style="margin-top:10px;width:240px;flex-shrink:0;margin-left:auto;display:flex;flex-direction:column;align-items:center;padding-top:0;">
                            <p style="margin:0 0 12px 0;font-size:0.88rem;color:#555;font-weight:600;text-align:center;">Advanced Readers</p>
                            <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:8px;width:200px;align-items:center;">
                                <input type="text" 
                                       id="request-name" 
                                       placeholder="Your name"
                                       style="width:100%;padding:8px 11px;border:1px solid #ccc;border-radius:0;font-size:0.88rem;text-align:center;">
                                <input type="email" 
                                       id="request-email" 
                                       placeholder="your@email.com"
                                       style="width:100%;padding:8px 11px;border:1px solid #ccc;border-radius:0;font-size:0.88rem;text-align:center;">
                                <button id="request-copy-btn" class="request-copy-btn">Request Copy</button>
                            </div>
                            <div id="request-message" style="font-size:0.84rem;text-align:center;min-height:1.2em;visibility:hidden;width:200px;">&nbsp;</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.renderSliderNotches();
        this.updateCanonPreview();
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
    async updateCanonPreview() {
        console.log('🎨 updateCanonPreview() called');
        const container = document.getElementById('canon-preview-container');
        console.log('   Container element:', container);
        if (!container) return;
        let session = null;
        if (window.oauthManager) {
            try {
                session = window.oauthManager.getSession();
                console.log('   Session:', session);
            } catch (e) {
                console.log('   Error getting session:', e);
            }
        }
        container.style.display = 'block';
        const anonymizeCheckbox = document.getElementById('anonymize-order');
        const publicNotice = document.getElementById('canon-public-notice');
        const avatarImg = document.getElementById('canon-preview-avatar');
        const handleDiv = document.getElementById('canon-preview-handle');
        const nameSpan = document.getElementById('canon-preview-name');
        const checkboxLabel = document.querySelector('label[for="anonymize-order"]');
        if (!session || !session.did) {
            console.log('❌ Not logged in - showing anonymous mode');
            if (anonymizeCheckbox) {
                anonymizeCheckbox.checked = true;
                anonymizeCheckbox.disabled = true;
                anonymizeCheckbox.style.opacity = '0.5';
            }
            if (checkboxLabel) {
                const labelSpan = checkboxLabel.querySelector('span');
                if (labelSpan) {
                    labelSpan.textContent = 'Anonymous (no login required)';
                    labelSpan.style.color = '#777';
                }
                if (!checkboxLabel.querySelector('.dreamweaver-login-link')) {
                    const loginLink = document.createElement('a');
                    loginLink.className = 'dreamweaver-login-link';
                    loginLink.href = '#';
                    loginLink.textContent = 'Dreamweaver Login';
                    loginLink.style.cssText = 'margin-left: auto; color: var(--primary); text-decoration: none; font-size: 0.9rem; font-weight: 500;';
                    loginLink.addEventListener('mouseover', () => {
                        loginLink.style.textDecoration = 'underline';
                    });
                    loginLink.addEventListener('mouseout', () => {
                        loginLink.style.textDecoration = 'none';
                    });
                    loginLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (window.LoginWidget) {
                            new LoginWidget();
                        }
                    });
                    checkboxLabel.style.display = 'flex';
                    checkboxLabel.style.alignItems = 'center';
                    checkboxLabel.appendChild(loginLink);
                }
            }
            if (publicNotice) {
                publicNotice.textContent = 'Anonymous support will be noted in the public canon.';
                publicNotice.style.color = '#777';
            }
            if (avatarImg) {
                avatarImg.src = '/assets/icon_face.png';
                avatarImg.alt = 'Anonymous';
            }
            if (handleDiv) {
                handleDiv.textContent = '@reverie.house';
            }
            if (nameSpan) {
                nameSpan.textContent = 'a dreamer';
            }
            this.updateCanonPreviewQuantity();
            return;
        }
        console.log('✅ Showing canon preview for', session.did);
        if (anonymizeCheckbox) {
            anonymizeCheckbox.disabled = false;
            anonymizeCheckbox.style.opacity = '1';
        }
        if (checkboxLabel) {
            const labelSpan = checkboxLabel.querySelector('span');
            if (labelSpan) {
                labelSpan.textContent = 'Make my order anonymous';
                labelSpan.style.color = '#666';
            }
        }
        const isAnonymous = anonymizeCheckbox && anonymizeCheckbox.checked;
        if (publicNotice) {
            if (isAnonymous) {
                publicNotice.textContent = 'Anonymous support will be noted in the public canon.';
                publicNotice.style.color = '#777';
            } else {
                publicNotice.textContent = 'Your support will be noted in the public canon.';
                publicNotice.style.color = '#555';
            }
        }
        if (isAnonymous) {
            if (avatarImg) {
                avatarImg.src = '/assets/icon_face.png';
                avatarImg.alt = 'Anonymous';
            }
            if (handleDiv) {
                handleDiv.textContent = '@reverie.house';
            }
            if (nameSpan) {
                nameSpan.textContent = 'a dreamer';
            }
        } else {
            if (avatarImg) {
                avatarImg.src = session.avatar || '/assets/icon_face.png';
                avatarImg.alt = session.displayName || session.handle || 'Dreamer';
            }
            if (handleDiv) {
                handleDiv.textContent = '@' + (session.handle || 'dreamer');
            }
            if (nameSpan) {
                nameSpan.textContent = session.displayName || session.handle || 'Dreamer';
            }
        }
        this.updateCanonPreviewQuantity();
    }
    updateCanonPreviewQuantity() {
        const quantitySpan = document.getElementById('canon-preview-quantity');
        const copiesSpan = document.getElementById('canon-preview-copies');
        if (quantitySpan && copiesSpan) {
            const numberWords = {
                1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
                6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
                15: 'fifteen', 20: 'twenty', 25: 'twenty five', 
                50: 'fifty', 75: 'seventy five', 100: 'one hundred'
            };
            const quantityText = numberWords[this.quantity] || this.quantity;
            quantitySpan.textContent = quantityText;
            copiesSpan.textContent = this.quantity === 1 ? 'book' : 'books';
        }
    }
    handleReadOnlineClick() {
        window.location.href = 'https://reverie.house/books/seeker/00';
    }
    attachEventListeners() {
        const quantitySlider = document.getElementById('quantity-slider');
        const orderBtn = document.getElementById('order-now-btn');
        const requestCopyBtn = document.getElementById('request-copy-btn');
        const requestName = document.getElementById('request-name');
        const requestEmail = document.getElementById('request-email');
        const coverArt = document.querySelector('.showcase-cover');
        const princesCover = document.querySelector('.princes-cover');
        if (coverArt) {
            coverArt.addEventListener('click', () => {
                // On mobile, redirect to chapter
                if (window.innerWidth <= 768) {
                    window.location.href = '/books/seekers/00';
                    return;
                }
                
                coverArt.style.animation = 'none';
                setTimeout(() => {
                    coverArt.style.animation = 'jostle 0.3s ease';
                }, 10);
                if (window.booksWidget) {
                    window.booksWidget.showBookTOC('seekers-reverie');
                }
            });
            coverArt.addEventListener('animationend', () => {
                coverArt.style.animation = '';
            });
        }
        if (princesCover) {
            princesCover.addEventListener('click', () => {
                princesCover.style.animation = 'none';
                setTimeout(() => {
                    princesCover.style.animation = 'jostle 0.3s ease';
                }, 10);
                if (window.booksWidget) {
                    window.booksWidget.showBookTOC('princes-reverie');
                }
            });
            princesCover.addEventListener('animationend', () => {
                princesCover.style.animation = '';
            });
        }
        if (quantitySlider) {
            quantitySlider.addEventListener('input', (e) => {
                this.currentSliderIndex = parseInt(e.target.value);
                this.quantity = this.quantityOptions[this.currentSliderIndex];
                this.sliderVelocity = this.currentSliderIndex - this.lastSliderValue;
                this.lastSliderValue = this.currentSliderIndex;
                const tilt = Math.max(-15, Math.min(15, this.sliderVelocity * 8));
                e.target.style.setProperty('--slider-tilt', `${tilt}deg`);
                this.updatePriceDisplay();
                this.updateCanonPreviewQuantity();
                setTimeout(() => {
                    this.sliderVelocity *= 0.5;
                    const settleTilt = Math.max(-15, Math.min(15, this.sliderVelocity * 8));
                    e.target.style.setProperty('--slider-tilt', `${settleTilt}deg`);
                    setTimeout(() => {
                        e.target.style.setProperty('--slider-tilt', '0deg');
                    }, 100);
                }, 50);
            });
        }
        if (orderBtn) {
            const handleOrderClick = () => {
                this.triggerConfetti(orderBtn);
                this.handleOrderNow();
            };
            orderBtn.addEventListener('click', handleOrderClick);
            orderBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                handleOrderClick();
            });
            orderBtn.addEventListener('mouseenter', () => {
                this.snapToFinalPrice();
            });
        }
        if (requestCopyBtn) {
            requestCopyBtn.addEventListener('click', () => {
                this.handleRequestCopy();
            });
        }
        if (requestEmail) {
            requestEmail.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleRequestCopy();
                }
            });
        }
        const anonymizeCheckbox = document.getElementById('anonymize-order');
        if (anonymizeCheckbox) {
            anonymizeCheckbox.addEventListener('change', () => {
                this.updateCanonPreview();
            });
        }
    }
    updatePriceDisplay() {
        const quantityDisplay = document.getElementById('quantity-display');
        const copiesLabel = document.getElementById('copies-label');
        const quantityDisplayPrice = document.getElementById('quantity-display-price');
        const totalPrice = document.getElementById('total-price');
        const total = (this.quantity * this.unitPrice).toFixed(2);
        if (quantityDisplay && copiesLabel) {
            quantityDisplay.textContent = this.quantity;
            copiesLabel.textContent = this.quantity === 1 ? 'Copy' : 'Copies';
            quantityDisplay.classList.remove('quantity-bump');
            copiesLabel.classList.remove('quantity-bump');
            void quantityDisplay.offsetWidth;
            quantityDisplay.classList.add('quantity-bump');
            copiesLabel.classList.add('quantity-bump');
        }
        if (quantityDisplayPrice) {
            quantityDisplayPrice.textContent = this.quantity;
        }
        if (totalPrice) {
            this.targetTotal = parseFloat(total);
            this.startPriceAnimation(totalPrice);
        }
    }
    startPriceAnimation(totalPriceElement) {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.isAnimating = true;
        totalPriceElement.classList.add('price-animating');
        const animate = () => {
            const diff = this.targetTotal - this.animatedTotal;
            const distance = Math.abs(diff);
            let easeMultiplier;
            if (distance > 100) {
                easeMultiplier = 0.08;
            } else if (distance > 50) {
                easeMultiplier = 0.18;
            } else if (distance > 20) {
                easeMultiplier = 0.25;
            } else if (distance > 10) {
                easeMultiplier = 0.22;
            } else if (distance > 5) {
                easeMultiplier = 0.18;
            } else if (distance > 2) {
                easeMultiplier = 0.14;
            } else if (distance > 0.25) {
                easeMultiplier = 0.10;
            } else {
                easeMultiplier = 0.05;
            }
            const step = diff * easeMultiplier;
            if (Math.abs(diff) < 0.01) {
                this.animatedTotal = this.targetTotal;
                this.isAnimating = false;
                totalPriceElement.classList.remove('price-animating');
                totalPriceElement.textContent = `$${this.animatedTotal.toFixed(2)} USD`;
                return;
            }
            this.animatedTotal += step;
            totalPriceElement.textContent = `$${this.animatedTotal.toFixed(2)} USD`;
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
    triggerConfetti(button) {
        const colors = ['#87408d', '#000080', '#ff9900', '#00cc88', '#ff6b9d'];
        const buttonRect = button.getBoundingClientRect();
        const sprayPoints = [
            { x: buttonRect.left + 10, y: buttonRect.top + 10 },
            { x: buttonRect.right - 10, y: buttonRect.top + 10 },
            { x: buttonRect.left + 10, y: buttonRect.bottom - 10 },
            { x: buttonRect.right - 10, y: buttonRect.bottom - 10 },
            { x: buttonRect.left + buttonRect.width * 0.3, y: buttonRect.top + buttonRect.height / 2 },
            { x: buttonRect.right - buttonRect.width * 0.3, y: buttonRect.top + buttonRect.height / 2 }
        ];
        sprayPoints.forEach((point, pointIndex) => {
            for (let i = 0; i < 15; i++) {
                setTimeout(() => {
                    const confetti = document.createElement('div');
                    confetti.style.position = 'fixed';
                    confetti.style.left = point.x + 'px';
                    confetti.style.top = point.y + 'px';
                    confetti.style.width = '5px';
                    confetti.style.height = '5px';
                    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '1px';
                    confetti.style.pointerEvents = 'none';
                    confetti.style.zIndex = '10000';
                    document.body.appendChild(confetti);
                    const angle = (Math.random() * Math.PI * 2);
                    const velocity = 2.5 + Math.random() * 5;
                    const vx = Math.cos(angle) * velocity;
                    const vy = Math.sin(angle) * velocity - 4;
                    let x = 0, y = 0, rotation = 0;
                    let opacity = 1;
                    const gravity = 0.25;
                    let velocityY = vy;
                    const animate = () => {
                        x += vx;
                        y += velocityY;
                        velocityY += gravity;
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
    async handleOrderNow() {
        const orderBtn = document.getElementById('order-now-btn');
        if (!orderBtn) return;
        try {
            let customerDid = null;
            let customerHandle = null;
            let anonymizeOrder = false;
            if (window.oauthManager) {
                try {
                    const session = window.oauthManager.getSession();
                    if (session && session.did) {
                        customerDid = session.did;
                        customerHandle = session.handle || null;
                        const anonymizeCheckbox = document.getElementById('anonymize-order');
                        if (anonymizeCheckbox && anonymizeCheckbox.checked) {
                            anonymizeOrder = true;
                            customerDid = null;
                            customerHandle = null;
                            console.log('🔒 Order will be anonymous (user opted out)');
                        } else {
                            console.log('📝 Order attribution: DID =', customerDid, '| Handle =', customerHandle);
                        }
                    } else {
                        anonymizeOrder = true;
                        console.log('🔒 Order will be anonymous (no login)');
                    }
                } catch (e) {
                    anonymizeOrder = true;
                    console.log('🔒 Order will be anonymous (no login)');
                }
            } else {
                anonymizeOrder = true;
                console.log('🔒 Order will be anonymous (no login)');
            }
            const response = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    quantity: this.quantity,
                    customer_did: customerDid,
                    customer_handle: customerHandle,
                    anonymous: anonymizeOrder
                })
            });
            if (!response.ok) {
                throw new Error('Failed to create checkout session');
            }
            const data = await response.json();
            if (data.url) {
                window.open(data.url, '_blank', 'noopener,noreferrer');
            } else {
                throw new Error('No checkout URL received');
            }
        } catch (error) {
            console.error('Error creating checkout session:', error);
            alert(
                `Unable to process your order at this time.\n\n` +
                `Please contact books@reverie.house to order ${this.quantity} ${this.quantity === 1 ? 'copy' : 'copies'} directly.`
            );
        }
    }
    async handleRequestCopy() {
        const nameInput = document.getElementById('request-name');
        const emailInput = document.getElementById('request-email');
        const messageDiv = document.getElementById('request-message');
        if (!nameInput || !emailInput || !messageDiv) return;
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!name) {
            messageDiv.textContent = 'Please enter your name.';
            messageDiv.className = 'request-message error';
            messageDiv.style.color = '#c00';
            messageDiv.style.visibility = 'visible';
            setTimeout(() => {
                messageDiv.style.visibility = 'hidden';
            }, 3000);
            return;
        }
        if (!email || !emailRegex.test(email)) {
            messageDiv.textContent = 'Please enter a valid email address.';
            messageDiv.className = 'request-message error';
            messageDiv.style.color = '#c00';
            messageDiv.style.visibility = 'visible';
            setTimeout(() => {
                messageDiv.style.visibility = 'hidden';
            }, 3000);
            return;
        }
        const subject = encodeURIComponent("Request for Prince's Reverie Advance Copy");
        const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nI would like to request an advance copy of Prince's Reverie.`);
        const mailtoLink = `mailto:books@reverie.house?subject=${subject}&body=${body}`;
        window.open(mailtoLink, '_blank');
        messageDiv.textContent = 'Opening email client...';
        messageDiv.className = 'request-message success';
        messageDiv.style.color = '#2a7d2e';
        messageDiv.style.visibility = 'visible';
        setTimeout(() => {
            nameInput.value = '';
            emailInput.value = '';
            messageDiv.style.visibility = 'hidden';
        }, 2000);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    window.printWidget = new PrintWidget();
    window.printWidget.init();
    console.log('✅ Print widget initialized globally');
});
