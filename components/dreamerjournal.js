function updateJournal(dreamer) {
    fetch('data/journal.json')
        .then(response => response.json())
        .then(journal => {
            const dreamerEvents = journal.filter(entry => entry.did.toLowerCase() === dreamer.did.toLowerCase());
            // Sort events with most recent first
            dreamerEvents.sort((a, b) => b.epoch - a.epoch);
            const adventureLogEl = document.querySelector('.adventure-box .adventure-log');
            adventureLogEl.innerHTML = dreamerEvents.map(ev => {
                if (ev.link && ev.link.trim()) {
                    const finalLink = ev.link.startsWith("did:")
                        ? `https://bsky.app/profile/${dreamer.handle}/post/${ev.link.split('/').pop()}`
                        : ev.link;
                    return `<div class="log-entry"><a href="${finalLink}" target="_blank">${ev.event}</a></div>`;
                } else {
                    return `<div class="log-entry">${ev.event}</div>`;
                }
            }).join('');
        })
        .catch(error => console.error('Error loading journal data:', error));
}
