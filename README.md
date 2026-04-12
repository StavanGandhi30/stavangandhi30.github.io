# Stavan Gandhi — Personal Site

Single-page static site in **`dist/`** — **HTML + Tailwind (CDN) + vanilla JS**, founder positioning. **`npm run build`** assembles **`dist/index.html`** from **`dist/index.src.html`** and **`dist/partials/*.html`**, links **`dist/css/site.css`**, then embeds **`dist/data/blogs.json`** into the page. If a `public/` folder exists, the build script copies it over `dist/` first (you’ll need to run build again afterward to re-assemble).

## Commands

| Command | What it does |
|--------|----------------|
| **`npm run build`** | Assembles `dist/index.html`, embeds `dist/data/blogs.json`, copies `public/` → `dist/` if `public/` exists. |

Requires **Node 18+**. No `npm install` unless you add dependencies. To preview locally after a build, serve **`dist/`** with any static file server (for example your editor’s “Live Preview” or `python3 -m http.server` from inside **`dist/`**).

After a build, **Writing** works from **`dist/index.html` even via `file://`** because posts are embedded.

## Deploy

### GitHub Pages (`stavangandhi30.github.io`)

This repo includes **`.github/workflows/main.yml`**. On every push to **`main`** or **`master`** (or a manual **Run workflow**), GitHub Actions runs **`npm run build`** and publishes the **`dist/`** folder.

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

**Still wrong after switching to Actions?** On GitHub, open **Code → `.github/workflows/`**. If you (or the Pages UI) added **“Static HTML”** / **“Deploy static content to Pages”**, that workflow uploads the **whole repo** (`path: '.'`), so the site is basically `README.md` and there is no root `index.html`. **Delete that extra YAML file** (or disable the workflow) so only **`main.yml`** runs—this one uploads **`dist/`** after `npm run build`.

**Do you need `npm run build` before every push?** **No.** The workflow runs the build on GitHub. Run **`npm run build`** locally when you want to check the output or catch errors before pushing.

**Git:** `dist/index.html` is **gitignored** (it is generated). Commit everything else under **`dist/`** (partials, `css/`, `js/`, `data/`, images, `resume.pdf`, etc.) plus **`scripts/`** and **`package.json`**.

### Other hosts

Publish the **`dist/`** folder as the site root and run **`npm run build`** before upload (or use CI the same way).

Update the canonical URL in **`dist/partials/head.html`** when you have a custom domain.

## Content (all under `dist/`)

| What | Where |
|------|--------|
| Page shell & includes | `dist/index.src.html`, `dist/partials/*.html` |
| Custom CSS | `dist/css/site.css` |
| Generated page (after build) | `dist/index.html` |
| Blog posts | `dist/data/blogs.json` |
| Resume | `dist/resume.pdf` |
| Certificate images | `dist/images/certificates/` |

### Certificate images

Placeholder **SVGs** are included. To use real credentials:

1. Export or screenshot your certificate (PNG or JPG).
2. Save into `dist/images/certificates/` (e.g. `iit-bombay-entrepreneurship.png`).
3. In the right file under `dist/partials/` (e.g. certificates section), change the matching `<img src="...">` and link `href` from `.svg` to `.png` / `.jpg`, then run **`npm run build`**.

Or replace the SVG files in place with the same filenames if your host serves them.

### Blog permalinks

Anchors look like `#post-{id}` (see each post after expanding).

## Contact

Submit builds a **mailto:** to `stavangandhi3008@gmail.com`. Very long bodies can exceed mailto limits; the UI warns when the URL is too long.
