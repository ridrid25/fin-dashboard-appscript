/**
 * gsdashboard.gs — Module "Дэшборд" (Summary / Cross-module KPIs).
 * Prefix: dashboard
 * Public entry: dashboardApiDashboard(params)
 *
 * Logic summary:
 *  1. snapshotDate = max Capital date ≤ dateTo
 *  2. periodStart  = 1 January of snapshotDate's year
 *  3. Money and Profit data: periodStart → snapshotDate
 *  4. Warning badge if dateTo > snapshotDate (by design, not a bug)
 *
 * KPIs:
 *  - ЧДП, Cash Buffer (from Money, excl. 5.Перемещение)
 *  - Ликвидность, Собственный капитал, Фин.независимость (from Capital)
 *  - ЧП, Рентабельность, MR% (from Profit)
 *  - ROE = ЧП / ((equityStart + equityEnd) / 2)
 *  - Оборачиваемость ДЗ/КЗ (turns and days)
 */

// ─────────────────────────────────────────────────────────────
// PUBLIC ENDPOINT
// ─────────────────────────────────────────────────────────────

/**
 * Main public endpoint for the "Дэшборд" page.
 *
 * @param {Object} params
 *   params.dateTo  {string} — upper bound date (YYYY-MM-DD or DD.MM.YYYY)
 *   params.dateFrom {string} — lower bound date (optional)
 *
 * @returns {Object} prepareResponse({status, data:{kpis, charts, tables, meta}, error})
 */
function dashboardApiDashboard(params) {
  try {
    logInfo('dashboardApiDashboard: params=' + JSON.stringify(params));

    params = params || {};

    // ── 1. Parse dateTo ──────────────────────────────────────
    var dateTo = parseDate(params.dateTo);
    if (!dateTo) {
      return createErrorResponse('Параметр dateTo обязателен и должен быть корректной датой.');
    }

    // ── 2. Find snapshotDate in Capital ──────────────────────
    var snapshotDate = capitalGetSnapshotDate(dateTo);
    if (!snapshotDate) {
      return createErrorResponse(
        'В листе "' + CONFIG.SHEETS.CAPITAL + '" нет срезов на дату ' +
        dashboardFormatDate(dateTo) + ' или ранее.'
      );
    }
    logInfo('dashboardApiDashboard: snapshotDate=' + snapshotDate.toISOString());

    // ── 3. Period: dateFrom (if valid) or 1 Jan of snapshot year → snapshotDate ─
    var dateFrom    = parseDate(params.dateFrom);
    var periodStart;
    if (dateFrom && dateFrom.getTime() <= endOfDay(snapshotDate).getTime()) {
      periodStart = startOfDay(dateFrom);
    } else {
      periodStart = new Date(snapshotDate.getFullYear(), 0, 1);
      periodStart.setHours(0, 0, 0, 0);
    }
    var periodEnd   = endOfDay(snapshotDate);

    logInfo('dashboardApiDashboard: periodStart=' + periodStart + ' periodEnd=' + periodEnd);

    // ── 4. Warning if dateTo > snapshotDate ──────────────────
    var warning = null;
    if (endOfDay(dateTo).getTime() > endOfDay(snapshotDate).getTime()) {
      warning = 'Капитал на дату среза: ' + dashboardFormatDate(snapshotDate) +
                '. Данные за период после этой даты в сводные KPI не входят — это ожидаемое поведение.';
    }

    // ── 5. Load all raw data ─────────────────────────────────
    var moneyRows  = readSheetAsObjects(CONFIG.SHEETS.MONEY,  'rangecash');
    var profitRows = readSheetAsObjects(CONFIG.SHEETS.PROFIT, 'rangeprofit');
    var capitalAllRows = readSheetAsObjects(CONFIG.SHEETS.CAPITAL, 'rangeequity');

    if (!moneyRows || moneyRows.length === 0) {
      return createErrorResponse('Лист "' + CONFIG.SHEETS.MONEY + '" пуст или недоступен.');
    }
    if (!profitRows || profitRows.length === 0) {
      return createErrorResponse('Лист "' + CONFIG.SHEETS.PROFIT + '" пуст или недоступен.');
    }
    if (!capitalAllRows || capitalAllRows.length === 0) {
      return createErrorResponse('Лист "' + CONFIG.SHEETS.CAPITAL + '" пуст или недоступен.');
    }

    // ── 6. Normalise Money rows ──────────────────────────────
    var normMoneyRows = dashboardNormaliseMoneyRows(moneyRows, periodStart, periodEnd);

    // ── 7. Normalise Profit rows ─────────────────────────────
    var normProfitRows = dashboardNormaliseProfitRows(profitRows, periodStart, periodEnd);

    // ── 8. Capital KPIs ──────────────────────────────────────
    var capitalKpiEnd   = capitalCalcKpisForDate(snapshotDate);

    // Start of year snapshot: find max Capital date ≤ Jan 1 of snapshotDate's year
    var yearStart = new Date(snapshotDate.getFullYear(), 0, 1);
    yearStart.setHours(0, 0, 0, 0);
    var snapshotStart = capitalGetSnapshotDate(yearStart);
    var capitalKpiStart = snapshotStart
      ? capitalCalcKpisForDate(snapshotStart)
      : { equity: 0, currentAssets: 0, currentLiabilities: 0, totalAssets: 0,
          liquidity: 0, finIndependence: 0, arValue: 0, apValue: 0 };

    logInfo('dashboardApiDashboard: capitalKpiStart equity=' + capitalKpiStart.equity +
            ' capitalKpiEnd equity=' + capitalKpiEnd.equity);

    // ── 9. Money KPIs ────────────────────────────────────────
    var excludeSection = CONFIG.CASH.excludeOddsSection;
    var moneyKpiRows   = normMoneyRows.filter(function(r) {
      return r._sectionOdds !== excludeSection;
    });

    var totalIncome  = moneyKpiRows.reduce(function(s, r) { return s + r._income;  }, 0);
    var totalExpense = moneyKpiRows.reduce(function(s, r) { return s + r._expense; }, 0);
    var netCashFlow  = totalIncome + totalExpense;

    var periodDays = Math.max(1,
      Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1
    );
    var avgDailyExpense = Math.abs(totalExpense) / periodDays;
    var cashBuffer = avgDailyExpense > 0 ? netCashFlow / avgDailyExpense : 0;

    // ── 10. Profit KPIs ──────────────────────────────────────
    var sectionSums = {};
    for (var si = 1; si <= 8; si++) { sectionSums[si] = 0; }
    normProfitRows.forEach(function(r) {
      if (r._sectionId !== null && r._sectionId >= 1 && r._sectionId <= 8) {
        sectionSums[r._sectionId] += r._amount;
      }
    });

    var revenue     = sectionSums[1];
    var costOfGoods = sectionSums[2];
    var grossProfit = revenue + costOfGoods;
    var marginPct   = revenue !== 0 ? (grossProfit / revenue) * 100 : 0;
    var netProfit   = CONFIG.PROFIT.netProfitSections.reduce(function(acc, id) {
      return acc + (sectionSums[id] || 0);
    }, 0);
    var netProfitMargin = revenue !== 0 ? (netProfit / revenue) * 100 : 0;

    // ── 11. ROE ──────────────────────────────────────────────
    var avgEquity = (capitalKpiStart.equity + capitalKpiEnd.equity) / 2;
    var roe = avgEquity !== 0 ? (netProfit / avgEquity) * 100 : 0;

    // ── 12. Receivables (ДЗ) turnover ────────────────────────
    var arStart = capitalKpiStart.arValue;
    var arEnd   = capitalKpiEnd.arValue;
    var avgAR   = (arStart + arEnd) / 2;
    var arTurns = avgAR !== 0 ? revenue / avgAR : 0;
    var arDays  = arTurns !== 0 ? 365 / arTurns : 0;

    // ── 13. Payables (КЗ) turnover ───────────────────────────
    var apStart  = Math.abs(capitalKpiStart.apValue);
    var apEnd    = Math.abs(capitalKpiEnd.apValue);
    var avgAP    = (apStart + apEnd) / 2;
    var apTurns  = avgAP !== 0 ? Math.abs(costOfGoods) / avgAP : 0;
    var apDays   = apTurns !== 0 ? 365 / apTurns : 0;

    // ── 14. Month list ────────────────────────────────────────
    var months = dashboardBuildMonthList(periodStart, periodEnd);

    // ── 15. Chart: ЧДП по месяцам ─────────────────────────────
    var chartNetCashByMonth = dashboardBuildMoneyByMonth(moneyKpiRows, months);

    // ── 16. Chart: ЧДП по направлениям ───────────────────────
    var chartNetCashByDirection = dashboardBuildMoneyByDirection(moneyKpiRows);

    // ── 17. Chart: Выручка + MR% ─────────────────────────────
    var chartRevenueMR = dashboardBuildRevenueMR(normProfitRows, months);

    // ── 18. Chart: Валовая прибыль по направлениям ───────────
    var profitDirections = dashboardGetUniqueDirections(normProfitRows);
    var chartGrossProfitByDir = dashboardBuildGrossProfitByDir(normProfitRows, months, profitDirections);

    // ── 19. Chart: ЧП + рентабельность по месяцам ────────────
    var chartNetProfitMargin = dashboardBuildNetProfitMargin(normProfitRows, months);

    // ── 20. Chart: Динамика ДЗ/КЗ ────────────────────────────
    var allSnapshotDates = capitalGetAllSnapshotDates();
    var chartARDynamics  = [];
    var chartAPDynamics  = [];
    var chartCapStructure = [];
    var chartFinIndep    = [];
    allSnapshotDates.forEach(function(sd) {
      var sdKpi = capitalCalcKpisForDate(sd);
      var sdIso = sd.toISOString();
      chartARDynamics.push({ date: sdIso, value: sdKpi.arValue });
      chartAPDynamics.push({ date: sdIso, value: Math.abs(sdKpi.apValue) });
      chartCapStructure.push({
        date: sdIso,
        equity: sdKpi.equity,
        liabilities: sdKpi.currentLiabilities
      });
      chartFinIndep.push({ date: sdIso, ratio: sdKpi.finIndependence });
    });

    // ── 21. Meta ─────────────────────────────────────────────
    var meta = {
      dateFrom:      periodStart.toISOString(),
      dateTo:        dateTo.toISOString(),
      snapshotDate:  snapshotDate.toISOString(),
      periodStart:   periodStart.toISOString(),
      periodEnd:     snapshotDate.toISOString(),
      warning:       warning
    };

    return createSuccessResponse({
      kpis: {
        // Money
        netCashFlow:         netCashFlow,
        cashBuffer:          cashBuffer,
        totalIncome:         totalIncome,
        totalExpense:        totalExpense,
        // Capital
        liquidity:           capitalKpiEnd.liquidity,
        equity:              capitalKpiEnd.equity,
        totalAssets:         capitalKpiEnd.totalAssets,
        finIndependence:     capitalKpiEnd.finIndependence,
        currentAssets:       capitalKpiEnd.currentAssets,
        currentLiabilities:  capitalKpiEnd.currentLiabilities,
        // Profit
        revenue:             revenue,
        costOfGoods:         costOfGoods,
        grossProfit:         grossProfit,
        marginPct:           marginPct,
        netProfit:           netProfit,
        netProfitMargin:     netProfitMargin,
        // Cross-module
        roe:                 roe,
        arTurns:             arTurns,
        arDays:              arDays,
        apTurns:             apTurns,
        apDays:              apDays,
        avgAR:               avgAR,
        avgAP:               avgAP
      },
      charts: {
        netCashByMonth:        chartNetCashByMonth,
        netCashByDirection:    chartNetCashByDirection,
        revenueMR:             chartRevenueMR,
        grossProfitByDir:      chartGrossProfitByDir,
        netProfitMargin:       chartNetProfitMargin,
        arDynamics:            chartARDynamics,
        apDynamics:            chartAPDynamics,
        capitalStructure:      chartCapStructure,
        finIndependence:       chartFinIndep
      },
      tables: {},
      meta:   meta
    });

  } catch (err) {
    logError('dashboardApiDashboard failed', err);
    return createErrorResponse('Ошибка модуля Дэшборд: ' + (err.message || String(err)));
  }
}

// ─────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Builds sorted 'YYYY-MM' month list between two dates.
 */
function dashboardBuildMonthList(from, to) {
  var months = [];
  var cur = new Date(from.getFullYear(), from.getMonth(), 1);
  var end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur.getTime() <= end.getTime()) {
    months.push(toMonthKey(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return months;
}

/**
 * Formats a Date as DD.MM.YYYY string.
 */
function dashboardFormatDate(d) {
  if (!d) return '(нет даты)';
  var dd   = d.getDate();
  var mm   = d.getMonth() + 1;
  var yyyy = d.getFullYear();
  return (dd < 10 ? '0' + dd : dd) + '.' +
         (mm < 10 ? '0' + mm : mm) + '.' + yyyy;
}

/**
 * Normalises and filters Money rows for the dashboard period.
 * Reads 'Сумма' + 'Вид операции' — no separate Приход/Расход columns.
 * Expense stored as negative number.
 */
function dashboardNormaliseMoneyRows(rawRows, fromBound, toBound) {
  var result = [];
  rawRows.forEach(function(row) {
    var d = parseDate(row['Дата']);
    if (!d) return;
    var t = d.getTime();
    if (t < fromBound.getTime() || t > toBound.getTime()) return;

    var amountRaw = normalizeValue(row['Сумма']);
    var operation = String(row['Вид операции'] || '').trim();
    var income, expenseSigned;
    if (operation === 'Приход') {
      income        = Math.abs(amountRaw);
      expenseSigned = 0;
    } else if (operation === 'Расход') {
      income        = 0;
      expenseSigned = -Math.abs(amountRaw);
    } else {
      income        = 0;
      expenseSigned = 0;
    }

    result.push({
      _date:        d,
      _income:      income,
      _expense:     expenseSigned,
      _amount:      income + expenseSigned,
      _sectionOdds: String(row['Раздел ОДДС'] || '').trim(),
      _operation:   operation,
      _article:     String(row['Статья']       || '').trim(),
      _account:     String(row['Счет']         || '').trim(),
      _counterparty:String(row['Контрагент']   || '').trim(),
      _direction:   String(row['Направление']  || '').trim()
    });
  });
  return result;
}

/**
 * Normalises and filters Profit rows for the dashboard period.
 */
function dashboardNormaliseProfitRows(rawRows, fromBound, toBound) {
  var result = [];
  rawRows.forEach(function(row) {
    var d = parseDate(row['Дата']);
    if (!d) return;
    var t = d.getTime();
    if (t < fromBound.getTime() || t > toBound.getTime()) return;

    var sectionRaw = String(row['Раздел ОПиУ'] || '');
    var m = sectionRaw.match(/^\s*([1-8])\b/);
    var sectionId = m ? parseInt(m[1], 10) : null;

    result.push({
      _date:      d,
      _project:   String(row['Наименование проекта'] || '').trim(),
      _direction: String(row['Направление']          || '').trim(),
      _article:   String(row['Статья ОПиУ']          || '').trim(),
      _sectionId: sectionId,
      _amount:    normalizeValue(row['Сумма'])
    });
  });
  return result;
}

/**
 * Builds {month, income, expense, net}[] chart data.
 */
function dashboardBuildMoneyByMonth(rows, months) {
  var incMap = {};
  var expMap = {};
  months.forEach(function(mk) { incMap[mk] = 0; expMap[mk] = 0; });

  rows.forEach(function(r) {
    if (!r._date) return;
    var mk = toMonthKey(r._date);
    if (incMap[mk] !== undefined) incMap[mk] += r._income;
    if (expMap[mk] !== undefined) expMap[mk] += r._expense;
  });

  return months.map(function(mk) {
    var inc = incMap[mk] || 0;
    var exp = expMap[mk] || 0;
    return { month: mk, income: inc, expense: exp, net: inc + exp };
  });
}

/**
 * Builds {direction, income, expense, net}[] chart data.
 */
function dashboardBuildMoneyByDirection(rows) {
  var map = new Map();
  rows.forEach(function(r) {
    var dir = r._direction || '(не указано)';
    if (!map.has(dir)) map.set(dir, { income: 0, expense: 0 });
    var entry = map.get(dir);
    entry.income  += r._income;
    entry.expense += r._expense;
  });
  var result = [];
  map.forEach(function(entry, direction) {
    result.push({
      direction: direction,
      income:    entry.income,
      expense:   entry.expense,
      net:       entry.income + entry.expense
    });
  });
  result.sort(function(a, b) { return Math.abs(b.net) - Math.abs(a.net); });
  return result;
}

/**
 * Builds {month, revenue, grossProfit, marginPct}[] chart data.
 */
function dashboardBuildRevenueMR(rows, months) {
  var revMap  = {};
  var costMap = {};
  months.forEach(function(mk) { revMap[mk] = 0; costMap[mk] = 0; });

  rows.forEach(function(r) {
    if (!r._date) return;
    var mk = toMonthKey(r._date);
    if (revMap[mk] === undefined) return;
    if (r._sectionId === 1) revMap[mk]  += r._amount;
    if (r._sectionId === 2) costMap[mk] += r._amount;
  });

  return months.map(function(mk) {
    var rev = revMap[mk];
    var cog = costMap[mk];
    var gp  = rev + cog;
    var mp  = rev !== 0 ? (gp / rev) * 100 : 0;
    return { month: mk, revenue: rev, grossProfit: gp, marginPct: mp };
  });
}

/**
 * Returns unique direction values from profit rows.
 */
function dashboardGetUniqueDirections(rows) {
  var seen = {};
  var dirs = [];
  rows.forEach(function(r) {
    if (r._direction && !seen[r._direction]) {
      seen[r._direction] = true;
      dirs.push(r._direction);
    }
  });
  dirs.sort();
  return dirs;
}

/**
 * Builds gross profit by direction by month chart data.
 */
function dashboardBuildGrossProfitByDir(rows, months, directions) {
  var matrix = {};
  months.forEach(function(mk) {
    matrix[mk] = {};
    directions.forEach(function(d) { matrix[mk][d] = 0; });
  });

  rows.forEach(function(r) {
    if (r._sectionId !== 1 && r._sectionId !== 2) return;
    if (!r._date) return;
    var mk = toMonthKey(r._date);
    if (!matrix[mk]) return;
    var dir = r._direction || '';
    if (dir && matrix[mk][dir] !== undefined) {
      matrix[mk][dir] += r._amount;
    }
  });

  return months.map(function(mk) {
    var entry = { month: mk };
    directions.forEach(function(d) { entry[d] = matrix[mk][d] || 0; });
    return entry;
  });
}

/**
 * Builds {month, netProfit, marginPct}[] chart data.
 */
function dashboardBuildNetProfitMargin(rows, months) {
  var npMap  = {};
  var revMap = {};
  months.forEach(function(mk) { npMap[mk] = 0; revMap[mk] = 0; });

  rows.forEach(function(r) {
    if (!r._date) return;
    var mk = toMonthKey(r._date);
    if (npMap[mk] === undefined) return;
    if (CONFIG.PROFIT.netProfitSections.indexOf(r._sectionId) !== -1) {
      npMap[mk] += r._amount;
    }
    if (r._sectionId === 1) {
      revMap[mk] += r._amount;
    }
  });

  return months.map(function(mk) {
    var np  = npMap[mk];
    var rev = revMap[mk];
    var mp  = rev !== 0 ? (np / rev) * 100 : 0;
    return { month: mk, netProfit: np, marginPct: mp };
  });
}