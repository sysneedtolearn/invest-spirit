const http = require('http');
const https = require('https');

const PORT = 3456;

function fetch(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  const url = req.url.slice(1); // 去掉前导/
  
  if (url.startsWith('fund/')) {
    const code = url.replace('fund/', '');
    try {
      const js = await fetch(`https://fund.eastmoney.com/pingzhongdata/${code}.js`);
      // 提取Data_netWorthTrend数据
      const match = js.match(/Data_netWorthTrend\s*=\s*(\[.*?\]);/s);
      if (match) {
        res.end(match[1]);
      } else {
        res.end(JSON.stringify({error: '数据未找到'}));
      }
    } catch(e) {
      res.end(JSON.stringify({error: e.message}));
    }
    return;
  }
  
  res.end('{"error": "invalid request"}');
});

server.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`);
});
