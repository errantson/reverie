function displayProfile(dreamer) {
    // Update title with user name
    document.title = `Dreamweaver: ${dreamer.name}`;
    // Update profile picture
    const profilePictureEl = document.querySelector('.profile-picture');
    if (dreamer.avatar && dreamer.avatar.ref && dreamer.avatar.ref.$link) {
        let imgSrc = '';
        if (dreamer.server && (dreamer.server.includes('bsky.network') || dreamer.server === 'https://reverie.house')) {
            let ext = (dreamer.avatar.mimeType === 'image/jpeg') ? 'jpeg' : 'png';
            imgSrc = `https://cdn.bsky.app/img/feed_thumbnail/plain/${dreamer.did}/${dreamer.avatar.ref.$link}@${ext}`;
        } else {
            imgSrc = dreamer.avatar.ref.$link;
        }
        profilePictureEl.innerHTML = `<a href="https://bsky.app/profile/${dreamer.handle}" target="_blank" rel="noopener noreferrer">
            <img src="${imgSrc}" alt="${dreamer.name} Avatar" style="width:100px; height:100px; border-radius:50%;">
        </a>`;
    } else {
        profilePictureEl.innerHTML = `<a href="https://bsky.app/profile/${dreamer.handle}" target="_blank" rel="noopener noreferrer">
            <img src="assets/default-avatar.png" alt="Default Avatar" style="width:100px; height:100px; border-radius:50%;">
        </a>`;
    }

    // Update profile details (icon, name, handle, etc.)
    const profileDetails = document.getElementById('profile-details');
    let iconSrc = '';
    let iconAlt = '';
    let iconStyle = '';
    if (dreamer.server === 'https://reverie.house') {
        if (dreamer.handle.endsWith('reverie.house')) {
            iconSrc = '../assets/icon_transp.png';
            iconAlt = 'Reverie House';
        } else {
            iconSrc = 'assets/icon_transp.png';
            iconAlt = 'Dreamweaver';
            iconStyle = 'filter: saturate(40%);';
        }
    } else if (dreamer.server.includes('bsky.network')) {
        if (dreamer.handle.endsWith('bsky.social')) {
            iconSrc = 'assets/bluesky.svg';
            iconAlt = 'Bluesky';
        } else if (dreamer.handle.endsWith('reverie.house')) {
            iconSrc = 'assets/icon_transp.png';
            iconAlt = 'Dreamweaver';
            iconStyle = 'filter: saturate(40%);';
        } else {
            iconSrc = 'assets/bluesky.svg';
            iconAlt = 'Dreamer';
            iconStyle = 'filter: brightness(50%) saturate(80%);';
        }
    } else {
        iconSrc = '../assets/our_wild_mindscape.svg';
        iconAlt = 'Our Wild Mindscape';
    }
    profileDetails.innerHTML = `
        <h1>
            <img src="${iconSrc}" alt="${iconAlt}" style="width: 30px; height: 30px; vertical-align: middle; margin-right: 8px; ${iconStyle}">
            ${dreamer.name}
        </h1>
        <div class="profile-data">
            <p>
                <span class="data-head">Handle:</span>
                <span class="data-content"><a href="https://bsky.app/profile/${dreamer.handle}" target="_blank">@${dreamer.handle}</a></span>
            </p>
            <p>
                <span class="data-head">Dreamer ID:</span>
                <span class="data-content"><a href="https://atproto-browser.vercel.app/at/${dreamer.did}" target="_blank">${dreamer.did}</a></span>
            </p>
            <p>
                <span class="data-head">Server:</span>
                <span class="data-content">${dreamer.server}</span>
            </p>
        </div>
    `;

    // Update bio converting newline to <br> and making URLs clickable.
    document.querySelector('.bio-box').innerHTML = `<p>${
        (dreamer.bio && dreamer.bio.trim())
            ? dreamer.bio.replace(/\n/g, "<br>")
                         .replace(/(https?:\/\/[^\s\n<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="font-weight: normal; text-decoration: underline;">$1</a>')
            : 'No bio available.'
    }</p>`;

    // Call related update functions if available
    if (typeof updateSouvenirs === 'function') updateSouvenirs(dreamer);
    if (typeof updateJournal === 'function') updateJournal(dreamer);
}