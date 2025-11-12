
class BooksWidget {
    constructor() {
        this.currentChapterIndex = 0;
        this.chapters = [];
        this.currentBookId = null;
        this.toc = null; 
        this.books = {
            "seekers-reverie": {
                id: "seekers-reverie",
                title: "Seeker's Reverie",
                author: "errantson",
                color: "#87408d",
                available: true,
                featured: true,
                chapters: [
                    {file: 'sr00-preface.md', title: 'Preface', id: '00'},
                    {file: 'sr01-escaping_oneself.md', title: 'Escaping Oneself', id: '01'},
                    {file: 'sr02-welcome_to_reverie_house.md', title: 'Welcome to Reverie House', id: '02'},
                    {file: 'sr03-remembering_the_way.md', title: 'Remembering the Way', id: '03'},
                    {file: 'sr04-gardens_guardian.md', title: 'Garden\'s Guardian', id: '04'},
                    {file: 'sr05-free_food_and_arguments.md', title: 'Free Food and Arguments', id: '05'},
                    {file: 'sr06-inside_the_orren.md', title: 'Inside the Orren', id: '06'},
                    {file: 'sr07-eyes_of_the_dreamweaver.md', title: 'Eyes of the Dreamweaver', id: '07'},
                    {file: 'sr08-a_well_of_perfect_dreams.md', title: 'A Well of Perfect Dreams', id: '08'},
                    {file: 'sr09-limitatio_temporaria.md', title: 'Limitatio Temporaria', id: '09'},
                    {file: 'sr10-the_long_path_home.md', title: 'The Long Way Home', id: '10'},
                    {file: 'sr11-best_laid_plans.md', title: 'Best Laid Plans', id: '11'},
                    {file: 'sr12-in_the_shadow_of_callie.md', title: 'In The Shadow of Callie', id: '12'},
                    {file: 'sr13-the_unending_nightmare.md', title: 'The Unending Nightmare', id: '13'},
                    {file: 'sr14-sweet_reverie.md', title: 'Sweet Reverie', id: '14'}
                ]
            },
            "princes-reverie": {
                id: "princes-reverie",
                title: "Prince's Reverie",
                author: "errantson",
                color: "#A52A2A",
                available: false,
                featured: false,
                parts: [
                    {
                        name: "PART I",
                        chapters: [
                            {file: 'pr01-whatever_you_want.md', title: 'Whatever You Want', id: '01', available: true},
                            {file: 'pr02-wasting_time.md', title: 'Wasting Time', id: '02', available: false},
                            {file: 'pr03-petunias_house.md', title: "Petunia's House", id: '03', available: false},
                            {file: 'pr04-no_wish_to_return.md', title: 'No Wish to Return', id: '04', available: false},
                            {file: 'pr05-breakfast_of_fools.md', title: 'Breakfast of Fools', id: '05', available: false},
                            {file: 'pr06-other_people.md', title: 'Other People', id: '06', available: false},
                            {file: 'pr07-savages.md', title: 'Savages', id: '07', available: false},
                            {file: 'pr08-demolition_of_order.md', title: 'Demolition of Order', id: '08', available: false},
                            {file: 'pr09-culture.md', title: 'Culture', id: '09', available: false}
                        ]
                    },
                    {
                        name: "PART II",
                        chapters: [
                            {file: 'pr10-revenge.md', title: 'Revenge', id: '10', available: false},
                            {file: 'pr11-cookies.md', title: 'Cookies', id: '11', available: false},
                            {file: 'pr12-away_we_walk.md', title: 'Away We Walk', id: '12', available: false},
                            {file: 'pr13-focus_on_figs.md', title: 'Focus on Figs', id: '13', available: false},
                            {file: 'pr14-gladiators.md', title: 'Gladiators', id: '14', available: false},
                            {file: 'pr15-you_decide.md', title: 'You Decide', id: '15', available: false},
                            {file: 'pr16-michael_slays_the_dragon.md', title: 'Michael Slays the Dragon', id: '16', available: false},
                            {file: 'pr17-proper_introductions.md', title: 'Proper Introductions', id: '17', available: false},
                            {file: 'pr18-man_in_the_moon.md', title: 'Man in the Moon', id: '18', available: false}
                        ]
                    },
                    {
                        name: "PART III",
                        chapters: [
                            {file: 'pr19-beware_the_bogderry.md', title: 'Beware the Bogderry', id: '19', available: false},
                            {file: 'pr20-the_vagabond_witch.md', title: 'The Vagabond Witch', id: '20', available: false},
                            {file: 'pr21-homecoming.md', title: 'Homecoming', id: '21', available: false},
                            {file: 'pr22-splitting_up.md', title: 'Splitting Up', id: '22', available: false},
                            {file: 'pr23-bakun_the_magnificent.md', title: 'Bakun the Magnificent', id: '23', available: false},
                            {file: 'pr24-overqualified.md', title: 'Overqualified', id: '24', available: false},
                            {file: 'pr25-right_hand_man.md', title: 'Right-Hand Man', id: '25', available: false},
                            {file: 'pr26-queen_of_stars.md', title: 'Queen of Stars', id: '26', available: false}
                        ]
                    },
                    {
                        name: "PART IV",
                        chapters: [
                            {file: 'pr27-new_flags.md', title: 'New Flags', id: '27', available: false},
                            {file: 'pr28-natures_lament.md', title: "Nature's Lament", id: '28', available: false},
                            {file: 'pr29-old_bastards.md', title: 'Old Bastards', id: '29', available: false},
                            {file: 'pr30-abuse_of_power.md', title: 'Abuse of Power', id: '30', available: false},
                            {file: 'pr31-the_liberation_of_weights.md', title: 'The Liberation of Weights', id: '31', available: false},
                            {file: 'pr32-things_come_to_a_head.md', title: 'Things Come to a Head', id: '32', available: false},
                            {file: 'pr33-the_princes_duel.md', title: "The Prince's Duel", id: '33', available: false},
                            {file: 'pr34-what_dreams_remain.md', title: 'What Dreams Remain', id: '34', available: false}
                        ]
                    }
                ]
            }
        };
    }
    init() {
        console.log('📚 BooksWidget initialized');
        this.initTOC();
        this.setupBookClickHandlers();
        this.createTOCOverlay();
        this.setupHistoryNavigation();
        this.handleInitialRoute();
    }
    initTOC() {
        if (window.TOC) {
            this.toc = new window.TOC(this);
            console.log('✅ TOC component initialized');
            return true;
        } else {
            console.warn('⚠️ TOC component not yet loaded');
            return false;
        }
    }
    setupHistoryNavigation() {
        window.addEventListener('popstate', (event) => {
            if (event.state) {
                if (event.state.view === 'library') {
                    this.showLibraryView();
                    this.removeReadingSubHeader();
                    if (window.TOC) {
                        window.TOC.close();
                    }
                } else if (event.state.view === 'toc') {
                    this.showBookTOC(event.state.bookId);
                } else if (event.state.view === 'chapter') {
                    const { bookId, chapterIndex, chapterFile, chapterTitle } = event.state;
                    this.currentBookId = bookId;
                    this.currentChapterIndex = chapterIndex;
                    const book = this.books[bookId];
                    if (book.parts) {
                        this.chapters = [];
                        book.parts.forEach(part => {
                            this.chapters.push(...part.chapters);
                        });
                    } else {
                        this.chapters = book.chapters;
                    }
                    this.loadChapterWithoutHistory(chapterFile, chapterTitle, chapterIndex);
                }
            }
        });
        if (!window.history.state && window.location.pathname === '/books/') {
            window.history.replaceState({ view: 'library' }, '', '/books/');
        }
    }
    handleInitialRoute() {
        const path = window.location.pathname;
        console.log('📍 Initial route:', path);
        const bookMatch = path.match(/^\/books\/(seekers?|seekers-reverie|princes?|princes-reverie)(\/(.+)?)?$/);
        if (!bookMatch) {
            console.log('📚 Showing library view');
            return;
        }
        const bookSlug = bookMatch[1];
        const subPath = bookMatch[3];
        const bookId = bookSlug.includes('seeker') ? 'seekers-reverie' : 'princes-reverie';
        if (!subPath) {
            console.log('📖 Opening TOC for:', bookId);
            setTimeout(() => this.showBookTOC(bookId), 100);
            return;
        }
        const chapterMatch = subPath.match(/^(?:ch|chapter)?(\d+)$/i);
        if (chapterMatch) {
            const chapterNumStr = String(chapterMatch[1]).padStart(2, '0');
            console.log('📖 Loading chapter:', chapterNumStr, 'of', bookId);
            this.currentBookId = bookId;
            const book = this.books[bookId];
            if (book.parts) {
                this.chapters = [];
                book.parts.forEach(part => {
                    this.chapters.push(...part.chapters);
                });
            } else {
                this.chapters = book.chapters;
            }
            console.log('📚 Available chapters:', this.chapters.map(ch => ch.id).join(', '));
            const chapterIndex = this.chapters.findIndex(ch => ch.id === chapterNumStr);
            const chapter = this.chapters[chapterIndex];
            console.log('🔍 Looking for chapter ID:', chapterNumStr, 'Found at index:', chapterIndex, 'Chapter:', chapter);
            if (chapter && chapterIndex !== -1) {
                setTimeout(() => {
                    this.loadChapterWithoutHistory(chapter.file, chapter.title, chapterIndex);
                }, 100);
            } else {
                console.error('❌ Chapter not found:', chapterNumStr, '- Available IDs:', this.chapters.map(ch => ch.id));
                setTimeout(() => this.showBookTOC(bookId), 100);
            }
        } else {
            console.log('❌ No chapter match for subPath:', subPath);
        }
    }
    setupBookClickHandlers() {
        const seekerCover = document.querySelector('.book-card[data-featured="true"] .book-cover-container');
        const princeCover = document.querySelector('.book-card[data-featured="false"] .book-cover-container');
        if (seekerCover) {
            seekerCover.style.cursor = 'pointer';
            seekerCover.addEventListener('click', () => this.showBookTOC('seekers-reverie'));
        }
        if (princeCover) {
            princeCover.style.cursor = 'pointer';
            princeCover.addEventListener('click', () => this.showBookTOC('princes-reverie'));
        }
    }
    createTOCOverlay() {
        if (!document.getElementById('toc-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'toc-overlay';
            overlay.className = 'toc-overlay';
            overlay.style.display = 'none';
            overlay.innerHTML = `
                <button class="toc-mobile-close" onclick="window.booksWidget.closeTOC()" aria-label="Close table of contents">×</button>
                <div class="toc-container">
                    <div class="toc-header">
                        <h3>Table of Contents</h3>
                        <button class="reader-btn" onclick="window.booksWidget.closeTOC()">Close</button>
                    </div>
                    <div class="toc-content">
                        <!-- Content will be populated dynamically -->
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeTOC();
                }
            });
        }
    }
    showBookTOC(bookId) {
        const book = this.books[bookId];
        if (!book) {
            console.error('Book not found:', bookId);
            return;
        }
        const bookSlug = bookId === 'seekers-reverie' ? 'seeker' : 'princes';
        window.history.pushState({
            view: 'toc',
            bookId: bookId
        }, '', `/books/${bookSlug}/`);
        if (!this.toc) {
            console.log('TOC not initialized, attempting to initialize now...');
            const success = this.initTOC();
            if (!success) {
                console.error('Failed to initialize TOC component');
                alert('Unable to load Table of Contents. Please refresh the page.');
                return;
            }
        }
        this.toc.show(bookId);
    }
    togglePart(headerElement) {
        const content = headerElement.nextElementSibling;
        const arrow = headerElement.querySelector('.arrow');
        if (content.style.display === 'block') {
            return;
        }
        const allPartHeaders = document.querySelectorAll('.toc-part-header');
        allPartHeaders.forEach(header => {
            const partContent = header.nextElementSibling;
            const partArrow = header.querySelector('.arrow');
            partContent.style.display = 'none';
            partArrow.textContent = '⮞';
        });
        content.style.display = 'block';
        arrow.textContent = '⮟';
    }
    async loadChapter(filename, chapterTitle, chapterIndex = 0) {
        const bookSlug = this.currentBookId === 'seekers-reverie' ? 'seeker' : 'princes';
        const chapter = this.chapters[chapterIndex];
        const chapterId = chapter ? chapter.id : String(chapterIndex).padStart(2, '0');
        const chapterPath = `/books/${bookSlug}/${chapterId}`;
        window.history.pushState({
            view: 'chapter',
            bookId: this.currentBookId,
            chapterIndex: chapterIndex,
            chapterFile: filename,
            chapterTitle: chapterTitle
        }, '', chapterPath);
        await this.loadChapterWithoutHistory(filename, chapterTitle, chapterIndex);
    }
    async loadChapterWithoutHistory(filename, chapterTitle, chapterIndex = 0) {
        try {
            console.log(`📖 Loading chapter: ${chapterTitle} (${filename})`);
            this.currentChapterIndex = chapterIndex;
            this.closeTOC();
            this.showChapterReader();
            const chapterContent = document.querySelector('.chapter-content');
            if (chapterContent) {
                chapterContent.innerHTML = '<div class="loading-state">Loading chapter...</div>';
            }
            const folderName = this.currentBookId === 'seekers-reverie' ? 'seeker' : 'princes';
            const response = await fetch(`/books/${folderName}/${filename}`);
            if (!response.ok) {
                throw new Error(`Failed to load chapter: ${response.status}`);
            }
            const markdown = await response.text();
            const metadata = this.extractMetadata(markdown);
            console.log('📝 Chapter metadata:', metadata);
            const cleanMarkdown = this.stripMetadata(markdown);
            const html = this.convertMarkdownToHTML(cleanMarkdown);
            if (metadata.color) {
                console.log('🎨 Applying chapter color:', metadata.color);
                this.applyChapterTheme(metadata.color);
            } else {
                console.log('🎨 Using default color');
                this.applyChapterTheme('#4a5f8f');
            }
            if (chapterContent) {
                const currentChapter = this.chapters[chapterIndex];
                chapterContent.innerHTML = `
                    <div class="chapter-header-compact">
                        <div class="chapter-number">Chapter ${currentChapter.id}</div>
                        <h1 class="chapter-title-compact">${chapterTitle}</h1>
                    </div>
                    <div class="chapter-body">
                        ${html}
                    </div>
                `;
            }
            this.addChapterFooter();
            this.switchToReadingMode(chapterTitle);
        } catch (error) {
            console.error('Error loading chapter:', error);
            const chapterContent = document.querySelector('.chapter-content');
            if (chapterContent) {
                chapterContent.innerHTML = `
                    <div class="error-state">
                        <p>Error loading chapter: ${error.message}</p>
                        <button onclick="window.booksWidget.returnToLibrary()">Return to Library</button>
                    </div>
                `;
            }
        }
    }
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
    applyChapterTheme(color) {
        console.log('🎨 Applying theme with color:', color);
        const hsl = this.hexToHSL(color);
        console.log('🎨 HSL values:', hsl);
        const useDarkText = hsl.l > 50;
        document.documentElement.style.setProperty('--chapter-hue', hsl.h);
        document.documentElement.style.setProperty('--chapter-saturation', `${hsl.s}%`);
        document.documentElement.style.setProperty('--chapter-lightness', `${hsl.l}%`);
        document.documentElement.style.setProperty('--chapter-primary', color);
        document.documentElement.style.setProperty('--chapter-text-color', useDarkText ? '#2a2a2a' : '#ffffff');
        document.documentElement.style.setProperty('--reverie-hue', hsl.h);
        document.documentElement.style.setProperty('--ecosystem-hue', hsl.h);
        console.log('✅ CSS variables set, dark text:', useDarkText);
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
    addChapterFooter() {
        const chapterReader = document.querySelector('.chapter-reader');
        if (!chapterReader) return;
        const existingFooter = chapterReader.querySelector('.chapter-footer-module');
        if (existingFooter) {
            existingFooter.remove();
        }
        const book = this.books[this.currentBookId];
        const currentChapter = this.chapters[this.currentChapterIndex];
        const isPrince = this.currentBookId === 'princes-reverie';
        let canGoNext = this.currentChapterIndex < this.chapters.length - 1;
        if (isPrince && canGoNext) {
            const nextChapter = this.chapters[this.currentChapterIndex + 1];
            if (!nextChapter.available) {
                canGoNext = false;
            }
        }
        const folderName = this.currentBookId === 'seekers-reverie' ? 'seeker' : 'princes';
        const coverImage = this.currentBookId === 'seekers-reverie' 
            ? '/books/seeker/seekers_reverie.png' 
            : '/books/princes/princes_reverie.png';
        const footer = document.createElement('div');
        footer.className = 'chapter-footer-module';
        let nextChapterSection = '';
        if (canGoNext) {
            const nextChapter = this.chapters[this.currentChapterIndex + 1];
            nextChapterSection = `
                <div class="footer-continue-section">
                    <div class="footer-next-label">Continue Reading</div>
                    <div class="footer-continue-header">
                        <button class="footer-toc-hamburger" onclick="window.booksWidget?.showBookTOC('${this.currentBookId}')" title="Table of Contents">☰</button>
                        <button class="footer-next-btn-compact" onclick="window.booksWidget.loadNextChapter()" title="Next Chapter: ${nextChapter.title}">
                            <div class="footer-next-title">Ch. ${nextChapter.id}: ${nextChapter.title}</div>
                            <div class="footer-next-arrow">→</div>
                        </button>
                    </div>
                    <hr class="footer-continue-divider">
                </div>
            `;
        } else {
            const otherBookId = isPrince ? 'seekers-reverie' : 'princes-reverie';
            const otherBook = this.books[otherBookId];
            const otherBookTitle = isPrince ? "Seeker's Reverie" : "Prince's Reverie";
            nextChapterSection = `
                <div class="footer-continue-section">
                    <div class="footer-next-label" style="color: ${otherBook.color};">Continue Your Journey</div>
                    <div class="footer-continue-header">
                        <button class="footer-toc-hamburger" onclick="window.booksWidget?.showBookTOC('${otherBookId}')" title="Table of Contents" style="border-color: ${otherBook.color};">☰</button>
                        <button class="footer-next-btn-compact" onclick="window.booksWidget?.showBookTOC('${otherBookId}')" title="Read ${otherBookTitle}" style="border-color: ${otherBook.color};">
                            <div class="footer-next-title">${otherBookTitle}</div>
                            <div class="footer-next-arrow">→</div>
                        </button>
                    </div>
                    <hr class="footer-continue-divider">
                </div>
            `;
        }
        const orderButtonHTML = isPrince ? `
            <button class="footer-order-btn" onclick="window.booksWidget.requestAdvancedCopy()">
                Request Advanced Copy
            </button>
        ` : `
            <button class="footer-order-btn" onclick="window.location.href='/order'">
                Order Print Editions
            </button>
        `;
        const showCC0 = isPrince || book.available;
        footer.innerHTML = `
            <div class="footer-unified-box">
                <div class="footer-layout">
                    <div class="footer-left-column">
                        <img src="${coverImage}" alt="${book.title}" class="footer-book-cover" onclick="window.booksWidget?.showBookTOC('${this.currentBookId}')">
                        <h3 style="color: ${book.color}; margin: 12px 0 4px 0; font-size: 1.2rem; font-weight: 600;">${book.title}</h3>
                        <p style="color: #666; font-style: italic; font-size: 0.85rem; margin: 0;">by ${book.author}</p>
                    </div>
                    <div class="footer-right-column">
                        ${nextChapterSection}
                        ${orderButtonHTML}
                        <div class="footer-format-buttons">
                            <button class="footer-format-btn" ${!book.available ? 'disabled' : ''} 
                                    onclick="window.location.href='/books/${folderName}/${this.currentBookId.replace('-', '_')}.epub'">Download ePub</button>
                            <button class="footer-format-btn" ${!book.available ? 'disabled' : ''} 
                                    onclick="openRegionalAmazonLink()">Read on Kindle</button>
                        </div>
                        ${showCC0 ? `
                        <div class="cc0-notice" style="margin-top: 16px; padding: 12px; background: #f9f9f9; border: 1px solid #ddd; font-size: 0.68rem; color: #666; line-height: 1.5; text-align: center;">
                            All prior editions of texts by errantson are dedicated to you through <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" style="color: #87408d; text-decoration: none;">CC0 1.0</a> universal license.
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        chapterReader.appendChild(footer);
    }
    showChapterReader() {
        const readerContent = document.querySelector('.reader-content');
        if (readerContent) {
            readerContent.innerHTML = `
                <div class="chapter-reader">
                    <div class="chapter-content">
                        <!-- Content will be loaded here -->
                    </div>
                </div>
            `;
        }
    }
    switchToReadingMode(chapterTitle) {
        console.log('📚 Switching to reading mode:', chapterTitle);
        document.body.classList.add('reading-mode');
        this.createReadingSubHeader();
        if (window.headerWidget && window.headerWidget.showReadingControls) {
            window.headerWidget.showReadingControls();
        }
        this.updateNavigationButtons();
    }
    createReadingSubHeader() {
        let subHeader = document.querySelector('.reading-sub-header');
        if (subHeader) {
            subHeader.remove();
        }
        subHeader = document.createElement('div');
        subHeader.className = 'reading-sub-header';
        const canGoPrev = this.currentChapterIndex > 0;
        const canGoNext = this.currentChapterIndex < this.chapters.length - 1;
        const currentChapter = this.chapters[this.currentChapterIndex];
        const book = this.books[this.currentBookId];
        subHeader.innerHTML = `
            <div class="sub-header-content">
                <button class="sub-header-btn sub-header-library-btn" onclick="window.location.href='/books'">
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
                            onclick="window.booksWidget.loadPreviousChapter()" 
                            title="Previous Chapter">
                        ←
                    </button>
                    <button class="sub-header-toc-btn" 
                            onclick="window.booksWidget.showBookTOC('${this.currentBookId}')"
                            title="Table of Contents">
                        ☰
                    </button>
                    <button class="sub-header-nav-btn" ${!canGoNext ? 'disabled' : ''} 
                            onclick="window.booksWidget.loadNextChapter()"
                            title="Next Chapter">
                        →
                    </button>
                </div>
            </div>
        `;
        const mainHeader = document.querySelector('.reader-header');
        const readerContent = document.querySelector('.reader-content');
        if (mainHeader && mainHeader.parentNode) {
            if (mainHeader.nextSibling) {
                mainHeader.parentNode.insertBefore(subHeader, mainHeader.nextSibling);
            } else {
                mainHeader.parentNode.appendChild(subHeader);
            }
        } else if (readerContent && readerContent.parentNode) {
            readerContent.parentNode.insertBefore(subHeader, readerContent);
        } else {
            document.body.insertBefore(subHeader, document.body.firstChild);
        }
    }
    removeReadingSubHeader() {
        const subHeader = document.querySelector('.reading-sub-header');
        if (subHeader) {
            subHeader.remove();
        }
    }
    updateNavigationButtons() {
        const canGoPrev = this.currentChapterIndex > 0;
        const canGoNext = this.currentChapterIndex < this.chapters.length - 1;
        if (window.headerWidget && window.headerWidget.updateReadingButtons) {
            window.headerWidget.updateReadingButtons(canGoPrev, canGoNext);
        }
    }
    loadPreviousChapter() {
        if (this.currentChapterIndex > 0) {
            const prevChapter = this.chapters[this.currentChapterIndex - 1];
            this.loadChapter(prevChapter.file, prevChapter.title, this.currentChapterIndex - 1);
        }
    }
    loadNextChapter() {
        if (this.currentChapterIndex < this.chapters.length - 1) {
            const nextChapter = this.chapters[this.currentChapterIndex + 1];
            this.loadChapter(nextChapter.file, nextChapter.title, this.currentChapterIndex + 1);
        }
    }
    returnToLibrary() {
        console.log('📚 Returning to library');
        document.body.classList.remove('reading-mode');
        window.history.pushState({ view: 'library' }, '', '/books/');
        this.removeReadingSubHeader();
        if (window.headerWidget && window.headerWidget.hideReadingControls) {
            window.headerWidget.hideReadingControls();
        }
        document.documentElement.style.removeProperty('--chapter-hue');
        document.documentElement.style.removeProperty('--chapter-saturation');
        document.documentElement.style.removeProperty('--chapter-lightness');
        document.documentElement.style.removeProperty('--chapter-primary');
        if (window.printWidget) {
            this.showPrintView();
        }
        this.currentChapterIndex = 0;
        this.chapters = [];
        this.currentBookId = null;
    }
    showPrintView() {
        const readerContent = document.querySelector('.reader-content');
        if (readerContent) {
            if (window.printWidget) {
                window.printWidget.renderPage();
            }
        }
    }
    closeTOC() {
        if (this.toc) {
            this.toc.close();
        }
    }
    requestAdvancedCopy() {
        const subject = encodeURIComponent("Request for Prince's Reverie Advance Copy");
        const body = encodeURIComponent("I would like to request an advance copy of Prince's Reverie.");
        const mailtoLink = `mailto:books@reverie.house?subject=${subject}&body=${body}`;
        window.open(mailtoLink, '_blank');
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
}
window.BooksWidget = BooksWidget;
document.addEventListener('DOMContentLoaded', () => {
    window.booksWidget = new BooksWidget();
    window.booksWidget.init();
    window.loadPreviousChapter = () => window.booksWidget.loadPreviousChapter();
    window.loadNextChapter = () => window.booksWidget.loadNextChapter();
    window.returnToLibrary = () => window.booksWidget.returnToLibrary();
    console.log('✅ Books widget initialized and global functions exposed');
});
