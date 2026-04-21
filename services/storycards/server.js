const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

const STORYCARD_DIR = '/srv/reverie.house/site/assets/storycards';
const RESIDENCE_PHANERA = '/srv/reverie.house/site/souvenirs/residence/phanera.png';
const LOGO_IMAGE = '/srv/reverie.house/site/assets/logo.png';
const FOOTER_ICON = '/srv/reverie.house/site/assets/icon.png';

async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch {
        // Directory exists
    }
}

async function loadRemoteImage(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') return null;

    try {
        const https = require('https');
        const http = require('http');
        const makeRequest = (urlToFetch, redirectsLeft) => new Promise((resolve, reject) => {
            let finalUrl = urlToFetch;
            if (finalUrl.includes('cdn.bsky.app') && !finalUrl.match(/@(jpeg|png|webp)$/)) {
                finalUrl += '@jpeg';
            }
            const protocol = finalUrl.startsWith('https://') ? https : http;
            const req = protocol.get(
                finalUrl,
                {
                    headers: {
                        'User-Agent': 'reverie-storycards/1.0',
                        'Accept': 'image/*,*/*;q=0.8',
                    },
                },
                (response) => {
                    const status = response.statusCode || 0;
                    const location = response.headers.location;
                    if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
                        const nextUrl = location.startsWith('http') ? location : new URL(location, finalUrl).toString();
                        resolve(makeRequest(nextUrl, redirectsLeft - 1));
                        return;
                    }
                    if (status < 200 || status >= 300) {
                        reject(new Error(`Image fetch failed with status ${status}`));
                        return;
                    }
                    const chunks = [];
                    response.on('data', (chunk) => chunks.push(chunk));
                    response.on('end', () => resolve(Buffer.concat(chunks)));
                    response.on('error', reject);
                }
            );
            req.on('error', reject);
            req.setTimeout(8000, () => req.destroy(new Error('Image fetch timeout')));
        });

        const imageData = await makeRequest(imageUrl, 3);
        if (!imageData || !imageData.length) {
            return null;
        }
        return await loadImage(imageData);
    } catch {
        return null;
    }
}

function getStyleAt(formatting, index) {
    let bold = false;
    let italic = false;
    for (const span of formatting) {
        if (!span || typeof span.start !== 'number' || typeof span.end !== 'number') continue;
        if (index < span.start || index >= span.end) continue;
        if (span.type === 'bold') bold = true;
        if (span.type === 'italic') italic = true;
    }
    return { bold, italic };
}

function setFont(ctx, size, style) {
    const weight = style.bold ? 'bold ' : '';
    const italic = style.italic ? 'italic ' : '';
    ctx.font = `${italic}${weight}${size}px Georgia, Times New Roman, serif`;
}

function measureRuns(ctx, runs, size) {
    let width = 0;
    for (const run of runs) {
        setFont(ctx, size, run.style);
        width += ctx.measureText(run.text).width;
    }
    return width;
}

function pushRun(line, run) {
    if (!run.text) return;
    const prev = line.runs[line.runs.length - 1];
    if (prev && prev.style.bold === run.style.bold && prev.style.italic === run.style.italic) {
        prev.text += run.text;
    } else {
        line.runs.push(run);
    }
}

function makeRunsForChunk(chunk, startIndex, formatting) {
    const runs = [];
    for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i];
        const style = getStyleAt(formatting, startIndex + i);
        const prev = runs[runs.length - 1];
        if (prev && prev.style.bold === style.bold && prev.style.italic === style.italic) {
            prev.text += ch;
        } else {
            runs.push({ text: ch, style });
        }
    }
    return runs;
}

function layoutFormattedText(ctx, rawText, formatting, maxWidth, maxLines, fontSize) {
    const text = String(rawText || '').replace(/\r\n/g, '\n');
    const tokens = [];
    const re = /(\n\n+|\n|[^\s\n]+|[ \t]+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        tokens.push({ text: m[0], start: m.index });
    }

    const lines = [];
    let line = { runs: [] };

    const commitLine = (blank = false) => {
        lines.push(blank ? { runs: [], blank: true } : line);
        line = { runs: [] };
    };

    for (const token of tokens) {
        if (lines.length >= maxLines) break;

        if (token.text.startsWith('\n')) {
            commitLine(false);
            if (token.text.length >= 2 && lines.length < maxLines) {
                commitLine(true);
            }
            continue;
        }

        if (/^[ \t]+$/.test(token.text) && line.runs.length === 0) {
            continue;
        }

        const tokenRuns = makeRunsForChunk(token.text, token.start, formatting);
        const tokenWidth = measureRuns(ctx, tokenRuns, fontSize);
        const lineWidth = measureRuns(ctx, line.runs, fontSize);

        if (lineWidth + tokenWidth <= maxWidth) {
            tokenRuns.forEach((run) => pushRun(line, run));
            continue;
        }

        if (/^[ \t]+$/.test(token.text)) {
            continue;
        }

        if (line.runs.length > 0) {
            commitLine(false);
            if (lines.length >= maxLines) break;
        }

        let chunk = '';
        let chunkStart = token.start;
        for (let i = 0; i < token.text.length; i++) {
            const ch = token.text[i];
            const testChunk = chunk + ch;
            const testRuns = makeRunsForChunk(testChunk, chunkStart, formatting);
            if (measureRuns(ctx, testRuns, fontSize) <= maxWidth) {
                chunk = testChunk;
                continue;
            }

            if (chunk) {
                makeRunsForChunk(chunk, chunkStart, formatting).forEach((run) => pushRun(line, run));
                commitLine(false);
                if (lines.length >= maxLines) break;
            }

            chunk = ch;
            chunkStart = token.start + i;
        }

        if (lines.length >= maxLines) break;
        if (chunk) {
            makeRunsForChunk(chunk, chunkStart, formatting).forEach((run) => pushRun(line, run));
        }
    }

    if (lines.length < maxLines && line.runs.length > 0) {
        commitLine(false);
    }

    const originalCount = lines.length;
    const clipped = lines.slice(0, maxLines);
    const truncated = originalCount > maxLines;

    if (truncated && clipped.length > 0) {
        const ellipsis = '...';
        const lastLine = clipped[clipped.length - 1];
        if (!lastLine.runs.length) {
            lastLine.runs.push({ text: ellipsis, style: { bold: false, italic: false } });
        } else {
            let width = measureRuns(ctx, lastLine.runs, fontSize);
            while (width + ctx.measureText(ellipsis).width > maxWidth && lastLine.runs.length) {
                const run = lastLine.runs[lastLine.runs.length - 1];
                run.text = run.text.slice(0, -1);
                if (!run.text) lastLine.runs.pop();
                width = measureRuns(ctx, lastLine.runs, fontSize);
            }
            pushRun(lastLine, { text: ellipsis, style: { bold: false, italic: false } });
        }
    }

    return clipped;
}

function drawFormattedLines(ctx, lines, x, y, lineHeight, fontSize, color) {
    ctx.fillStyle = color;
    let lineIndex = 0;
    for (const line of lines) {
        const py = y + lineIndex * lineHeight;
        let px = x;
        if (!line.blank) {
            for (const run of line.runs) {
                setFont(ctx, fontSize, run.style);
                ctx.fillText(run.text, px, py);
                px += ctx.measureText(run.text).width;
            }
        }
        lineIndex += 1;
    }
}

function parseHexColor(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^#?([a-fA-F0-9]{6})$/);
    if (!match) return null;
    const hex = match[1];
    return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
    };
}

function rgba(color, alpha) {
    if (!color) return `rgba(255,255,255,${alpha})`;
    return `rgba(${color.r},${color.g},${color.b},${alpha})`;
}

app.post('/generate-story', async (req, res) => {
    try {
        const {
            storyId,
            title,
            text,
            createdAt,
            formatting,
            authorDisplay,
            authorHandle,
            authorColor,
            avatar,
            postImage,
            recordType,
            worldName,
        } = req.body || {};

        if (!storyId) {
            return res.status(400).json({ error: 'Missing required field: storyId' });
        }

        const safeId = String(storyId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
        if (!safeId) {
            return res.status(400).json({ error: 'Invalid storyId' });
        }

        await ensureDir(STORYCARD_DIR);

        const canvas = createCanvas(1200, 630);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        const accent = parseHexColor(authorColor);

        try {
            const bgImage = await loadImage(RESIDENCE_PHANERA);
            ctx.drawImage(bgImage, 0, 0, 1200, 630);
        } catch {
            const bg = ctx.createLinearGradient(0, 0, 1200, 630);
            bg.addColorStop(0, '#141a22');
            bg.addColorStop(1, '#2a3644');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, 1200, 630);
        }

        ctx.fillStyle = 'rgba(9, 13, 19, 0.55)';
        ctx.fillRect(0, 0, 1200, 630);

        const panelX = 64;
        const panelY = 54;
        const panelW = 1072;
        const panelH = 522;
        ctx.fillStyle = 'rgba(8, 11, 16, 0.72)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = rgba(accent, 0.8);
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        // Brand mark in top-right corner
        try {
            const logo = await loadImage(LOGO_IMAGE);
            const maxLogoW = 495;
            const maxLogoH = 80;
            const logoScale = Math.min(maxLogoW / logo.width, maxLogoH / logo.height);
            const lw = logo.width * logoScale;
            const lh = logo.height * logoScale;
            const logoX = panelX + panelW - lw - 28;
            const logoY = panelY + 16;
            ctx.globalAlpha = 0.95;
            ctx.drawImage(logo, logoX, logoY, lw, lh);
            ctx.globalAlpha = 1;
        } catch {
            // Optional logo only
        }

        const avatarImage = await loadRemoteImage(avatar);
        const postImageAsset = await loadRemoteImage(postImage);
        const hasPostImage = Boolean(postImageAsset) && recordType !== 'ink.branchline.bud';

        const avatarSize = 88;
        const avatarX = panelX + 28;
        const avatarY = panelY + 28;
        if (avatarImage) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();
            ctx.strokeStyle = rgba(accent, 0.9);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // Keep a visible identity mark even if remote avatar fetch fails.
            const initials = (authorDisplay || authorHandle || 'D')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0].toUpperCase())
                .join('') || 'D';
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = rgba(accent, 0.8);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.textAlign = 'center';
            ctx.font = 'bold 34px Arial, Helvetica, sans-serif';
            ctx.fillText(initials, avatarX + avatarSize / 2, avatarY + 56);
        }

        const authorX = avatarX + avatarSize + 22;
        const authorName = (authorDisplay || authorHandle || 'Dreamer').trim();
        const handleText = authorHandle ? `@${authorHandle}` : '@reverie.house';

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = 'bold 38px Arial, Helvetica, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(authorName, authorX, avatarY + 40);

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '24px Arial, Helvetica, sans-serif';
        ctx.fillText(handleText, authorX, avatarY + 74);

        const bodyX = panelX + 36;
        const bodyY = panelY + 164;
        const dividerY = panelY + panelH - 82;
        let bodyW = panelW - 72;

        if (hasPostImage) {
            const mediaW = 330;
            const textRegionTop = bodyY;
            const textRegionBottom = dividerY;
            const textRegionHeight = Math.max(180, textRegionBottom - textRegionTop);
            const mediaH = Math.max(180, Math.min(250, textRegionHeight - 14));
            const mediaX = panelX + panelW - mediaW - 36;
            const mediaY = textRegionTop + Math.floor((textRegionHeight - mediaH) / 2);
            bodyW = mediaX - bodyX - 28;

            ctx.save();
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(mediaX, mediaY, mediaW, mediaH);
            ctx.beginPath();
            ctx.rect(mediaX, mediaY, mediaW, mediaH);
            ctx.clip();

            const sourceW = postImageAsset.width || mediaW;
            const sourceH = postImageAsset.height || mediaH;
            const scale = Math.max(mediaW / sourceW, mediaH / sourceH);
            const drawW = sourceW * scale;
            const drawH = sourceH * scale;
            const drawX = mediaX + (mediaW - drawW) / 2;
            const drawY = mediaY + (mediaH - drawH) / 2;
            ctx.drawImage(postImageAsset, drawX, drawY, drawW, drawH);
            ctx.restore();

            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 2;
            ctx.strokeRect(mediaX, mediaY, mediaW, mediaH);
        }

        const postTitle = (title || '').trim();
        const textOnlyMode = !hasPostImage;
        let usedTitleHeight = 0;
        if (postTitle) {
            ctx.fillStyle = 'rgba(255,255,255,0.97)';
            const titleSize = textOnlyMode ? 44 : 48;
            const titleLineHeight = textOnlyMode ? 50 : 54;
            ctx.font = `bold ${titleSize}px Arial, Helvetica, sans-serif`;
            const titleLines = [];
            const titleWords = postTitle.replace(/\s+/g, ' ').trim().split(' ');
            let lineText = '';
            let wasTitleTruncated = false;
            for (const word of titleWords) {
                const candidate = lineText ? `${lineText} ${word}` : word;
                if (ctx.measureText(candidate).width <= bodyW) {
                    lineText = candidate;
                } else {
                    if (lineText) titleLines.push(lineText);
                    lineText = word;
                    if (titleLines.length >= 2) {
                        wasTitleTruncated = true;
                        break;
                    }
                }
            }
            if (titleLines.length < 2 && lineText) {
                titleLines.push(lineText);
            }
            const finalTitle = titleLines.slice(0, 2);
            if (wasTitleTruncated && finalTitle.length > 0) {
                const last = finalTitle.length - 1;
                let clipped = finalTitle[last].replace(/[\s.,;:!?-]+$/g, '');
                while (clipped.length > 3 && ctx.measureText(`${clipped}...`).width > bodyW) {
                    clipped = clipped.slice(0, -1).replace(/[\s.,;:!?-]+$/g, '');
                }
                finalTitle[last] = `${clipped}...`;
            }
            finalTitle.forEach((line, idx) => {
                ctx.fillText(line, bodyX, bodyY + idx * titleLineHeight);
            });
            usedTitleHeight = finalTitle.length * titleLineHeight;
        }

        const excerpt = (text || '').trim() || 'Discover this story in the Reverie House living archive.';
        const excerptY = postTitle ? bodyY + usedTitleHeight + 22 : bodyY + 14;
        const excerptLineHeight = textOnlyMode ? 30 : 34;
        const excerptFontSize = textOnlyMode ? 24 : 28;
        const availableHeight = panelY + panelH - 96 - excerptY;
        const maxExcerptLines = Math.max(3, Math.floor(availableHeight / excerptLineHeight));
        const safeFormatting = Array.isArray(formatting) ? formatting : [];
        const lines = layoutFormattedText(ctx, excerpt, safeFormatting, bodyW, maxExcerptLines, excerptFontSize);
        drawFormattedLines(
            ctx,
            lines,
            bodyX,
            excerptY,
            excerptLineHeight,
            excerptFontSize,
            'rgba(233, 239, 248, 0.94)'
        );

        ctx.strokeStyle = rgba(accent, 0.65);
        ctx.beginPath();
        ctx.moveTo(bodyX, dividerY);
        ctx.lineTo(panelX + panelW - 36, dividerY);
        ctx.stroke();

        // Bottom-left date from original story creation time
        let dateLabel = '';
        try {
            const dt = createdAt ? new Date(createdAt) : null;
            if (dt && !Number.isNaN(dt.getTime())) {
                const dd = String(dt.getUTCDate()).padStart(2, '0');
                const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
                const yyyy = String(dt.getUTCFullYear());
                dateLabel = `${dd}/${mm}/${yyyy}`;
            }
        } catch {
            dateLabel = '';
        }
        if (!dateLabel) dateLabel = '00/00/0000';
        ctx.fillStyle = 'rgba(255,255,255,0.84)';
        ctx.font = 'bold 24px Arial, Helvetica, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(dateLabel, bodyX, panelY + panelH - 36);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = '22px Arial, Helvetica, sans-serif';
        const footerText = 'reverie.house/story';
        const textX = panelX + panelW - 36;
        const textY = panelY + panelH - 36;
        try {
            const icon = await loadImage(FOOTER_ICON);
            const size = 28;
            const gap = 12;
            const textW = ctx.measureText(footerText).width;
            const iconX = textX - textW - gap - size;
            const iconY = textY - size + 5;
            ctx.drawImage(icon, iconX, iconY, size, size);
        } catch {
            // Optional icon only
        }
        ctx.fillText(footerText, textX, textY);

        const buffer = canvas.toBuffer('image/png', { compressionLevel: 9, quality: 0.95 });
        const outputPath = path.join(STORYCARD_DIR, `${safeId}.png`);
        await fs.writeFile(outputPath, buffer);

        return res.json({
            success: true,
            url: `https://reverie.house/assets/storycards/${safeId}.png`,
            size: buffer.length,
        });
    } catch (error) {
        console.error('Story card generation error:', error);
        return res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'storycards' });
});

const PORT = 3051;
app.listen(PORT, () => {
    console.log(`Storycards service running on port ${PORT}`);
});
