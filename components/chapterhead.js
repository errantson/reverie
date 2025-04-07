function renderChapterHeader(containerId, chapterDetails) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { coverImage, title, chapterNumber, chapterTitle } = chapterDetails;

    container.innerHTML = `
        <div class="chapter-header">
            <div class="chapter-cover-container">
                <a href="#" onclick="openRegionalAmazonLink(); return false;">
                    <img src="${coverImage}" alt="${title} Cover" class="chapter-cover" width="100px">
                </a>
            </div>
            <div class="chapter-title-container">
                <h1 style="margin-bottom: -20px;">${title}</h1>
                <h3 style="margin-bottom: -10px;">${chapterNumber}</h3>
                <h2>${chapterTitle}</h2>
            </div>
        </div>
    `;
}
