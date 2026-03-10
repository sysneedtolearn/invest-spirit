var fundDetailModal = null;

function showFundDetail(idx) {
  var pos = DATA.positions[idx];
  if (!pos || !pos.code) return;
  
  var name = pos.name;
  var code = pos.code;
  
  // 获取该基金的操作记录
  var ops = (DATA.operations || []).filter(function(o) { 
    return o.fundCode === code || (o.name && o.name.includes(name.split('(')[0])); 
  });
  
  // 操作记录
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
    '<div><div style="font-size:13px;font-weight:600;margin-bottom:8px">📝 操作记录</div>' +
    '<div style="background:#252540;border-radius:8px;padding:8px 12px">' + opsHtml + '</div></div></div>';
  
  document.body.appendChild(modal);
  fundDetailModal = modal;
  
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
