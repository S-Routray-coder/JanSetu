const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf'
};

const ROUTE_ALIASES = {
    '/': '/index.html',
    '/index': '/index.html',
    '/dashboard': '/citizendashboard.html',
    '/citizen': '/citizendashboard.html',
    '/officer': '/officerdashboard.html',
    '/report': '/report.html',
    '/signup': '/signup.html'
};

const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];

    if (ROUTE_ALIASES[reqUrl]) {
        reqUrl = ROUTE_ALIASES[reqUrl];
    }

    let filePath = path.join(ROOT, reqUrl);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`<h2>404 - File Not Found</h2><p>Could not find <code>${reqUrl}</code></p><p><a href="/index.html">← Back to JanSetu Home</a></p>`);
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content);
        }
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`JanSetu Local Server running at http://localhost:${PORT}`);
});
