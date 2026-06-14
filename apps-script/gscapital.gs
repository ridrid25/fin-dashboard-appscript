/**
 * gscapital.gs — Module "Капитал" (Balance Sheet snapshots).
 * Prefix: capital
 * Public entry: capitalApiCapital(params)
 * Sheet: CONFIG.SHEETS.CAPITAL, named range: rangeequity
 *
 * Columns expected in sheet "Капитал":
 *   Дата, Раздел 1 (Активы/Пассивы), Раздел 2, Раздел 3, Раздел 4, Сумма
 *
 * KEY DECISIONS:
 *  #3: liquidity = Оборотные активы / (Краткосрочные обязательства + Кредиторская задолженность)
 *  #4: ДЗ = Раздел 4 in arItemsR4; КЗ = Раздел 4 in apItemsR4
 *  #6: Only 2 snapshots exist; snapshot logic is preserved, never hardcoded
 */

// ─────────────────────────────────────────────────────────────
// COLUMN NAME CONSTANTS
// ─────────────────────────────────────────────────────────────

var CAPITAL_COL = {
  DATE:     'Дата',
  SECTION1: 'Раздел 1',
  SECTION2: 'Раздел 2',
  SECTION3: 'Раздел 3',
  SECTION4: 'Раздел 4',
  AMOUNT:   'Сумма'
};

// ─────────────────────────────────────────────────────────────
// PUBLIC ENDPOINT
// ─────────────────────────────────────────────────────────────

function capitalApiCapital(params) {
  try {
    logInfo('capitalApiCapital: params=' + JSON.stringify(params));

    params = params || {};

    var dateTo = parseDate(params.dateTo);
    if (!dateTo) {
      return createErrorResponse('Параметр dateTo обязателен и должен быть корректной датой.');
    }

    var snapshotDate = capitalGetSnapshotDate(dateTo);
    if (!snapshotDate) {
      return createErrorResponse(
        'В листе "' + CONFIG.SHEETS.CAPITAL + '" нет срезов на дату ' +
        capitalFormatDate(dateTo) + ' или ранее.'
      );
    }
    logInfo('capitalApiCapital: snapshotDate=' + snapshotDate.toISOString());

    var allRows = readSheetAsObjects(CONFIG.SHEETS.CAPITAL, 'rangeequity');
    if (!allRows || allRows.length === 0) {
      return createErrorResponse('Лист "' + CONFIG.SHEETS.CAPITAL + '" пуст или недоступен.');
    }

    var requiredCols = [CAPITAL_COL.DATE, CAPITAL_COL.SECTION1, CAPITAL_COL.SECTION2, CAPITAL_COL.AMOUNT];
    var sampleRow = allRows[0];
    for (var ci = 0; ci < requiredCols.length; ci++) {
      if (!(requiredCols[ci] in sampleRow)) {
        return createErrorResponse(
          'В листе "' + CONFIG.SHEETS.CAPITAL + '" не найдена колонка "' + requiredCols[ci] + '".'
        );
      }
    }

    var normRows = allRows.map(function(row) {
      return {
        _date:     parseDate(row[CAPITAL_COL.DATE]),
        _sec1:     String(row[CAPITAL_COL.SECTION1] || '').trim(),
        _sec2:     String(row[CAPITAL_COL.SECTION2] || '').trim(),
        _sec3:     String(row[CAPITAL_COL.SECTION3] || '').trim(),
        _sec4:     String(row[CAPITAL_COL.SECTION4] || '').trim(),
        _amount:   normalizeValue(row[CAPITAL_COL.AMOUNT])
      };
    }).filter(function(r) { return r._date !== null; });

    var allSnapshotDates = capitalGetAllSnapshotDates();
    var allSnapshotIso   = allSnapshotDates.map(function(d) { return d.toISOString(); });

    var kpis = capitalCalcKpisForDate(snapshotDate);

    var snapRows = capitalGetNormRowsForDate(normRows, snapshotDate);

    var assetsStructure = capitalBuildSec3Structure(snapRows, CONFIG.EQUITY.section1.assets);
    var liabilitiesStructure = capitalBuildSec3Structure(snapRows, CONFIG.EQUITY.section1.liabilities);

    var arDynamics         = [];
    var apDynamics         = [];
    var capitalStructure   = [];
    var liquidityChart     = [];
    var independenceChart  = [];

    allSnapshotDates.forEach(function(sd) {
      var sdIso = sd.toISOString();
      var sdKpi = capitalCalcKpisForDate(sd);

      arDynamics.push({ date: sdIso, value: sdKpi.arValue });
      apDynamics.push({ date: sdIso, value: Math.abs(sdKpi.apValue) });
      capitalStructure.push({
        date:        sdIso,
        equity:      sdKpi.equity,
        liabilities: sdKpi.currentLiabilities
      });
      liquidityChart.push({ date: sdIso, ratio: sdKpi.liquidity });
      independenceChart.push({ date: sdIso, ratio: sdKpi.finIndependence });
    });

    var balanceTable = capitalBuildBalanceTable(snapRows);

    var meta = {
      snapshotDate:      snapshotDate.toISOString(),
      allSnapshotDates:  allSnapshotIso
    };

    return createSuccessResponse({
      kpis: {
        equity:             kpis.equity,
        currentAssets:      kpis.currentAssets,
        currentLiabilities: kpis.currentLiabilities,
        liquidity:          kpis.liquidity,
        totalAssets:        kpis.totalAssets,
        finIndependence:    kpis.finIndependence,
        arValue:            kpis.arValue,
        apValue:            kpis.apValue
      },
      charts: {
        assetsStructure:      assetsStructure,
        liabilitiesStructure: liabilitiesStructure,
        arDynamics:           arDynamics,
        apDynamics:           apDynamics,
        capitalStructure:     capitalStructure,
        liquidityChart:       liquidityChart,
        independenceChart:    independenceChart
      },
      tables: {
        balanceSheet: balanceTable
      },
      meta: meta
    });

  } catch (err) {
    logError('capitalApiCapital failed', err);
    return createErrorResponse('Ошибка модуля Капитал: ' + (err.message || String(err)));
  }
}

// ─────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────

function capitalGetNormRowsForDate(normRows, snapshotDate) {
  var dayStart = startOfDay(snapshotDate).getTime();
  var dayEnd   = endOfDay(snapshotDate).getTime();
  return normRows.filter(function(r) {
    if (!r._date) return false;
    var t = r._date.getTime();
    return t >= dayStart && t <= dayEnd;
  });
}

function capitalBuildSec3Structure(snapRows, sec1Value) {
  var map = new Map();
  snapRows.forEach(function(r) {
    if (r._sec1 !== sec1Value) return;
    var label = r._sec3 || '(не указано)';
    if (!map.has(label)) map.set(label, 0);
    map.set(label, map.get(label) + r._amount);
  });
  var result = [];
  map.forEach(function(value, name) {
    result.push({ name: name, value: value });
  });
  result.sort(function(a, b) { return Math.abs(b.value) - Math.abs(a.value); });
  return result;
}

function capitalBuildBalanceTable(snapRows) {
  var rows = [];
  snapRows.forEach(function(r) {
    rows.push({
      section1: r._sec1,
      section2: r._sec2,
      section3: r._sec3,
      section4: r._sec4,
      amount:   r._amount
    });
  });
  rows.sort(function(a, b) {
    var c1 = String(a.section1).localeCompare(String(b.section1));
    if (c1 !== 0) return c1;
    var c2 = String(a.section2).localeCompare(String(b.section2));
    if (c2 !== 0) return c2;
    var c3 = String(a.section3).localeCompare(String(b.section3));
    if (c3 !== 0) return c3;
    return String(a.section4).localeCompare(String(b.section4));
  });
  return rows;
}

function capitalFormatDate(d) {
  if (!d) return '(нет даты)';
  var dd = d.getDate();
  var mm = d.getMonth() + 1;
  var yyyy = d.getFullYear();
  return (dd < 10 ? '0' + dd : dd) + '.' +
         (mm < 10 ? '0' + mm : mm) + '.' + yyyy;
}
