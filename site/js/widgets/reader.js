/**
 * Reader Widget - Chapter reading functionality for library
 * Handles markdown rendering, navigation, theming
 */

class ReaderWidget {
    constructor(libraryWidget) {
        this.libraryWidget = libraryWidget;
        this.currentChapterIndex = 0;
        this.chapters = [];
        this.currentBookId = null;
    }

    // Session storage key for reading progress
    static getProgressKey(bookId) {
        return `reading_progress_${bookId}`;
    }

    // Save reading progress to session storage
    saveReadingProgress(bookId, chapterId) {
        try {
            sessionStorage.setItem(ReaderWidget.getProgressKey(bookId), chapterId);
        } catch (e) {
            console.warn('Could not save reading progress:', e);
        }
    }

    // Get last read chapter for a book
    static getLastChapter(bookId) {
        try {
            return sessionStorage.getItem(ReaderWidget.getProgressKey(bookId));
        } catch (e) {
            return null;
        }
    }

    // Get URL for resuming reading (last chapter or preface/first chapter)
    static getResumeUrl(book) {
        const lastChapter = ReaderWidget.getLastChapter(book.id);
        if (lastChapter) {
            return `/books/${book.folderName}/${lastChapter}`;
        }
        // Default to readOnlineUrl or first available chapter
        if (book.readOnlineUrl) {
            return book.readOnlineUrl;
        }
        // Find first available chapter
        if (book.parts) {
            for (const part of book.parts) {
                for (const chapter of part.chapters) {
                    if (chapter.available) {
                        return `/books/${book.folderName}/${chapter.id}`;
                    }
                }
            }
        } else if (book.chapters) {
            const ch = book.chapters.find(c => c.available);
            if (ch) return `/books/${book.folderName}/${ch.id}`;
        }
        return null;
    }

    async loadChapter(bookId, chapterIndex) {
        const book = this.libraryWidget.books[bookId];
        if (!book) {
            console.error('Book not found:', bookId);
            return;
        }

        this.currentBookId = bookId;
        this.currentChapterIndex = chapterIndex;

        // Build chapters array
        if (book.parts) {
            this.chapters = [];
            book.parts.forEach(part => {
                this.chapters.push(...part.chapters);
            });
        } else {
            this.chapters = book.chapters;
        }

        const chapter = this.chapters[chapterIndex];
        if (!chapter) {
            console.error('Chapter not found:', chapterIndex);
            return;
        }

        // Update URL
        const bookSlug = bookId === 'seekers-reverie' ? 'seeker' : 'princes';
        const chapterPath = `/books/${bookSlug}/${chapter.id}`;
        window.history.pushState({
            view: 'chapter',
            bookId: bookId,
            chapterIndex: chapterIndex
        }, '', chapterPath);

        // Save reading progress
        this.saveReadingProgress(bookId, chapter.id);

        await this.renderChapter(chapter);
    }

    async renderChapter(chapter) {
        try {
            console.log(`📖 Loading chapter: ${chapter.title} (${chapter.file})`);

            // Show reader view
            this.showReaderView();

            const chapterContent = document.querySelector('.chapter-content');
            if (chapterContent) {
                chapterContent.innerHTML = '<div class="loading-state">Loading chapter...</div>';
            }

            // Fetch markdown
            const folderName = this.currentBookId === 'seekers-reverie' ? 'seeker' : 'princes';
            const response = await fetch(`/books/${folderName}/${chapter.file}`);
            if (!response.ok) {
                throw new Error(`Failed to load chapter: ${response.status}`);
            }

            const markdown = await response.text();
            const metadata = this.extractMetadata(markdown);
            const cleanMarkdown = this.stripMetadata(markdown);
            const html = this.convertMarkdownToHTML(cleanMarkdown);

            // Apply theme
            if (metadata.color) {
                this.applyChapterTheme(metadata.color);
            } else {
                const book = this.libraryWidget.books[this.currentBookId];
                this.applyChapterTheme(book.color);
            }

            // Render content
            if (chapterContent) {
                chapterContent.innerHTML = `
                    <div class="chapter-header-compact">
                        <div class="chapter-number">Chapter ${chapter.id}</div>
                        <h1 class="chapter-title-compact">${chapter.title}</h1>
                    </div>
                    <div class="chapter-body">
                        ${html}
                    </div>
                `;
            }

            this.addChapterFooter();
            this.createReadingSubHeader();
            
        } catch (error) {
            console.error('Error loading chapter:', error);
            const chapterContent = document.querySelector('.chapter-content');
            if (chapterContent) {
                chapterContent.innerHTML = `
                    <div class="error-state">
                        <p>Error loading chapter: ${error.message}</p>
                        <button onclick="window.location.href='/library'">Return to Library</button>
                    </div>
                `;
            }
        }
    }

    showReaderView() {
        // Hide entire library page container
        const libraryContainer = document.querySelector('.library-page-container');
        if (libraryContainer) {
            libraryContainer.style.display = 'none';
        }

        // Show main-content wrapper and reader
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.display = 'block';
        }

        const readerView = document.getElementById('reader-view');
        if (readerView) {
            readerView.style.display = 'block';
        }

        document.body.classList.add('reading-mode');
    }

    hideReaderView() {
        const readerView = document.getElementById('reader-view');
        if (readerView) {
            readerView.style.display = 'none';
        }

        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.display = 'none';
        }

        // Show library page container
        const libraryContainer = document.querySelector('.library-page-container');
        if (libraryContainer) {
            libraryContainer.style.display = 'grid';
        }

        document.body.classList.remove('reading-mode');
        this.removeReadingSubHeader();
        
        // Clear theme
        document.documentElement.style.removeProperty('--chapter-hue');
        document.documentElement.style.removeProperty('--chapter-saturation');
        document.documentElement.style.removeProperty('--chapter-lightness');
        document.documentElement.style.removeProperty('--chapter-primary');
    }

    createReadingSubHeader() {
        let subHeader = document.querySelector('.reading-sub-header');
        if (subHeader) {
            subHeader.remove();
        }

        const canGoPrev = this.currentChapterIndex > 0;
        const canGoNext = this.currentChapterIndex < this.chapters.length - 1;
        const currentChapter = this.chapters[this.currentChapterIndex];
        const book = this.libraryWidget.books[this.currentBookId];

        subHeader = document.createElement('div');
        subHeader.className = 'reading-sub-header';
        subHeader.innerHTML = `
            <div class="sub-header-content">
                <button class="sub-header-btn sub-header-library-btn" onclick="window.location.href='/library'">
                    ← Library
                </button>
                <div class="sub-header-book-title-mobile">${book.title}</div>
                <div class="sub-header-info">
                    <span class="sub-header-book-title">${book.title}</span>
                    <span class="sub-header-separator">·</span>
                    <span class="sub-header-chapter-number">Ch. ${currentChapter.id}</span>
                    <span class="sub-header-chapter-title">${currentChapter.title}</span>
                </div>
                <div class="sub-header-nav">
                    <button class="sub-header-nav-btn" ${!canGoPrev ? 'disabled' : ''} 
                            onclick="libraryWidget.reader.loadPreviousChapter()" 
                            title="Previous Chapter">
                        ←
                    </button>
                    <button class="sub-header-toc-btn" 
                            onclick="libraryWidget.reader.returnToLibrary()"
                            title="Table of Contents">
                        ☰
                    </button>
                    <button class="sub-header-nav-btn" ${!canGoNext ? 'disabled' : ''} 
                            onclick="libraryWidget.reader.loadNextChapter()"
                            title="Next Chapter">
                        →
                    </button>
                </div>
            </div>
        `;

        const readerView = document.getElementById('reader-view');
        const mainContent = document.querySelector('.main-content');
        if (mainContent && readerView) {
            mainContent.insertBefore(subHeader, readerView);
        } else if (readerView) {
            readerView.insertBefore(subHeader, readerView.firstChild);
        }
    }

    removeReadingSubHeader() {
        const subHeader = document.querySelector('.reading-sub-header');
        if (subHeader) {
            subHeader.remove();
        }
    }

    loadPreviousChapter() {
        if (this.currentChapterIndex > 0) {
            this.loadChapter(this.currentBookId, this.currentChapterIndex - 1);
        }
    }

    loadNextChapter() {
        if (this.currentChapterIndex < this.chapters.length - 1) {
            this.loadChapter(this.currentBookId, this.currentChapterIndex + 1);
        }
    }

    returnToLibrary() {
        this.hideReaderView();
        window.location.href = '/library';
    }

    showBookDetails(bookId) {
        // Navigate to library and trigger book details view
        window.location.href = `/library?book=${bookId}`;
    }

    addChapterFooter() {
        const chapterContent = document.querySelector('.chapter-content');
        if (!chapterContent) return;

        const existingFooter = document.querySelector('.chapter-footer-module');
        if (existingFooter) {
            existingFooter.remove();
        }

        const book = this.libraryWidget.books[this.currentBookId];
        const canGoNext = this.currentChapterIndex < this.chapters.length - 1;

        const footer = document.createElement('div');
        footer.className = 'chapter-footer-module';

        let nextSection = '';
        if (canGoNext) {
            const nextChapter = this.chapters[this.currentChapterIndex + 1];
            nextSection = `
                <div class="footer-continue-section">
                    <div class="footer-next-label">Continue Reading</div>
                    <div class="footer-continue-header">
                        <button class="footer-toc-hamburger" onclick="libraryWidget.reader.showBookDetails('${this.currentBookId}')" title="Table of Contents">☰</button>
                        <button class="footer-next-btn-compact" onclick="libraryWidget.reader.loadNextChapter()" title="Next Chapter: ${nextChapter.title}">
                            <div class="footer-next-title">Ch. ${nextChapter.id}: ${nextChapter.title}</div>
                            <div class="footer-next-arrow">→</div>
                        </button>
                    </div>
                    <hr class="footer-continue-divider">
                </div>
            `;
        }

        footer.innerHTML = `
            <div class="footer-unified-box">
                <div class="footer-layout">
                    <div class="footer-left-column">
                        <img src="${book.cover}" alt="${book.title}" class="footer-book-cover" onclick="libraryWidget.reader.showBookDetails('${this.currentBookId}')" style="cursor: pointer;">
                        <h3 style="color: ${book.color}; margin: 12px 0 4px 0; font-size: 1.2rem; font-weight: 600;">${book.title}</h3>
                        <p style="color: #666; font-style: italic; font-size: 0.85rem; margin: 0;">by ${book.author}</p>
                    </div>
                    <div class="footer-right-column">
                        ${nextSection}
                        <button class="footer-order-btn" onclick="window.location.href='/order'">
                            Order Print Edition
                        </button>
                        <div class="footer-format-buttons">
                            <button class="footer-format-btn" ${!book.epubUrl ? 'disabled' : ''} 
                                    onclick="window.location.href='${book.epubUrl}'">Download ePub</button>
                            <button class="footer-format-btn" ${!book.kindleAsin ? 'disabled' : ''} 
                                    onclick="libraryWidget.handleKindleClick('${book.kindleAsin}')">Read on Kindle</button>
                        </div>
                        ${book.available ? `
                        <div class="cc0-notice">
                            All prior editions of texts by errantson are dedicated to you through 
                            <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank">CC0 1.0</a> universal license.
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        const chapterReader = document.querySelector('.chapter-reader');
        if (chapterReader) {
            chapterReader.appendChild(footer);
        } else {
            chapterContent.appendChild(footer);
        }
    }

    // Metadata & Markdown utilities
    extractMetadata(markdown) {
        const metadata = {};
        const lines = markdown.split('\n');
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const colorMatch = lines[i].match(/<!--\s*color:\s*(#[0-9a-fA-F]{6})\s*-->/);
            if (colorMatch) {
                metadata.color = colorMatch[1];
            }
        }
        return metadata;
    }

    stripMetadata(markdown) {
        return markdown.replace(/<!--\s*color:\s*#[0-9a-fA-F]{6}\s*-->\n?/g, '');
    }

    convertMarkdownToHTML(markdown) {
        let html = markdown
            .replace(/^### (.*)/gm, '<h3>$1</h3>')
            .replace(/^## (.*)/gm, '<h2>$1</h2>')
            .replace(/^# (.*)/gm, '<h1>$1</h1>')
            .replace(/\\([!?.;,:`*_\[\](){}"'\-#@~%$^&|<>=\/])/g, '$1')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/^(.+)$/gm, '<p>$1</p>')
            .replace(/<p><h([1-6])>/g, '<h$1>')
            .replace(/<\/h([1-6])><\/p>/g, '</h$1>');
        return html;
    }

    applyChapterTheme(color) {
        const hsl = this.hexToHSL(color);
        document.documentElement.style.setProperty('--chapter-hue', hsl.h);
        document.documentElement.style.setProperty('--chapter-saturation', `${hsl.s}%`);
        document.documentElement.style.setProperty('--chapter-lightness', `${hsl.l}%`);
        document.documentElement.style.setProperty('--chapter-primary', color);
    }

    hexToHSL(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }
}
