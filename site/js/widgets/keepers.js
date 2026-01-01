function generateKeepersView(holders, souvenirKey, allCanonEntries) {
    const souvenir = allSouvenirs[souvenirKey];
    if (!souvenir || !souvenir.forms) return '<p>No souvenir data available</p>';
    const formKeys = souvenir.forms.map(form => form.key);
    return holders.map((u, index) => {
        const dreamerForms = formKeys.filter(formKey => formKey in u.souvenirs);
        if (dreamerForms.length === 0) return '';
        const earliestFormKey = dreamerForms.reduce((earliest, formKey) => {
            const earliestEpoch = u.souvenirs[earliest] || Infinity;
            const currentEpoch = u.souvenirs[formKey] || Infinity;
            return currentEpoch < earliestEpoch ? formKey : earliest;
        });
        const timestamp = u.souvenirs[earliestFormKey];
        const date = new Date(timestamp * 1000);
        const dateStr = date.toLocaleDateString();
        const isRecent = (Date.now() - timestamp * 1000) < (7 * 24 * 60 * 60 * 1000);
        const formInfo = souvenir.forms.find(form => form.key === earliestFormKey);
        const formName = formInfo ? formInfo.name : earliestFormKey;
        let postIdElement = '';
        const canonEntries = allCanonEntries || [];
        const acquisitionEntry = canonEntries.find(entry => 
            entry.did === u.did && 
            entry.key === earliestFormKey &&
            Math.abs(entry.epoch - timestamp) < 60
        );
        if (acquisitionEntry && acquisitionEntry.uri && acquisitionEntry.uri.includes('/app.bsky.feed.post/')) {
            const postId = acquisitionEntry.uri.split('/').pop();
            const atprotoUrl = `https://atproto-browser.vercel.app/at/${acquisitionEntry.uri}`;
            postIdElement = `<code class="souvenir-uri" style="margin-left: 8px; font-family: monospace; font-size: 0.7em; color: #ccc; cursor: pointer; text-decoration: none;" onmouseover="this.style.color='#999'" onmouseout="this.style.color='#ccc'" onclick="window.open('${atprotoUrl}', '_blank')">${postId}</code>`;
        }
        let iconSrc = '';
        let iconAlt = '';
        let iconStyle = '';
        if (u.server === 'https://reverie.house') {
            if (u.handle.endsWith('reverie.house')) {
                iconSrc = 'assets/icon.png';
                iconAlt = 'Reverie House';
            } else {
                iconSrc = 'assets/icon.png';
                iconAlt = 'Reverie House';
                iconStyle = 'filter: grayscale(100%);';
            }
        } else if (u.server.includes('bsky.network')) {
            if (u.handle.endsWith('bsky.social')) {
                iconSrc = 'assets/bluesky.png';
                iconAlt = 'Bluesky';
            } else if (u.handle.endsWith('reverie.house')) {
                iconSrc = 'assets/icon.png';
                iconAlt = 'Dreamweaver';
                iconStyle = 'filter: saturate(40%);';
            } else {
                iconSrc = 'assets/bluesky.svg';
                iconAlt = 'Dreamer';
                iconStyle = 'filter: brightness(50%) saturate(80%);';
            }
        } else {
            iconSrc = 'assets/our_wild_mindscape.svg';
            iconAlt = 'Our Wild Mindscape';
        }
        return `<div class="keeper-entry" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 5px; border-bottom: 1px solid #f0f0f0;">
            <div>
                <img src="${iconSrc}" alt="${iconAlt}" title="${iconAlt}" style="width:20px; height:20px; vertical-align:middle; margin-right:8px; ${iconStyle}">
                <a href="dreamer?did=${encodeURIComponent(u.did)}" class="dreamer-link" data-dreamer-did="${encodeURIComponent(u.did)}">${u.name}</a>
                (<a href="https://bsky.app/profile/${u.did}" title="${u.handle.replace(/^@/, '')}">@${u.handle.replace(/^@/, '')}</a>)
                ${isRecent ? `<span style="color: var(--reverie-core-color, #734ba1); font-size: 12px; margin-left: 8px;">✨ new</span>` : ''}
            </div>
            <div class="souvenir-uri-container" style="color: #999; font-family: monospace; display: flex; align-items: center;">
                ${postIdElement}
            </div>
        </div>`;
    }).join('');
}
