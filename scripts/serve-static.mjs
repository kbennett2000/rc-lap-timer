// Serves the phone-only app from out/ the way GitHub Pages does, under its base path (npm run serve:pages).
// `next start` can't serve a static export. Options: --port 3100 --base /rc-lap-timer --dir out

import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const options = {};
for (let i = 2; i < process.argv.length; i += 2) options[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const port = Number(options.port ?? 3100);
const base = (options.base ?? process.env.PAGES_BASE_PATH ?? "/rc-lap-timer").replace(/\/$/, "");
const root = resolve(options.dir ?? "out");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// The file for a path inside the site, or null. Folders serve their index.html.
function fileFor(pathname) {
  const file = join(root, normalize(decodeURIComponent(pathname)));
  if (file !== root && !file.startsWith(root + sep)) return null;
  try {
    const found = statSync(file).isDirectory() ? join(file, "index.html") : file;
    return statSync(found).isFile() ? found : null;
  } catch {
    return null;
  }
}

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  if (base && pathname === base) {
    response.writeHead(301, { Location: `${base}/` });
    response.end();
    return;
  }
  const file = pathname.startsWith(`${base}/`) ? fileFor(pathname.slice(base.length)) : null;
  if (!file) {
    const notFound = fileFor("/404.html");
    response.writeHead(404, { "Content-Type": TYPES[".html"] });
    if (notFound) createReadStream(notFound).pipe(response);
    else response.end("Not found");
    return;
  }
  const headers = { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" };
  // Browsers check for a new service worker on every visit; it must never come from a cache.
  if (file.endsWith(`${sep}sw.js`)) headers["Cache-Control"] = "no-cache";
  response.writeHead(200, headers);
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => console.log(`Serving ${root} at http://127.0.0.1:${port}${base}/`));
