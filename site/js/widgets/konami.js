class KonamiCode {
    constructor() {
    this.sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];
        this.currentIndex = 0;
        this.isActive = false;
        this.bubbles = [];
        this.scattering = false;
        this.mouseX = -1000;
        this.mouseY = -1000;
        this.avoidanceRadius = 100;
        this.windForceX = 0.06;
        this.windVariation = 0.02;
        this.buoyancy = 0.015;
        this.friction = 0.96;
        this.spawnInterval = 1000;
        this.spawnX = -150;
        this.initialBubbleCount = 1;
        this.hasFocus = true;
        this.cleanupMargin = 300;
        this.init();
    }
    init() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        window.addEventListener('focus', () => {
            this.hasFocus = true;
        });
        window.addEventListener('blur', () => {
            this.hasFocus = false;
        });
        console.log('🎮 Konami code listener active');
    }
    handleKeyPress(e) {
        if (this.isActive) return;
        const key = e.key;
        const expectedKey = this.sequence[this.currentIndex];
        if (key === expectedKey) {
            this.currentIndex++;
            if (this.currentIndex === this.sequence.length) {
                this.trigger();
                this.currentIndex = 0;
            }
        } else {
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
                this.currentIndex = 0;
            }
        }
    }
    async trigger() {
        console.log('🎉 Konami code activated!');
        this.isActive = true;
        try {
            const response = await fetch('/data/souvenirs.json');
            const souvenirs = await response.json();
            const souvenirArray = Object.entries(souvenirs);
            this.createBubbleContainer();
            this.startMouseTracking();
            this.populateInitialBubbles(souvenirArray);
            this.startContinuousSpawning(souvenirArray);
            await this.animationLoop();
            this.cleanup();
        } catch (error) {
            console.error('Konami code error:', error);
            this.isActive = false;
        }
    }
    createBubbleContainer() {
        const existing = document.getElementById('konami-bubbles');
        if (existing) existing.remove();
        this.container = document.createElement('div');
        this.container.id = 'konami-bubbles';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 999;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
        `;
        document.body.appendChild(this.container);
    }
    populateInitialBubbles(souvenirs) {
        for (let i = 0; i < this.initialBubbleCount; i++) {
            this.createBubble(souvenirs);
        }
    }
    startContinuousSpawning(souvenirs) {
        this.spawnTimer = setInterval(() => {
            if (this.isActive && this.hasFocus) {
                this.createBubble(souvenirs);
            }
        }, this.spawnInterval);
    }
    createBubble(souvenirs) {
        const sizeTiers = [
            { min: 40, max: 55, weight: 0.3 },
            { min: 55, max: 75, weight: 0.5 },
            { min: 75, max: 95, weight: 0.2 }
        ];
        const selectSize = () => {
            const random = Math.random();
            let cumulative = 0;
            for (const tier of sizeTiers) {
                cumulative += tier.weight;
                if (random < cumulative) {
                    return Math.random() * (tier.max - tier.min) + tier.min;
                }
            }
            return 60;
        };
        const getLatestForm = (souvenir) => {
            if (!souvenir.forms || souvenir.forms.length === 0) {
                return { icon: '/assets/icon.png', name: 'Unknown' };
            }
            return souvenir.forms.reduce((latest, form) => {
                return (form.epoch || 0) > (latest.epoch || 0) ? form : latest;
            });
        };
        const [souvenirId, souvenirData] = souvenirs[Math.floor(Math.random() * souvenirs.length)];
        const latestForm = getLatestForm(souvenirData);
        const size = selectSize();
        const zIndex = Math.floor((1 - (size - 40) / 55) * 100);
        const bubble = document.createElement('div');
        bubble.className = 'konami-bubble';
        bubble.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1));
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255,255,255,0.4);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: ${zIndex};
            opacity: 1;
            cursor: pointer;
            pointer-events: auto;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            -webkit-tap-highlight-color: transparent;
        `;
        const hitbox = document.createElement('div');
        hitbox.style.cssText = `
            position: absolute;
            width: ${size * 1.8}px;
            height: ${size * 1.8}px;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            cursor: pointer;
            z-index: 1;
            user-select: none;
            -webkit-user-select: none;
        `;
        bubble.appendChild(hitbox);
        const icon = document.createElement('img');
        icon.src = latestForm.icon;
        icon.style.cssText = `
            width: 60%;
            height: 60%;
            object-fit: contain;
            pointer-events: none;
            position: relative;
            z-index: 2;
        `;
        bubble.appendChild(icon);
        bubble.x = this.spawnX;
        bubble.y = Math.random() * window.innerHeight;
        bubble.vx = Math.random() * 0.5 + 0.5;
        bubble.vy = (Math.random() - 0.5) * 0.3;
        bubble.rotation = Math.random() * 360;
        bubble.rotationSpeed = (Math.random() - 0.5) * 2;
        bubble.size = size;
        bubble.souvenirId = souvenirId;
        bubble.popped = false;
        bubble.scattered = false;
        this.container.appendChild(bubble);
        this.bubbles.push(bubble);
        return bubble;
    }
    scatterAllBubbles(clickX, clickY) {
        if (this.scattering) return;
        console.log('💥 Bubbles scattering!');
        this.scattering = true;
        if (this.spawnTimer) {
            clearInterval(this.spawnTimer);
            this.spawnTimer = null;
        }
        this.bubbles.forEach(bubble => {
            if (bubble.popped) return;
            bubble.scattered = true;
            const dx = bubble.x - clickX;
            const dy = bubble.y - clickY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0) {
                const scatterSpeed = 15;
                bubble.vx = (dx / distance) * scatterSpeed;
                bubble.vy = (dy / distance) * scatterSpeed;
            } else {
                const angle = Math.random() * Math.PI * 2;
                bubble.vx = Math.cos(angle) * 15;
                bubble.vy = Math.sin(angle) * 15;
            }
            bubble.style.pointerEvents = 'none';
        });
    }
    popBubble(bubble, souvenirId) {
        if (bubble.popped) return;
        bubble.popped = true;
        console.log('💥 Bubble popped! Navigating to souvenir:', souvenirId);
        bubble.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out';
        bubble.style.transform = 'translate(-50%, -50%) scale(1.5) rotate(' + (bubble.rotation + 360) + 'deg)';
        bubble.style.opacity = '0';
        this.bubbles.forEach(b => {
            if (b !== bubble) {
                b.style.pointerEvents = 'none';
            }
        });
        setTimeout(() => {
            window.location.href = `/souvenirs#${souvenirId}`;
        }, 300);
    }
    startMouseTracking() {
        this.mouseMoveHandler = (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        };
        this.touchMoveHandler = (e) => {
            if (e.touches.length > 0) {
                this.mouseX = e.touches[0].clientX;
                this.mouseY = e.touches[0].clientY;
            }
        };
        this.globalClickHandler = (e) => {
            if (!this.scattering) {
                const clickX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : window.innerWidth / 2);
                const clickY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : window.innerHeight / 2);
                this.scatterAllBubbles(clickX, clickY);
            }
        };
        this.globalTouchHandler = (e) => {
            if (!this.scattering && e.touches.length > 0) {
                this.scatterAllBubbles(e.touches[0].clientX, e.touches[0].clientY);
            }
        };
        document.addEventListener('mousemove', this.mouseMoveHandler);
        document.addEventListener('touchmove', this.touchMoveHandler, { passive: true });
        document.addEventListener('click', this.globalClickHandler);
        document.addEventListener('touchend', this.globalTouchHandler);
    }
    stopMouseTracking() {
        if (this.mouseMoveHandler) {
            document.removeEventListener('mousemove', this.mouseMoveHandler);
        }
        if (this.touchMoveHandler) {
            document.removeEventListener('touchmove', this.touchMoveHandler);
        }
        if (this.globalClickHandler) {
            document.removeEventListener('click', this.globalClickHandler);
        }
        if (this.globalTouchHandler) {
            document.removeEventListener('touchend', this.globalTouchHandler);
        }
    }
    async animationLoop() {
        return new Promise((resolve) => {
            const animate = () => {
                if (!this.isActive) {
                    resolve();
                    return;
                }
                const activeBubbles = this.bubbles.filter(b => !b.popped);
                activeBubbles.forEach(bubble => {
                    this.updateBubblePhysics(bubble);
                    this.updateBubbleVisual(bubble);
                });
                this.cleanupOffscreenBubbles();
                requestAnimationFrame(animate);
            };
            animate();
        });
    }
    cleanupOffscreenBubbles() {
        const margin = this.cleanupMargin;
        const topMargin = margin * 3;
        const toRemove = [];
        this.bubbles.forEach((bubble, index) => {
            if (bubble.popped) return;
            const offLeft = bubble.x < -margin;
            const offRight = bubble.x > window.innerWidth + margin;
            const offTop = bubble.y < -topMargin;
            const offBottom = bubble.y > window.innerHeight + margin;
            if (offLeft || offRight || offTop || offBottom) {
                bubble.remove();
                toRemove.push(index);
            }
        });
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.bubbles.splice(toRemove[i], 1);
        }
        if (this.scattering && this.bubbles.length === 0) {
            console.log('🎮 All bubbles scattered away! Effect complete.');
            this.isActive = false;
        }
    }
    updateBubblePhysics(bubble) {
        if (bubble.scattered) {
            bubble.x += bubble.vx;
            bubble.y += bubble.vy;
            const currentOpacity = parseFloat(bubble.style.opacity);
            if (currentOpacity > 0) {
                bubble.style.opacity = Math.max(0, currentOpacity - 0.02);
            }
            return;
        }
        const windX = this.windForceX + (Math.random() - 0.5) * this.windVariation;
        bubble.vx += windX;
        const buoyancyY = -this.buoyancy + (Math.random() - 0.5) * 0.02;
        bubble.vy += buoyancyY;
        const dx = bubble.x - this.mouseX;
        const dy = bubble.y - this.mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < this.avoidanceRadius && distance > 0) {
            const avoidanceStrength = (1 - distance / this.avoidanceRadius) * 2;
            const avoidX = (dx / distance) * avoidanceStrength;
            const avoidY = (dy / distance) * avoidanceStrength;
            bubble.vx += avoidX;
            bubble.vy += avoidY;
        }
        bubble.vx *= this.friction;
        bubble.vy *= this.friction;
        if (bubble.y > window.innerHeight - 50) {
            bubble.y = window.innerHeight - 50;
            bubble.vy = -Math.abs(bubble.vy) * 0.5;
        }
        bubble.x += bubble.vx;
        bubble.y += bubble.vy;
        bubble.rotation += bubble.rotationSpeed;
    }
    updateBubbleVisual(bubble) {
        bubble.style.left = `${bubble.x}px`;
        bubble.style.top = `${bubble.y}px`;
        bubble.style.transform = `translate(-50%, -50%) rotate(${bubble.rotation}deg)`;
    }
    cleanup() {
        this.stopMouseTracking();
        if (this.spawnTimer) {
            clearInterval(this.spawnTimer);
            this.spawnTimer = null;
        }
        if (this.container) {
            this.container.remove();
        }
        this.bubbles = [];
        this.isActive = false;
        console.log('🎮 Konami code deactivated');
    }
}
const konamiCode = new KonamiCode();
