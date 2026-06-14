/**
 * gsmoney.gs — Module "Деньги" (Cash Flow / ODDS).
 * Prefix: cash
 * Public entry: cashApiMoney(params)
 * Sheet: CONFIG.SHEETS.MONEY, named range: rangecash
 *
 * Columns expected in sheet "Деньги":
 *   Дата, Счет, Контрагент, Статья, Раздел ОДДС, Вид операции, Направление, Приход, Расход
 */

// ─────────────────────────────────────────────────────────────
// COLUMN NAME CONSTANTS
// ─────────────────────────────────────────────────────────────

var CASH_COL = {
  DATE:          'Дата',
  ACCOUNT:       'Счет',
  COUNTERPARTY:  'Контрагент',
  ARTICLE:       'Статья',
  SECTION_ODDS:  'Раздел ОДДС',
  OPERATION:     'Вид операции',
  DIRECTION:     'Направление',
  INCOME:        'Приход',
  EXPENSE:       'Расход'
};

// ─────────────────────────────────────────────────────────────
// PUBLIC ENDPOINT
// ─────────────────────────────────────────────────────────────

function cashApiMoney(params) {
  try {
    logInfo('cashApiMoney: params=' + JSON.stringify(params));

    params = params || {};

    var dateFrom = parseDate(params.dateFrom);
    var dateTo   = parseDate(params.dateTo);

    if (!dateFrom) {
      return createErrorResponse('Параметр dateFrom обязателен и должен быть корректной датой.');
    }
    if (!dateTo) {
      return createErrorResponse('Параметр dateTo обязателен и должен быть корректной датой.');
    }

    var fromBound = startOfDay(dateFrom);
    var toBound   = endOfDay(dateTo);

    logDebug('cashApiMoney: fromBound=' + fromBound + ' toBound=' + toBound);

    var allRows = readSheetAsObjects(CONFIG.SHEETS.MONEY, 'rangecash');
    if (!allRows || allRows.length === 0) {
      return createErrorResponse('Лист "' + CONFIG.SHEETS.MONEY + '" пуст или недоступен.');
    }

    var requiredCols = [CASH_COL.DATE, CASH_COL.SECTION_ODDS, CASH_COL.INCOME, CASH_COL.EXPENSE];
    var sampleRow = allRows[0];
    for (var ci = 0; ci < requiredCols.length; ci++) {
      if (!(requiredCols[ci] in sampleRow)) {
        return createErrorResponse(
          'В листе "' + CONFIG.SHEETS.MONEY + '" не найдена колонка "' + requiredCols[ci] + '".'
        );
      }
    }

    var periodRows = filterByDateRange(allRows, CASH_COL.DATE, fromBound, toBound);
    logDebug('cashApiMoney: rows after date filter=' + periodRows.length);

    periodRows = periodRows.map(function(row) {
      var income  = normalizeValue(row[CASH_COL.INCOME]);
      var expense = normalizeValue(row[CASH_COL.EXPENSE]);
      var expenseSigned = expense > 0 ? -expense : expense;
      var amount = income + expenseSigned;
      return {
        _date:         parseDate(row[CASH_COL.DATE]),
        _income:       income,
        _expense:      expenseSigned,
        _amount:       amount,
        _sectionOdds:  String(row[CASH_COL.SECTION_ODDS] || '').trim(),
        _operation:    String(row[CASH_COL.OPERATION]    || '').trim(),
        _article:      String(row[CASH_COL.ARTICLE]      || '').trim(),
        _account:      String(row[CASH_COL.ACCOUNT]      || '').trim(),
        _counterparty: String(row[CASH_COL.COUNTERPARTY] || '').trim(),
        _direction:    String(row[CASH_COL.DIRECTION]    || '').trim()
      };
    });

    if (params.account) {
      var accFilter = String(params.account).trim();
      periodRows = periodRows.filter(function(r) { return r._account === accFilter; });
    }
    if (params.counterparty) {
      var cpFilter = String(params.counterparty).trim();
      periodRows = periodRows.filter(function(r) { return r._counterparty === cpFilter; });
    }
    if (params.article) {
      var artFilter = String(params.article).trim();
      periodRows = periodRows.filter(function(r) { return r._article === artFilter; });
    }
    if (params.direction) {
      var dirFilter = String(params.direction).trim();
      periodRows = periodRows.filter(function(r) { return r._direction === dirFilter; });
    }

    var excludeSection = CONFIG.CASH.excludeOddsSection;
    var kpiRows = periodRows.filter(function(r) {
      return r._sectionOdds !== excludeSection;
    });

    var totalIncome  = kpiRows.reduce(function(s, r) { return s + r._income;  }, 0);
    var totalExpense = kpiRows.reduce(function(s, r) { return s + r._expense; }, 0);
    var netCashFlow  = totalIncome + totalExpense;

    var periodDays = Math.max(1,
      Math.round((toBound.getTime() - fromBound.getTime()) / 86400000) + 1
    );

    var openingBalance = getOpeningBalance(dateFrom);

    var avgDailyExpense = totalExpense !== 0 ? Math.abs(totalExpense) / periodDays : 0;
    var cashBuffer = avgDailyExpense !== 0 ? netCashFlow / avgDailyExpense : 0;

    var sectionMap = new Map();
    kpiRows.forEach(function(r) {
      var sec = r._sectionOdds || '(без раздела)';
      if (!sectionMap.has(sec)) sectionMap.set(sec, 0);
      sectionMap.set(sec, sectionMap.get(sec) + r._amount);
    });
    var netBySection = [];
    sectionMap.forEach(function(amount, section) {
      netBySection.push({ section: section, amount: amount });
    });
    netBySection.sort(function(a, b) { return b.amount - a.amount; });

    var months = cashBuildMonthList(fromBound, toBound);
    var monthlyIncome  = {};
    var monthlyExpense = {};
    months.forEach(function(m) {
      monthlyIncome[m]  = 0;
      monthlyExpense[m] = 0;
    });

    kpiRows.forEach(function(r) {
      if (!r._date) return;
      var mk = toMonthKey(r._date);
      if (monthlyIncome[mk]  !== undefined) monthlyIncome[mk]  += r._income;
      if (monthlyExpense[mk] !== undefined) monthlyExpense[mk] += r._expense;
    });

    var runningBalance = openingBalance;
    var balanceByMonth = {};
    var chartByMonthRaw = months.map(function(mk) {
      var inc = monthlyIncome[mk]  || 0;
      var exp = monthlyExpense[mk] || 0;
      var net = inc + exp;
      runningBalance += net;
      balanceByMonth[mk] = runningBalance;
      return {
        month:   mk,
        income:  inc,
        expense: exp,
        net:     net,
        balance: runningBalance
      };
    });

    var avgMonthlyExpense = months.length > 0
      ? Math.abs(totalExpense) / months.length
      : 0;

    var chartByMonth = chartByMonthRaw.map(function(item) {
      return {
        month:      item.month,
        income:     item.income,
        expense:    item.expense,
        net:        item.net,
        balance:    item.balance,
        avgExpense: avgMonthlyExpense
      };
    });

    var chartByCounterparty = cashBuildCounterpartyChart(kpiRows);

    var directionMap = new Map();
    kpiRows.forEach(function(r) {
      var dir = r._direction || '(не указано)';
      if (!directionMap.has(dir)) directionMap.set(dir, 0);
      directionMap.set(dir, directionMap.get(dir) + r._amount);
    });
    var chartByDirection = [];
    directionMap.forEach(function(amount, direction) {
      chartByDirection.push({ direction: direction, amount: amount });
    });
    chartByDirection.sort(function(a, b) { return Math.abs(b.amount) - Math.abs(a.amount); });

    var expenseArticleMap = new Map();
    kpiRows.forEach(function(r) {
      if (r._expense >= 0) return;
      var art = r._article || '(без статьи)';
      if (!expenseArticleMap.has(art)) expenseArticleMap.set(art, 0);
      expenseArticleMap.set(art, expenseArticleMap.get(art) + Math.abs(r._expense));
    });
    var totalExpenseAbs = Math.abs(totalExpense);
    var expenseStructure = [];
    expenseArticleMap.forEach(function(amount, article) {
      expenseStructure.push({
        article: article,
        amount:  amount,
        share:   totalExpenseAbs > 0 ? amount / totalExpenseAbs : 0
      });
    });
    expenseStructure.sort(function(a, b) { return b.amount - a.amount; });

    var oddsTable = cashBuildOddsTable(periodRows, months, openingBalance, monthlyIncome, monthlyExpense);

    var kpis = {
      netCashFlow:       netCashFlow,
      cashBuffer:        cashBuffer,
      totalIncome:       totalIncome,
      totalExpense:      totalExpense,
      openingBalance:    openingBalance,
      closingBalance:    openingBalance + netCashFlow,
      avgMonthlyExpense: avgMonthlyExpense,
      netBySection:      netBySection
    };

    function unique(arr) {
      var seen = {};
      return arr.filter(function(v) { return v && !(seen[v] = v in seen); });
    }
    var meta = {
      dateFrom:       dateFrom.toISOString(),
      dateTo:         dateTo.toISOString(),
      totalIncome:    totalIncome,
      totalExpense:   totalExpense,
      periodDays:     periodDays,
      openingBalance: openingBalance,
      months:         months,
      accounts:       unique(periodRows.map(function(r) { return r._account;      })).sort(),
      counterparties: unique(periodRows.map(function(r) { return r._counterparty; })).sort(),
      articles:       unique(periodRows.map(function(r) { return r._article;      })).sort(),
      directions:     unique(periodRows.map(function(r) { return r._direction;    })).sort()
    };

    return createSuccessResponse({
      kpis:   kpis,
      charts: {
        byMonth:          chartByMonth,
        byCounterparty:   chartByCounterparty,
        byDirection:      chartByDirection,
        expenseStructure: expenseStructure
      },
      tables: {
        odds:   oddsTable,
        months: months
      },
      meta: meta
    });

  } catch (err) {
    logError('cashApiMoney failed', err);
    return createErrorResponse('Ошибка модуля Деньги: ' + (err.message || String(err)));
  }
}

// ─────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────

function cashBuildMonthList(fromBound, toBound) {
  var months = [];
  var cur = new Date(fromBound.getFullYear(), fromBound.getMonth(), 1);
  var end = new Date(toBound.getFullYear(), toBound.getMonth(), 1);
  while (cur.getTime() <= end.getTime()) {
    months.push(toMonthKey(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return months;
}

function cashBuildCounterpartyChart(rows) {
  var suppMap = new Map();
  var buyMap  = new Map();

  rows.forEach(function(r) {
    if (/депозит/i.test(r._account)) return;

    if (r._expense < 0) {
      var cp = r._counterparty || '(не указан)';
      if (!suppMap.has(cp)) suppMap.set(cp, 0);
      suppMap.set(cp, suppMap.get(cp) + Math.abs(r._expense));
    }
    if (r._income > 0) {
      var cp2 = r._counterparty || '(не указан)';
      if (!buyMap.has(cp2)) buyMap.set(cp2, 0);
      buyMap.set(cp2, buyMap.get(cp2) + r._income);
    }
  });

  function buildItems(map) {
    var total = 0;
    map.forEach(function(v) { total += v; });
    var items = [];
    map.forEach(function(amount, name) {
      var share = total > 0 ? amount / total : 0;
      items.push({ name: name, amount: amount, share: share, highlight: share > 0.3 });
    });
    items.sort(function(a, b) { return b.amount - a.amount; });
    return items;
  }

  return {
    suppliers: { type: 'suppliers', items: buildItems(suppMap) },
    buyers:    { type: 'buyers',    items: buildItems(buyMap)  }
  };
}

function cashBuildOddsTable(allPeriodRows, months, openingBalance, monthlyIncome, monthlyExpense) {
  try {
    var excludeSection = CONFIG.CASH.excludeOddsSection;

    var balanceRow = {
      sectionOdds:    '__BALANCE__',
      operationType:  '',
      article:        'Остаток денежных средств',
      monthlyAmounts: {},
      total:          openingBalance
    };

    var runBalance = openingBalance;
    months.forEach(function(mk) {
      balanceRow.monthlyAmounts[mk] = runBalance;
      var inc = monthlyIncome[mk]  || 0;
      var exp = monthlyExpense[mk] || 0;
      runBalance += inc + exp;
    });
    balanceRow.closingBalance = runBalance;

    var nodeMap = new Map();

    var kpiRows = allPeriodRows.filter(function(r) {
      return r._sectionOdds !== excludeSection;
    });

    kpiRows.forEach(function(r) {
      if (!r._date) return;
      var mk = toMonthKey(r._date);
      var nodeKey = r._sectionOdds + '|||' + r._operation + '|||' + r._article;

      if (!nodeMap.has(nodeKey)) {
        var monthAmounts = {};
        months.forEach(function(m) { monthAmounts[m] = 0; });
        nodeMap.set(nodeKey, {
          sectionOdds:    r._sectionOdds,
          operationType:  r._operation,
          article:        r._article,
          monthlyAmounts: monthAmounts,
          total:          0
        });
      }

      var node = nodeMap.get(nodeKey);
      if (months.indexOf(mk) !== -1) {
        node.monthlyAmounts[mk] += r._amount;
      }
      node.total += r._amount;
    });

    var rows = [balanceRow];
    var nodeArr = [];
    nodeMap.forEach(function(node) { nodeArr.push(node); });
    nodeArr.sort(function(a, b) {
      var sc = String(a.sectionOdds).localeCompare(String(b.sectionOdds));
      if (sc !== 0) return sc;
      var oc = String(a.operationType).localeCompare(String(b.operationType));
      if (oc !== 0) return oc;
      return String(a.article).localeCompare(String(b.article));
    });

    return rows.concat(nodeArr);

  } catch (err) {
    logError('cashBuildOddsTable failed', err);
    return [];
  }
}
