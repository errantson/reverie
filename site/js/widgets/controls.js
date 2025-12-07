
class Controls {
    constructor(container, spectrumVisualizer) {
        this.container = container;
        this.spectrum = spectrumVisualizer;
        this.currentView = '3d';
        this.showLabels = spectrumVisualizer.options.showLabels || false;
        this.showAllNames = spectrumVisualizer.options.showAllNames || false;
        this.render();
        this.attachEventListeners();
    }
    render() {
        const hideNamesButton = this.spectrum.isTouchDevice ? 'display: none;' : '';
        this.container.innerHTML = `
            <div class="controls">
                <div class="controls-section">
                    <div class="controls-section-title">Controls</div>
                    <div class="control-buttons">
                        <button class="control-btn ${this.showLabels ? 'active' : ''}" data-control="labels">
                            <span class="control-label">Axis Names</span>
                        </button>
                        <button class="control-btn ${this.showAllNames ? 'active' : ''}" data-control="names" style="${hideNamesButton}">
                            <span class="control-label">Dreamer Names</span>
                        </button>
                        <button class="control-btn" data-control="fit">
                            <span class="control-label">Fit Zoom</span>
                        </button>
                        <button class="control-btn" data-control="reset-origin">
                            <span class="control-label">Reset to Origin</span>
                        </button>
                    </div>
                </div>
                <div class="controls-section">
                    <div class="controls-section-title">Perspective</div>
                    <div class="perspective-buttons">
                        <button class="perspective-btn active" data-view="3d">
                            <span class="perspective-label">Balance</span>
                        </button>
                        <button class="perspective-btn" data-view="power-structure">
                            <span class="perspective-label">Force</span>
                        </button>
                        <button class="perspective-btn" data-view="belief-agency">
                            <span class="perspective-label">Agency</span>
                        </button>
                        <button class="perspective-btn" data-view="change-freedom">
                            <span class="perspective-label">Position</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    attachEventListeners() {
        const controlButtons = this.container.querySelectorAll('.control-btn');
        controlButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const control = btn.dataset.control;
                this.handleControlClick(control, btn);
            });
        });
        const perspectiveButtons = this.container.querySelectorAll('.perspective-btn');
        perspectiveButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.handleViewClick(view);
                perspectiveButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentView = view;
            });
        });
    }
    handleControlClick(control, button) {
        switch(control) {
            case 'labels':
                this.showLabels = !this.showLabels;
                this.spectrum.options.showLabels = this.showLabels;
                button.classList.toggle('active', this.showLabels);
                break;
            case 'names':
                if (this.spectrum.isTouchDevice) {
                    return;
                }
                this.showAllNames = !this.showAllNames;
                this.spectrum.options.showAllNames = this.showAllNames;
                button.classList.toggle('active', this.showAllNames);
                break;
            case 'fit':
                this.spectrum.fitZoomToDreamers();
                break;
            case 'reset-origin':
                this.resetAllToOrigin(button);
                break;
        }
    }
    async resetAllToOrigin(button) {
        button.disabled = true;
        button.innerHTML = '<span class="control-label">Resetting...</span>';
        try {
            const dreamers = this.spectrum.dreamers;
            let successCount = 0;
            let totalCount = dreamers.length;
            for (const dreamer of dreamers) {
                const did = await this.getDreamerDID(dreamer);
                if (did) {
                    const response = await fetch(`/api/spectrum/reset/${did}`, {
                        method: 'POST'
                    });
                    if (response.ok) {
                        const result = await response.json();
                        if (result.success) {
                            successCount++;
                        }
                    }
                }
                button.innerHTML = `<span class="control-label">Resetting ${successCount}/${totalCount}</span>`;
            }
            await this.spectrum.loadDreamers();
            button.disabled = false;
            button.innerHTML = '<span class="control-label">Reset to Origin</span>';
                    } catch (error) {
            console.error('Error resetting dreamers:', error);
            button.disabled = false;
            button.innerHTML = '<span class="control-label">Reset Failed</span>';
            setTimeout(() => {
                button.innerHTML = '<span class="control-label">Reset to Origin</span>';
            }, 2000);
        }
    }
    async getDreamerDID(dreamer) {
        try {
            const response = await fetch('/api/dreamers');
            const allDreamers = await response.json();
            const match = allDreamers.find(d => d.handle === dreamer.handle);
            return match ? match.did : null;
        } catch (error) {
            console.error('Error fetching dreamer DID:', error);
            return null;
        }
    }
    handleViewClick(view) {
        this.spectrum.camera.autoRotate = false;
        this.spectrum.camera.velocityX = 0;
        this.spectrum.camera.velocityY = 0;
        let targetRotX = 0;
        let targetRotY = 0;
        switch(view) {
            case '3d':
                targetRotX = 0.3;
                targetRotY = 0.5;
                this.spectrum.currentView = '3d';
                break;
            case 'power-structure':
                targetRotX = 0;
                targetRotY = 0;
                this.spectrum.currentView = 'xy';
                break;
            case 'belief-agency':
                targetRotX = 0;
                targetRotY = Math.PI / 2;
                this.spectrum.currentView = 'yz';
                break;
            case 'change-freedom':
                targetRotX = Math.PI / 2;
                targetRotY = 0;
                this.spectrum.currentView = 'xz';
                break;
        }
        const currentRotY = this.spectrum.camera.rotY;
        const rotYDiff = targetRotY - (currentRotY % (Math.PI * 2));
        if (rotYDiff > Math.PI) {
            targetRotY = currentRotY - (Math.PI * 2 - rotYDiff);
        } else if (rotYDiff < -Math.PI) {
            targetRotY = currentRotY + (Math.PI * 2 + rotYDiff);
        } else {
            targetRotY = currentRotY + rotYDiff;
        }
        this.spectrum.cameraTween.active = true;
        this.spectrum.cameraTween.startRotX = this.spectrum.camera.rotX;
        this.spectrum.cameraTween.startRotY = this.spectrum.camera.rotY;
        this.spectrum.cameraTween.targetRotX = targetRotX;
        this.spectrum.cameraTween.targetRotY = targetRotY;
        this.spectrum.cameraTween.progress = 0;
    }
    updateActiveView(view) {
        const buttons = this.container.querySelectorAll('.perspective-btn');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        this.currentView = view;
    }
}
