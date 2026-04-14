# Stavan Gandhi — Personal Site

Single-page static site in **`dist/`** — edit **`dist/index.html`** directly. **Writing**, **Credentials**, and **Endorsements** load from **`dist/data/blogs.json`**, **`credentials.json`**, and **`recommendations.json`** (all need **`http://`**, not **`file://`**). Styling uses **Tailwind (CDN)** plus **`css/site.css`**. Behavior is split across **ES modules** under **`dist/js/`** (loaded via **`type="module"`** on **`site.js`**); see the table below. There is **no build step**: commit what’s in **`dist/`** and deploy that folder.

To preview locally, serve **`dist/`** with any static file server (for example your editor’s “Live Preview” or `python3 -m http.server` from inside **`dist/`**).

Serve **`dist/`** over HTTP so **`data/*.json`** loads and **ES module** imports resolve; opening **`index.html`** as **`file://`** usually breaks fetches and module loading.

**Recommendation excerpts:** Only publish quotes **with each recommender’s explicit permission** (the letter is their work; many are written for a specific audience). Edit copy in **`dist/data/recommendations.json`** and keep the **`disclaimer`** accurate. Each item supports optional **`avatar`** (HTTPS image URL); otherwise initials are shown. Wrap phrases in **`**double asterisks**`** for bold in the quote text.

## Deploy

### GitHub Pages (`stavangandhi30.github.io`)

This repo includes **`.github/workflows/main.yml`**. On every push to **`main`** or **`master`** (or a manual **Run workflow**), GitHub Actions publishes the committed **`dist/`** folder as the site.

1. Create a repository named **`stavangandhi30.github.io`** under your GitHub user **`stavangandhi30`** (exact name is required for that URL).
2. Push this project to the default branch (`main` or `master`).
3. In the repo on GitHub: **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions** (not “Deploy from a branch”).
4. Open the **Actions** tab and confirm the **Deploy to GitHub Pages** workflow succeeds. The site will be at **https://stavangandhi30.github.io/** (propagation can take a minute).

#### Site still shows `README.md`?

That means Pages is still serving the **git branch** (repo root), where there is no `index.html`—not the **`dist/`** output from Actions.

1. Go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not *Deploy from a branch*). If you previously used **Branch: main / (root)**, change it.
3. Save, then open **Actions → Deploy to GitHub Pages → Run workflow** (or push any commit) so a new deploy runs.
4. On the workflow run page, expand and confirm **both** the **build** and **deploy** jobs completed (green). If **deploy** is waiting on **deployment approval**, open the run and approve the **`github-pages`** environment.
5. Hard-refresh the site or try an incognito window.

**Still wrong after switching to Actions?** On GitHub, open **Code → `.github/workflows/`**. If you (or the Pages UI) added **“Static HTML”** / **“Deploy static content to Pages”**, that workflow uploads the **whole repo** (`path: '.'`), so the site is basically `README.md` and there is no root `index.html`. **Delete that extra YAML file** (or disable the workflow) so only **`main.yml`** runs—this one uploads **`dist/`** from the repo.

**Git:** Commit **`dist/index.html`**, **`dist/css/`**, **`dist/js/`**, **`dist/data/`**, assets, etc.

### Other hosts

Publish the **`dist/`** folder as the site root.

Update the canonical URL in **`dist/index.html`** (`<head>`) when you have a custom domain.

## Content (all under `dist/`)

| What | Where |
|------|--------|
| Page | `dist/index.html` (minimal `<head>`; charset, viewport, then `js/head/document-head.js`) |
| End-of-body bootstrap (year + site app) | `dist/js/page-end.js` |
| Custom CSS | `dist/css/site.css` |
| Blog posts (source) | `dist/data/blogs.json` |
| Credentials & programs (source) | `dist/data/credentials.json` |
| Endorsement excerpts (source) | `dist/data/recommendations.json` |
| Profile JSON-LD (Schema.org) | `dist/data/profile-page-ld.json` (injected by `dist/js/head/embed-profile-ldjson.js`) |
| Resume | `dist/data/resume.pdf` |
| Certificate images | `dist/images/certificates/` |

### JavaScript (`dist/js/`)

| Path | Role |
|------|------|
| **`page-end.js`** | Body entry: sets copyright year, imports the main app. |
| **`head/document-head.js`** | Builds `<head>` (SEO meta, icons, fonts, Tailwind, `site.css`). |
| **`head/embed-profile-ldjson.js`** | Fetches `data/profile-page-ld.json` and injects JSON-LD. |
| **`config/tailwind-config.js`** | Tailwind Play CDN theme extensions (fonts, `canvas` color). |
| **`app/site.js`** | Main app: `DOMContentLoaded` wiring (theme, nav, blog, Connect, audio, …). |
| **`app/site-utils.js`** | Shared helpers and JSON `fetch` loaders. |
| **`app/site-nav.js`** | Theme toggle, section nav, scroll-fade, blog hash / nav sync. |
| **`app/site-content.js`** | Blog, credentials, recommendations, LinkedIn embeds, certificate UI. |

### Image folders (`dist/images/`)

| Folder | Use |
|--------|-----|
| **`icons/`** | Favicons and PWA-style icons (`favicon-32.png`, `favicon-48.png`, `apple-touch-icon.png`). Regenerate from `photos/profile.png` if you swap the portrait. |
| **`photos/`** | Page imagery: profile, research shots, etc. |
| **`logos/`** | School or org marks (e.g. Tetr, DePaul). |
| **`certificates/`** | Optional certificate thumbnails for credential cards (see below). |

### Certificate images

Placeholder **SVGs** are included. To use real credentials:

1. Export or screenshot your certificate (PNG or JPG).
2. Save into `dist/images/certificates/` (e.g. `iit-bombay-entrepreneurship.png`).
3. Edit credential cards in **`dist/data/credentials.json`**: each object in **`items`** has **`title`**, **`meta`** (issuer · date line), **`description`**, optional **`url`** (certificate / share link → “View Certificate →”), and optional **`courseUrl`** (program on Coursera etc. → “Specialization / course →”). Omit either field to hide that link.

Or replace the SVG files in place with the same filenames if your host serves them.

### Blog permalinks

Anchors look like `#post-{id}` (see each post after expanding).

## Connect

Submit builds a **mailto:** to `stavangandhi3008@gmail.com`. Very long bodies can exceed mailto limits; the UI warns when the URL is too long.
