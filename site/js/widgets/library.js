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

        spine.innerHTML = `
            <img src="${book.cover}" alt="${book.title}" class="book-spine-cover">
            <div class="book-spine-info">
                <h3 class="book-spine-title" style="color: ${book.color};">${book.title}</h3>
                <p class="book-spine-author">by ${book.author}</p>
                <div class="book-spine-status ${statusClass}">${statusText}</div>
            </div>
        `;

        spine.addEventListener('click', () => this.showBookDetails(book));

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
                <button class="list-action-btn" onclick="event.stopPropagation(); window.location.href='${book.readOnlineUrl}';">
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

    showBookDetails(book) {
        this.selectedBook = book;
        const panel = document.getElementById('book-details-panel');
        const bookshelfView = document.getElementById('bookshelf-view');
        const listView = document.getElementById('list-view');
        
        if (!panel) return;

        // Set the book data attribute for theming
        panel.setAttribute('data-book', book.id);

        // Populate details
        document.getElementById('details-cover').src = book.cover;
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
                partHeader.innerHTML = `<span class="arrow">${partIndex === 0 ? '⮟' : '⮞'}</span> ${part.name}`;
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
                            arrow.textContent = '⮞';
                        });
                        // Open this part
                        partContent.style.display = 'flex';
                        partHeader.querySelector('.arrow').textContent = '⮟';
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
            beginBtn.onclick = () => {
                if (book.readOnlineUrl) {
                    window.location.href = book.readOnlineUrl;
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
