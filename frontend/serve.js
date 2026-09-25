const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 5500);
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';
const ROOT = __dirname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

function proxy(req, res) {
  const target = new URL(req.url, BACKEND_URL);
  const transport = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers, host: target.host, 'x-forwarded-host': req.headers.host || '' };
  delete headers.connection;
  const upstream = transport.request({ protocol: target.protocol, hostname: target.hostname, port: target.port || (target.protocol === 'https:' ? 443 : 80), path: `${target.pathname}${target.search}`, method: req.method, headers }, (response) => {
    const responseHeaders = { ...response.headers };
    delete responseHeaders['content-length'];
    res.writeHead(response.statusCode || 502, responseHeaders);
    response.pipe(res);
  });
  upstream.setTimeout(30000, () => upstream.destroy(new Error('Backend request timed out')));
  upstream.on('error', (err) => {
    if (res.headersSent) return res.destroy(err);
    res.writeHead(502, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ success: false, message: `Backend unavailable: ${err.message}` }));
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/') || req.url === '/health') return proxy(req, res);
  const pathname = decodeURIComponent(req.url.split('?')[0]);
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT)) return res.writeHead(403).end('Forbidden');
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`CodeMentor workspace running on port ${PORT}; API proxy → ${BACKEND_URL}`));
