/**
 * 投资组合管理器
 * 负责读写 portfolio, operations, daily-reports 数据
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

function readJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
}

function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf-8');
}

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

function writeConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// --- Portfolio Operations ---

function getPortfolio() {
  return readJSON('portfolio.json');
}

function savePortfolio(p) {
  writeJSON('portfolio.json', p);
}

function getOperations() {
  return readJSON('operations.json');
}

function getDailyReports() {
  return readJSON('daily-reports.json');
}

/**
 * 建仓 / 加仓
 */
function buyFund({ code, name, amount, nav, reason, date, time }) {
  const portfolio = getPortfolio();
  const ops = getOperations();

  if (amount > portfolio.availableCash) {
    return { success: false, error: `可用资金不足，当前可用: ${portfolio.availableCash}` };
  }

  // Calculate shares
  const shares = amount / nav;

  // Find existing position
  let position = portfolio.positions.find(p => p.code === code);
  const isNew = !position;

  if (isNew) {
    position = {
      code,
      name,
      totalCost: 0,
      totalShares: 0,
      avgCostNav: 0,
      currentNav: nav,
      currentValue: 0,
      firstBuyDate: date,
      lastOpDate: date
    };
    portfolio.positions.push(position);
  }

  position.totalCost += amount;
  position.totalShares += shares;
  position.avgCostNav = position.totalCost / position.totalShares;
  position.currentNav = nav;
  position.currentValue = position.totalShares * nav;
  position.lastOpDate = date;

  portfolio.availableCash -= amount;
  portfolio.totalInvested = portfolio.positions.reduce((sum, p) => sum + p.totalCost, 0);

  // Recalc total profit
  const totalValue = portfolio.positions.reduce((sum, p) => sum + p.currentValue, 0);
  portfolio.totalProfit = totalValue - portfolio.totalInvested;
  portfolio.totalProfitRate = portfolio.totalInvested > 0 ? (portfolio.totalProfit / portfolio.totalInvested) * 100 : 0;
  portfolio.lastUpdated = `${date} ${time}`;

  savePortfolio(portfolio);

  // Record operation
  const op = {
    id: `op_${Date.now()}`,
    type: isNew ? '建仓' : '加仓',
    fundCode: code,
    fundName: name,
    amount,
    shares,
    nav,
    reason,
    date,
    time
  };
  ops.operations.push(op);
  writeJSON('operations.json', ops);

  return { success: true, operation: op, position };
}

/**
 * 减仓
 */
function sellFund({ code, amount, nav, reason, date, time }) {
  const portfolio = getPortfolio();
  const ops = getOperations();

  const position = portfolio.positions.find(p => p.code === code);
  if (!position) {
    return { success: false, error: `未找到持仓: ${code}` };
  }

  // Calculate shares to sell
  const sharesToSell = amount / nav;
  if (sharesToSell > position.totalShares) {
    return { success: false, error: `持仓份额不足，当前: ${position.totalShares.toFixed(4)}` };
  }

  const costBasis = sharesToSell * position.avgCostNav;
  const realizedProfit = amount - costBasis;

  position.totalShares -= sharesToSell;
  position.totalCost -= costBasis;
  position.currentNav = nav;
  position.currentValue = position.totalShares * nav;
  position.lastOpDate = date;

  portfolio.availableCash += amount;

  const isClear = position.totalShares < 0.01;
  if (isClear) {
    portfolio.positions = portfolio.positions.filter(p => p.code !== code);
  }

  portfolio.totalInvested = portfolio.positions.reduce((sum, p) => sum + p.totalCost, 0);
  const totalValue = portfolio.positions.reduce((sum, p) => sum + p.currentValue, 0);
  portfolio.totalProfit = totalValue - portfolio.totalInvested;
  portfolio.totalProfitRate = portfolio.totalInvested > 0 ? (portfolio.totalProfit / portfolio.totalInvested) * 100 : 0;
  portfolio.lastUpdated = `${date} ${time}`;

  savePortfolio(portfolio);

  const op = {
    id: `op_${Date.now()}`,
    type: isClear ? '清仓' : '减仓',
    fundCode: code,
    fundName: position.name || code,
    amount,
    shares: sharesToSell,
    nav,
    reason,
    date,
    time,
    realizedProfit
  };
  ops.operations.push(op);
  writeJSON('operations.json', ops);

  return { success: true, operation: op, realizedProfit };
}

/**
 * 添加每日报告
 */
function addDailyReport({ date, summary, marketStatus, noOpReason }) {
  const reports = getDailyReports();
  
  // Check if report for this date already exists
  const existing = reports.reports.findIndex(r => r.date === date);
  const report = { date, summary, marketStatus, noOpReason, createdAt: new Date().toISOString() };
  
  if (existing >= 0) {
    reports.reports[existing] = report;
  } else {
    reports.reports.push(report);
  }
  
  writeJSON('daily-reports.json', reports);
  return report;
}

/**
 * 更新所有持仓的当前净值
 */
function updateNavs(navMap) {
  // navMap: { fundCode: currentNav }
  const portfolio = getPortfolio();
  
  portfolio.positions.forEach(p => {
    if (navMap[p.code] !== undefined) {
      p.currentNav = navMap[p.code];
      p.currentValue = p.totalShares * p.currentNav;
    }
  });

  const totalValue = portfolio.positions.reduce((sum, p) => sum + p.currentValue, 0);
  portfolio.totalInvested = portfolio.positions.reduce((sum, p) => sum + p.totalCost, 0);
  portfolio.totalProfit = totalValue - portfolio.totalInvested;
  portfolio.totalProfitRate = portfolio.totalInvested > 0 ? (portfolio.totalProfit / portfolio.totalInvested) * 100 : 0;
  portfolio.lastUpdated = new Date().toISOString();

  savePortfolio(portfolio);
  return portfolio;
}

/**
 * 修改总本金
 */
function updateCapital(newCapital) {
  const portfolio = getPortfolio();
  const config = readConfig();
  
  const diff = newCapital - portfolio.totalCapital;
  portfolio.totalCapital = newCapital;
  portfolio.availableCash += diff;
  config.totalCapital = newCapital;
  
  savePortfolio(portfolio);
  writeConfig(config);
  
  return { totalCapital: newCapital, availableCash: portfolio.availableCash };
}

// CLI interface
if (require.main === module) {
  const cmd = process.argv[2];
  
  switch (cmd) {
    case 'status':
      console.log(JSON.stringify(getPortfolio(), null, 2));
      break;
    case 'buy':
      // node portfolio-manager.js buy <code> <name> <amount> <nav> <reason>
      console.log(JSON.stringify(buyFund({
        code: process.argv[3],
        name: process.argv[4],
        amount: parseFloat(process.argv[5]),
        nav: parseFloat(process.argv[6]),
        reason: process.argv[7] || '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0]
      }), null, 2));
      break;
    case 'sell':
      console.log(JSON.stringify(sellFund({
        code: process.argv[3],
        amount: parseFloat(process.argv[4]),
        nav: parseFloat(process.argv[5]),
        reason: process.argv[6] || '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0]
      }), null, 2));
      break;
    case 'report':
      console.log(JSON.stringify(addDailyReport({
        date: process.argv[3],
        summary: process.argv[4],
        marketStatus: process.argv[5] || '',
        noOpReason: process.argv[6] || null
      }), null, 2));
      break;
    case 'capital':
      console.log(JSON.stringify(updateCapital(parseFloat(process.argv[3])), null, 2));
      break;
    default:
      console.log('Usage: node portfolio-manager.js <status|buy|sell|report|capital> [args...]');
  }
}

module.exports = { getPortfolio, buyFund, sellFund, addDailyReport, updateNavs, updateCapital, getOperations, getDailyReports };
