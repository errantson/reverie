document.addEventListener("DOMContentLoaded", () => {
    const pathDepth = window.location.pathname.split('/').length - 2;
    const relativePath = '../'.repeat(pathDepth);

    const navHTML = `
        <table>
            <tr>
                <td><a href="${relativePath}books.html">Books</a></td>
                <td><a href="${relativePath}dreamer.html">Dreamweavers</a></td>
                <td><a href="https://bsky.app/profile/reverie.house" target="_blank">Explore</a></td>
                <td><a href="${relativePath}lore.html">Memory</a></td>
                <td><a href="${relativePath}about.html">About</a></td>
            </tr>
        </table>
    `;
    document.querySelector("#nav-container").innerHTML = navHTML;
});

function togglePart(partId, header) {
    const allParts = document.querySelectorAll(".chapter-part-content");
    const allHeaders = document.querySelectorAll(".chapter-part h2");

    allParts.forEach(part => {
        if (part.id !== partId) {
            part.style.display = "none";
        }
    });

    allHeaders.forEach(h => {
        const arrow = h.querySelector(".arrow");
        if (h !== header) {
            arrow.textContent = "⮞";
        }
    });

    const part = document.getElementById(partId);
    const arrow = header.querySelector(".arrow");
    if (part.style.display === "none" || part.style.display === "") {
        part.style.display = "block";
        arrow.textContent = "⮟";
    }
}
