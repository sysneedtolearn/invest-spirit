var fundDetailModal = null;

// 简单的趋势图渲染
function renderTrendChart(container, data, color) {
  if (!data || data.length < 2) {
    container.innerHTML = '<div style="color:#888;font-size:12px;padding:20px;text-align:center">暂无趋势数据</div>';
    return;
  }
  
  var width = container.clientWidth || 280;
  var height = 120;
  var padding = 25;
  
  var minY = Math.min(...data.map(d => d.y));
  var maxY = Math.max(...data.map(d => d.y));
  var range = maxY - minY || 1;
  
  var points = data.map((d, i) => {
    var x = padding + (i / (data.length - 1)) * (width - padding * 2);
    var y = height - padding - ((d.y - minY) / range) * (height - padding * 2);
    return x + ',' + y;
  }).join(' ');
  
  var areaPoints = points + ' ' + (width - padding) + ',' + (height - padding) + ' ' + padding + ',' + (height - padding);
  
  container.innerHTML = '<svg width="' + width + '" height="' + height + '" style="background:#1a1a2e">' +
    '<polygon points="' + areaPoints + '" fill="' + color + '15" />' +
    '<polyline points="' + points + '" fill="none" stroke="' + color + '" stroke-width="2" />' +
    '<text x="' + padding + '" y="12" fill="#888" font-size="10">最新: ' + data[data.length-1].y.toFixed(4) + '</text>' +
  '</svg>';
}

function showFundDetail(idx) {
  var pos = DATA.positions[idx];
  if (!pos || !pos.code) return;
  
  var code = pos.code;
  var name = pos.name;
  var trendColor = (pos.currentValue >= pos.totalCost) ? '#4caf50' : '#f44336';
  
  // 获取趋势数据
  var trendData = null;
  if (typeof FUND_TRENDS !== 'undefined' && FUND_TRENDS[code]) {
    trendData = FUND_TRENDS[code];
  }
  
  // 获取操作记录
  var ops = (DATA.operations || []).filter(function(o) { 
    return o.fundCode === code || (o.name && o.name.includes(name.split('(')[0])); 
  });
  
  var opsHtml = ops.length ? ops.map(function(o) {
    var typeColor = (o.type === '买入') ? '#4caf50' : '#f44336';
    return '<div style="padding:8px 0;border-bottom:1px solid #333;font-size:12px">' +
      '<span style="color:' + typeColor + '">' + (o.type || '操作') + '</span> ' + 
      (o.amount || '') + '元 <span style="color:#888">' + (o.date || '') + '</span></div>';
  }).join('') : '<div style="color:#888;font-size:12px;padding:8px 0">暂无操作记录</div>';
  
  var modal = document.createElement('div');
  modal.id = 'fundDetailModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = '<div style="background:#1a1a2e;width:90%;max-width:360px;border-radius:16px;padding:20px;max-height:80vh;overflow-y:auto">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<h3 style="margin:0;font-size:15px">' + name + '</h3>' +
      '<button onclick="closeFundDetail()" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer">✕</button></div>' +
    
    // 趋势图
    '<div style="margin-bottom:16px"><div style="font-size:13px;font-weight:600;margin-bottom:8px">📈 净值走势</div>' +
    '<div id="trendChart" style="background:#252540;border-radius:8px;overflow:hidden"></div></div>' +
    
    // 操作记录
    '<div><div style="font-size:13px;font-weight:600;margin-bottom:8px">📝 操作记录</div>' +
    '<div style="background:#252540;border-radius:8px;padding:8px 12px">' + opsHtml + '</div></div></div>';
  
  document.body.appendChild(modal);
  fundDetailModal = modal;
  
  // 渲染趋势图
  setTimeout(function() {
    var chartContainer = document.getElementById('trendChart');
    if (chartContainer) {
      renderTrendChart(chartContainer, trendData, trendColor);
    }
  }, 100);
  
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
