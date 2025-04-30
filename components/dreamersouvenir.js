function updateSouvenirs(dreamer) {
    const souvenirsBox = document.querySelector('.souvenirs-box');
    const fallbackHTML = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
<strong>${dreamer.name} has no souvenirs</strong></div>`;
    
    if (dreamer.souvenirs && dreamer.souvenirs.length > 0) {
        fetch('data/souvenirs.json')
            .then(response => response.json())
            .then(souvenirsData => {
                const userSouvenirs = souvenirsData.filter(s => dreamer.souvenirs.includes(s.id));
                if (userSouvenirs.length > 0) {
                    // Create a header element for "Souvenirs" similar to fallback style
                    let headerHTML = `<div style="width: 100%; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
<strong>Souvenirs</strong></div>`;
                    let gridHTML = `<div class="souvenirs-grid">`;
                    userSouvenirs.forEach(s => {
                        gridHTML += `<a href="souvenirs.html?id=${s.id}" style="display: inline-block;">
    <img src="souvenirs/${s.id}.png" alt="${s.name}" title="${s.name}">
</a>`;
                    });
                    gridHTML += `</div>`;
                    // Wrap header and grid in a block container
                    souvenirsBox.innerHTML = `<div style="display:block; width: 100%;">` + headerHTML + gridHTML + `</div>`;
                } else {
                    // Use fallbackHTML when no souvenirs available
                    souvenirsBox.innerHTML = fallbackHTML;
                }
            })
            .catch(err => {
                // Use fallbackHTML on error
                souvenirsBox.innerHTML = fallbackHTML;
            });
    } else {
        // Use fallbackHTML when dreamer has no souvenirs
        souvenirsBox.innerHTML = fallbackHTML;
    }
}
