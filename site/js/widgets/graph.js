function generateGraphView(holders, key) {
    const souvenir = allSouvenirs[key];
    if (!souvenir || !souvenir.forms) {
        return '<div style="text-align: center; color: #999; padding: 20px;">No souvenir data available</div>';
    }
    const formKeys = souvenir.forms.map(form => form.key);
    const acquisitions = [];
    holders.forEach(holder => {
        formKeys.forEach(formKey => {
            if (formKey in holder.souvenirs) {
                const form = souvenir.forms.find(f => f.key === formKey);
                acquisitions.push({
                    timestamp: holder.souvenirs[formKey],
                    name: holder.name,
                    formKey: formKey,
                    formName: form ? form.name : formKey
                });
            }
        });
    });
    if (acquisitions.length === 0) {
        return '<div style="text-align: center; color: #999; padding: 20px;">No acquisition data to display</div>';
    }
    acquisitions.sort((a, b) => a.timestamp - b.timestamp);
    const uniquePoints = [];
    let cumulativeCount = 0;
    let currentTimestamp = null;
    acquisitions.forEach(acq => {
        if (acq.timestamp !== currentTimestamp) {
            currentTimestamp = acq.timestamp;
            cumulativeCount++;
            uniquePoints.push({
                timestamp: acq.timestamp,
                count: cumulativeCount,
                entries: [`${acq.name} (${acq.formName})`]
            });
        } else {
            cumulativeCount++;
            uniquePoints[uniquePoints.length - 1].count = cumulativeCount;
            uniquePoints[uniquePoints.length - 1].entries.push(`${acq.name} (${acq.formName})`);
        }
    });
    const startTime = uniquePoints[0].timestamp;
    const currentTime = Math.floor(Date.now() / 1000);
    const lastDataTime = uniquePoints[uniquePoints.length - 1].timestamp;
    const oneMonthAgo = currentTime - (30 * 24 * 60 * 60);
    const defaultToNowView = lastDataTime > oneMonthAgo;
    const graphId = `graph_${key}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createGraphContent = (useCurrentTime = true) => {
        // Get user color with fallback to default purple
        const userColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--reverie-core-color').trim() || '#734ba1';
        
        const endTime = useCurrentTime ? currentTime : lastDataTime;
        const timeRange = endTime - startTime || 86400;
        const maxCount = uniquePoints[uniquePoints.length - 1].count;
        const yAxisMax = uniquePoints.length === 1 ? maxCount * 2 : maxCount;
        const isMobile = window.innerWidth <= 768;
        const graphWidth = isMobile ? Math.min(window.innerWidth - 60, 300) : 350;
        const graphHeight = isMobile ? 140 : 160;
        const padding = isMobile ? 25 : 30;
        const minMarkerSpacing = 80;
        const maxMarkers = Math.floor(graphWidth / minMarkerSpacing);
        const optimalMarkers = Math.min(Math.max(2, uniquePoints.length), maxMarkers, 5);
        const timeMarkers = [];
        for (let i = 0; i < optimalMarkers; i++) {
            const ratio = i / (optimalMarkers - 1);
            const timePoint = startTime + (ratio * timeRange);
            const x = padding + (ratio * graphWidth);
            const date = new Date(timePoint * 1000);
            const isLastMarker = i === optimalMarkers - 1;
            timeMarkers.push({
                x,
                timePoint,
                date,
                isLastMarker,
                label: isLastMarker ? 
                    (useCurrentTime ? 'Now' : date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})) :
                    date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})
            });
        }
        return `
            <div style="position: relative; width: 100%; max-width: ${graphWidth + padding * 2}px; height: ${graphHeight + padding * 2}px; background: white; border: 1px solid #ddd; border-radius: 0; margin: 0 auto; transition: all 0.3s ease; overflow: hidden;">
                <!-- Graph area -->
                <svg width="100%" height="100%" viewBox="0 0 ${graphWidth + padding * 2} ${graphHeight + padding * 2}" style="position: absolute; top: 0; left: 0;" preserveAspectRatio="xMidYMid meet">
                    <!-- Grid lines -->
                    ${Array.from({length: 5}, (_, i) => {
                        const y = padding + (i * graphHeight / 4);
                        const value = Math.round(yAxisMax * (4 - i) / 4);
                        const fontSize = isMobile ? 8 : 10;
                        return `
                            <line x1="${padding}" y1="${y}" x2="${padding + graphWidth}" y2="${y}" 
                                  stroke="#f0f0f0" stroke-width="1"/>
                            <text x="${padding - 5}" y="${y + 3}" font-size="${fontSize}" fill="#999" text-anchor="end">${value}</text>
                        `;
                    }).join('')}
                    <!-- Time axis -->
                    ${uniquePoints.length > 1 ? timeMarkers.map(marker => {
                        const fontSize = isMobile ? 7 : 9;
                        return `
                        <line x1="${marker.x}" y1="${padding}" x2="${marker.x}" y2="${padding + graphHeight}" 
                              stroke="#f0f0f0" stroke-width="1" style="transition: all 0.3s ease;"/>
                        <text x="${marker.x}" y="${padding + graphHeight + 15}" font-size="${fontSize}" fill="#999" text-anchor="middle"
                              ${marker.isLastMarker ? `style="cursor: pointer; transition: all 0.3s ease;" onclick="toggleGraphTimeRange('${graphId}')"` : 'style="transition: all 0.3s ease;"'}>
                            ${marker.label}
                        </text>
                    `}).join('') : `
                        <text x="${padding}" y="${padding + graphHeight + 15}" font-size="${isMobile ? 7 : 9}" fill="#999" text-anchor="middle">
                            Past
                        </text>
                        <text x="${padding + graphWidth/2}" y="${padding + graphHeight + 15}" font-size="${isMobile ? 7 : 9}" fill="#999" text-anchor="middle">
                            ${new Date(startTime * 1000).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                        </text>
                        <text x="${padding + graphWidth}" y="${padding + graphHeight + 15}" font-size="${isMobile ? 7 : 9}" fill="#999" text-anchor="middle">
                            Future
                        </text>
                    `}
                    <!-- Data line -->
                    ${uniquePoints.length > 1 ? `
                        <polyline 
                            points="${uniquePoints.map(point => {
                                const x = padding + ((point.timestamp - startTime) / timeRange) * graphWidth;
                                const y = padding + graphHeight - ((point.count / yAxisMax) * graphHeight);
                                return `${x},${y}`;
                            }).join(' ')}"
                            fill="none" 
                            stroke="${userColor}" 
                            stroke-width="2"
                            style="transition: all 0.3s ease;"
                        />
                    ` : `
                        <line 
                            x1="${padding}" 
                            y1="${padding + graphHeight - ((uniquePoints[0].count / yAxisMax) * graphHeight)}"
                            x2="${padding + graphWidth}" 
                            y2="${padding + graphHeight - ((uniquePoints[0].count / yAxisMax) * graphHeight)}"
                            stroke="${userColor}" 
                            stroke-width="2"
                            style="transition: all 0.3s ease;"
                        />
                    `}
                    <!-- Data points -->
                    ${uniquePoints.map(point => {
                        const x = uniquePoints.length > 1 ? 
                            padding + ((point.timestamp - startTime) / timeRange) * graphWidth : 
                            padding + graphWidth / 2;
                        const y = padding + graphHeight - ((point.count / yAxisMax) * graphHeight);
                        const date = new Date(point.timestamp * 1000).toLocaleDateString();
                        const tooltip = `${point.entries.join(', ')} - ${date} (Count: ${point.count})`;
                        return `
                            <circle 
                                cx="${x}" 
                                cy="${y}" 
                                r="4" 
                                fill="${userColor}" 
                                stroke="white" 
                                stroke-width="2"
                                style="cursor: pointer; transition: all 0.3s ease;"
                            >
                                <title>${tooltip}</title>
                            </circle>
                        `;
                    }).join('')}
                </svg>
            </div>
        `;
    };
    if (!window.graphStates) {
        window.graphStates = {};
    }
    window.graphStates[graphId] = { useCurrentTime: defaultToNowView };
    window.toggleGraphTimeRange = function(graphId) {
        const state = window.graphStates[graphId];
        if (state) {
            state.useCurrentTime = !state.useCurrentTime;
            const container = document.getElementById(`graph-container-${graphId}`);
            if (container) {
                container.style.opacity = '0.7';
                container.style.transition = 'opacity 0.15s ease';
                setTimeout(() => {
                    container.innerHTML = createGraphContent(state.useCurrentTime);
                    container.style.opacity = '1';
                }, 150);
            }
        }
    };
    return `
        <div style="padding: 20px; background: #f8f8f8; border-radius: 8px; margin: 10px 0;">
            <div id="graph-container-${graphId}">
                ${createGraphContent(defaultToNowView)}
            </div>
        </div>
    `;
}
class GraphPage {
    constructor() {
        this.container = null;
        this.graphWidget = null;
        this.init();
    }
    init() {
        this.createPage();
        this.initialize();
    }
    createPage() {
        document.body.innerHTML = `
            <div class="about-container">
                <div class="section-header">
                    <h2>Reverie Network Graph</h2>
                </div>
                <div class="graph-container" id="graph-container">
                    <div class="graph-controls">
                        <button id="reset-view" class="btn">Reset View</button>
                        <button id="toggle-labels" class="btn">Toggle Labels</button>
                    </div>
                    <div class="graph-info" id="graph-info">
                        <strong>Network Overview</strong><br>
                        <span id="node-count">0</span> nodes<br>
                        <span id="connection-count">0</span> connections<br>
                        <em>Click and drag to explore</em>
                    </div>
                    <canvas id="graph-canvas" style="width: 100%; height: 100%;"></canvas>
                </div>
                <div class="graph-nav">
                    <p>Interactive visualization of connections between dreamers, stories, and souvenirs in the Reverie House network.</p>
                    <a href="index.html" class="btn">← Back to Home</a>
                </div>
            </div>
        `;
        this.addStyles();
        this.setupNavigation();
    }
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            body {
                margin: 0;
                padding: 20px;
                background: var(--page-background-color);
                font-family: Arial, sans-serif;
            }
            .about-container {
                max-width: 1200px;
                margin: 0 auto;
            }
            .section-header h2 {
                color: var(--reverie-core-color, #734ba1);
                font-size: 1.8rem;
                margin-bottom: 20px;
                text-align: center;
            }
            .graph-container {
                width: 100%;
                height: 80vh;
                border: 1px solid var(--border-color);
                background: var(--internal-background-color);
                position: relative;
                overflow: hidden;
            }
            .graph-controls {
                position: absolute;
                top: 10px;
                left: 10px;
                z-index: 100;
                background: rgba(255, 255, 255, 0.9);
                padding: 10px;
                border: 1px solid var(--border-color);
            }
            .graph-info {
                position: absolute;
                bottom: 10px;
                right: 10px;
                z-index: 100;
                background: rgba(255, 255, 255, 0.9);
                padding: 10px;
                border: 1px solid var(--border-color);
                font-size: 12px;
                max-width: 200px;
                font-family: monospace;
            }
            .graph-nav {
                margin-top: 20px;
                text-align: center;
            }
            .btn {
                background: var(--reverie-core-color, #734ba1);
                color: white;
                border: none;
                padding: 10px 20px;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                transition: all 0.3s ease;
                font-family: monospace;
                margin: 0 5px;
            }
            .btn:hover {
                filter: brightness(0.9);
                transform: translateY(-1px);
            }
        `;
        document.head.appendChild(style);
    }
    async initialize() {
        const dataManager = new DataManager();
        await dataManager.fetchAllData();
        if (typeof generateGraphView !== 'undefined') {
        } else {
            document.getElementById('graph-container').innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">
                    <div style="text-align: center;">
                        <h3>Graph Widget Loading...</h3>
                        <p>Network visualization will appear here</p>
                    </div>
                </div>
            `;
        }
        this.setupControls();
    }
    setupControls() {
        document.getElementById('reset-view')?.addEventListener('click', () => {
            if (this.graphWidget && this.graphWidget.resetView) {
                this.graphWidget.resetView();
            }
        });
        document.getElementById('toggle-labels')?.addEventListener('click', () => {
            if (this.graphWidget && this.graphWidget.toggleLabels) {
                this.graphWidget.toggleLabels();
            }
        });
    }
    setupNavigation() {
        document.title = 'Reverie Graph View - Interactive Network';
        if (!document.querySelector('link[rel="icon"]')) {
            const favicon = document.createElement('link');
            favicon.rel = 'icon';
            favicon.href = 'assets/favicon.ico';
            favicon.type = 'image/x-icon';
            document.head.appendChild(favicon);
        }
    }
    resetView() {
        if (this.graphWidget && this.graphWidget.resetView) {
            this.graphWidget.resetView();
        }
    }
    toggleLabels() {
        if (this.graphWidget && this.graphWidget.toggleLabels) {
            this.graphWidget.toggleLabels();
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('souvenir-container')) {
        window.graphPage = new GraphPage();
    }
});
window.GraphPage = GraphPage;
