/**
 * Library Widget - Structured bookshelf interface
 * Follows the work.html / dreamers.html pattern with sidebar controls + content area
 */

class LibraryWidget {
    constructor() {
        this.books = {
            'seekers-reverie': {
                id: 'seekers-reverie',
                title: "Seeker's Reverie",
                author: "errantson",
                color: "#5c3d5e",
                cover: "/books/seeker/seekers_reverie.png",
                available: true,
                synopsis: "After falling from his nightmare into the place between dreams, one lost dreamer finds our wild mindscape and Reverie House.\n\nWhen an unending nightmare threatens to consume this strange but welcoming new home, Seeker must quickly master the art of dreamweaving before everything is lost to oblivion.",
                folderName: 'seeker',
                stats: {
                    genre: "Fantasy",
                    length: "188 pages",
                    ages: "16+",
                    binding: "Softcover",
                    published: "29/03/25",
                    asin: "B0F2ST7CXZ",
                    isbn: "Undeclared"
                },
                readOnlineUrl: "/books/seeker/00",
                epubUrl: "/books/seeker/seekers_reverie.epub",
                kindleAsin: "B0F2ST7CXZ",
                chapters: [
                    { id: '00', title: 'Preface', file: 'sr00-preface.md', available: true },
                    { id: '01', title: 'Escaping Oneself', file: 'sr01-escaping_oneself.md', available: true },
                    { id: '02', title: 'Welcome to Reverie House', file: 'sr02-welcome_to_reverie_house.md', available: true },
                    { id: '03', title: 'Remembering the Way', file: 'sr03-remembering_the_way.md', available: true },
                    { id: '04', title: "Garden's Guardian", file: 'sr04-gardens_guardian.md', available: true },
                    { id: '05', title: 'Free Food and Arguments', file: 'sr05-free_food_and_arguments.md', available: true },
                    { id: '06', title: 'Inside the Orren', file: 'sr06-inside_the_orren.md', available: true },
                    { id: '07', title: 'Eyes of the Dreamweaver', file: 'sr07-eyes_of_the_dreamweaver.md', available: true },
                    { id: '08', title: 'A Well of Perfect Dreams', file: 'sr08-a_well_of_perfect_dreams.md', available: true },
                    { id: '09', title: 'Limitatio Temporaria', file: 'sr09-limitatio_temporaria.md', available: true },
                    { id: '10', title: 'The Long Way Home', file: 'sr10-the_long_path_home.md', available: true },
                    { id: '11', title: 'Best Laid Plans', file: 'sr11-best_laid_plans.md', available: true },
                    { id: '12', title: 'In The Shadow of Callie', file: 'sr12-in_the_shadow_of_callie.md', available: true },
                    { id: '13', title: 'The Unending Nightmare', file: 'sr13-the_unending_nightmare.md', available: true },
                    { id: '14', title: 'Sweet Reverie', file: 'sr14-sweet_reverie.md', available: true }
                ]
            },
            'princes-reverie': {
                id: 'princes-reverie',
                title: "Prince's Reverie",
                author: "errantson",
                color: "#A52A2A",
                cover: "/books/princes/princes_reverie.png",
                available: false,
                synopsis: "When an enchanting prince becomes disenchanted with the delights of a perfect dream, his natural boredom and malevolence wreak unnatural havoc on Reverie House and all our wild mindscape.\n\nWhat dreams and dreamweavers survive, must contend.",
                folderName: 'princes',
                stats: {
                    genre: "Fantasy",
                    length: "-- pages",
                    ages: "16+",
                    binding: "Softcover",
                    published: "2026",
                    asin: "TBD",
                    isbn: "TBD"
                },
                readOnlineUrl: "/books/princes/01",
                epubUrl: null,
                kindleAsin: null,
                parts: [
                    {
                        name: 'PART I',
                        chapters: [
                            { id: '01', title: 'Whatever You Want', file: 'pr01-whatever_you_want.md', available: true },
                            { id: '02', title: 'Wasting Time', file: '02', available: false },
                            { id: '03', title: "Petunia's House", file: '03', available: false },
                            { id: '04', title: 'No Wish to Return', file: '04', available: false },
                            { id: '05', title: 'Breakfast of Fools', file: '05', available: false },
                            { id: '06', title: 'Other People', file: '06', available: false },
                            { id: '07', title: 'Savages', file: '07', available: false },
                            { id: '08', title: 'Demolition of Order', file: '08', available: false },
                            { id: '09', title: 'Culture', file: '09', available: false }
                        ]
                    },
                    {
                        name: 'PART II',
                        chapters: [
                            { id: '10', title: 'Revenge', file: '10', available: false },
                            { id: '11', title: 'Cookies', file: '11', available: false },
                            { id: '12', title: 'Away We Walk', file: '12', available: false },
                            { id: '13', title: 'Focus on Figs', file: '13', available: false },
                            { id: '14', title: 'Gladiators', file: '14', available: false },
                            { id: '15', title: 'You Decide', file: '15', available: false },
                            { id: '16', title: 'Michael Slays the Dragon', file: '16', available: false },
                            { id: '17', title: 'Proper Introductions', file: '17', available: false },
                            { id: '18', title: 'Man in the Moon', file: '18', available: false }
                        ]
                    },
                    {
                        name: 'PART III',
                        chapters: [
                            { id: '19', title: 'Beware the Bogderry', file: '19', available: false },
                            { id: '20', title: 'The Vagabond Witch', file: '20', available: false },
                            { id: '21', title: 'Homecoming', file: '21', available: false },
                            { id: '22', title: 'Splitting Up', file: '22', available: false },
                            { id: '23', title: 'Bakun the Magnificent', file: '23', available: false },
                            { id: '24', title: 'Overqualified', file: '24', available: false },
                            { id: '25', title: 'Right-Hand Man', file: '25', available: false },
                            { id: '26', title: 'Queen of Stars', file: '26', available: false }
                        ]
                    },
                    {
                        name: 'PART IV',
                        chapters: [
                            { id: '27', title: 'New Flags', file: '27', available: false },
                            { id: '28', title: "Nature's Lament", file: '28', available: false },
                            { id: '29', title: 'Old Bastards', file: '29', available: false },
                            { id: '30', title: 'Abuse of Power', file: '30', available: false },
                            { id: '31', title: 'The Liberation of Weights', file: '31', available: false },
                            { id: '32', title: 'Things Come to a Head', file: '32', available: false },
                            { id: '33', title: "The Prince's Duel", file: '33', available: false },
                            { id: '34', title: 'What Dreams Remain', file: '34', available: false }
                        ]
                    }
                ]
            }
        };

        this.currentView = 'bookshelf';
        this.selectedBook = null;
    }

    init() {
        console.log('📚 Initializing Library Widget');
        
        // Set user color as CSS variable for sidebar theming
        const userColor = window.colorManager?.getColor() || '#8b7355';
        document.documentElement.style.setProperty('--user-color', userColor);
        
        // Initialize reader widget
        console.log('🔍 Checking for ReaderWidget...', typeof ReaderWidget);
        if (typeof ReaderWidget !== 'undefined') {
            this.reader = new ReaderWidget(this);
            console.log('📖 Reader Widget initialized');
        } else {
            console.error('❌ ReaderWidget not available!');
        }
        
        // Handle initial route
        const path = window.location.pathname;
        console.log('📍 Current path:', path);
        const chapterMatch = path.match(/^\/books\/([^/]+)\/(\d+)/);
        
        if (chapterMatch && this.reader) {
            console.log('✅ Matched chapter route:', chapterMatch);
            // Load chapter directly from URL
            const folderName = chapterMatch[1]; // e.g., 'seeker' or 'princes'
            const chapterId = chapterMatch[2]; // e.g., '00' or '01'
            
            console.log('🔍 Looking for book with folder:', folderName);
            // Find book by folder name
            const book = Object.values(this.books).find(b => b.folderName === folderName);
            if (book) {
                console.log('📖 Found book:', book.title);
                // Find chapter by ID
                let chapterIndex = -1;
                if (book.parts) {
                    // Multi-part book
                    let globalIndex = 0;
                    for (const part of book.parts) {
                        for (const chapter of part.chapters) {
                            if (chapter.id === chapterId) {
                                chapterIndex = globalIndex;
                                break;
                            }
                            globalIndex++;
                        }
                        if (chapterIndex !== -1) break;
                    }
                } else {
                    // Simple chapter list
                    chapterIndex = book.chapters.findIndex(ch => ch.id === chapterId);
                }
                
                if (chapterIndex !== -1) {
                    console.log('📖 Loading chapter at index:', chapterIndex);
                    this.reader.loadChapter(book.id, chapterIndex);
                    return;
                } else {
                    console.error('❌ Chapter not found with ID:', chapterId);
                }
            } else {
                console.error('❌ Book not found with folder:', folderName);
            }
        } else if (chapterMatch) {
            console.error('❌ Chapter route matched but reader not available!');
        }
        
        // Check for book query parameter (?book=bookId)
        const urlParams = new URLSearchParams(window.location.search);
        const bookParam = urlParams.get('book');
        if (bookParam) {
            console.log('📖 Book parameter found:', bookParam);
            const book = this.books[bookParam];
            if (book) {
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    this.showBookDetails(book);
                    // Scroll to TOC after details panel is shown
                    setTimeout(() => {
                        const tocElement = document.getElementById('details-toc');
                        if (tocElement) {
                            tocElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 300);
                }, 100);
            }
        }
        
        // Default: show library
        console.log('📚 Showing default library view');
        this.renderBookshelf();
        this.renderList();
    }

    renderBookshelf() {
        const container = document.getElementById('bookshelf-grid');
        if (!container) return;

        container.innerHTML = '';
        const booksToShow = this.getFilteredBooks();

        booksToShow.forEach(book => {
            const bookEl = this.createBookSpine(book);
            container.appendChild(bookEl);
        });

        // On mobile, add CC0 link after the last book
        if (window.innerWidth <= 768) {
            const existing = container.parentElement.querySelector('.mobile-cc0-footer');
            if (existing) existing.remove();
            const cc0 = document.createElement('a');
            cc0.className = 'mobile-cc0-footer';
            cc0.href = 'https://creativecommons.org/publicdomain/zero/1.0/';
            cc0.target = '_blank';
            cc0.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm0 4c-2.761 0-5 2.686-5 6s2.239 6 5 6 5-2.686 5-6-2.239-6-5-6zm2.325 3.472c.422.69.675 1.57.675 2.528 0 2.21-1.343 4-3 4-.378 0-.74-.093-1.073-.263l-.164-.092 3.562-6.173zM12 8c.378 0 .74.093 1.073.263l.164.092-3.562 6.173C9.253 13.838 9 12.958 9 12c0-2.21 1.343-4 3-4z"/></svg> CC0 License Info';
            container.parentElement.appendChild(cc0);

            // Make entire sidebar-links box navigate to /order
            const sidebarLinks = document.querySelector('.sidebar-links');
            if (sidebarLinks && !sidebarLinks.dataset.clickBound) {
                sidebarLinks.dataset.clickBound = 'true';
                sidebarLinks.addEventListener('click', (e) => {
                    // Don't intercept if they clicked the actual link inside
                    if (e.target.closest('a')) return;
                    window.location.href = '/order';
                });
            }
        }
    }

    renderList() {
        const container = document.getElementById('list-container');
        if (!container) return;

        container.innerHTML = '';
        const booksToShow = this.getFilteredBooks();

        booksToShow.forEach(book => {
            const bookEl = this.createBookListItem(book);
            container.appendChild(bookEl);
        });
    }

    createBookSpine(book) {
        const spine = document.createElement('div');
        spine.className = 'book-spine';
        spine.setAttribute('data-book-id', book.id);
        spine.setAttribute('data-book', book.id);

        const statusClass = book.available ? 'available' : 'coming-soon';
        const statusText = book.available ? 'Available Now' : 'Coming Soon';
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // ── Mobile: horizontal card (cover left, info+buttons right) ──
            const stats = book.stats;
            let chapterCount = 0;
            if (book.chapters) chapterCount = book.chapters.length;
            else if (book.parts) chapterCount = book.parts.reduce((s, p) => s + p.chapters.length, 0);

            // Check resume state
            const lastChapter = typeof ReaderWidget !== 'undefined' ? ReaderWidget.getLastChapter(book.id) : null;
            const readLabel = lastChapter ? 'Continue Reading' : 'Begin Reading';

            spine.innerHTML = `
                <img src="${book.cover}" alt="${book.title}" class="book-spine-cover">
                <div class="book-spine-info">
                    <h3 class="book-spine-title" style="color: ${book.color};">${book.title}</h3>
                    <p class="book-spine-author">by ${book.author}</p>
                    <div class="book-spine-status ${statusClass}">${statusText}</div>
                    <div class="mobile-book-actions"></div>
                </div>
            `;

            // Cover tap → start reading
            const cover = spine.querySelector('.book-spine-cover');
            cover.style.cursor = 'pointer';
            cover.addEventListener('click', (e) => {
                e.stopPropagation();
                this.navigateToBook(book.id);
            });

            // Build stacked action buttons
            const actions = spine.querySelector('.mobile-book-actions');
            const buttons = [
                { label: readLabel, icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>', action: () => this.navigateToBook(book.id), disabled: false },
                { label: 'Chapters', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>', action: () => this.showMobileTOC(book), disabled: false },
                { label: 'Read on Kindle', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>', action: () => this.handleKindleClick(book.kindleAsin), disabled: !book.kindleAsin || book.kindleAsin === 'TBD' },
                { label: 'Download ePub', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>', action: () => { if (book.epubUrl) window.location.href = book.epubUrl; }, disabled: !book.epubUrl },
                { label: 'Order Print Editions', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>', action: () => { window.location.href = '/order'; }, disabled: !book.available },
            ];

            buttons.forEach(b => {
                const btn = document.createElement('button');
                btn.className = 'mobile-action-btn';
                btn.innerHTML = `${b.icon} ${b.label}`;
                btn.disabled = b.disabled;
                btn.addEventListener('click', (e) => { e.stopPropagation(); b.action(); });
                actions.appendChild(btn);
            });

        } else {
            // ── Desktop: vertical card ──
            spine.innerHTML = `
                <img src="${book.cover}" alt="${book.title}" class="book-spine-cover">
                <div class="book-spine-info">
                    <h3 class="book-spine-title" style="color: ${book.color};">${book.title}</h3>
                    <p class="book-spine-author">by ${book.author}</p>
                    <div class="book-spine-status ${statusClass}">${statusText}</div>
                </div>
            `;
            spine.addEventListener('click', () => this.showBookDetails(book));
        }

        return spine;
    }

    createBookListItem(book) {
        const item = document.createElement('div');
        item.className = 'book-list-item';
        item.setAttribute('data-book-id', book.id);
        item.setAttribute('data-book', book.id);

        // Count chapters
        let chapterCount = 0;
        if (book.chapters) {
            chapterCount = book.chapters.length;
        } else if (book.parts) {
            chapterCount = book.parts.reduce((sum, part) => sum + part.chapters.length, 0);
        }

        // Extract first paragraph from synopsis for excerpt
        const excerpt = book.synopsis.split('\n')[0];
        
        // Build stats details
        const stats = book.stats;
        const statsHTML = `
            <div class="book-list-stats-detail">
                <span class="stat-detail"><strong>Genre:</strong> ${stats.genre}</span>
                <span class="stat-detail"><strong>Chapters:</strong> ${chapterCount}</span>
                <span class="stat-detail"><strong>Published:</strong> ${stats.published}</span>
                <span class="stat-detail"><strong>Printed:</strong> ${stats.length}</span>
            </div>
        `;
        
        // Build action buttons - don't disable for Princes since some chapters are available
        const printDisabled = !book.available ? ' disabled' : '';
        const epubDisabled = !book.epubUrl ? ' disabled' : '';
        const kindleDisabled = !book.kindleAsin ? ' disabled' : '';
        
        const buttonsHTML = `
            <div class="book-list-actions">
                <button class="list-action-btn" onclick="event.stopPropagation(); window.open('/order', '_blank');"${printDisabled}>
                    Order Print Edition
                </button>
                <button class="list-action-btn" onclick="event.stopPropagation(); ${book.epubUrl ? `window.location.href='${book.epubUrl}'` : ''};"${epubDisabled}>
                    Download ePub
                </button>
                <button class="list-action-btn" onclick="event.stopPropagation(); libraryWidget.navigateToBook('${book.id}');">
                    Read Online Now
                </button>
                <button class="list-action-btn" onclick="event.stopPropagation(); libraryWidget.handleKindleClick('${book.kindleAsin || ''}');"${kindleDisabled}>
                    Read on Kindle
                </button>
            </div>
        `;

        item.innerHTML = `
            <img src="${book.cover}" alt="${book.title}" class="book-list-cover">
            <div class="book-list-info">
                <h3 class="book-list-title" style="color: ${book.color};">${book.title}</h3>
                <p class="book-list-author">by ${book.author}</p>
                <p class="book-list-excerpt">${excerpt}</p>
                ${statsHTML}
            </div>
            <div class="book-list-meta">
                ${buttonsHTML}
            </div>
        `;
        
        // Add click handler to show book details (except when clicking buttons)
        item.addEventListener('click', () => this.showBookDetails(book));

        return item;
    }

    getFilteredBooks() {
        let books = Object.values(this.books);
        return books;
    }

    handleKindleClick(asin) {
        if (!asin || asin === 'TBD') {
            return;
        }
        
        if (typeof openRegionalAmazonLink === 'function') {
            openRegionalAmazonLink(asin);
        } else {
            // Fallback to US Amazon
            window.open(`https://www.amazon.com/dp/${asin}`, '_blank');
        }
    }

    // Navigate to book's reading page (respects session progress)
    navigateToBook(bookId) {
        const book = this.books[bookId];
        if (!book) return;
        
        const resumeUrl = typeof ReaderWidget !== 'undefined' ? ReaderWidget.getResumeUrl(book) : book.readOnlineUrl;
        if (resumeUrl) {
            window.location.href = resumeUrl;
        }
    }

    showBookDetails(book) {
        this.selectedBook = book;
        const panel = document.getElementById('book-details-panel');
        const bookshelfView = document.getElementById('bookshelf-view');
        const listView = document.getElementById('list-view');
        
        if (!panel) return;

        // Set the book data attribute for theming
        panel.setAttribute('data-book', book.id);

        // Populate details
        const coverImg = document.getElementById('details-cover');
        coverImg.src = book.cover;
        coverImg.style.cursor = 'pointer';
        coverImg.onclick = () => {
            // Navigate to last read chapter or preface
            const resumeUrl = typeof ReaderWidget !== 'undefined' ? ReaderWidget.getResumeUrl(book) : book.readOnlineUrl;
            if (resumeUrl) {
                window.location.href = resumeUrl;
            }
        };
        document.getElementById('details-title').textContent = book.title;
        document.getElementById('details-author').textContent = `by ${book.author}`;
        document.getElementById('details-synopsis').textContent = book.synopsis;

        // Render TOC
        this.renderDetailsTOC(book);

        // Set up format buttons
        this.setupFormatButtons(book);

        // Fade out current view, then fade in details panel
        const currentView = this.currentView === 'bookshelf' ? bookshelfView : listView;
        
        currentView.style.opacity = '0';
        setTimeout(() => {
            currentView.style.display = 'none';
            panel.style.display = 'block';
            // Force reflow to ensure transition works
            panel.offsetHeight;
            panel.classList.add('active');
        }, 300);
    }

    renderDetailsTOC(book) {
        const tocContainer = document.getElementById('details-toc');
        if (!tocContainer) return;

        tocContainer.innerHTML = '';

        if (book.parts) {
            // Multi-part book (like Princes) with collapsible sections
            book.parts.forEach((part, partIndex) => {
                const partHeader = document.createElement('div');
                partHeader.className = 'toc-part-header';
                partHeader.innerHTML = `<span class="arrow">${partIndex === 0 ? '▾' : '▸'}</span> ${part.name}`;
                tocContainer.appendChild(partHeader);

                const partContent = document.createElement('div');
                partContent.className = 'toc-part-content';
                partContent.style.display = partIndex === 0 ? 'flex' : 'none';

                part.chapters.forEach(chapter => {
                    if (chapter.available) {
                        const chapterEl = this.createTOCChapter(chapter, book);
                        partContent.appendChild(chapterEl);
                    } else {
                        // Unreleased chapter - show blurred
                        const chapterEl = document.createElement('div');
                        chapterEl.className = 'toc-chapter toc-chapter-unreleased';
                        chapterEl.innerHTML = `
                            <span class="toc-chapter-number">Ch. ${chapter.id}</span>
                            <span class="toc-chapter-title">${chapter.title}</span>
                        `;
                        partContent.appendChild(chapterEl);
                    }
                });

                tocContainer.appendChild(partContent);

                // Toggle part visibility on click
                partHeader.addEventListener('click', () => {
                    const isOpen = partContent.style.display !== 'none';
                    if (!isOpen) {
                        // Close all other parts
                        tocContainer.querySelectorAll('.toc-part-content').forEach(pc => {
                            pc.style.display = 'none';
                        });
                        tocContainer.querySelectorAll('.arrow').forEach(arrow => {
                            arrow.textContent = '▸';
                        });
                        // Open this part
                        partContent.style.display = 'flex';
                        partHeader.querySelector('.arrow').textContent = '▾';
                    }
                });
            });
        } else if (book.chapters) {
            // Simple chapter list (like Seeker)
            book.chapters.forEach(chapter => {
                if (chapter.available) {
                    const chapterEl = this.createTOCChapter(chapter, book);
                    tocContainer.appendChild(chapterEl);
                }
            });
        }
    }

    createTOCChapter(chapter, book) {
        const chapterEl = document.createElement('div');
        chapterEl.className = 'toc-chapter';
        chapterEl.innerHTML = `
            <span class="toc-chapter-number">Ch. ${chapter.id}</span>
            <span class="toc-chapter-title">${chapter.title}</span>
        `;
        chapterEl.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `/books/${book.folderName}/${chapter.id}`;
        });
        return chapterEl;
    }

    /**
     * Mobile-only: bottom-sheet TOC with format buttons in the footer
     */
    showMobileTOC(book) {
        // Remove any existing overlay
        document.querySelector('.mobile-toc-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.className = 'mobile-toc-overlay';

        // Tap backdrop to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        // Count chapters
        let chapterCount = 0;
        if (book.chapters) chapterCount = book.chapters.length;
        else if (book.parts) chapterCount = book.parts.reduce((s, p) => s + p.chapters.length, 0);

        const sheet = document.createElement('div');
        sheet.className = 'mobile-toc-sheet';
        sheet.setAttribute('data-book', book.id);
        sheet.innerHTML = `
            <div class="mobile-toc-header">
                <h3>${book.title} · ${chapterCount} Chapters</h3>
                <button class="mobile-toc-close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="mobile-toc-chapters"></div>
            <div class="mobile-toc-footer">
                <div class="cc0-notice-full">
                    All texts by errantson are dedicated to you through
                    <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank">CC0 1.0</a>.
                    You may freely adapt or utilize these texts.
                    Attribution to <a href="https://reverie.house">reverie.house</a> is appreciated.
                </div>
            </div>
        `;

        // Close button
        sheet.querySelector('.mobile-toc-close').addEventListener('click', () => overlay.remove());

        // Build chapters
        const chaptersEl = sheet.querySelector('.mobile-toc-chapters');

        if (book.parts) {
            book.parts.forEach((part, partIndex) => {
                const partHeader = document.createElement('div');
                partHeader.className = 'toc-part-header';
                partHeader.innerHTML = `<span class="arrow">${partIndex === 0 ? '▾' : '▸'}</span> ${part.name}`;
                chaptersEl.appendChild(partHeader);

                const partContent = document.createElement('div');
                partContent.className = 'toc-part-content';
                partContent.style.display = partIndex === 0 ? 'flex' : 'none';

                part.chapters.forEach(chapter => {
                    if (chapter.available) {
                        partContent.appendChild(this.createTOCChapter(chapter, book));
                    } else {
                        const el = document.createElement('div');
                        el.className = 'toc-chapter toc-chapter-unreleased';
                        el.innerHTML = `
                            <span class="toc-chapter-number">Ch. ${chapter.id}</span>
                            <span class="toc-chapter-title">${chapter.title}</span>
                        `;
                        partContent.appendChild(el);
                    }
                });

                chaptersEl.appendChild(partContent);

                partHeader.addEventListener('click', () => {
                    const isOpen = partContent.style.display !== 'none';
                    if (!isOpen) {
                        chaptersEl.querySelectorAll('.toc-part-content').forEach(pc => pc.style.display = 'none');
                        chaptersEl.querySelectorAll('.arrow').forEach(a => a.textContent = '▸');
                        partContent.style.display = 'flex';
                        partHeader.querySelector('.arrow').textContent = '▾';
                    }
                });
            });
        } else if (book.chapters) {
            book.chapters.forEach(chapter => {
                if (chapter.available) {
                    chaptersEl.appendChild(this.createTOCChapter(chapter, book));
                }
            });
        }

        overlay.appendChild(sheet);
        document.body.appendChild(overlay);
    }

    setupFormatButtons(book) {

        const beginBtn = document.getElementById('details-btn-begin');
        const epubBtn = document.getElementById('details-btn-epub');
        const kindleBtn = document.getElementById('details-btn-kindle');
        const printBtn = document.getElementById('details-btn-print');
        // Begin Reading button: enable if there's any available chapter or a read URL
        if (beginBtn) {
            let canBegin = false;

            if (book.readOnlineUrl) {
                canBegin = true;
            } else if (book.parts) {
                for (const part of book.parts) {
                    if (part.chapters && part.chapters.some(c => c.available)) {
                        canBegin = true;
                        break;
                    }
                }
            } else if (book.chapters) {
                if (book.chapters.some(c => c.available)) canBegin = true;
            }

            beginBtn.disabled = !canBegin;
            
            // Check for saved reading progress
            const lastChapter = typeof ReaderWidget !== 'undefined' ? ReaderWidget.getLastChapter(book.id) : null;
            if (lastChapter) {
                beginBtn.textContent = 'Continue Reading';
            }
            
            beginBtn.onclick = () => {
                // Use resume URL (respects saved progress)
                const resumeUrl = typeof ReaderWidget !== 'undefined' ? ReaderWidget.getResumeUrl(book) : null;
                if (resumeUrl) {
                    window.location.href = resumeUrl;
                    return;
                }

                // Fallback: navigate to the first available chapter
                if (book.parts) {
                    for (const part of book.parts) {
                        for (const chapter of part.chapters) {
                            if (chapter.available) {
                                window.location.href = `/books/${book.folderName}/${chapter.id}`;
                                return;
                            }
                        }
                    }
                } else if (book.chapters) {
                    const ch = book.chapters.find(c => c.available);
                    if (ch) window.location.href = `/books/${book.folderName}/${ch.id}`;
                }
            };
        }

        // Disable all if not available
        const disabled = !book.available;

        [epubBtn, kindleBtn, printBtn].forEach(btn => {
            if (btn) {
                btn.disabled = disabled;
            }
        });

        if (!disabled) {
            // Download ePub
            epubBtn.onclick = () => {
                window.location.href = `/books/${book.folderName}/${book.id.replace('-', '_')}.epub`;
            };

            // Read on Kindle
            kindleBtn.onclick = () => {
                if (window.openRegionalAmazonLink) {
                    window.openRegionalAmazonLink();
                } else if (window.getRegionalAmazonLink) {
                    window.getRegionalAmazonLink()
                        .then(link => window.open(link, '_blank'))
                        .catch(() => window.open('https://www.amazon.com/dp/B0F2ST7CXZ', '_blank'));
                } else {
                    window.open('https://www.amazon.com/dp/B0F2ST7CXZ', '_blank');
                }
            };

            // Order Print
            printBtn.onclick = () => {
                window.location.href = '/order';
            };
        }
    }
}

// Global functions for onclick handlers
function switchView(viewName) {
    const bookshelfView = document.getElementById('bookshelf-view');
    const listView = document.getElementById('list-view');
    const bookshelfBtn = document.querySelector('[data-view="bookshelf"]');
    const listBtn = document.querySelector('[data-view="list"]');
    const detailsPanel = document.getElementById('book-details-panel');

    // Close book details first if open
    if (detailsPanel && detailsPanel.classList.contains('active')) {
        detailsPanel.classList.remove('active');
        setTimeout(() => {
            detailsPanel.style.display = 'none';
            detailsPanel.removeAttribute('data-book');
            
            // Then switch views after details are closed
            performViewSwitch();
        }, 300);
    } else {
        // No details open, switch immediately
        performViewSwitch();
    }
    
    function performViewSwitch() {
        if (viewName === 'bookshelf') {
            bookshelfView.style.display = 'block';
            bookshelfView.style.opacity = '1';
            listView.style.display = 'none';
            bookshelfBtn.classList.add('active');
            listBtn.classList.remove('active');
            if (window.libraryWidget) {
                window.libraryWidget.currentView = 'bookshelf';
                window.libraryWidget.selectedBook = null;
            }
        } else if (viewName === 'list') {
            listView.style.display = 'block';
            listView.style.opacity = '1';
            bookshelfView.style.display = 'none';
            bookshelfBtn.classList.remove('active');
            listBtn.classList.add('active');
            if (window.libraryWidget) {
                window.libraryWidget.currentView = 'list';
                window.libraryWidget.selectedBook = null;
            }
        }
    }
}

function closeBookDetails() {
    const panel = document.getElementById('book-details-panel');
    const bookshelfView = document.getElementById('bookshelf-view');
    const listView = document.getElementById('list-view');
    
    if (panel && window.libraryWidget) {
        const widget = window.libraryWidget;
        const targetView = widget.currentView === 'bookshelf' ? bookshelfView : listView;
        
        // Fade out panel
        panel.classList.remove('active');
        
        setTimeout(() => {
            panel.style.display = 'none';
            panel.removeAttribute('data-book');
            
            // Show and fade in the appropriate view
            targetView.style.display = 'block';
            targetView.style.opacity = '0';
            // Force reflow
            targetView.offsetHeight;
            targetView.style.transition = 'opacity 0.3s ease';
            targetView.style.opacity = '1';
            
            widget.selectedBook = null;
        }, 300);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLibrary);
} else {
    initLibrary();
}

function initLibrary() {
    const widget = new LibraryWidget();
    window.libraryWidget = widget;
    widget.init();
    console.log('✅ Library Widget initialized');
}
