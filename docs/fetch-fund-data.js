const fs = require('fs');
const https = require('https');

const fundCodes = ['001475', '008888', '003834', '519674', '012348'];

function fetchFund(code) {
  return new Promise((resolve, reject) => {
    https.get(`https://fund.eastmoney.com/pingzhongdata/${code}.js`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/Data_netWorthTrend\s*=\s*(\[.*?\]);/s);
        if (match) {
          try {
            const arr = JSON.parse(match[1]);
            // 取最近30条
            const recent = arr.slice(-30).map(d => ({x: d.x, y: d.y}));
            resolve({code, data: recent});
          } catch(e) {
            resolve({code, data: [], error: e.message});
          }
        } else {
          resolve({code, data: [], error: 'no data'});
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const results = {};
  for (const code of fundCodes) {
    const r = await fetchFund(code);
    results[code] = r.data;
    console.log(code, r.data.length, 'records');
  }
  const js = 'const FUND_TRENDS = ' + JSON.stringify(results, null, 2) + ';';
  fs.writeFileSync('docs/fund-data.js', js);
  console.log('Saved to docs/fund-data.js');
}

main().catch(console.error);
