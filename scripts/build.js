/**
 * dist workflow:
 * 1. Assemble dist/index.html from dist/index.src.html + dist/partials/*.html
 * 2. Embed dist/data/blogs.json into #blogs-data for offline-friendly Writing section
 *
 * If a legacy public/ folder exists, copies it over dist/ first (then re-run build to assemble).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');

if (fs.existsSync(publicDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
  fs.cpSync(publicDir, distDir, { recursive: true });
  console.log('Copied public/ → dist/');
}

const srcPath = path.join(distDir, 'index.src.html');
const indexPath = path.join(distDir, 'index.html');

function assembleHtml() {
  if (!fs.existsSync(srcPath)) {
    console.error(
      'Missing dist/index.src.html. Add index.src.html + dist/partials/ or restore a full dist/ from version control.'
    );
    process.exit(1);
  }
  let html = fs.readFileSync(srcPath, 'utf8');
  const includeRe = /<!--\s*BUILD:include\s+(\S+)\s*-->/g;
  html = html.replace(includeRe, (_, rel) => {
    const partialPath = path.join(distDir, rel);
    if (!fs.existsSync(partialPath)) {
      throw new Error(`BUILD:include missing file: ${rel}`);
    }
    return fs.readFileSync(partialPath, 'utf8');
  });
  fs.writeFileSync(indexPath, html);
  console.log('Assembled dist/index.html from index.src.html + partials');
}

assembleHtml();

const blogsPath = path.join(distDir, 'data', 'blogs.json');

if (fs.existsSync(blogsPath)) {
  let blogsRaw = fs.readFileSync(blogsPath, 'utf8');
  blogsRaw = blogsRaw.replace(/<\/script/gi, '<\\/script');
  let html = fs.readFileSync(indexPath, 'utf8');
  const embed = `<script type="application/json" id="blogs-data">${blogsRaw}</script>\n    `;
  if (html.includes('id="blogs-data"')) {
    html = html.replace(
      /<script type="application\/json" id="blogs-data"[^>]*>[\s\S]*?<\/script>\s*/i,
      embed
    );
  } else {
    html = html.replace(
      '<script type="module" src="js/main.js"></script>',
      embed + '<script type="module" src="js/main.js"></script>'
    );
  }
  fs.writeFileSync(indexPath, html);
  console.log('Embedded data/blogs.json into dist/index.html');
} else {
  console.warn('No dist/data/blogs.json — skipped blog embed.');
}

console.log('Build complete.');
