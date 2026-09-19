# Documentation Navigator

A lightweight, offline-friendly Markdown documentation viewer with search, generated section navigation, reading progress, responsive layout, and Luau syntax highlighting.

## Edit the documentation

Put your content in [`documentation.md`](documentation.md). Use Markdown headings to create the outline. Fenced blocks labeled `luau` receive Roblox Studio-style syntax highlighting:

```markdown
```luau
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

GitHub Pages deployment is configured in `.github/workflows/pages.yml`. Push the repository to the `main` branch, then in the repository settings choose **Pages > Build and deployment > Source: GitHub Actions**. Each push to `main` will publish the site automatically.

The expected GitHub Pages URL is:

`https://neurospawn.github.io/Defshock2-Item-Manager-Documentation/`

No build step, backend, database, or network dependency is required.

## Discord embed image

Place the supplied image in the repository root as `embed-image.jpg`. The page already includes Open Graph and Twitter card metadata for that file. After deployment, Discord may need a fresh URL or cache refresh before showing updated embed metadata.