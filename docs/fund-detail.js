var fundDetailModal = null;
var fundNavData = {};

async function showFundDetail(idx) {
  var pos = DATA.positions[idx];
  if (!pos || !pos.code) return;
  
  var code = pos.code;
  var name = pos.name;
  
  // 显示加载状态
  var modal = document.createElement('div');
  modal.id = 'fundDetailModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = '<div style="background:#1a1a2e;width:90%;max-width:380px;border-radius:16px;padding:20px;text-align:center"><p>加载中...</p></div>';
  document.body.appendChild(modal);
  fundDetailModal = modal;
  
  // 获取净值历史 - 用天天基金的API
  var navHistory = fundNavData[code];
  if (!navHistory) {
    try {
      // 尝试用不同的API
      var res = await fetch('https://fund.eastmoney.com/pingzhongdata/' + code + '.js?v=' + Date.now(), {
        headers: {'User-Agent': 'Mozilla/5.0'}
      });
      var text = await res.text();
      
      // 解析JS中的净值数据
      var navMatch = text.match(/"jz_list":\[(.*?)\]/);
      if (navMatch) {
        var navStr = '[' + navMatch[1] + ']';
        var navArr = JSON.parse(navStr.replace(/"/g, ''));
        navHistory = navArr.slice(-30).map(function(item) {
          var parts = item.split(',');
          return {date: parts[0], nav: parseFloat(parts[1])};
        }).reverse();
        fundNavData[code] = navHistory;
      }
    } catch(e) { 
      console.error(e); 
    }
  }
  
  // 获取操作记录
  var ops = (DATA.operations || []).filter(function(o) { 
    return o.fundCode === code || (o.name && o.name.includes(name.split('(')[0])); 
  });
  
  // 生成趋势图
  var chartSvg = '';
  if (navHistory && navHistory.length > 1) {
    var w = 300, h = 100, pad = 20;
    var navs = navHistory.map(function(n) { return n.nav; });
    var minNav = Math.min.apply(null, navs), maxNav = Math.max.apply(null, navs);
    var range = maxNav - minNav || 1;
    
    var points = navHistory.map(function(n, i) {
      var x = pad + (i / (navHistory.length - 1)) * (w - pad * 2);
      var y = h - pad - ((n.nav - minNav) / range) * (h - pad * 2);
      return x + ',' + y;
    }).join(' ');
    
    chartSvg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:100px;background:#252540;border-radius:8px">' +
      '<polyline fill="none" stroke="#7c5cfc" stroke-width="2" points="' + points + '"/></svg>' +
      '<div style="display:flex;justify-content:space-between;font-size:10px;color:#888;margin-top:4px">' +
      '<span>' + navHistory[0].date + '</span><span>' + navHistory[navHistory.length-1].date + '</span></div>';
  }
  
  // 操作记录
  var opsHtml = ops.length ? ops.map(function(o) {
    var typeColor = (o.type === '买入') ? '#4caf50' : '#f44336';
    return '<div style="padding:6px 0;border-bottom:1px solid #333;font-size:12px"><span style="color:' + typeColor + '">' + (o.type || '操作') + '</span> ' + (o.amount || '') + '元 <span style="color:#888">' + (o.date || '') + '</span></div>';
  }).join('') : '<div style="color:#888;font-size:12px;padding:8px 0">暂无操作记录</div>';
  
  // 更新弹窗内容 - 简化版，只显示趋势图和操作记录
  modal.innerHTML = '<div style="background:#1a1a2e;width:90%;max-width:380px;border-radius:16px;padding:20px;max-height:80vh;overflow-y:auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<h3 style="margin:0;font-size:15px">' + name + '</h3>' +
      '<button onclick="closeFundDetail()" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer">✕</button></div>' +
    '<div style="margin-bottom:16px">' + (chartSvg || '<div style="color:#888;text-align:center;padding:20px;background:#252540;border-radius:8px">暂无趋势数据</div>') + '</div>' +
    '<div><div style="font-size:13px;font-weight:600;margin-bottom:8px">📝 操作记录</div><div style="background:#252540;border-radius:8px;padding:8px 12px">' + opsHtml + '</div></div></div>';
  
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
