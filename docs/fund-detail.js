// 基金详情弹窗
var fundDetailModal = null;
var fundNavData = {};

async function showFundDetail(idx) {
  var pos = DATA.positions[idx];
  if (!pos || !pos.code) return;
  
  var code = pos.code;
  var name = pos.name;
  
  // 获取净值历史
  var navHistory = fundNavData[code];
  if (!navHistory) {
    try {
      var res = await fetch('https://api.fund.eastmoney.com/f10/lsjz?fundCode=' + code + '&pageIndex=1&pageSize=60&startDate=2025-12-01&endDate=2026-03-10', {
        headers: {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://fund.eastmoney.com/'}
      });
      var d = await res.json();
      if (d.Data && d.Data.LSJZList) {
        navHistory = d.Data.LSJZList.map(function(item) {
          return {date: item.FSRQ, nav: parseFloat(item.DWJZ), change: parseFloat(item.JZZZL) || 0};
        }).reverse();
        fundNavData[code] = navHistory;
      }
    } catch(e) { console.error(e); }
  }
  
  // 获取该基金的操作记录
  var ops = (DATA.operations || []).filter(function(o) { 
    return o.fundCode === code || (o.name && o.name.includes(name.split('(')[0])); 
  });
  
  // 生成趋势图 SVG
  var chartSvg = '';
  if (navHistory && navHistory.length > 1) {
    var w = 320, h = 120, pad = 30;
    var navs = navHistory.map(function(n) { return n.nav; });
    var minNav = Math.min.apply(null, navs), maxNav = Math.max.apply(null, navs);
    var range = maxNav - minNav || 1;
    
    var points = navHistory.map(function(n, i) {
      var x = pad + (i / (navHistory.length - 1)) * (w - pad * 2);
      var y = h - pad - ((n.nav - minNav) / range) * (h - pad * 2);
      return x + ',' + y;
    }).join(' ');
    
    chartSvg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:120px">' +
      '<polyline fill="none" stroke="#7c5cfc" stroke-width="2" points="' + points + '"/>';
    
    navHistory.forEach(function(n, i) {
      if (i === 0 || i === navHistory.length - 1) {
        var x = pad + (i / (navHistory.length - 1)) * (w - pad * 2);
        var y = h - pad - ((n.nav - minNav) / range) * (h - pad * 2);
        chartSvg += '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#7c5cfc"/>';
      }
    });
    
    chartSvg += '</svg><div style="display:flex;justify-content:space-between;font-size:11px;color:#888;margin-top:4px"><span>' + navHistory[0].date + '</span><span>' + navHistory[navHistory.length-1].date + '</span></div>';
  }
  
  var profit = pos.currentValue - pos.totalCost;
  var profitRate = pos.totalCost > 0 ? (profit / pos.totalCost * 100) : 0;
  
  var opsHtml = ops.length ? ops.map(function(o) {
    var typeColor = (o.type === '买入') ? '#4caf50' : '#f44336';
    return '<div style="padding:8px 0;border-bottom:1px solid #eee;font-size:12px"><span style="color:' + typeColor + '">' + (o.type || '操作') + '</span> <span>' + (o.amount || '') + '元</span> <span style="color:#888">' + (o.date || '') + '</span></div>';
  }).join('') : '<div style="color:#888;font-size:12px;padding:8px 0">暂无操作记录</div>';
  
  var modal = document.createElement('div');
  modal.id = 'fundDetailModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = '<div style="background:#1a1a2e;width:90%;max-width:380px;border-radius:16px;padding:20px;max-height:80vh;overflow-y:auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<h3 style="margin:0;font-size:16px">' + name + '</h3>' +
      '<button onclick="closeFundDetail()" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer">✕</button></div>' +
    '<div style="background:#252540;border-radius:12px;padding:12px;margin-bottom:16px">' +
      (chartSvg || '<div style="color:#888;text-align:center;padding:40px">加载中...</div>') + '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
      '<div style="background:#252540;border-radius:12px;padding:12px;text-align:center"><div style="color:#888;font-size:11px">持仓成本</div><div style="font-size:16px;font-weight:600">¥' + fmtCny(pos.totalCost) + '</div></div>' +
      '<div style="background:#252540;border-radius:12px;padding:12px;text-align:center"><div style="color:#888;font-size:11px">当前市值</div><div style="font-size:16px;font-weight:600">¥' + fmtCny(pos.currentValue) + '</div></div>' +
      '<div style="background:#252540;border-radius:12px;padding:12px;text-align:center"><div style="color:#888;font-size:11px">收益</div><div style="font-size:16px;font-weight:600;color:' + (profit >= 0 ? '#4caf50' : '#f44336') + '">¥' + fmtCny(profit) + '</div></div>' +
      '<div style="background:#252540;border-radius:12px;padding:12px;text-align:center"><div style="color:#888;font-size:11px">收益率</div><div style="font-size:16px;font-weight:600;color:' + (profit >= 0 ? '#4caf50' : '#f44336') + '">' + profitRate.toFixed(2) + '%</div></div></div>' +
    '<div style="margin-bottom:12px"><div style="font-size:13px;font-weight:600;margin-bottom:8px">📝 操作记录</div><div style="background:#252540;border-radius:12px;padding:8px 12px">' + opsHtml + '</div></div></div>';
  document.body.appendChild(modal);
  fundDetailModal = modal;
  
  // 点击背景关闭
  modal.onclick = function(e) {
    if (e.target === modal) closeFundDetail();
  };
}

function closeFundDetail() {
  if (fundDetailModal) {
    fundDetailModal.remove();
    fundDetailModal = null;
  }
}
