function renderNextChapter(containerId, chapterDetails) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with id "${containerId}" not found.`);
        return;
    }

    if (!chapterDetails) {
        console.error('Chapter details are missing or undefined.');
        return;
    }

    console.log('Rendering next chapter with details:', chapterDetails);

    const { coverImage, title, chapterTitle, description, link, available } = chapterDetails;
    const epubLink = coverImage.replace(/\.[^/.]+$/, '.epub'); // Replace the file extension with .epub

    container.innerHTML = `
        <div class="next-chapter-container">
            <img src="${coverImage}" alt="${title} Cover" class="next-chapter-cover">
            <div class="next-chapter-details">
                <h1>${title}</h1>
                <h2>${chapterTitle}</h2>
                <p><i>${description}</i></p>
                <a href="${available ? link : '#'}" class="next-chapter-link" style="cursor: ${available ? 'pointer' : 'not-allowed'};">
                    ${available ? 'READ NEXT CHAPTER' : 'Available Soon'}
                </a>
                <div class="purchase-buttons">
                    <button style="cursor: ${available ? 'pointer' : 'not-allowed'};" ${!available ? 'disabled' : ''} onclick="openRegionalAmazonLink()">Kindle</button>
                    <button style="cursor: pointer;" onclick="window.open('https://buy.stripe.com/3cs7tVesCa7PbAc144', '_blank')">Print</button>
                    <button style="cursor: ${available ? 'pointer' : 'not-allowed'};" ${!available ? 'disabled' : ''} onclick="window.location.href='${epubLink}'">ePub</button>
                </div>
            </div>
        </div>
    `;

    console.log('Next chapter rendered successfully.');
}
