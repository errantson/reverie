class Bookshelf {
    constructor(booksWidget) {
        this.booksWidget = booksWidget;
    }
    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Bookshelf container not found:', containerId);
            return;
        }
        const seekerBook = this.booksWidget.books['seekers-reverie'];
        const princeBook = this.booksWidget.books['princes-reverie'];
        container.innerHTML = '';
        if (seekerBook) {
            const seekerLayout = this.createBookLayout(seekerBook);
            container.appendChild(seekerLayout);
        }
        if (princeBook) {
            const princeLayout = this.createBookLayout(princeBook);
            container.appendChild(princeLayout);
        }
        this.attachAllHandlers(container);
    }
    createBookLayout(book) {
        const layout = document.createElement('div');
        layout.className = 'toc-layout ' + (book.id === 'princes-reverie' ? 'prince-chapter-part' : 'seeker-chapter-part');
        layout.innerHTML = this.generateBookContent(book);
        return layout;
    }
    generateBookContent(book) {
        const isPrince = book.id === 'princes-reverie';
        let chapterContent = '';
        if (isPrince && book.parts) {
            const maxChapters = Math.max(...book.parts.map(part => part.chapters.length));
            chapterContent = book.parts.map((part, index) => {
                const chapterRows = part.chapters.map((chapter) => {
                    if (chapter.available) {
                        return `<p class="toc-row" data-chapter="${chapter.file}" data-title="${chapter.title}" data-bookid="${book.id}" data-chapterid="${chapter.id}"><b>Ch. ${chapter.id}</b> — <span>${chapter.title}</span></p>`;
                    } else {
                        return `<p class="coming-soon" style="filter: blur(1.5px); opacity: 0.5; pointer-events: none;"><b>Ch. ${chapter.id}</b> — <span>${chapter.title}</span></p>`;
                    }
                });
                while (chapterRows.length < maxChapters) {
                    chapterRows.push(`<p class="blank-row">———————————</p>`);
                }
                return `
                <div class="chapter-part">
                    <h2 class="toc-part-header" data-part-index="${index}">
                        <span class="arrow">${index === 0 ? '⮟' : '⮞'}</span> ${part.name}
                    </h2>
                    <div class="chapter-part-content" style="display: ${index === 0 ? 'block' : 'none'};">
                        ${chapterRows.join('')}
                    </div>
                </div>
                `;
            }).join('');
        } else if (book.chapters) {
            chapterContent = `
                <div class="chapter-section-content">
                    ${book.chapters.map((chapter, index) => `
                        <p class="toc-row" data-chapter="${chapter.file}" data-title="${chapter.title}" data-bookid="${book.id}" data-chapterid="${chapter.id}" data-index="${index}"><b>Ch. ${chapter.id}</b> — <span>${chapter.title}</span></p>
                    `).join('')}
                </div>
            `;
        }
        return `
            <div class="toc-cover-section">
                <div class="toc-book-card" data-featured="${!isPrince}">
                    <img src="${isPrince ? '/books/princes/princes_reverie.png' : '/books/seeker/seekers_reverie.png'}" 
                         alt="${book.title}" class="toc-book-cover" data-book-id="${book.id}">
                    <h3 style="color: ${book.color};">${book.title}</h3>
                    <p class="book-author">by ${book.author}</p>
                    <div class="toc-format-buttons">
                        <button class="toc-format-btn toc-order-btn" ${!book.available ? 'disabled' : ''} 
                                onclick="window.location.href='/order'">Order Print Editions</button>
                        <button class="toc-format-btn" ${!book.available ? 'disabled' : ''} 
                                onclick="window.location.href='/books/${isPrince ? 'princes' : 'seeker'}/${book.id.replace('-', '_')}.epub'">Download ePub</button>
                        <button class="toc-format-btn" ${!book.available ? 'disabled' : ''} 
                                onclick="openRegionalAmazonLink()">Read on Kindle</button>
                    </div>
                    <div class="cc0-notice" style="margin-top: 16px; padding: 12px; background: #f9f9f9; border: 1px solid #ddd; font-size: 0.68rem; color: #666; line-height: 1.5; text-align: center;">
                        All prior editions of texts by errantson are dedicated to you through <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" style="color: ${book.color}; text-decoration: none;">CC0 1.0</a>
                    </div>
                </div>
            </div>
            <div class="toc-chapters-section">
                ${isPrince && book.parts ? '' : '<h2 class="toc-chapters-header">Table of Contents</h2>'}
                <div class="chapter-section">
                    ${chapterContent}
                </div>
            </div>
        `;
    }
    attachAllHandlers(container) {
        container.querySelectorAll('.toc-row').forEach(row => {
            row.style.cursor = 'pointer';
            row.addEventListener('click', (e) => {
                e.preventDefault();
                const bookId = row.getAttribute('data-bookid');
                const chapterId = row.getAttribute('data-chapterid');
                if (bookId && chapterId) {
                    const folderName = bookId === 'seekers-reverie' ? 'seeker' : 'princes';
                    window.location.href = `/books/${folderName}/${chapterId}`;
                }
            });
        });
        container.querySelectorAll('.toc-book-cover').forEach(cover => {
            cover.style.cursor = 'pointer';
            cover.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const bookId = cover.dataset.bookId;
                const isPrince = bookId === 'princes-reverie';
                const firstChapter = isPrince ? '01' : '00';
                const folderName = isPrince ? 'princes' : 'seeker';
                const originalTransition = cover.style.transition;
                cover.style.transition = 'transform 0.1s ease';
                cover.style.transform = 'scale(1.05) rotate(2deg)';
                setTimeout(() => {
                    cover.style.transform = 'scale(0.95) rotate(-2deg)';
                }, 100);
                setTimeout(() => {
                    cover.style.transform = 'scale(1) rotate(0)';
                }, 200);
                setTimeout(() => {
                    cover.style.transition = originalTransition;
                    window.location.href = `/books/${folderName}/${firstChapter}`;
                }, 300);
            });
        });
        container.querySelectorAll('.toc-part-header').forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', (e) => {
                e.preventDefault();
                this.togglePart(header);
            });
        });
    }
    togglePart(headerElement) {
        const content = headerElement.nextElementSibling;
        const arrow = headerElement.querySelector('.arrow');
        const allHeaders = headerElement.closest('.chapter-section').querySelectorAll('.toc-part-header');
        const isCurrentlyOpen = content.style.display !== 'none';
        if (isCurrentlyOpen) {
            return;
        }
        allHeaders.forEach(h => {
            const otherContent = h.nextElementSibling;
            const otherArrow = h.querySelector('.arrow');
            if (h === headerElement) {
                otherContent.style.display = 'block';
                otherArrow.textContent = '⮟';
            } else {
                otherContent.style.display = 'none';
                otherArrow.textContent = '⮞';
            }
        });
    }
}
window.Bookshelf = Bookshelf;
