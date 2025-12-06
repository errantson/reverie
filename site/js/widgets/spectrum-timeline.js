if (typeof window.OCTANT_RGB === 'undefined') {
        window.OCTANT_RGB = {
        '+++': { r: 100, g: 255, b: 200 },
        '++-': { r: 100, g: 200, b: 255 },
        '+-+': { r: 255, g: 180, b: 100 },
        '+--': { r: 255, g: 100, b: 150 },
        '-++': { r: 255, g: 150, b: 255 },
        '-+-': { r: 150, g: 150, b: 255 },
        '--+': { r: 255, g: 255, b: 100 },
        '---': { r: 200, g: 100, b: 255 }
    };
}
if (typeof window.ROTATION_LIMIT === 'undefined') {
    window.ROTATION_LIMIT = Math.PI * 0.4;
}
if (typeof window.MOMENTUM_FRICTION === 'undefined') {
    window.MOMENTUM_FRICTION = 0.95;
}
if (typeof window.MOMENTUM_THRESHOLD === 'undefined') {
    window.MOMENTUM_THRESHOLD = 0.0001;
}
const OCTANT_RGB = window.OCTANT_RGB;
const ROTATION_LIMIT = window.ROTATION_LIMIT;
const MOMENTUM_FRICTION = window.MOMENTUM_FRICTION;
const MOMENTUM_THRESHOLD = window.MOMENTUM_THRESHOLD;
class SpectrumTimelineViewer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.options = {
            showLabels: options.showLabels !== false,
            showAllNames: options.showAllNames || this.isTouchDevice,
            initialZoom: options.initialZoom || 1.2,
            showControls: options.showControls !== false
        };
        this.currentView = '3d';
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.camera = {
            rotX: 0.3,
            rotY: 0.5,
            zoom: this.options.initialZoom,
            autoRotate: true,
            velocityX: 0,
            velocityY: 0
        };
        this.cameraTween = {
            active: false,
            startRotX: 0,
            startRotY: 0,
            targetRotX: 0,
            targetRotY: 0,
            progress: 0,
            duration: 0.8
        };
        this.zoomTween = {
            active: false,
            startZoom: 0,
            targetZoom: 0,
            progress: 0,
            duration: 0.6
        };
        this.dreamers = [];
        this.octants = {};
        this.zones = [];
        this.animationRunning = false;
        this.animationFrameId = null;
        this.time = 0;
        this.mouse = { x: 0, y: 0, down: false, lastX: 0, lastY: 0, lastTime: 0 };
        this.hoveredDreamer = null;
        this.labelBounds = [];
        if (this.options.showControls) {
            this.createControlPanel();
        }
        this.setupControls();
        this.startAnimation();
    }
    createControlPanel() {
        let sidebar = this.canvas.parentElement.querySelector('.timeline-sidebar');
        if (!sidebar) {
            sidebar = document.querySelector('.timeline-sidebar');
        }
        if (!sidebar) return;
        const panel = document.createElement('div');
        panel.className = 'timeline-view-control-section';
        panel.innerHTML = `
            <div class="timeline-view-section-title">Controls</div>
            <button class="timeline-control-btn ${this.options.showLabels ? 'active' : ''}" id="timeline-toggleLabels" style="margin-bottom: 12px;">
                <span class="control-label">Axis Names</span>
            </button>
            <button class="timeline-control-btn ${this.options.showAllNames ? 'active' : ''}" id="timeline-toggleAllNames" style="margin-bottom: 12px; display: ${this.isTouchDevice ? 'none' : 'block'};">
                <span class="control-label">Dreamer Names</span>
            </button>
            <button class="timeline-control-btn" id="timeline-fitZoom" style="margin-bottom: 18px;">
                <span class="control-label">Fit Zoom</span>
            </button>
            <div style="height: 24px;"></div>
            <div class="timeline-view-section-title">Perspective</div>
            <div class="timeline-view-buttons">
                <button class="timeline-view-btn active" data-view="3d">
                    <span class="view-label">Balance</span>
                </button>
                <button class="timeline-view-btn" data-view="power-structure">
                    <span class="view-label">Force</span>
                </button>
                <button class="timeline-view-btn" data-view="belief-agency">
                    <span class="view-label">Agency</span>
                </button>
                <button class="timeline-view-btn" data-view="change-freedom">
                    <span class="view-label">Position</span>
                </button>
            </div>
        `;
        sidebar.insertBefore(panel, sidebar.firstChild);
        const toggleLabels = panel.querySelector('#timeline-toggleLabels');
        toggleLabels.addEventListener('click', () => {
            this.options.showLabels = !this.options.showLabels;
            toggleLabels.classList.toggle('active', this.options.showLabels);
        });
        const toggleAllNames = panel.querySelector('#timeline-toggleAllNames');
        toggleAllNames.addEventListener('click', () => {
            if (this.isTouchDevice) {
                return;
            }
            this.options.showAllNames = !this.options.showAllNames;
            toggleAllNames.classList.toggle('active', this.options.showAllNames);
        });
        const fitZoom = panel.querySelector('#timeline-fitZoom');
        fitZoom.addEventListener('click', () => {
            this.fitZoomToDreamers();
        });
        const viewButtons = panel.querySelectorAll('.timeline-view-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.snapToView(view);
                viewButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }
    snapToView(view) {
        this.camera.autoRotate = false;
        this.camera.velocityX = 0;
        this.camera.velocityY = 0;
        let targetRotX = 0;
        let targetRotY = 0;
        switch(view) {
            case '3d':
                targetRotX = 0.3;
                targetRotY = 0.5;
                this.camera.autoRotate = true;
                this.currentView = '3d';
                break;
            case 'power-structure':
                targetRotX = 0;
                targetRotY = 0;
                this.currentView = 'xy';
                break;
            case 'belief-agency':
                targetRotX = 0;
                targetRotY = Math.PI / 2;
                this.currentView = 'yz';
                break;
            case 'change-freedom':
                targetRotX = Math.PI / 2;
                targetRotY = 0;
                this.currentView = 'xz';
                break;
        }
        const currentRotY = this.camera.rotY;
        const rotYDiff = targetRotY - (currentRotY % (Math.PI * 2));
        if (rotYDiff > Math.PI) {
            targetRotY = currentRotY - (Math.PI * 2 - rotYDiff);
        } else if (rotYDiff < -Math.PI) {
            targetRotY = currentRotY + (Math.PI * 2 + rotYDiff);
        } else {
            targetRotY = currentRotY + rotYDiff;
        }
        this.cameraTween.active = true;
        this.cameraTween.startRotX = this.camera.rotX;
        this.cameraTween.startRotY = this.camera.rotY;
        this.cameraTween.targetRotX = targetRotX;
        this.cameraTween.targetRotY = targetRotY;
        this.cameraTween.progress = 0;
    }
    shouldShowLabel(label) {
        if (this.currentView === '3d') return true;
        switch(this.currentView) {
            case 'xy':
                return label !== 'Receptive' && label !== 'Skeptic';
            case 'xz':
                return label !== 'Authority' && label !== 'Liberty';
            case 'yz':
                return label !== 'Entropy' && label !== 'Oblivion';
            default:
                return true;
        }
    }
    fitZoomToDreamers() {
        if (this.dreamers.length === 0) return;
        if (this.dreamers.length === 1) {
            this.zoomTween.active = true;
            this.zoomTween.startZoom = this.camera.zoom;
            this.zoomTween.targetZoom = 1.2;
            this.zoomTween.progress = 0;
            return;
        }
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        this.dreamers.forEach(d => {
            minX = Math.min(minX, d.x);
            maxX = Math.max(maxX, d.x);
            minY = Math.min(minY, d.y);
            maxY = Math.max(maxY, d.y);
            minZ = Math.min(minZ, d.z);
            maxZ = Math.max(maxZ, d.z);
        });
        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
        const rangeZ = maxZ - minZ;
        const maxRange = Math.max(rangeX, rangeY, rangeZ);
        if (maxRange < 10) {
            this.zoomTween.active = true;
            this.zoomTween.startZoom = this.camera.zoom;
            this.zoomTween.targetZoom = 1.5;
            this.zoomTween.progress = 0;
            return;
        }
        const canvasSize = Math.min(this.canvas.width, this.canvas.height);
        const targetScale = (canvasSize * 0.65) / maxRange;
        const targetZoom = targetScale / 2.5;
        const maxZoom = canvasSize < 500 ? 4.0 : 3.5;
        const clampedZoom = Math.max(0.8, Math.min(maxZoom, targetZoom));
        this.zoomTween.active = true;
        this.zoomTween.startZoom = this.camera.zoom;
        this.zoomTween.targetZoom = clampedZoom;
        this.zoomTween.progress = 0;
    }
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || this.canvas.width || 600;
        const height = rect.height || this.canvas.height || 600;
        if (width > 0 && height > 0) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.centerX = this.canvas.width / 2;
            this.centerY = this.canvas.height / 2;
        } else {
            console.warn('⚠️ [SpectrumTimelineViewer] Canvas has 0 dimensions, using fallback');
            this.canvas.width = 600;
            this.canvas.height = 600;
            this.centerX = 300;
            this.centerY = 300;
        }
    }
    setupControls() {
        let touchStartDistance = 0;
        let touchStartZoom = 1;
        const handleDragStart = (clientX, clientY) => {
            this.mouse.down = true;
            this.mouse.lastX = clientX;
            this.mouse.lastY = clientY;
            this.mouse.lastTime = Date.now();
            this.mouse.hasDragged = false;
            this.camera.autoRotate = false;
            this.camera.velocityX = 0;
            this.camera.velocityY = 0;
            this.cameraTween.active = false;
        };
        const handleDragMove = (clientX, clientY) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = clientX - rect.left;
            this.mouse.y = clientY - rect.top;
            if (this.mouse.down) {
                const currentTime = Date.now();
                const dt = Math.max(1, currentTime - this.mouse.lastTime);
                const dx = clientX - this.mouse.lastX;
                const dy = clientY - this.mouse.lastY;
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                    this.mouse.hasDragged = true;
                    if (this.currentView !== '3d') {
                        this.currentView = '3d';
                        const viewButtons = document.querySelectorAll('.timeline-view-btn');
                        viewButtons.forEach(btn => {
                            btn.classList.toggle('active', btn.dataset.view === '3d');
                        });
                    }
                }
                this.camera.velocityY = (dx * 0.01) / dt * 16;
                this.camera.velocityX = (dy * 0.01) / dt * 16;
                this.camera.rotY += dx * 0.01;
                this.camera.rotX += dy * 0.01;
                this.camera.rotX = Math.max(-ROTATION_LIMIT, Math.min(ROTATION_LIMIT, this.camera.rotX));
                this.mouse.lastX = clientX;
                this.mouse.lastY = clientY;
                this.mouse.lastTime = currentTime;
            }
        };
        const handleDragEnd = () => {
            this.mouse.down = false;
            this.mouse.hasDragged = false;
        };
        this.canvas.addEventListener('mousedown', (e) => {
            handleDragStart(e.clientX, e.clientY);
        });
        this.canvas.addEventListener('mousemove', (e) => {
            handleDragMove(e.clientX, e.clientY);
        });
        this.canvas.addEventListener('mouseup', (e) => {
            if (!this.mouse.hasDragged && this.hoveredDreamer) {
                const dreamer = this.hoveredDreamer;
                if (dreamer.did) {
                    window.location.href = `/dreamer?did=${encodeURIComponent(dreamer.did)}`;
                }
            }
            handleDragEnd();
        });
        this.canvas.addEventListener('mouseleave', handleDragEnd);
        const getTouchDistance = (touches) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                handleDragStart(touch.clientX, touch.clientY);
            } else if (e.touches.length === 2) {
                this.mouse.down = false;
                touchStartDistance = getTouchDistance(e.touches);
                touchStartZoom = this.camera.zoom;
            }
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && this.mouse.down) {
                const touch = e.touches[0];
                handleDragMove(touch.clientX, touch.clientY);
            } else if (e.touches.length === 2) {
                const currentDistance = getTouchDistance(e.touches);
                const scale = currentDistance / touchStartDistance;
                this.camera.zoom = Math.max(0.5, Math.min(3.0, touchStartZoom * scale));
            }
        }, { passive: false });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleDragEnd();
        }, { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            handleDragEnd();
        }, { passive: false });
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camera.zoom *= (1 - e.deltaY * 0.001);
            this.camera.zoom = Math.max(0.5, Math.min(3, this.camera.zoom));
        });
    }
    loadSnapshot(dreamers) {
        this.dreamers = dreamers.map(d => ({
            did: d.did,
            name: d.name,
            handle: d.handle,
            spectrum: d.spectrum,
            x: d.x,
            y: d.y,
            z: d.z,
            targetX: d.x,
            targetY: d.y,
            targetZ: d.z,
            phase: Math.random() * Math.PI * 2
        }));
        this.categorizeDreamers();
        this.loadZones();
    }
    categorizeDreamers() {
        this.octants = {};
        this.dreamers.forEach(dreamer => {
            const signX = dreamer.x >= 0 ? '+' : '-';
            const signY = dreamer.y >= 0 ? '+' : '-';
            const signZ = dreamer.z >= 0 ? '+' : '-';
            const octantKey = signX + signY + signZ;
            if (!this.octants[octantKey]) {
                this.octants[octantKey] = [];
            }
            this.octants[octantKey].push(dreamer);
        });
    }
    async loadZones() {
        try {
            const response = await fetch('/api/zones');
            const zonesData = await response.json();
            this.zones = zonesData.map(z => {
                let color = z.color;
                if (typeof color === 'string') {
                    try {
                        color = JSON.parse(color);
                    } catch (e) {
                        color = {r: 120, g: 120, b: 120, a: 0.15};
                    }
                }
                return {
                    ...z,
                    color: color || {r: 120, g: 120, b: 120, a: 0.15}
                };
            });
                    } catch (error) {
            console.error('[Timeline] Failed to load zones:', error);
        }
    }
    startAnimation() {
        if (this.animationRunning) return;
        this.animationRunning = true;
        this.animate();
    }
    stopAnimation() {
        this.animationRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }
    animate() {
        if (!this.animationRunning) return;
        this.time += 0.016;
        if (this.cameraTween.active) {
            this.cameraTween.progress += 0.016 / this.cameraTween.duration;
            if (this.cameraTween.progress >= 1) {
                this.camera.rotX = this.cameraTween.targetRotX;
                this.camera.rotY = this.cameraTween.targetRotY;
                this.cameraTween.active = false;
            } else {
                const t = this.cameraTween.progress;
                const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                this.camera.rotX = this.cameraTween.startRotX + (this.cameraTween.targetRotX - this.cameraTween.startRotX) * eased;
                this.camera.rotY = this.cameraTween.startRotY + (this.cameraTween.targetRotY - this.cameraTween.startRotY) * eased;
            }
        }
        if (this.zoomTween.active) {
            this.zoomTween.progress += 0.016 / this.zoomTween.duration;
            if (this.zoomTween.progress >= 1) {
                this.camera.zoom = this.zoomTween.targetZoom;
                this.zoomTween.active = false;
            } else {
                const t = this.zoomTween.progress;
                const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                this.camera.zoom = this.zoomTween.startZoom + (this.zoomTween.targetZoom - this.zoomTween.startZoom) * eased;
            }
        }
        if (!this.cameraTween.active) {
            if (this.camera.autoRotate) {
                this.camera.rotY += 0.003;
            } else if (!this.mouse.down) {
                this.camera.rotY += this.camera.velocityY;
                this.camera.rotX += this.camera.velocityX;
                this.camera.rotX = Math.max(-ROTATION_LIMIT, Math.min(ROTATION_LIMIT, this.camera.rotX));
                this.camera.velocityY *= MOMENTUM_FRICTION;
                this.camera.velocityX *= MOMENTUM_FRICTION;
                if (Math.abs(this.camera.velocityY) < MOMENTUM_THRESHOLD && Math.abs(this.camera.velocityX) < MOMENTUM_THRESHOLD) {
                    this.camera.velocityY = 0;
                    this.camera.velocityX = 0;
                }
            }
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.render();
        if (this.hoveredDreamer) {
            this.canvas.style.cursor = 'pointer';
        } else {
            this.canvas.style.cursor = this.mouse.down ? 'grabbing' : 'grab';
        }
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
    render() {
        this.ctx.save();
        const centerX = this.centerX;
        const centerY = this.centerY;
        const project = (x, y, z) => {
            const cosX = Math.cos(this.camera.rotX);
            const sinX = Math.sin(this.camera.rotX);
            const cosY = Math.cos(this.camera.rotY);
            const sinY = Math.sin(this.camera.rotY);
            let x1 = x * cosY + z * sinY;
            let z1 = -x * sinY + z * cosY;
            let y1 = y * cosX - z1 * sinX;
            let z2 = y * sinX + z1 * cosX;
            const scale = this.camera.zoom * 2.5;
            return {
                x: centerX + x1 * scale,
                y: centerY - y1 * scale,
                z: z2
            };
        };
        const axisLength = 2000;
        const labelDistance = 90;
        const origin = project(0, 0, 0);
        function axisLabelPos(axisVec) {
            const mag = Math.sqrt(axisVec[0]*axisVec[0] + axisVec[1]*axisVec[1] + axisVec[2]*axisVec[2]);
            const nx = axisVec[0] / mag;
            const ny = axisVec[1] / mag;
            const nz = axisVec[2] / mag;
            return project(nx * labelDistance, ny * labelDistance, nz * labelDistance);
        }
        const xNeg = project(-axisLength, 0, 0);
        const xPos = project(axisLength, 0, 0);
        const yNeg = project(0, -axisLength, 0);
        const yPos = project(0, axisLength, 0);
        const zNeg = project(0, 0, -axisLength);
        const zPos = project(0, 0, axisLength);
        const xNegLabel = axisLabelPos([-1,0,0]);
        const xPosLabel = axisLabelPos([1,0,0]);
        const yNegLabel = axisLabelPos([0,-1,0]);
        const yPosLabel = axisLabelPos([0,1,0]);
        const zNegLabel = axisLabelPos([0,0,-1]);
        const zPosLabel = axisLabelPos([0,0,1]);
        let axisSegments = [
            { from: xNeg, to: origin, z: (xNeg.z + origin.z) / 2, label: 'Oblivion', labelPos: xNegLabel },
            { from: origin, to: xPos, z: (origin.z + xPos.z) / 2, label: 'Entropy', labelPos: xPosLabel },
            { from: yNeg, to: origin, z: (yNeg.z + origin.z) / 2, label: 'Authority', labelPos: yNegLabel },
            { from: origin, to: yPos, z: (origin.z + yPos.z) / 2, label: 'Liberty', labelPos: yPosLabel },
            { from: zNeg, to: origin, z: (zNeg.z + origin.z) / 2, label: 'Skeptic', labelPos: zNegLabel },
            { from: origin, to: zPos, z: (origin.z + zPos.z) / 2, label: 'Receptive', labelPos: zPosLabel }
        ];
        let shouldHideYAxis = false;
        if (this.currentView === 'xz') {
            if (this.cameraTween.active) {
                shouldHideYAxis = this.cameraTween.progress > 0.5;
            } else {
                shouldHideYAxis = true;
            }
        }
        if (shouldHideYAxis) {
            axisSegments = axisSegments.filter(seg => seg.label !== 'Authority' && seg.label !== 'Liberty');
        }
        const dreamersWithPos = this.dreamers.map(d => {
            const pos = project(d.x, d.y, d.z);
            const zonesContaining = this.zones.filter(zone => {
                if (zone.type === 'sphere') {
                    return this.isPointInSphere(d, zone);
                } else if (zone.type === 'hull') {
                    return this.isPointInHull(d, zone);
                }
                return false;
            });
            return { dreamer: d, pos, zonesContaining };
        });
        this.zones.forEach(zone => {
            if (zone.type === 'sphere') {
                this.renderSphereZone(zone, project);
            } else if (zone.type === 'hull') {
                this.renderSimpleHullZone(zone, project);
            }
        });
        const renderQueue = [
            ...axisSegments.map(seg => ({ type: 'axis', data: seg, z: seg.z })),
            ...dreamersWithPos.map(d => ({ type: 'dreamer', data: d, z: d.pos.z })),
            { type: 'origin', data: origin, z: origin.z }
        ].sort((a, b) => a.z - b.z);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.hoveredDreamer = null;
        this.labelBounds = [];
        for (const item of renderQueue) {
            if (item.type === 'axis') {
                this.ctx.strokeStyle = 'rgba(115, 75, 161, 0.35)';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(item.data.from.x, item.data.from.y);
                this.ctx.lineTo(item.data.to.x, item.data.to.y);
                this.ctx.stroke();
                if (this.options.showLabels && this.shouldShowLabel(item.data.label)) {
                    const label = item.data.label;
                    const labelPos = item.data.labelPos;
                    const isVerticalAxis = (label === 'Authority' || label === 'Liberty');
                    const isHorizontalInPosition = (this.currentView === 'xz' && (label === 'Skeptic' || label === 'Receptive'));
                    if (isVerticalAxis || isHorizontalInPosition) {
                        this.ctx.save();
                        this.ctx.font = '600 11px monospace';
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        this.ctx.fillStyle = '#6b4fa1';
                        let fixedY;
                        if (label === 'Liberty' || label === 'Receptive') {
                            fixedY = 20;
                        } else if (label === 'Authority' || label === 'Skeptic') {
                            fixedY = this.canvas.height - 20;
                        }
                        this.ctx.fillText(label, centerX, fixedY);
                        this.ctx.restore();
                    } else {
                        if (this.currentView === '3d') {
                            const dx = item.data.to.x - item.data.from.x;
                            const dy = item.data.to.y - item.data.from.y;
                            let angle = Math.atan2(dy, dx);
                            if (angle > Math.PI / 2) {
                                angle -= Math.PI;
                            } else if (angle < -Math.PI / 2) {
                                angle += Math.PI;
                            }
                            this.ctx.save();
                            this.ctx.translate(labelPos.x, labelPos.y);
                            this.ctx.rotate(angle);
                            this.ctx.font = '600 11px monospace';
                            this.ctx.textAlign = 'center';
                            this.ctx.textBaseline = 'middle';
                            this.ctx.fillStyle = '#6b4fa1';
                            this.ctx.fillText(label, 0, -7);
                            this.ctx.restore();
                        } else {
                            this.ctx.save();
                            this.ctx.font = '600 11px monospace';
                            this.ctx.textAlign = 'center';
                            this.ctx.textBaseline = 'bottom';
                            this.ctx.fillStyle = '#6b4fa1';
                            const from = item.data.from;
                            const to = item.data.to;
                            const dx = to.x - from.x;
                            const dy = to.y - from.y;
                            const length = Math.sqrt(dx * dx + dy * dy);
                            const usePositiveEnd = (label === 'Entropy' || label === 'Receptive');
                            let targetX, targetY;
                            if (usePositiveEnd) {
                                targetX = to.x;
                                targetY = to.y;
                            } else {
                                targetX = from.x;
                                targetY = from.y;
                            }
                            const buffer = 30;
                            const clampedX = Math.max(buffer, Math.min(this.canvas.width - buffer, targetX));
                            const clampedY = Math.max(buffer, Math.min(this.canvas.height - buffer, targetY));
                            let finalX = clampedX;
                            let finalY = clampedY;
                            if (clampedX !== targetX || clampedY !== targetY) {
                                const moveBackDistance = 10;
                                const dirX = dx / length;
                                const dirY = dy / length;
                                if (usePositiveEnd) {
                                    finalX = clampedX - dirX * moveBackDistance;
                                    finalY = clampedY - dirY * moveBackDistance;
                                } else {
                                    finalX = clampedX + dirX * moveBackDistance;
                                    finalY = clampedY + dirY * moveBackDistance;
                                }
                            }
                            this.ctx.fillText(label, finalX, finalY - 7);
                            this.ctx.restore();
                        }
                    }
                }
            } else if (item.type === 'origin') {
                this.ctx.fillStyle = 'rgba(115, 75, 161, 0.5)';
                this.ctx.beginPath();
                this.ctx.arc(item.data.x, item.data.y, 3, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (item.type === 'dreamer') {
                const { dreamer, pos, zonesContaining } = item.data;
                this.renderDreamer(dreamer, pos, zonesContaining);
            }
        }
        this.ctx.restore();
    }
    renderDreamer(dreamer, pos, zonesContaining = []) {
        const depthScale = 1 + (pos.z / 400);
        const clampedScale = Math.max(0.5, Math.min(1.5, depthScale));
        const breath = Math.sin(this.time * 2 + dreamer.phase) * 0.15 + 1;
        const baseRadius = 8 * clampedScale;
        const radius = baseRadius * breath;
        const dx = this.mouse.x - pos.x;
        const dy = this.mouse.y - pos.y;
        const isHovered = dx * dx + dy * dy < (radius + 5) ** 2;
        if (isHovered) {
            this.hoveredDreamer = dreamer;
        }
        let color = this.getOctantColor(dreamer.x, dreamer.y, dreamer.z);
        if (zonesContaining && zonesContaining.length > 0) {
            const zoneColor = zonesContaining[0].color;
            const blendAmount = 0.4;
            color = {
                r: Math.round(color.r * (1 - blendAmount) + zoneColor.r * blendAmount),
                g: Math.round(color.g * (1 - blendAmount) + zoneColor.g * blendAmount),
                b: Math.round(color.b * (1 - blendAmount) + zoneColor.b * blendAmount)
            };
        }
        const isErrantson = dreamer.name === 'errantson' || dreamer.name === 'Reverie House';
        this.renderDreamerDot(pos, radius, clampedScale, color, isErrantson, isHovered);
        const shouldShowLabel = isHovered || (this.options.showAllNames && dreamer.name !== 'Reverie House');
        if (shouldShowLabel) {
            this.ctx.font = 'bold 13px monospace';
            const metrics = this.ctx.measureText(dreamer.name);
            const padding = 6;
            const labelHeight = 18 + padding * 2;
            const labelWidth = metrics.width + padding * 2;
            const idealLabelY = pos.y - radius - 25;
            const buffer = 10;
            let labelX = pos.x;
            let labelY = idealLabelY;
            const halfWidth = labelWidth / 2;
            if (labelX - halfWidth < buffer) {
                labelX = buffer + halfWidth;
            } else if (labelX + halfWidth > this.canvas.width - buffer) {
                labelX = this.canvas.width - buffer - halfWidth;
            }
            if (labelY - labelHeight < buffer) {
                labelY = buffer + labelHeight;
            }
            const lineStartY = pos.y - radius;
            const lineEndY = labelY + padding;
            this.ctx.strokeStyle = 'rgba(107, 79, 161, 0.25)';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x, lineStartY);
            this.ctx.lineTo(labelX, lineEndY);
            this.ctx.stroke();
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            this.ctx.fillRect(
                labelX - halfWidth,
                labelY - labelHeight,
                labelWidth,
                labelHeight
            );
            this.ctx.fillStyle = '#372e42';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(dreamer.name, labelX, labelY - labelHeight / 2);
        }
    }
    renderDreamerDot(pos, radius, clampedScale, color, isErrantson, isHovered) {
        if (isErrantson) {
            const bubbleGlowRadius = radius + (isHovered ? 12 : 8) * clampedScale;
            const bubbleGlow = this.ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, bubbleGlowRadius);
            bubbleGlow.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${isHovered ? 0.25 : 0.15})`);
            bubbleGlow.addColorStop(0.7, `rgba(${color.r}, ${color.g}, ${color.b}, 0.08)`);
            bubbleGlow.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
            this.ctx.fillStyle = bubbleGlow;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, bubbleGlowRadius, 0, Math.PI * 2);
            this.ctx.fill();
            const bubbleGradient = this.ctx.createRadialGradient(
                pos.x - radius * 0.3, pos.y - radius * 0.3, radius * 0.1,
                pos.x, pos.y, radius
            );
            bubbleGradient.addColorStop(0, `rgba(255, 255, 255, 0.95)`);
            bubbleGradient.addColorStop(0.4, `rgba(${color.r * 0.3 + 255 * 0.7}, ${color.g * 0.3 + 255 * 0.7}, ${color.b * 0.3 + 255 * 0.7}, 0.85)`);
            bubbleGradient.addColorStop(1, `rgba(${color.r * 0.4 + 150 * 0.6}, ${color.g * 0.4 + 150 * 0.6}, ${color.b * 0.4 + 150 * 0.6}, 0.75)`);
            this.ctx.fillStyle = bubbleGradient;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            const shineGradient = this.ctx.createRadialGradient(
                pos.x - radius * 0.35, pos.y - radius * 0.35, 0,
                pos.x - radius * 0.25, pos.y - radius * 0.25, radius * 0.65
            );
            shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
            shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            this.ctx.fillStyle = shineGradient;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = isHovered ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)';
            this.ctx.lineWidth = (isHovered ? 3.5 : 2.8) * clampedScale;
            this.ctx.stroke();
            const shadowGradient = this.ctx.createRadialGradient(
                pos.x + radius * 0.3, pos.y + radius * 0.3, 0,
                pos.x, pos.y, radius
            );
            shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            shadowGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
            shadowGradient.addColorStop(1, `rgba(${color.r * 0.3}, ${color.g * 0.3}, ${color.b * 0.3}, 0.15)`);
            this.ctx.fillStyle = shadowGradient;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            const glowRadius = radius + (isHovered ? 15 : 8) * clampedScale;
            const gradient = this.ctx.createRadialGradient(pos.x, pos.y, radius, pos.x, pos.y, glowRadius);
            gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`);
            gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = isHovered ? '#ffffff' : `rgba(255, 255, 255, 0.6)`;
            this.ctx.lineWidth = (isHovered ? 3.5 : 2.8) * clampedScale;
            this.ctx.stroke();
        }
    }
    getOctantColor(x, y, z) {
        const xSign = x > 0 ? '+' : '-';
        const ySign = y > 0 ? '+' : '-';
        const zSign = z > 0 ? '+' : '-';
        const key = xSign + ySign + zSign;
        const baseColor = OCTANT_RGB[key];
        let { r, g, b } = baseColor;
        const distance = Math.sqrt(x*x + y*y + z*z);
        const maxDistance = 173;
        const intensity = Math.min(1, distance / maxDistance);
        const fade = 0.4 + (intensity * 0.6);
        r = Math.round(255 - (255 - r) * fade);
        g = Math.round(255 - (255 - g) * fade);
        b = Math.round(255 - (255 - b) * fade);
        return { r, g, b };
    }
    isPointInSphere(dreamer, zone) {
        const dx = dreamer.x - zone.center_coords.x;
        const dy = dreamer.y - zone.center_coords.y;
        const dz = dreamer.z - zone.center_coords.z;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        return distance <= zone.radius;
    }
    isPointInHull(dreamer, zone) {
        if (!zone.point_coords || zone.point_coords.length < 4) return false;
        const px = dreamer.x;
        const py = dreamer.y;
        const pz = dreamer.z;
        const points3D = zone.point_coords.map(p => ({
            x: (p.entropy || 0) - (p.oblivion || 0),
            y: (p.liberty || 0) - (p.authority || 0),
            z: (p.receptive || 0) - (p.skeptic || 0)
        }));
        const centroid = {
            x: points3D.reduce((sum, p) => sum + p.x, 0) / points3D.length,
            y: points3D.reduce((sum, p) => sum + p.y, 0) / points3D.length,
            z: points3D.reduce((sum, p) => sum + p.z, 0) / points3D.length
        };
        const n = points3D.length;
        const tolerance = 0.1;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                for (let k = j + 1; k < n; k++) {
                    const p1 = points3D[i];
                    const p2 = points3D[j];
                    const p3 = points3D[k];
                    const v1x = p2.x - p1.x, v1y = p2.y - p1.y, v1z = p2.z - p1.z;
                    const v2x = p3.x - p1.x, v2y = p3.y - p1.y, v2z = p3.z - p1.z;
                    const nx = v1y * v2z - v1z * v2y;
                    const ny = v1z * v2x - v1x * v2z;
                    const nz = v1x * v2y - v1y * v2x;
                    const normalLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
                    if (normalLen < 0.001) continue;
                    let posCount = 0, negCount = 0;
                    for (let m = 0; m < n; m++) {
                        if (m === i || m === j || m === k) continue;
                        const p = points3D[m];
                        const dot = nx * (p.x - p1.x) + ny * (p.y - p1.y) + nz * (p.z - p1.z);
                        if (dot > tolerance) posCount++;
                        else if (dot < -tolerance) negCount++;
                    }
                    const isHullFace = (posCount === 0 || negCount === 0);
                    if (!isHullFace) continue;
                    const faceCenterX = (p1.x + p2.x + p3.x) / 3;
                    const faceCenterY = (p1.y + p2.y + p3.y) / 3;
                    const faceCenterZ = (p1.z + p2.z + p3.z) / 3;
                    const toCentroidX = centroid.x - faceCenterX;
                    const toCentroidY = centroid.y - faceCenterY;
                    const toCentroidZ = centroid.z - faceCenterZ;
                    const centroidDot = nx * toCentroidX + ny * toCentroidY + nz * toCentroidZ;
                    const pointDot = nx * (px - p1.x) + ny * (py - p1.y) + nz * (pz - p1.z);
                    if ((centroidDot > 0 && pointDot < -tolerance) || 
                        (centroidDot < 0 && pointDot > tolerance)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    renderSphereZone(zone, project) {
        const color = zone.color;
        let centerX = 0, centerY = 0, centerZ = 0;
        if (zone.center_coords) {
            const c = zone.center_coords;
            centerX = (c.entropy || 0) - (c.oblivion || 0);
            centerY = (c.liberty || 0) - (c.authority || 0);
            centerZ = (c.receptive || 0) - (c.skeptic || 0);
        } else if (zone.center_did) {
            const dreamer = this.dreamers.find(d => d.handle && d.handle.includes(zone.center_did.split(':')[2]));
            if (dreamer) {
                centerX = dreamer.x;
                centerY = dreamer.y;
                centerZ = dreamer.z;
            } else {
                return;
            }
        }
        const centerPos = project(centerX, centerY, centerZ);
        const radiusPoint = project(centerX + zone.radius, centerY, centerZ);
        const screenRadius = Math.abs(radiusPoint.x - centerPos.x);
        this.ctx.save();
        this.ctx.globalAlpha = color.a || 0.15;
        this.ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        this.ctx.beginPath();
        this.ctx.arc(centerPos.x, centerPos.y, screenRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = (color.a || 0.15) * 2;
        this.ctx.strokeStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.restore();
    }
    renderSimpleHullZone(zone, project) {
        if (!zone.point_coords || zone.point_coords.length < 4) return;
        const color = zone.color;
        const points3D = zone.point_coords.map(p => {
            const x = (p.entropy || 0) - (p.oblivion || 0);
            const y = (p.liberty || 0) - (p.authority || 0);
            const z = (p.receptive || 0) - (p.skeptic || 0);
            return { 
                x, y, z,
                projected: project(x, y, z)
            };
        });
        this.ctx.save();
        const centroid = {
            x: points3D.reduce((sum, p) => sum + p.x, 0) / points3D.length,
            y: points3D.reduce((sum, p) => sum + p.y, 0) / points3D.length,
            z: points3D.reduce((sum, p) => sum + p.z, 0) / points3D.length
        };
        const faces = [];
        const n = points3D.length;
        const tolerance = 0.1;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                for (let k = j + 1; k < n; k++) {
                    const p1 = points3D[i];
                    const p2 = points3D[j];
                    const p3 = points3D[k];
                    const v1x = p2.x - p1.x, v1y = p2.y - p1.y, v1z = p2.z - p1.z;
                    const v2x = p3.x - p1.x, v2y = p3.y - p1.y, v2z = p3.z - p1.z;
                    const nx = v1y * v2z - v1z * v2y;
                    const ny = v1z * v2x - v1x * v2z;
                    const nz = v1x * v2y - v1y * v2x;
                    const normalLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
                    if (normalLen < 0.001) continue;
                    let posCount = 0, negCount = 0;
                    for (let m = 0; m < n; m++) {
                        if (m === i || m === j || m === k) continue;
                        const p = points3D[m];
                        const dot = nx * (p.x - p1.x) + ny * (p.y - p1.y) + nz * (p.z - p1.z);
                        if (dot > tolerance) posCount++;
                        else if (dot < -tolerance) negCount++;
                    }
                    const isHullFace = (posCount === 0 || negCount === 0);
                    if (isHullFace) {
                        const faceCenterX = (p1.x + p2.x + p3.x) / 3;
                        const faceCenterY = (p1.y + p2.y + p3.y) / 3;
                        const faceCenterZ = (p1.z + p2.z + p3.z) / 3;
                        const outwardX = faceCenterX - centroid.x;
                        const outwardY = faceCenterY - centroid.y;
                        const outwardZ = faceCenterZ - centroid.z;
                        const dotProduct = nx * outwardX + ny * outwardY + nz * outwardZ;
                        if (dotProduct > 0) {
                            const avgZ = (p1.projected.z + p2.projected.z + p3.projected.z) / 3;
                            faces.push({
                                points: [p1.projected, p2.projected, p3.projected],
                                z: avgZ
                            });
                        }
                    }
                }
            }
        }
        faces.sort((a, b) => a.z - b.z);
        for (const face of faces) {
            this.ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a || 0.15})`;
            this.ctx.beginPath();
            this.ctx.moveTo(face.points[0].x, face.points[0].y);
            this.ctx.lineTo(face.points[1].x, face.points[1].y);
            this.ctx.lineTo(face.points[2].x, face.points[2].y);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.min(1, (color.a || 0.15) * 3)})`;
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
        }
        this.ctx.restore();
    }
    renderHullZone(zone, project) {
        if (!zone.vertices || !zone.edges) return;
        const color = zone.color;
        const vertices3D = zone.vertices.map(v => {
            const x = (v.entropy || 0) - (v.oblivion || 0);
            const y = (v.liberty || 0) - (v.authority || 0);
            const z = (v.receptive || 0) - (v.skeptic || 0);
            return { x, y, z };
        });
        const projectedVertices = vertices3D.map(v => project(v.x, v.y, v.z));
        this.ctx.save();
        this.ctx.globalAlpha = (color.a || 0.15) * 2;
        this.ctx.strokeStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        this.ctx.lineWidth = 1.5;
        zone.edges.forEach(edge => {
            const [i, j, k] = edge;
            this.ctx.beginPath();
            this.ctx.moveTo(projectedVertices[i].x, projectedVertices[i].y);
            this.ctx.lineTo(projectedVertices[j].x, projectedVertices[j].y);
            this.ctx.lineTo(projectedVertices[k].x, projectedVertices[k].y);
            this.ctx.closePath();
            this.ctx.stroke();
        });
        this.ctx.globalAlpha = color.a || 0.15;
        this.ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        zone.edges.forEach(edge => {
            const [i, j, k] = edge;
            const v1 = projectedVertices[i];
            const v2 = projectedVertices[j];
            const v3 = projectedVertices[k];
            const dx1 = v2.x - v1.x;
            const dy1 = v2.y - v1.y;
            const dx2 = v3.x - v1.x;
            const dy2 = v3.y - v1.y;
            const cross = dx1 * dy2 - dy1 * dx2;
            if (cross > 0) {
                this.ctx.beginPath();
                this.ctx.moveTo(v1.x, v1.y);
                this.ctx.lineTo(v2.x, v2.y);
                this.ctx.lineTo(v3.x, v3.y);
                this.ctx.closePath();
                this.ctx.fill();
            }
        });
        this.ctx.restore();
    }
}
window.SpectrumTimelineViewer = SpectrumTimelineViewer;
