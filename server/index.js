/**
 * 投资精灵 Web Server
 * 提供 API + 静态页面服务
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3927;
const DATA_DIR = path.join(__dirname, '..', 'data');
const WEB_DIR = path.join(__dirname, '..', 'web');
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, data, status = 200) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // ---- API Routes ----

  // GET /api/portfolio
  if (pathname === '/api/portfolio' && req.method === 'GET') {
    const data = readJSON(path.join(DATA_DIR, 'portfolio.json'));
    return json(res, data || {});
  }

  // GET /api/operations
  if (pathname === '/api/operations' && req.method === 'GET') {
    const data = readJSON(path.join(DATA_DIR, 'operations.json'));
    return json(res, data || { operations: [] });
  }

  // GET /api/reports
  if (pathname === '/api/reports' && req.method === 'GET') {
    const data = readJSON(path.join(DATA_DIR, 'daily-reports.json'));
    return json(res, data || { reports: [] });
  }

  // GET /api/config
  if (pathname === '/api/config' && req.method === 'GET') {
    const data = readJSON(CONFIG_FILE);
    return json(res, data || {});
  }

  // PUT /api/config/capital
  if (pathname === '/api/config/capital' && req.method === 'PUT') {
    const body = await parseBody(req);
    if (!body.totalCapital || body.totalCapital <= 0) {
      return json(res, { error: '请输入有效金额' }, 400);
    }
    const config = readJSON(CONFIG_FILE);
    const portfolio = readJSON(path.join(DATA_DIR, 'portfolio.json'));
    const diff = body.totalCapital - portfolio.totalCapital;
    portfolio.totalCapital = body.totalCapital;
    portfolio.availableCash += diff;
    config.totalCapital = body.totalCapital;
    writeJSON(CONFIG_FILE, config);
    writeJSON(path.join(DATA_DIR, 'portfolio.json'), portfolio);
    return json(res, { success: true, totalCapital: body.totalCapital, availableCash: portfolio.availableCash });
  }

  // GET /api/summary — 聚合数据给前端一次性加载
  if (pathname === '/api/summary' && req.method === 'GET') {
    const portfolio = readJSON(path.join(DATA_DIR, 'portfolio.json'));
    const operations = readJSON(path.join(DATA_DIR, 'operations.json'));
    const reports = readJSON(path.join(DATA_DIR, 'daily-reports.json'));
    const config = readJSON(CONFIG_FILE);
    return json(res, { portfolio, operations, reports, config });
  }

  // ---- Static Files ----
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(WEB_DIR, filePath);

  // Security: prevent path traversal
  if (!filePath.startsWith(WEB_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const ext = path.extname(filePath);
      const contentType = MIME[ext] || 'application/octet-stream';
      const content = fs.readFileSync(filePath);
      cors(res);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return;
    }
  } catch {}

  // 404
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>404 - Not Found</h1>');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🧚 投资精灵 Web Server running at http://0.0.0.0:${PORT}`);
});
