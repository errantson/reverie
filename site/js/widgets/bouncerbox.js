/**
 * BouncerBox - Physics-based souvenir bubble visualization widget
 * Displays souvenirs as floating bubbles with physics interactions
 * 
 * Usage:
 *   new BouncerBox(container, options)
 * 
 * Options:
 *   - userDID: Filter to specific user's souvenirs (string)
 *   - souvenirKeys: Filter to specific souvenir keys (string or array)
 *   - categories: Filter to specific categories (string or array)
 *   - displayMode: 'all' | 'unique' | 'onePerType' (default: 'all')
 *   - width: Canvas width (default: container width)
 *   - height: Canvas height (default: 336)
 *   - showWidget: Show mini info widget on click (default: true)
 *   - widgetCallback: Custom callback when souvenir clicked (function)
 */

class BouncerBox {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        if (!this.container) {
            console.error('[BouncerBox] Container not found');
            return;
        }

        this.options = {
            userDID: options.userDID || null,
            souvenirKeys: options.souvenirKeys || null,
            categories: options.categories || null,
            displayMode: options.displayMode || 'all', // 'all' | 'unique' | 'onePerType'
            width: options.width || this.container.clientWidth,
            height: options.height || 336,
            showWidget: options.showWidget !== false,
            widgetCallback: options.widgetCallback || null,
            userColor: options.userColor || '#734ba1',
            ...options
        };

        // Normalize souvenirKeys to array
        if (this.options.souvenirKeys && !Array.isArray(this.options.souvenirKeys)) {
            this.options.souvenirKeys = [this.options.souvenirKeys];
        }
        
        // Normalize categories to array
        if (this.options.categories && !Array.isArray(this.options.categories)) {
            this.options.categories = [this.options.categories];
        }

        this.bubbles = [];
        this.animationFrame = null;
        this.mouseX = 0;
        this.mouseY = 0;
        this.phaneraBgImage = null;
        this.phaneraBgAlpha = 1;

        this.init();
    }

    async init() {
        console.log('[BouncerBox] Initializing with options:', this.options);

        // Build HTML structure
        this.container.innerHTML = `
            <div class="souvenirs-physics-container" style="border-color: ${this.options.userColor}; height: ${this.options.height}px; min-height: ${this.options.height}px;">
                <canvas class="souvenirs-physics-canvas"></canvas>
                ${this.options.showWidget ? '<div class="souvenirs-mini-widget"></div>' : ''}
            </div>
        `;

        this.canvas = this.container.querySelector('.souvenirs-physics-canvas');
        this.widget = this.container.querySelector('.souvenirs-mini-widget');

        // Set canvas size
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;

        // Attach event listeners
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));

        // Load and initialize
        await this.loadSouvenirs();
    }

    async loadSouvenirs() {
        console.log('[BouncerBox] Loading souvenirs data...', this.options);

        try {
            // Fetch souvenirs data
            const souvenirsResponse = await fetch('/api/souvenirs');
            const allSouvenirs = await souvenirsResponse.json();

            let allDreamers = [];
            let dreamers = [];

            // Only fetch dreamers data if we need user-specific filtering
            if (this.options.userDID || this.options.displayMode === 'all') {
                try {
                    const dreamersResponse = await fetch('/api/dreamers');
                    allDreamers = await dreamersResponse.json();
                    
                    // Filter by user if specified
                    dreamers = allDreamers;
                    if (this.options.userDID) {
                        const dreamer = allDreamers.find(d => d.did === this.options.userDID);
                        dreamers = dreamer ? [dreamer] : [];
                    }
                } catch (error) {
                    console.warn('[BouncerBox] Could not fetch dreamers data, continuing with souvenirs only:', error);
                    // Continue without dreamers data
                }
            }

            // Build souvenir instances from user data
            const souvenirInstances = [];
            
            for (const dreamer of dreamers) {
                if (!dreamer.souvenirs) continue;

                const userFormKeys = Object.keys(dreamer.souvenirs);
                
                userFormKeys.forEach(formKey => {
                    // Find matching souvenir data
                    const souvenirData = allSouvenirs[formKey];
                    if (!souvenirData) return;
                    
                    // Filter by souvenirKeys if specified
                    if (this.options.souvenirKeys && !this.options.souvenirKeys.includes(formKey)) {
                        return;
                    }
                    
                    // Filter by categories if specified
                    if (this.options.categories) {
                        const souvenirCategory = souvenirData.category || 'other';
                        if (!this.options.categories.includes(souvenirCategory)) {
                            return;
                        }
                    }

                    souvenirInstances.push({
                        key: formKey,
                        name: souvenirData.name,
                        icon: souvenirData.icon,
                        phanera: souvenirData.phanera,
                        category: souvenirData.category || 'other',
                        epoch: dreamer.souvenirs[formKey],
                        dreamerDID: dreamer.did,
                        dreamerName: dreamer.name,
                        dreamerColor: dreamer.color_hex
                    });
                });
            }

            // Apply display mode filtering
            let filteredInstances = souvenirInstances;
            
            if (this.options.displayMode === 'unique') {
                // One instance per unique souvenir key (first keeper found)
                const uniqueMap = new Map();
                souvenirInstances.forEach(instance => {
                    if (!uniqueMap.has(instance.key)) {
                        uniqueMap.set(instance.key, instance);
                    }
                });
                filteredInstances = Array.from(uniqueMap.values());
                console.log('[BouncerBox] Unique mode: reduced to', filteredInstances.length, 'unique souvenirs');
                
            } else if (this.options.displayMode === 'onePerType') {
                // One instance per unique souvenir key - show ALL souvenir types
                const keyMap = new Map();
                
                // First, add all available souvenirs from the API
                Object.keys(allSouvenirs).forEach(key => {
                    const souvenirData = allSouvenirs[key];
                    
                    // Filter by souvenirKeys if specified
                    if (this.options.souvenirKeys && !this.options.souvenirKeys.includes(key)) {
                        return;
                    }
                    
                    // Filter by categories if specified
                    if (this.options.categories) {
                        const souvenirCategory = souvenirData.category || 'other';
                        if (!this.options.categories.includes(souvenirCategory)) {
                            return;
                        }
                    }
                    
                    keyMap.set(key, {
                        key: key,
                        name: souvenirData.name,
                        icon: souvenirData.icon,
                        phanera: souvenirData.phanera,
                        category: souvenirData.category || 'other',
                        epoch: null, // No keeper yet
                        dreamerDID: null,
                        dreamerName: null,
                        dreamerColor: null
                    });
                });
                
                // Then override with actual user instances if they exist (to get keeper info)
                souvenirInstances.forEach(instance => {
                    keyMap.set(instance.key, instance);
                });
                
                filteredInstances = Array.from(keyMap.values());
                console.log('[BouncerBox] OnePerType mode: showing', filteredInstances.length, 'types from keys:', Array.from(keyMap.keys()));
            }

            console.log('[BouncerBox] Displaying', filteredInstances.length, 'souvenir instances');

            if (filteredInstances.length === 0) {
                this.drawEmptyState();
                return;
            }

            // Auto-select souvenir based on initialKey option, or first souvenir
            let selectedSouvenir = filteredInstances[0];
            if (this.options.initialKey) {
                const matchingSouvenir = filteredInstances.find(s => s.key === this.options.initialKey);
                if (matchingSouvenir) {
                    selectedSouvenir = matchingSouvenir;
                    console.log('[BouncerBox] Using initialKey:', this.options.initialKey);
                }
            }
            
            if (selectedSouvenir.phanera) {
                this.phaneraBgImage = new Image();
                this.phaneraBgImage.src = selectedSouvenir.phanera;
            }

            if (this.options.showWidget) {
                this.updateWidget(selectedSouvenir);
            }

            // Create bubbles
            this.createBubbles(filteredInstances);

            // Start animation
            this.startAnimation();

        } catch (error) {
            console.error('[BouncerBox] Error loading souvenirs:', error);
            this.drawEmptyState();
        }
    }

    createBubbles(souvenirInstances) {
        const widgetWidth = this.options.showWidget ? 280 : 0;
        const widgetHeight = this.options.showWidget ? 150 : 0;
        const widgetMargin = this.options.showWidget ? 12 : 0;

        souvenirInstances.forEach((souvenir, index) => {
            const minSize = 55;
            const maxSize = 85;
            const size = minSize + Math.random() * (maxSize - minSize);

            // Find valid position
            let x, y;
            let attempts = 0;
            const maxAttempts = 50;

            do {
                x = size / 2 + Math.random() * (this.canvas.width - size);
                y = size / 2 + Math.random() * (this.canvas.height - size);

                // Check widget overlap
                const widgetLeft = widgetMargin;
                const widgetRight = widgetMargin + widgetWidth;
                const widgetTop = this.canvas.height - widgetMargin - widgetHeight;
                const widgetBottom = this.canvas.height - widgetMargin;

                const padding = size / 2 + 20;
                const isOutsideWidget = x > widgetRight + padding || 
                                       x < widgetLeft - padding ||
                                       y < widgetTop - padding ||
                                       y > widgetBottom + padding;

                if (isOutsideWidget || !this.options.showWidget) break;
                attempts++;
            } while (attempts < maxAttempts);

            // Fallback position
            if (attempts >= maxAttempts) {
                x = this.canvas.width * 0.6 + Math.random() * (this.canvas.width * 0.3);
                y = this.canvas.height * 0.2 + Math.random() * (this.canvas.height * 0.3);
            }

            // Velocity
            const minVelocity = 1.5;
            const maxVelocity = 4;
            let vx = (Math.random() - 0.5) * maxVelocity * 2;
            let vy = (Math.random() - 0.5) * maxVelocity * 2;

            const speed = Math.sqrt(vx * vx + vy * vy);
            if (speed < minVelocity) {
                const angle = Math.random() * Math.PI * 2;
                vx = Math.cos(angle) * minVelocity;
                vy = Math.sin(angle) * minVelocity;
            } else if (speed > maxVelocity) {
                vx = (vx / speed) * maxVelocity;
                vy = (vy / speed) * maxVelocity;
            }

            const bubble = {
                ...souvenir,
                x: x,
                y: y,
                vx: vx,
                vy: vy,
                size: size,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.02,
                image: new Image()
            };

            bubble.image.src = bubble.icon;
            this.bubbles.push(bubble);
        });
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;

        // Update cursor
        let hovering = false;
        for (const bubble of this.bubbles) {
            const dx = this.mouseX - bubble.x;
            const dy = this.mouseY - bubble.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < bubble.size / 2) {
                hovering = true;
                break;
            }
        }
        this.canvas.style.cursor = hovering ? 'pointer' : 'default';
    }

    async handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        for (const bubble of this.bubbles) {
            const dx = clickX - bubble.x;
            const dy = clickY - bubble.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < bubble.size / 2) {
                console.log('[BouncerBox] Bubble clicked:', bubble.key);

                // Pulse animation
                this.animatePulse(bubble);

                // Custom callback takes priority (e.g., navigation)
                if (this.options.widgetCallback) {
                    this.options.widgetCallback(bubble);
                    return;
                }

                // Default behavior: load phanera and update widget
                if (bubble.phanera) {
                    this.crossfadePhanera(bubble.phanera);
                }

                if (this.options.showWidget) {
                    this.updateWidget(bubble);
                }

                return;
            }
        }
    }

    animatePulse(bubble) {
        const originalSize = bubble.size;
        bubble.targetSize = originalSize * 1.2;

        const pulseAnimation = () => {
            if (bubble.size < bubble.targetSize) {
                bubble.size += (bubble.targetSize - bubble.size) * 0.3;
                if (Math.abs(bubble.size - bubble.targetSize) < 0.5) {
                    bubble.size = bubble.targetSize;
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

        let frameCount = 0;
        const animateInterval = setInterval(() => {
            pulseAnimation();
            frameCount++;
            if (frameCount > 15 || !bubble.targetSize) {
                clearInterval(animateInterval);
                bubble.size = originalSize;
            }
        }, 16);
    }

    crossfadePhanera(phaneraUrl) {
        const newImage = new Image();
        newImage.src = phaneraUrl;
        newImage.onload = () => {
            const fadeOut = setInterval(() => {
                this.phaneraBgAlpha = Math.max(0, this.phaneraBgAlpha - 0.05);
                if (this.phaneraBgAlpha <= 0) {
                    clearInterval(fadeOut);
                    this.phaneraBgImage = newImage;
                    const fadeIn = setInterval(() => {
                        this.phaneraBgAlpha = Math.min(1, this.phaneraBgAlpha + 0.05);
                        if (this.phaneraBgAlpha >= 1) clearInterval(fadeIn);
                    }, 16);
                }
            }, 16);
        };
    }

    async updateWidget(souvenir) {
        if (!this.widget) return;

        // Slide down animation
        const slideDistance = this.canvas.height;
        this.widget.style.transition = 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
        this.widget.style.transform = `translateY(${slideDistance}px)`;

        setTimeout(() => {
            this.renderWidgetContent(souvenir);
            setTimeout(() => {
                this.widget.style.transform = 'translateY(0)';
            }, 50);
        }, 300);
    }

    async renderWidgetContent(souvenir) {
        try {
            const response = await fetch('/api/souvenirs');
            const allSouvenirs = await response.json();
            const souvenirData = allSouvenirs[souvenir.key];

            const keeperCount = souvenirData?.keepers?.length || 0;
            const description = souvenirData?.description || '';

            const keeperText = keeperCount === 0 ? 'unclaimed' : 
                              keeperCount === 1 ? '1 keeper' : 
                              `${keeperCount} keepers`;

            const earnedTime = souvenir.epoch ? this.formatTimeAgo(souvenir.epoch) : '';
            const userColor = souvenir.dreamerColor || this.options.userColor;

            this.widget.innerHTML = `
                <div class="souvenir-widget-inner" style="border-color: ${userColor};">
                    <div class="souvenir-widget-close" onclick="this.parentElement.parentElement.innerHTML = ''">&times;</div>
                    <div class="souvenir-widget-content">
                        <div class="souvenir-widget-photo">
                            <img src="${souvenir.icon}" alt="${souvenir.name}" class="souvenir-widget-icon souvenir-icon-wave">
                        </div>
                        <div class="souvenir-widget-info">
                            <h3 class="souvenir-widget-title">${souvenir.name}</h3>
                            ${description ? `<p class="souvenir-widget-description">${description}</p>` : ''}
                            <div class="souvenir-widget-meta">
                                <span class="souvenir-widget-category" style="background: ${userColor}15; color: ${userColor};">${souvenir.key}</span>
                                <span class="souvenir-widget-separator">•</span>
                                <span class="souvenir-widget-keepers">${keeperText}</span>
                            </div>
                            ${earnedTime ? `<div class="souvenir-widget-earned">earned ${earnedTime}</div>` : ''}
                        </div>
                    </div>
                    <a href="/souvenirs?key=${souvenir.key}" class="souvenir-widget-explore" target="_blank" style="background-color: ${userColor}; color: white;">
                        <span>Explore Souvenir</span>
                        <span class="souvenir-widget-arrow">→</span>
                    </a>
                </div>
            `;
        } catch (error) {
            console.error('[BouncerBox] Error updating widget:', error);
        }
    }

    startAnimation() {
        const ctx = this.canvas.getContext('2d');
        let animationTime = 0;

        const userColor = this.options.userColor;
        const r = parseInt(userColor.slice(1, 3), 16);
        const g = parseInt(userColor.slice(3, 5), 16);
        const b = parseInt(userColor.slice(5, 7), 16);

        const animate = () => {
            animationTime += 0.01;

            // Background
            ctx.fillStyle = '#fdfcfe';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            // Phanera background
            if (this.phaneraBgImage && this.phaneraBgImage.complete && this.phaneraBgImage.naturalWidth > 0) {
                ctx.save();
                ctx.globalAlpha = 0.15 * this.phaneraBgAlpha;

                const imgAspect = this.phaneraBgImage.naturalWidth / this.phaneraBgImage.naturalHeight;
                const canvasAspect = this.canvas.width / this.canvas.height;
                let drawWidth, drawHeight, drawX, drawY;

                if (imgAspect > canvasAspect) {
                    drawHeight = this.canvas.height;
                    drawWidth = drawHeight * imgAspect;
                    drawX = (this.canvas.width - drawWidth) / 2;
                    drawY = 0;
                } else {
                    drawWidth = this.canvas.width;
                    drawHeight = drawWidth / imgAspect;
                    drawX = 0;
                    drawY = (this.canvas.height - drawHeight) / 2;
                }

                ctx.drawImage(this.phaneraBgImage, drawX, drawY, drawWidth, drawHeight);
                ctx.restore();
            }

            // Gradient overlay
            const oscillation = Math.sin(animationTime) * 0.5 + 0.5;
            const gradient = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.03 + oscillation * 0.02})`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${0.08 - oscillation * 0.02})`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            // Update and draw bubbles
            this.updateBubbles();
            this.drawBubbles(ctx);

            this.animationFrame = requestAnimationFrame(animate);
        };

        animate();
    }

    updateBubbles() {
        const minVelocity = 0.8;
        const maxVelocity = 5;

        this.bubbles.forEach((bubble, i) => {
            // Update position
            bubble.x += bubble.vx;
            bubble.y += bubble.vy;
            bubble.rotation += bubble.rotationSpeed;

            // Constrain velocity
            const speed = Math.sqrt(bubble.vx * bubble.vx + bubble.vy * bubble.vy);
            if (speed > maxVelocity) {
                bubble.vx = (bubble.vx / speed) * maxVelocity;
                bubble.vy = (bubble.vy / speed) * maxVelocity;
            } else if (speed < minVelocity && speed > 0) {
                bubble.vx = (bubble.vx / speed) * minVelocity;
                bubble.vy = (bubble.vy / speed) * minVelocity;
            }

            // Wall collisions
            if (bubble.x - bubble.size / 2 < 0) {
                bubble.x = bubble.size / 2;
                bubble.vx = Math.abs(bubble.vx);
            }
            if (bubble.x + bubble.size / 2 > this.canvas.width) {
                bubble.x = this.canvas.width - bubble.size / 2;
                bubble.vx = -Math.abs(bubble.vx);
            }
            if (bubble.y - bubble.size / 2 < 0) {
                bubble.y = bubble.size / 2;
                bubble.vy = Math.abs(bubble.vy);
            }
            if (bubble.y + bubble.size / 2 > this.canvas.height) {
                bubble.y = this.canvas.height - bubble.size / 2;
                bubble.vy = -Math.abs(bubble.vy);
            }

            // Widget collision
            if (this.widget) {
                const rect = this.widget.getBoundingClientRect();
                const canvasRect = this.canvas.getBoundingClientRect();

                const widgetLeft = rect.left - canvasRect.left;
                const widgetTop = rect.top - canvasRect.top;
                const widgetRight = widgetLeft + rect.width;
                const widgetBottom = widgetTop + rect.height;

                const bubbleRadius = bubble.size / 2;
                const closestX = Math.max(widgetLeft, Math.min(bubble.x, widgetRight));
                const closestY = Math.max(widgetTop, Math.min(bubble.y, widgetBottom));

                const distX = bubble.x - closestX;
                const distY = bubble.y - closestY;
                const distance = Math.sqrt(distX * distX + distY * distY);

                if (distance < bubbleRadius && distance > 0) {
                    const pushX = (distX / distance) * (bubbleRadius - distance);
                    const pushY = (distY / distance) * (bubbleRadius - distance);
                    bubble.x += pushX;
                    bubble.y += pushY;

                    const normalX = distX / distance;
                    const normalY = distY / distance;
                    const dotProduct = bubble.vx * normalX + bubble.vy * normalY;
                    bubble.vx -= 2 * dotProduct * normalX;
                    bubble.vy -= 2 * dotProduct * normalY;
                    bubble.vx *= 0.9;
                    bubble.vy *= 0.9;
                }
            }

            // Bubble collisions
            for (let j = i + 1; j < this.bubbles.length; j++) {
                const other = this.bubbles[j];
                const dx = other.x - bubble.x;
                const dy = other.y - bubble.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDist = (bubble.size + other.size) / 2;

                if (distance < minDist && distance > 0) {
                    const angle = Math.atan2(dy, dx);
                    const targetX = bubble.x + Math.cos(angle) * minDist;
                    const targetY = bubble.y + Math.sin(angle) * minDist;

                    const ax = (targetX - other.x) * 0.5;
                    const ay = (targetY - other.y) * 0.5;
                    bubble.x -= ax;
                    bubble.y -= ay;
                    other.x += ax;
                    other.y += ay;

                    const vxTemp = bubble.vx;
                    const vyTemp = bubble.vy;
                    bubble.vx = other.vx * 0.95;
                    bubble.vy = other.vy * 0.95;
                    other.vx = vxTemp * 0.95;
                    other.vy = vyTemp * 0.95;
                }
            }
        });
    }

    drawBubbles(ctx) {
        this.bubbles.forEach(bubble => {
            const dx = this.mouseX - bubble.x;
            const dy = this.mouseY - bubble.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const isHovered = distance < bubble.size / 2;

            ctx.save();

            if (isHovered) {
                ctx.translate(bubble.x, bubble.y);
                ctx.scale(1.1, 1.1);
                ctx.translate(-bubble.x, -bubble.y);
            }

            // Bubble gradient
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

            ctx.strokeStyle = isHovered ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.stroke();

            // Draw icon
            if (bubble.image.complete && bubble.image.naturalWidth > 0) {
                const iconSize = bubble.size * 0.85;
                ctx.globalAlpha = 0.95;

                ctx.save();
                ctx.translate(bubble.x, bubble.y);
                ctx.rotate(bubble.rotation);
                ctx.drawImage(bubble.image, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
                ctx.restore();
                ctx.globalAlpha = 1;
            }

            ctx.restore();
        });
    }

    drawEmptyState() {
        const ctx = this.canvas.getContext('2d');
        ctx.fillStyle = '#fdfcfe';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = '#999';
        ctx.font = 'italic 14px serif';
        ctx.textAlign = 'center';
        ctx.fillText('No souvenirs to display.', this.canvas.width / 2, this.canvas.height / 2 - 10);
        ctx.fillText('Continue exploring with a curious mind.', this.canvas.width / 2, this.canvas.height / 2 + 10);
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

    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
