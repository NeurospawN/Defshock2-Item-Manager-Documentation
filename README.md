# Documentation Navigator

A lightweight, offline-friendly Markdown documentation viewer with search, generated section navigation, reading progress, responsive layout, and Lua syntax highlighting.

## Edit the documentation

Put your content in [`documentation.md`](documentation.md). Use Markdown headings to create the outline. Fenced blocks labeled `lua` receive syntax highlighting:

```markdown
```lua
local answer = 42
```
```

## Preview locally

The browser blocks JavaScript from fetching a neighboring Markdown file when the page is opened directly from `file://`. Serve the folder over HTTP instead. For example, with Python installed:

```text
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy

Deploy the repository as static files to GitHub Pages, Netlify, Cloudflare Pages, or any other static host. No build step, backend, database, or network dependency is required.