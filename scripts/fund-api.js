/**
 * 场外基金数据获取工具
 * 数据源：天天基金 (eastmoney)
 */

const https = require('https');
const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://fund.eastmoney.com/' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// 获取基金实时净值
async function getFundNav(fundCode) {
  try {
    const url = `http://fundgz.1234567.com.cn/js/${fundCode}.js?rt=${Date.now()}`;
    const raw = await fetch(url);
    const match = raw.match(/jsonpgz\((.+)\)/);
    if (match) {
      const data = JSON.parse(match[1]);
      return {
        code: data.fundcode,
        name: data.name,
        nav: parseFloat(data.dwjz),        // 单位净值
        estimatedNav: parseFloat(data.gsz), // 估算净值
        estimatedChange: parseFloat(data.gszzl), // 估算涨跌幅
        navDate: data.jzrq,                 // 净值日期
        updateTime: data.gztime            // 更新时间
      };
    }
    return null;
  } catch (e) {
    console.error(`获取基金 ${fundCode} 净值失败:`, e.message);
    return null;
  }
}

// 获取基金历史净值
async function getFundHistory(fundCode, days = 30) {
  try {
    const url = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${fundCode}&pageIndex=1&pageSize=${days}&startDate=&endDate=&callback=`;
    const raw = await fetch(url);
    const data = JSON.parse(raw);
    if (data.Data && data.Data.LSJZList) {
      return data.Data.LSJZList.map(item => ({
        date: item.FSRQ,
        nav: parseFloat(item.DWJZ),
        accNav: parseFloat(item.LJJZ),
        dailyChange: parseFloat(item.JZZZL) || 0
      }));
    }
    return [];
  } catch (e) {
    console.error(`获取基金 ${fundCode} 历史净值失败:`, e.message);
    return [];
  }
}

// 获取基金基本信息
async function getFundInfo(fundCode) {
  try {
    const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=1&plat=Android&appType=ttjj&product=EFund&Version=1&deviceid=1&Ession=null&Fcode=${fundCode}`;
    const raw = await fetch(url);
    const data = JSON.parse(raw);
    if (data.Datas) {
      return {
        code: fundCode,
        name: data.Datas.SHORTNAME,
        type: data.Datas.FTYPE,
        nav: parseFloat(data.Datas.DWJZ),
        navDate: data.Datas.PDATE,
        dayChange: parseFloat(data.Datas.RZDF) || 0,
        weekChange: parseFloat(data.Datas.SYL_Z) || 0,
        monthChange: parseFloat(data.Datas.SYL_Y) || 0,
        threeMonthChange: parseFloat(data.Datas.SYL_3Y) || 0,
        sixMonthChange: parseFloat(data.Datas.SYL_6Y) || 0,
        yearChange: parseFloat(data.Datas.SYL_1N) || 0,
        manager: data.Datas.JJJL
      };
    }
    return null;
  } catch (e) {
    console.error(`获取基金 ${fundCode} 信息失败:`, e.message);
    return null;
  }
}

// 获取热门基金排行
async function getTopFunds(type = 'all', sort = 'rzdf', count = 20) {
  // type: gp(股票型) hh(混合型) zq(债券型) zs(指数型) qdii(QDII) lof(LOF) fof(FOF)
  // sort: rzdf(日涨幅) zzdf(周涨幅) 1yzdf(月涨幅) 3yzdf(3月涨幅) 6yzdf(6月涨幅) 1nzdf(年涨幅)
  try {
    const ftMap = { all: '', gp: '25', hh: '27', zq: '31', zs: '11', qdii: '6', lof: '4', fof: '15' };
    const ft = ftMap[type] || '';
    const url = `https://fund.eastmoney.com/data/rankhandler.aspx?op=ph&dt=kf&ft=${ft}&rs=&gs=0&sc=${sort}&st=desc&sd=&ed=&qdii=&tabSubtype=,,,,,&pi=1&pn=${count}&dx=1`;
    const raw = await fetch(url);
    const match = raw.match(/rankData\s*=\s*\{.*?datas:\s*\[(.*?)\]/s);
    if (match) {
      const items = match[1].split('","').map(s => s.replace(/"/g, ''));
      return items.map(item => {
        const parts = item.split(',');
        return {
          code: parts[0],
          name: parts[1],
          navDate: parts[3],
          nav: parseFloat(parts[4]),
          accNav: parseFloat(parts[5]),
          dayChange: parseFloat(parts[6]) || 0,
          weekChange: parseFloat(parts[7]) || 0,
          monthChange: parseFloat(parts[8]) || 0,
          threeMonthChange: parseFloat(parts[9]) || 0,
          sixMonthChange: parseFloat(parts[10]) || 0,
          yearChange: parseFloat(parts[11]) || 0
        };
      }).filter(f => f.code);
    }
    return [];
  } catch (e) {
    console.error('获取热门基金失败:', e.message);
    return [];
  }
}

module.exports = { getFundNav, getFundHistory, getFundInfo, getTopFunds };

// CLI mode
if (require.main === module) {
  const cmd = process.argv[2];
  const arg = process.argv[3];
  
  (async () => {
    if (cmd === 'nav' && arg) {
      console.log(JSON.stringify(await getFundNav(arg), null, 2));
    } else if (cmd === 'info' && arg) {
      console.log(JSON.stringify(await getFundInfo(arg), null, 2));
    } else if (cmd === 'history' && arg) {
      console.log(JSON.stringify(await getFundHistory(arg, parseInt(process.argv[4]) || 30), null, 2));
    } else if (cmd === 'top') {
      console.log(JSON.stringify(await getTopFunds(arg || 'all', process.argv[4] || 'rzdf', parseInt(process.argv[5]) || 20), null, 2));
    } else {
      console.log('Usage: node fund-api.js <nav|info|history|top> <fundCode|type> [days|sort] [count]');
    }
  })();
}
