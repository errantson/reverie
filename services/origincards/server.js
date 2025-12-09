const express = require('express');
const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

const SPECTRUM_DIR = '/srv/site/spectrum';
const ASSETS_DIR = '/srv/site/assets';
const SOUVENIRS_DIR = '/srv/site/souvenirs';

// Ensure directory exists
async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (e) {
        // Directory exists
    }
}

// Octant info (from spectrum-utils.js)
const OCTANT_INFO = {
    'adaptive': { axes: 'Entropy • Liberty • Receptive', desc: 'embracing change prolongs freedom' },
    'chaotic': { axes: 'Entropy • Liberty • Skeptic', desc: 'increasing possibility unlocks momentum' },
    'prepared': { axes: 'Entropy • Authority • Receptive', desc: 'contemplative foresight averts disaster' },
    'intended': { axes: 'Entropy • Authority • Skeptic', desc: 'independent action delivers results' },
    'equilibrium': { axes: 'All Axes in Perfect Balance', desc: 'centered only to self' },
    'confused': { axes: 'One Axis Resolved, Two in Tension', desc: 'split decision clouds judgment' },
    'singling': { axes: 'Two Axes Resolved, One Dominant', desc: 'narrow dogma tightens vision' },
    'contented': { axes: 'Oblivion • Liberty • Receptive', desc: 'relentless acceptance begets peace' },
    'assertive': { axes: 'Oblivion • Liberty • Skeptic', desc: 'outbound query solves doubt' },
    'ordered': { axes: 'Oblivion • Authority • Receptive', desc: 'disciplined governence builds structure' },
    'guarded': { axes: 'Oblivion • Authority • Skeptic', desc: 'protective rejection averts malinfluence' }
};

function getOctantInfo(octantName) {
    return OCTANT_INFO[octantName] || OCTANT_INFO['equilibrium'];
}

// Octant colors (from spectrumpreview.js)
const OCTANT_COLORS = {
    'adaptive': { base: 'rgb(100, 255, 200)', dark: 'rgb(45, 140, 100)' },
    'chaotic': { base: 'rgb(100, 200, 255)', dark: 'rgb(45, 110, 150)' },
    'intended': { base: 'rgb(255, 100, 150)', dark: 'rgb(160, 50, 90)' },
    'prepared': { base: 'rgb(255, 180, 100)', dark: 'rgb(150, 100, 50)' },
    'contented': { base: 'rgb(255, 150, 255)', dark: 'rgb(141, 87, 141)' },
    'assertive': { base: 'rgb(150, 150, 255)', dark: 'rgb(80, 80, 150)' },
    'ordered': { base: 'rgb(255, 255, 100)', dark: 'rgb(140, 140, 50)' },
    'guarded': { base: 'rgb(169, 85, 214)', dark: 'rgb(100, 50, 130)' },
    'equilibrium': { base: 'rgb(200, 200, 200)', dark: 'rgb(100, 100, 100)' },
    'confused': { base: 'rgb(180, 180, 200)', dark: 'rgb(90, 90, 110)' },
    'singling': { base: 'rgb(200, 180, 180)', dark: 'rgb(110, 90, 90)' }
};

// Axis colors
const AXIS_COLORS = {
    oblivion: 'rgb(150, 120, 180)',
    entropy: 'rgb(255, 120, 80)',
    authority: 'rgb(200, 60, 60)',
    liberty: 'rgb(80, 180, 255)',
    skeptic: 'rgb(255, 200, 80)',
    receptive: 'rgb(120, 220, 160)'
};

/**
 * Generate full spectrum origin image
 * EXACT replication of generateOriginImageCanvas from spectrumpreview.js
 */
app.post('/generate', async (req, res) => {
    try {
        const { handle, displayName, spectrum, avatar, coordinates } = req.body;
        
        if (!handle || !spectrum) {
            return res.status(400).json({ error: 'Missing required fields: handle, spectrum' });
        }
        
        console.log(`🎨 Generating origin card for ${handle}...`);
        
        // Create 1280x720 canvas (landscape for social media)
        const canvas = createCanvas(1280, 720);
        const ctx = canvas.getContext('2d');
        
        // Configure for pixel-perfect rendering (from spectrum-utils.js)
        ctx.imageSmoothingEnabled = false;
        
        // Load and draw background
        try {
            const bg = await loadImage(path.join(ASSETS_DIR, 'originBG.png'));
            ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
            console.log('✅ Background drawn');
        } catch (e) {
            console.log('⚠️  Background not found, using gradient');
            const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grad.addColorStop(0, '#0a0806');
            grad.addColorStop(1, '#1a1410');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Generate particles (80-120 particles)
        const seed = hashCode(handle);
        const rng = seededRandom(seed);
        const particleCount = Math.floor(80 + rng() * 40);
        
        for (let i = 0; i < particleCount; i++) {
            const x = rng() * canvas.width;
            const y = rng() * canvas.height;
            const size = rng() * 3 + 1;  // 1-4px
            const opacity = rng() * 0.6 + 0.2;
            
            ctx.fillStyle = `rgba(212, 175, 55, ${opacity})`;  // Gold particles
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        console.log(`✅ Drew ${particleCount} particles`);
        
        // Generate souvenir bubbles (4-8 bubbles)
        const bubbleCount = Math.floor(4 + rng() * 4);
        const souvenirFiles = await fs.readdir(SOUVENIRS_DIR);
        const svgFiles = souvenirFiles.filter(f => f.endsWith('.svg'));
        
        for (let i = 0; i < bubbleCount && i < svgFiles.length; i++) {
            const x = rng() * canvas.width;
            const y = rng() * canvas.height;
            const size = 80 + rng() * 60;  // 80-140px
            
            // Draw bubble with gradient
            const gradient = ctx.createRadialGradient(
                x - size * 0.2, y - size * 0.2, 0,
                x, y, size / 2
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(1, 'rgba(200, 220, 255, 0.4)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Inner shadow
            ctx.save();
            ctx.globalCompositeOperation = 'source-atop';
            const innerShadow = ctx.createRadialGradient(
                x + size * 0.15, y + size * 0.15, 0,
                x, y, size / 2
            );
            innerShadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
            innerShadow.addColorStop(0.7, 'rgba(0, 0, 0, 0.08)');
            ctx.fillStyle = innerShadow;
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // Try to load souvenir icon (SVG not supported by node-canvas, skip for now)
            // Icons will be missing but bubbles will show
        }
        console.log(`✅ Drew ${bubbleCount} souvenir bubbles`);
        
        // Load logo
        let logo;
        try {
            logo = await loadImage(path.join(ASSETS_DIR, 'logo.png'));
            console.log('✅ Logo loaded');
        } catch (e) {
            console.warn('⚠️  Logo not found');
        }
        
        // Load avatar if provided
        let avatarImage = null;
        if (avatar) {
            try {
                // Fetch avatar from URL
                const https = require('https');
                const http = require('http');
                const url = require('url');
                
                const avatarData = await new Promise((resolve, reject) => {
                    const parsedUrl = url.parse(avatar);
                    const protocol = parsedUrl.protocol === 'https:' ? https : http;
                    
                    protocol.get(avatar, (response) => {
                        const chunks = [];
                        response.on('data', (chunk) => chunks.push(chunk));
                        response.on('end', () => resolve(Buffer.concat(chunks)));
                        response.on('error', reject);
                    }).on('error', reject);
                });
                
                avatarImage = await loadImage(avatarData);
                console.log('✅ Avatar loaded');
            } catch (e) {
                console.warn('⚠️  Could not load avatar:', e.message);
            }
        }
        
        // Get octant name and info - USE ORIGIN OCTANT for origin cards!
        const octantName = spectrum.origin_octant || spectrum.octant || 'equilibrium';
        const octantInfo = getOctantInfo(octantName);
        const octantColor = OCTANT_COLORS[octantName] || OCTANT_COLORS['equilibrium'];
        
        // Get coordinate string - EXACT format from spectrumpreview.js
        // Use ORIGIN coordinates for origin cards
        const pad = (num) => String(Math.round(num)).padStart(2, '0');
        const coordinateText = `O${pad(spectrum.origin_oblivion || spectrum.oblivion || 0)} A${pad(spectrum.origin_authority || spectrum.authority || 0)} S${pad(spectrum.origin_skeptic || spectrum.skeptic || 0)} R${pad(spectrum.origin_receptive || spectrum.receptive || 0)} L${pad(spectrum.origin_liberty || spectrum.liberty || 0)} E${pad(spectrum.origin_entropy || spectrum.entropy || 0)}`;
        
        // OCTANT DISPLAY BOX - Wide format for landscape canvas
        const boxWidth = 880;
        const boxHeight = 630;
        const boxX = 20;
        const boxY = (canvas.height - boxHeight) / 2;  // Vertically centered
        
        // Background box with drop shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 25;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = 'rgba(26, 20, 16, 0.85)';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        
        // Reset shadow for border
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Border with octant color
        ctx.strokeStyle = octantColor.base.replace(')', ', 0.6)').replace('rgb', 'rgba');
        ctx.lineWidth = 3;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
        
        // Profile section
        let profileY = boxY + 22;
        
        // Avatar - 121px
        const avatarSize = 121;
        const avatarX = boxX + 28;
        const avatarY = profileY - 4;
        
        if (avatarImage) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();
            
            // Border around avatar
            ctx.strokeStyle = octantColor.base.replace(')', ', 0.8)').replace('rgb', 'rgba');
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.stroke();
            console.log('✅ Avatar drawn');
        }
        
        // Text next to avatar
        const profileTextX = avatarX + avatarSize + 28;
        let textY = avatarY;
        
        // Display name
        ctx.fillStyle = 'rgba(232, 213, 196, 0.95)';
        ctx.font = 'bold 39px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(displayName || handle, profileTextX, textY + 32);
        
        // Handle
        textY += 53;
        ctx.fillStyle = 'rgba(201, 184, 168, 0.75)';
        ctx.font = '31px system-ui, -apple-system, sans-serif';
        ctx.fillText(`@${handle}`, profileTextX, textY + 19);
        
        // Coordinates
        textY += 39;
        ctx.fillStyle = 'rgba(232, 213, 196, 0.95)';
        ctx.font = 'bold 26px "Courier New", monospace';
        ctx.fillText(coordinateText, profileTextX, textY + 16);
        
        // Octant name below avatar
        profileY = avatarY + avatarSize + 44;
        ctx.fillStyle = octantColor.base;
        ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 8;
        ctx.fillText(octantName.toUpperCase(), boxX + 48, profileY);
        ctx.shadowBlur = 0;
        
        // Octant description
        profileY += 41;
        ctx.fillStyle = octantColor.base;
        ctx.font = 'italic 26px Georgia, serif';
        ctx.fillText(octantInfo.desc, boxX + 48, profileY);
        
        // Divider
        profileY += 28;
        ctx.strokeStyle = octantColor.base;
        ctx.beginPath();
        ctx.moveTo(boxX + 55, profileY);
        ctx.lineTo(boxX + boxWidth - 55, profileY);
        ctx.stroke();
        
        // Three axis pair bars
        profileY += 58;
        const barWidth = boxWidth - 110;
        const barHeight = 81;
        const barSpacing = 36;
        
        const axisPairs = [
            {
                left: { name: 'Oblivion', value: spectrum.oblivion || 50, color: AXIS_COLORS.oblivion },
                right: { name: 'Entropy', value: spectrum.entropy || 50, color: AXIS_COLORS.entropy }
            },
            {
                left: { name: 'Authority', value: spectrum.authority || 50, color: AXIS_COLORS.authority },
                right: { name: 'Liberty', value: spectrum.liberty || 50, color: AXIS_COLORS.liberty }
            },
            {
                left: { name: 'Skeptic', value: spectrum.skeptic || 50, color: AXIS_COLORS.skeptic },
                right: { name: 'Receptive', value: spectrum.receptive || 50, color: AXIS_COLORS.receptive }
            }
        ];
        
        axisPairs.forEach((pair, i) => {
            const y = profileY + i * (barHeight + barSpacing);
            const barStartX = boxX + 55;
            
            // Calculate midline position
            const total = pair.left.value + pair.right.value;
            const leftRatio = pair.left.value / total;
            const midlineX = barStartX + (barWidth * leftRatio);
            
            // Background track
            ctx.fillStyle = 'rgba(50, 40, 45, 0.6)';
            ctx.fillRect(barStartX, y, barWidth, 41);
            
            // Gradient bar
            const barGradient = ctx.createLinearGradient(barStartX, 0, barStartX + barWidth, 0);
            barGradient.addColorStop(0, pair.left.color.replace(')', ', 0.9)').replace('rgb', 'rgba'));
            barGradient.addColorStop(leftRatio, pair.left.color.replace(')', ', 0.5)').replace('rgb', 'rgba'));
            barGradient.addColorStop(leftRatio, pair.right.color.replace(')', ', 0.5)').replace('rgb', 'rgba'));
            barGradient.addColorStop(1, pair.right.color.replace(')', ', 0.9)').replace('rgb', 'rgba'));
            ctx.fillStyle = barGradient;
            ctx.fillRect(barStartX, y, barWidth, 41);
            
            // Midline marker
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(midlineX - 3.5, y - 9, 7, 60);
            
            // Axis titles
            ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = pair.left.color.replace(')', ', 0.9)').replace('rgb', 'rgba');
            ctx.fillText(pair.left.name.toUpperCase(), barStartX, y - 14);
            ctx.textAlign = 'right';
            ctx.fillStyle = pair.right.color.replace(')', ', 0.9)').replace('rgb', 'rgba');
            ctx.fillText(pair.right.name.toUpperCase(), barStartX + barWidth, y - 14);
            
            // Values inside bars
            ctx.font = 'bold 32px "Courier New", monospace';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillText(Math.round(pair.left.value), barStartX + 15, y + 30);
            
            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillText(Math.round(pair.right.value), barStartX + barWidth - 15, y + 30);
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        });
        
        // Add logo to bottom-right
        if (logo) {
            const logoWidth = 330;
            const logoHeight = (logo.height / logo.width) * logoWidth;
            const logoX = boxX + boxWidth - logoWidth - 30 + (logoWidth * 1.25) - 15 - 5 - 4;
            const logoY = boxY + boxHeight - logoHeight - 20 + 5;
            
            ctx.shadowColor = 'rgba(0, 0, 0, 1)';
            ctx.shadowBlur = 60;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 25;
            ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            console.log('✅ Logo drawn');
        }
        
        // Save to file
        await ensureDir(SPECTRUM_DIR);
        const safeHandle = handle.replace(/[/\\]/g, '');
        const outputPath = path.join(SPECTRUM_DIR, `${safeHandle}.png`);
        
        const buffer = canvas.toBuffer('image/png', { compressionLevel: 9, quality: 0.95 });
        await fs.writeFile(outputPath, buffer);
        
        const sizeKB = (buffer.length / 1024).toFixed(2);
        console.log(`✅ Generated ${safeHandle}.png (${sizeKB} KB)`);
        
        res.json({
            success: true,
            url: `https://reverie.house/spectrum/${safeHandle}.png`,
            size: buffer.length
        });
        
    } catch (error) {
        console.error('❌ Generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'origincards' });
});

// Simple hash function for seeding RNG
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

// Seeded random number generator
function seededRandom(seed) {
    let state = seed;
    return function() {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

const PORT = 3050;
app.listen(PORT, () => {
    console.log(`🎨 Origin Cards service running on port ${PORT}`);
});
