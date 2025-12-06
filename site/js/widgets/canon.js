function generateCanonView(holders, key) {
    const souvenir = allSouvenirs[key];
    if (!souvenir || !souvenir.forms) return '<p style="color: #999;">No souvenir data found.</p>';
    const formKeys = souvenir.forms.map(form => form.key);
    const relevantCanon = allCanonEntries.filter(entry => {
        if (entry.type !== 'souvenir') return false;
        return entry.key && formKeys.includes(entry.key);
    });
    const dateGroups = {};
    relevantCanon.forEach(entry => {
        const date = new Date(entry.epoch * 1000).toDateString();
        if (!dateGroups[date]) dateGroups[date] = [];
        const dreamer = allDreamers.find(d => d.did === entry.did);
        const dreamerName = dreamer ? dreamer.name : 'unknown dreamer';
        dateGroups[date].push({
            ...entry,
            dreamerName: dreamerName
        });
    });
    const sortedDates = Object.keys(dateGroups).sort((a, b) => 
        new Date(b).getTime() - new Date(a).getTime()
    );
    if (sortedDates.length === 0) {
        return '<p style="color: #999; font-style: italic;">No canon entries found for this souvenir.</p>';
    }
    return `<div style="border-left: 2px solid var(--reverie-core-color, #734ba1); padding-left: 15px; margin-left: 10px;">
        ${sortedDates.map(date => `
            <div style="margin-bottom: 15px; position: relative;">
                <div style="
                    position: absolute; 
                    left: -20px; 
                    top: 5px; 
                    width: 12px; 
                    height: 12px; 
                    background: var(--reverie-core-color, #734ba1); 
                    border-radius: 50%; 
                    border: 2px solid white;
                "></div>
                <div style="font-weight: bold; color: #372e42; margin-bottom: 5px;">${date}</div>
                ${dateGroups[date].map(entry => {
                    let postIdElement = '';
                    if (entry.uri && entry.uri.includes('/app.bsky.feed.post/')) {
                        const postId = entry.uri.split('/').pop();
                        const atprotoUrl = `https://atproto-browser.vercel.app/at/${entry.uri}`;
                        postIdElement = `<code style="margin-left: 8px; font-family: monospace; font-size: 0.7em; color: #ccc; cursor: pointer; text-decoration: none;" onmouseover="this.style.color='#999'" onmouseout="this.style.color='#ccc'" onclick="window.open('${atprotoUrl}', '_blank')">${postId}</code>`;
                    }
                    return `
                    <div style="margin: 3px 0; padding-left: 10px; font-size: 14px; display: flex; align-items: center; justify-content: space-between;">
                        <div>
                                                        <a href="dreamer?did=${encodeURIComponent(entry.did)}" class="dreamer-link" data-dreamer-did="${encodeURIComponent(entry.did)}" style="color: var(--reverie-core-color, #734ba1); text-decoration: none;">
                                ${entry.name || 'Unknown'}
                            </a>
                            ${entry.url ? 
                                `<a href="${entry.url}" target="_blank" style="color: #666; font-size: 12px; text-decoration: none; cursor: pointer;"> ${entry.event}</a>` :
                                `<span style="color: #666; font-size: 12px;"> ${entry.event}</span>`
                            }
                        </div>
                        ${postIdElement}
                    </div>
                `;
                }).join('')}
            </div>
        `).join('')}
    </div>`;
}
