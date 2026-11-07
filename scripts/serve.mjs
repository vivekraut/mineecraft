// Minimal static file server for previewing dist/ locally (Vercel serves dist/ in production).
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(DIST, '.' + (urlPath.endsWith('/') ? urlPath + 'index.html' : urlPath));
    if (file !== DIST && !file.startsWith(DIST + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let data;
    try {
      data = await fs.readFile(file);
    } catch {
      file = path.join(DIST, 'index.html');
      data = await fs.readFile(file);
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(500).end('Server error — did you run "npm run build"?');
  }
});

server.listen(PORT, () => console.log(`Minee's Crafts running at http://localhost:${PORT}`));
