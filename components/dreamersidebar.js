document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const autofillTbody = document.getElementById('autofill-tbody');
    const refreshButton = document.getElementById('refresh-button');
    const kindredPanel = document.getElementById('kindred-panel');
    let dreamers = [];

    // Load dreamers data and display initial profile based on URL params
    fetch('data/dreamers.json')
        .then(response => response.json())
        .then(data => {
            dreamers = data;
            const params = new URLSearchParams(window.location.search);
            let foundDreamer;
            if (params.has('name')) {
                const queryName = params.get('name').toLowerCase();
                foundDreamer = dreamers.find(d => d.name.toLowerCase() === queryName);
            } else if (params.has('handle')) {
                const queryHandle = params.get('handle').toLowerCase();
                foundDreamer = dreamers.find(d => d.handle.toLowerCase() === queryHandle);
            } else if (params.has('did')) {
                const queryDid = params.get('did').toLowerCase();
                foundDreamer = dreamers.find(d => d.did.toLowerCase() === queryDid);
            }
            if (foundDreamer) {
                displayProfile(foundDreamer);
            } else {
                displayRandomProfile();
            }
            if (searchInput.value === '') {
                searchInput.dispatchEvent(new Event('input'));
            }
        })
        .catch(error => console.error('Error loading dreamers data:', error));

    // Set up search input for autofill suggestions
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        autofillTbody.innerHTML = '';
        let results = query ? dreamers.filter(d => d.name.toLowerCase().includes(query)) : dreamers.slice().sort(() => Math.random() - 0.5);
        results = results.slice(0, 6);
        results.forEach(match => {
            // ...existing suggestion code...
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            // Add icon before name (minimal sample)
            cell.innerHTML = `<img src="${(match.server === 'https://reverie.house') ? '../assets/icon_transp.png' : 'assets/bluesky.svg'}" alt="icon" style="width:20px; height:20px; vertical-align:middle; margin-right:5px;"> ${match.name}`;
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', () => {
                window.location.href = `${window.location.pathname}?name=${encodeURIComponent(match.name)}`;
            });
            row.appendChild(cell);
            autofillTbody.appendChild(row);
        });
    });

    refreshButton.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
    });

    // New code to load epoch information from world.json
    fetch('data/world.json')
        .then(response => response.json())
        .then(worldData => {
            const epochDisplay = document.getElementById('epoch-display');
            if (epochDisplay) {
                epochDisplay.textContent = `Epoch: ${worldData.epoch}`;
            }
        })
        .catch(error => console.error('Error loading world data:', error));

    // Function to pick a random profile from dreamers filtered by a server condition
    function displayRandomProfile() {
        const reverieDreamers = dreamers.filter(d => d.server === 'https://reverie.house');
        if (reverieDreamers.length > 0) {
            const randomDreamer = reverieDreamers[Math.floor(Math.random() * reverieDreamers.length)];
            displayProfile(randomDreamer);
            populateKindred(randomDreamer);
        } else if (dreamers.length > 0) {
            displayProfile(dreamers[0]);
            populateKindred(dreamers[0]);
        }
    }

    // Function to update the kindred panel in rolodex style
    function populateKindred(dreamer) {
        kindredPanel.innerHTML = '';
        kindredPanel.style.display = 'block';
        if (dreamer.kindred && dreamer.kindred.length > 0) {
            let kindredList = dreamer.kindred.map(did => dreamers.find(d => d.did === did)).filter(Boolean);
            if (kindredList.length > 0) {
                let currentIndex = 0;
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'space-between';
                const leftArrow = document.createElement('span');
                leftArrow.textContent = '◀';
                leftArrow.style.cursor = 'pointer';
                leftArrow.style.display = kindredList.length > 1 ? 'inline' : 'none';
                const displaySpan = document.createElement('span');
                displaySpan.style.flex = '1';
                displaySpan.style.textAlign = 'center';
                const rightArrow = document.createElement('span');
                rightArrow.textContent = '▶';
                rightArrow.style.cursor = 'pointer';
                rightArrow.style.display = kindredList.length > 1 ? 'inline' : 'none';
                function updateDisplay() {
                    const kDreamer = kindredList[currentIndex];
                    displaySpan.innerHTML = `<a href="dreamer.html?did=${encodeURIComponent(kDreamer.did)}" 
                        style="text-decoration: none;">${kDreamer.name}</a>`;
                }
                updateDisplay();
                leftArrow.addEventListener('click', () => {
                    currentIndex = (currentIndex - 1 + kindredList.length) % kindredList.length;
                    updateDisplay();
                });
                rightArrow.addEventListener('click', () => {
                    currentIndex = (currentIndex + 1) % kindredList.length;
                    updateDisplay();
                });
                container.appendChild(leftArrow);
                container.appendChild(displaySpan);
                container.appendChild(rightArrow);
                kindredPanel.appendChild(container);
            } else {
                kindredPanel.innerHTML = '<div style="text-align: center; color: #333;">None Kindred</div>';
            }
        } else {
            kindredPanel.innerHTML = '<div style="text-align: center; color: #333;">None Kindred</div>';
        }
    }
});
