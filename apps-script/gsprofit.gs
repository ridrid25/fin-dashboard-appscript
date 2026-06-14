/**
 * gsprofit.gs — Module "Прибыль" (P&L / OPiU).
 * Prefix: profit
 * Public entry: profitApiProfit(params)
 * Sheet: CONFIG.SHEETS.PROFIT, named range: rangeprofit
 *
 * Columns expected in sheet "Прибыль":
 *   Дата, Наименование проекта, Направление, Статья ОПиУ, Раздел ОПиУ, Сумма
 *
 * KEY DECISION #2: Net profit = signed sum of sections 1–7.
 *   Expenses are already stored as negative values — do NOT double-negate.
 *   Section 8 (dividends etc.) is excluded from net profit.
 */

// ─────────────────────────────────────────────────────────────
// COLUMN NAME CONSTANTS
// ─────────────────────────────────────────────────────────────

var PROFIT_COL = {
  DATE:      'Дата',
  PROJECT:   'Наименование проекта',
  DIRECTION: 'Направление',
  ARTICLE:   'Статья ОПиУ',
  SECTION:   'Раздел ОПиУ',
  AMOUNT:    'Сумма'
};

// ─────────────────────────────────────────────────────────────
// PUBLIC ENDPOINT
// ─────────────────────────────────────────────────────────────

function profitApiProfit(params) {
  try {
    logInfo('profitApiProfit: params=' + JSON.stringify(params));

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

    var allRows = readSheetAsObjects(CONFIG.SHEETS.PROFIT, 'rangeprofit');
    if (!allRows || allRows.length === 0) {
      return createErrorResponse('Лист "' + CONFIG.SHEETS.PROFIT + '" пуст или недоступен.');
    }

    var requiredCols = [PROFIT_COL.DATE, PROFIT_COL.SECTION, PROFIT_COL.AMOUNT];
    var sampleRow = allRows[0];
    for (var ci = 0; ci < requiredCols.length; ci++) {
      if (!(requiredCols[ci] in sampleRow)) {
        return createErrorResponse(
          'В листе "' + CONFIG.SHEETS.PROFIT + '" не найдена колонка "' + requiredCols[ci] + '".'
        );
      }
    }

    var normRows = allRows.map(function(row) {
      var sectionRaw = String(row[PROFIT_COL.SECTION] || '');
      var sectionId  = profitParseSectionId(sectionRaw);
      return {
        _date:      parseDate(row[PROFIT_COL.DATE]),
        _project:   String(row[PROFIT_COL.PROJECT]   || '').trim(),
        _direction: String(row[PROFIT_COL.DIRECTION] || '').trim(),
        _article:   String(row[PROFIT_COL.ARTICLE]   || '').trim(),
        _sectionId: sectionId,
        _amount:    normalizeValue(row[PROFIT_COL.AMOUNT])
      };
    });

    var periodRows = normRows.filter(function(r) {
      if (!r._date) return false;
      var t = r._date.getTime();
      return t >= fromBound.getTime() && t <= toBound.getTime();
    });
    logDebug('profitApiProfit: rows after date filter=' + periodRows.length);

    if (params.project) {
      var projFilter = String(params.project).trim();
      periodRows = periodRows.filter(function(r) { return r._project === projFilter; });
    }
    if (params.direction) {
      var dirFilter = String(params.direction).trim();
      periodRows = periodRows.filter(function(r) { return r._direction === dirFilter; });
    }
    if (params.article) {
      var artFilter = String(params.article).trim();
      periodRows = periodRows.filter(function(r) { return r._article === artFilter; });
    }
    if (params.section !== undefined && params.section !== null && params.section !== '') {
      var secFilter = parseInt(String(params.section), 10);
      if (!isNaN(secFilter)) {
        periodRows = periodRows.filter(function(r) { return r._sectionId === secFilter; });
      }
    }

    var sectionSums = {};
    for (var si = 1; si <= 8; si++) { sectionSums[si] = 0; }
    periodRows.forEach(function(r) {
      if (r._sectionId !== null && r._sectionId >= 1 && r._sectionId <= 8) {
        sectionSums[r._sectionId] += r._amount;
      }
    });

    var revenue        = sectionSums[1];
    var costOfGoods    = sectionSums[2];
    var grossProfit    = revenue + costOfGoods;
    var marginPct      = revenue !== 0 ? (grossProfit / revenue) * 100 : 0;
    var fixedCostsPct  = revenue !== 0
      ? (Math.abs(sectionSums[4] + sectionSums[5]) / revenue) * 100
      : 0;

    var netProfit = CONFIG.PROFIT.netProfitSections.reduce(function(acc, id) {
      return acc + (sectionSums[id] || 0);
    }, 0);
    var netProfitMargin = revenue !== 0 ? (netProfit / revenue) * 100 : 0;

    var months = profitBuildMonthList(fromBound, toBound);

    var monthRevenue = {};
    var monthCost    = {};
    months.forEach(function(mk) { monthRevenue[mk] = 0; monthCost[mk] = 0; });

    periodRows.forEach(function(r) {
      if (!r._date) return;
      var mk = toMonthKey(r._date);
      if (months.indexOf(mk) === -1) return;
      if (r._sectionId === 1) monthRevenue[mk] += r._amount;
      if (r._sectionId === 2) monthCost[mk]    += r._amount;
    });

    var chartRevenueMargin = months.map(function(mk) {
      var rev = monthRevenue[mk];
      var cog = monthCost[mk];
      var gp  = rev + cog;
      var mp  = rev !== 0 ? (gp / rev) * 100 : 0;
      return { month: mk, revenue: rev, grossProfit: gp, marginPct: mp };
    });

    var directions = profitGetUniqueDirections(periodRows);
    var chartRevenueByDirection   = profitBuildDirectionMonthChart(periodRows, months, directions, 1);
    var chartGrossProfitByDirection = profitBuildGrossProfitByDirection(periodRows, months, directions);

    var netProfitSections = CONFIG.PROFIT.netProfitSections;
    var monthNetProfit = {};
    var monthGrossRevenue = {};
    months.forEach(function(mk) { monthNetProfit[mk] = 0; monthGrossRevenue[mk] = 0; });

    periodRows.forEach(function(r) {
      if (!r._date) return;
      var mk = toMonthKey(r._date);
      if (months.indexOf(mk) === -1) return;
      if (netProfitSections.indexOf(r._sectionId) !== -1) {
        monthNetProfit[mk] += r._amount;
      }
      if (r._sectionId === 1) {
        monthGrossRevenue[mk] += r._amount;
      }
    });

    var chartNetProfitMargin = months.map(function(mk) {
      var np  = monthNetProfit[mk];
      var rev = monthGrossRevenue[mk];
      var mp  = rev !== 0 ? (np / rev) * 100 : 0;
      return { month: mk, netProfit: np, marginPct: mp };
    });

    var tableByProject = profitBuildProjectTable(periodRows, directions);

    var uniqueProjects = [];
    var seenProjects   = {};
    periodRows.forEach(function(r) {
      if (r._project && !seenProjects[r._project]) {
        seenProjects[r._project] = true;
        uniqueProjects.push(r._project);
      }
    });

    var meta = {
      dateFrom:   dateFrom.toISOString(),
      dateTo:     dateTo.toISOString(),
      directions: directions,
      projects:   uniqueProjects
    };

    return createSuccessResponse({
      kpis: {
        revenue:        revenue,
        costOfGoods:    costOfGoods,
        grossProfit:    grossProfit,
        marginPct:      marginPct,
        fixedCostsPct:  fixedCostsPct,
        netProfit:      netProfit,
        netProfitMargin: netProfitMargin,
        sectionSums:    sectionSums
      },
      charts: {
        revenueMargin:            chartRevenueMargin,
        revenueByDirection:       chartRevenueByDirection,
        grossProfitByDirection:   chartGrossProfitByDirection,
        netProfitMargin:          chartNetProfitMargin
      },
      tables: {
        byProject: tableByProject
      },
      meta: meta
    });

  } catch (err) {
    logError('profitApiProfit failed', err);
    return createErrorResponse('Ошибка модуля Прибыль: ' + (err.message || String(err)));
  }
}

// ─────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────

function profitParseSectionId(raw) {
  var m = String(raw).match(/^\s*([1-8])\b/);
  if (m) return parseInt(m[1], 10);
  return null;
}

function profitBuildMonthList(fromBound, toBound) {
  var months = [];
  var cur = new Date(fromBound.getFullYear(), fromBound.getMonth(), 1);
  var end = new Date(toBound.getFullYear(), toBound.getMonth(), 1);
  while (cur.getTime() <= end.getTime()) {
    months.push(toMonthKey(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return months;
}

function profitGetUniqueDirections(rows) {
  var seen = {};
  var dirs = [];
  rows.forEach(function(r) {
    var dir = r._direction || '';
    if (dir && !seen[dir]) {
      seen[dir] = true;
      dirs.push(dir);
    }
  });
  dirs.sort();
  return dirs;
}

function profitBuildDirectionMonthChart(rows, months, directions, sectionId) {
  var matrix = {};
  months.forEach(function(mk) {
    matrix[mk] = {};
    directions.forEach(function(d) { matrix[mk][d] = 0; });
  });

  rows.forEach(function(r) {
    if (r._sectionId !== sectionId) return;
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

function profitBuildGrossProfitByDirection(rows, months, directions) {
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

function profitBuildProjectTable(rows, directions) {
  var dirMap = {};

  rows.forEach(function(r) {
    if (!r._project) return;
    if (r._sectionId !== 1 && r._sectionId !== 2) return;

    var dir  = r._direction || '(без направления)';
    var proj = r._project;

    if (!dirMap[dir]) dirMap[dir] = {};
    if (!dirMap[dir][proj]) dirMap[dir][proj] = { revenue: 0, costOfGoods: 0 };

    if (r._sectionId === 1) dirMap[dir][proj].revenue     += r._amount;
    if (r._sectionId === 2) dirMap[dir][proj].costOfGoods += r._amount;
  });

  var result = [];

  var allDirs = Object.keys(dirMap).sort();
  allDirs.forEach(function(dir) {
    var projects = [];
    var projData = dirMap[dir];
    Object.keys(projData).forEach(function(projName) {
      var d = projData[projName];
      var gp  = d.revenue + d.costOfGoods;
      var mp  = d.revenue !== 0 ? (gp / d.revenue) * 100 : 0;
      projects.push({
        name:        projName,
        revenue:     d.revenue,
        grossProfit: gp,
        marginPct:   mp
      });
    });
    projects.sort(function(a, b) { return b.marginPct - a.marginPct; });
    result.push({ direction: dir, projects: projects });
  });

  return result;
}
