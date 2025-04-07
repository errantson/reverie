function loadMarkdown(markdownFile, bookTitle) {
    fetch(markdownFile)
        .then(response => response.text())
        .then(markdown => {
            const container = document.getElementById('markdown-content');
            const lines = markdown.split('\n');
            const titleMatch = lines[0].match(/# \*\*(.*?)\*\*/);

            if (titleMatch) {
                document.title = `${bookTitle} — ${titleMatch[1]}`;
            }

            container.innerHTML = marked.parse(markdown);
        })
        .catch(error => console.error('Error loading Markdown:', error));
}
