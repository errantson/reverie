document.addEventListener('DOMContentLoaded', function () {
    const books = [
        {
            title: "Seeker's Reverie",
            cover: "books/seeker/seekers_reverie.png",
            chapters: [
                { title: "Preface", md: "books/seeker/sr00-preface.md" },
                { title: "Escaping Oneself", md: "books/seeker/sr01-escaping_oneself.md" },
                { title: "Welcome to Reverie House", md: "books/seeker/sr02-welcome_to_reverie_house.md" },
                { title: "Remembering The Way", md: "books/seeker/sr03-remembering_the_way.md" }
            ],
            md: "books/seeker/README.md"
        }
    ];
    const defaultBook = books.find(b => b.title === "Seeker's Reverie");
    const readerContainer = document.createElement('div');
    readerContainer.id = 'reader-container';
    document.body.appendChild(readerContainer);
    function getChapterTitle(book, index) {
        const chapter = book.chapters[index];
        return index === 0 ? chapter.title : "Chapter " + index + ": " + chapter.title;
    }
    function renderHeader(book) {
        return `<header class="book-header" style="background: inherit; display: flex; align-items: center; padding: 10px; margin-bottom:20px;">
            <a href="#" onclick="openRegionalAmazonLink(); return false;">
                <img src="${book.cover}" alt="${book.title}" style="width:100px; margin-right:20px;"/>
            </a>
            <div class="header-buttons" style="display: flex; flex-direction: column; gap: 5px;">
                <button class="header-button" onclick="openRegionalAmazonLink()">Read on Kindle</button>
                <button class="header-button" onclick="window.location.href='print.html'">Order Print Edition</button>
                <button class="header-button" onclick="window.location.href='books/seeker/seekers_reverie.epub'">Download ePub</button>
            </div>
        </header>`;
    }
    function loadBook(book) {
        if (book.chapters && book.chapters.length > 0) {
            let chapterHTML = renderHeader(book);
            book.chapters.forEach((chapter, index) => {
                let chapterClass = index % 2 === 0 ? 'chapter-item even' : 'chapter-item odd';
                chapterHTML += '<div class="'+ chapterClass +'" data-md="'+ chapter.md +'" data-index="'+ index +'">';
                if (index === 0 && chapter.title === "Preface") {
                    chapterHTML += '<h3 class="chapter-index">Chapter ' + index + ':</h3>';
                    chapterHTML += '<h4 class="chapter-title">' + chapter.title + '</h4>';
                } else if (index === 0) {
                    chapterHTML += '<h2 class="chapter-title main-chapter">' + chapter.title + '</h2>';
                } else {
                    chapterHTML += '<h3 class="chapter-index">Chapter ' + index + ':</h3>';
                    chapterHTML += '<h4 class="chapter-title">' + chapter.title + '</h4>';
                }
                chapterHTML += '</div>';
            });
            readerContainer.innerHTML = chapterHTML;
            readerContainer.style.display = 'block';
            readerContainer.querySelectorAll('.chapter-item').forEach(item => {
                item.addEventListener('click', () => {
                    const chapterIndex = parseInt(item.getAttribute('data-index'));
                    history.pushState({ chapterIndex: chapterIndex }, "", "?chapter=" + chapterIndex);
                    loadChapter(book, getChapterTitle(book, chapterIndex), book.chapters[chapterIndex].md);
                });
            });
        } else {
            loadChapter(book, "", book.md);
        }
    }
    function loadChapter(book, chapterTitle, mdLink) {
        fetch(mdLink)
            .then(response => {
                if (!response.ok) throw new Error('Network error');
                return response.text();
            })
            .then(mdContent => {
                let header = renderHeader(book);
                if (chapterTitle) header += '<h3>' + chapterTitle + '</h3>';
                readerContainer.innerHTML = header + marked.parse(mdContent);
            })
            .catch(error => console.error('Error loading markdown:', error));
    }
    const params = new URLSearchParams(window.location.search);
    const chapterParam = params.get('chapter');
    if (chapterParam !== null) {
        const chapterIndex = parseInt(chapterParam);
        loadChapter(defaultBook, getChapterTitle(defaultBook, chapterIndex), defaultBook.chapters[chapterIndex].md);
    } else {
        loadBook(defaultBook);
    }
    window.addEventListener('popstate', function(event) {
        const params = new URLSearchParams(window.location.search);
        const chapterParam = params.get('chapter');
        if (chapterParam !== null) {
            const chapterIndex = parseInt(chapterParam);
            loadChapter(defaultBook, getChapterTitle(defaultBook, chapterIndex), defaultBook.chapters[chapterIndex].md);
        } else {
            loadBook(defaultBook);
        }
    });
    window.openReaderApp = function() {
        history.pushState({}, "", window.location.pathname);
        loadBook(defaultBook);
    };
});