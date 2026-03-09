/**
 * 投资精灵 Web Server
 * 提供 API + 静态页面服务
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3927;

// 调用多模态模型识别图片
async function callMultimodalModel(imageDataUrl) {
  const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const prompt = `请识别这张基金/股票持仓截图，提取所有持仓信息。

请按以下JSON格式返回（只返回JSON，不要其他内容）：
{
  "positions": [
    {"name": "基金/股票名称", "code": "代码", "totalCost": 持仓成本(数字), "currentValue": 当前市值(数字), "totalShares": 持有份额(数字，可选)}
  ]
}

如果无法识别或图片不清晰，返回：
{"positions": [], "error": "错误原因"}`;

  const payload = JSON.stringify({
    model: "gemini-2.0-flash",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageDataUrl } }
        ]
      }
    ],
    max_tokens: 2000,
    temperature: 0.1
  });

  // 通过 OpenClaw MCP 调用模型 (绕过代理)
  const curlCmd = `curl -s --noproxy '*' -X POST 'http://127.0.0.1:18999/v1/chat/completions' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer dummy' \
    --max-time 120 \
    -d '${payload.replace(/'/g, "\\'")}'`;

  try {
    const response = execSync(curlCmd, { timeout: 130000, env: { ...process.env, http_proxy: '', https_proxy: '', HTTP_PROXY: '', HTTPS_PROXY: '' } });
    const result = JSON.parse(response.toString());
    const content = result.choices?.[0]?.message?.content || '';
    
    // 解析 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { positions: [], error: '无法解析模型返回' };
  } catch (e) {
    return { positions: [], error: e.message };
  }
}
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
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
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

  // POST /api/upload — 上传截图存到服务器，返回 ID
  if (pathname === '/api/upload' && req.method === 'POST') {
    const body = await parseBody(req);
    const imageData = body.image || body.dataUrl || '';
    if (!imageData) {
      return json(res, { error: '请提供图片数据' }, 400);
    }
    
    const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const ext = imageData.match(/^data:image\/(\w+);base64,/)?.[1] || 'png';
    const filename = `${id}.${ext}`;
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(base64Data, 'base64'));
    
    console.log('[Upload] 保存截图:', filename);
    return json(res, { success: true, id, filename, url: `/data/uploads/${filename}` });
  }

  // GET /api/screenshots — 列出所有上传的截图
  if (pathname === '/api/screenshots' && req.method === 'GET') {
    const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
    if (!fs.existsSync(UPLOAD_DIR)) {
      return json(res, { screenshots: [] });
    }
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
    const screenshots = files.map(f => ({
      filename: f,
      url: `/data/uploads/${f}`,
      addedAt: fs.statSync(path.join(UPLOAD_DIR, f)).mtime.toISOString()
    })).sort((a,b) => new Date(b.addedAt) - new Date(a.addedAt));
    return json(res, { screenshots });
  }

  // GET /data/uploads/* — 静态文件服务
  if (pathname.startsWith('/data/uploads/')) {
    const file = path.join(__dirname, '..', pathname);
    if (fs.existsSync(file)) {
      const ext = path.extname(file).slice(1);
      res.writeHead(200, { 'Content-Type': MIME[('.'+ext)] || 'image/png' });
      fs.createReadStream(file).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
    return;
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
