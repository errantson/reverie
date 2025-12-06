
class TOC {
    constructor(booksWidget) {
        this.booksWidget = booksWidget;
    }
    show(bookId) {
        const book = this.booksWidget.books[bookId];
        if (!book) {
            console.error('Book not found:', bookId);
            return;
        }
        this.booksWidget.currentBookId = bookId;
        if (book.parts) {
            this.booksWidget.chapters = [];
            book.parts.forEach(part => {
                this.booksWidget.chapters.push(...part.chapters);
            });
        } else {
            this.booksWidget.chapters = book.chapters;
        }
        const tocContent = document.querySelector('.toc-content');
        if (tocContent) {
            tocContent.innerHTML = this.generateContent(book);
            this.attachChapterClickHandlers();
            this.attachCoverClickHandler(book);
        }
        const tocHeaderTitle = document.querySelector('.toc-header h3');
        if (tocHeaderTitle) {
            tocHeaderTitle.textContent = book.title;
        }
        const overlay = document.getElementById('toc-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            document.body.classList.add('toc-open');
        }
    }
    generateContent(book) {
        const isPrince = book.id === 'princes-reverie';
        let chapterContent = '';
        if (isPrince && book.parts) {
            const maxChapters = Math.max(...book.parts.map(part => part.chapters.length));
            chapterContent = book.parts.map((part, index) => {
                const chapterRows = part.chapters.map((chapter, chIdx) => {
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
                    <h2 class="toc-part-header" onclick="window.booksWidget.togglePart(this)">
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
            <div class="toc-layout ${isPrince ? 'prince-chapter-part' : 'seeker-chapter-part'}">
                <div class="toc-cover-section">
                    <div class="toc-book-card" data-featured="${!isPrince}">
                        <img src="${isPrince ? '/books/princes/princes_reverie.png' : '/books/seeker/seekers_reverie.png'}" 
                             alt="${book.title}" class="toc-book-cover">
                        <div>
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
                                ${isPrince 
                                    ? 'All prior editions of texts by errantson are dedicated to you through <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" style="color: ' + book.color + '; text-decoration: none;">CC0 1.0</a>'
                                    : 'All prior editions of texts by errantson are dedicated to you through <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" style="color: ' + book.color + '; text-decoration: none;">CC0 1.0</a>'
                                }
                            </div>
                        </div>
                    </div>
                </div>
                <div class="toc-chapters-section">
                    ${isPrince && book.parts ? '' : '<h2 class="toc-chapters-header">Table of Contents</h2>'}
                    <div class="chapter-section">
                        ${chapterContent}
                    </div>
                    <div class="toc-mobile-close-bottom">
                        <button class="toc-close-btn" onclick="window.booksWidget.closeTOC()">Close</button>
                    </div>
                </div>
            </div>
        `;
    }
    attachChapterClickHandlers() {
        const chapterRows = document.querySelectorAll('.toc-content .toc-row');
        chapterRows.forEach(row => {
            row.style.cursor = 'pointer';
            row.addEventListener('click', (e) => {
                e.preventDefault();
                const chapterFile = row.getAttribute('data-chapter');
                const chapterTitle = row.getAttribute('data-title');
                const chapterIndex = row.getAttribute('data-index');
                let actualIndex = chapterIndex ? parseInt(chapterIndex) : 
                    this.booksWidget.chapters.findIndex(ch => ch.file === chapterFile);
                this.booksWidget.loadChapter(chapterFile, chapterTitle, actualIndex);
            });
        });
    }
    attachCoverClickHandler(book) {
        const coverImg = document.querySelector('.toc-book-cover');
        if (!coverImg) return;
        coverImg.addEventListener('click', (e) => {
            e.preventDefault();
            coverImg.style.transition = 'transform 0.1s ease';
            coverImg.style.transform = 'scale(1.05) rotate(2deg)';
            setTimeout(() => {
                coverImg.style.transform = 'scale(0.95) rotate(-2deg)';
            }, 100);
            setTimeout(() => {
                coverImg.style.transform = 'scale(1) rotate(0)';
            }, 200);
            setTimeout(() => {
                const isPrince = book.id === 'princes-reverie';
                const firstChapter = isPrince ? '01' : '00';
                const bookPath = isPrince ? 'princes' : 'seeker';
                const url = `/books/${bookPath}/${firstChapter}`;
                this.close();
                window.history.pushState({ view: 'chapter', book: book.id, chapter: firstChapter }, '', url);
                this.booksWidget.handleInitialRoute();
            }, 300);
        });
    }
    close() {
        const overlay = document.getElementById('toc-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            document.body.classList.remove('toc-open');
        }
    }
}
window.TOC = TOC;
